import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { collection, newId, nowIso, toApi, toApiList, type Doc } from '../db.js';
import type { Deps } from '../deps.js';
import { isStaff, principalOf, type Guards } from '../lib/auth.js';
import {
  HttpError,
  badRequest,
  body,
  compact,
  forbidden,
  idParam,
  isPlainObject,
  notFound,
  oneOf,
  optBoolean,
  optDate,
  optNumber,
  optString,
  optTime,
  optUrl,
  reqString,
} from '../lib/http.js';
import { ACCESS } from '../lib/roles.js';
import { signedDownloadPath } from '../lib/storage.js';
import { STALE_ORDER_MS } from './print.js';

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

// Accepts the camelCase keys the dashboard sends as well as the snake_case fields.
function inventoryPayload(input: Record<string, any>) {
  const pick = (camel: string, snake = camel) => (input[camel] !== undefined ? input[camel] : input[snake]);
  return compact({
    name: optString(input.name, 'name', 200) ?? undefined,
    description: optString(input.description, 'description', 2000),
    category: optString(input.category, 'category', 100),
    type: optString(input.type, 'type', 50),
    total_quantity: optNumber(pick('totalQuantity', 'total_quantity'), 'totalQuantity', { integer: true, max: 1e7 }),
    available_quantity: optNumber(pick('availableQuantity', 'available_quantity'), 'availableQuantity', {
      integer: true,
      max: 1e7,
    }),
    cost_per_unit: optNumber(pick('costPerUnit', 'cost_per_unit'), 'costPerUnit', { max: 1e8 }),
    unit: optString(input.unit, 'unit', 30),
    location: optString(input.location, 'location', 200),
    room_no: optString(input.room_no, 'room_no', 50),
    status: optString(input.status, 'status', 50),
    is_rentable: optBoolean(input.is_rentable, 'is_rentable'),
    image_url: optUrl(input.image_url, 'image_url'),
    specification: optString(input.specification, 'specification', 5000),
    brand: optString(input.brand, 'brand', 200),
    asset_id: optString(input.asset_id, 'asset_id', 100),
    bill_number: optString(pick('billNumber', 'bill_number'), 'billNumber', 100),
    purchase_order: optString(pick('purchaseOrder', 'purchase_order'), 'purchaseOrder', 100),
    purchase_date: optString(pick('purchaseDate', 'purchase_date'), 'purchaseDate', 40),
    invoice_url: optUrl(pick('invoiceUrl', 'invoice_url'), 'invoiceUrl'),
  });
}

/* ------------------------------------------------------------------ */
/* PCB pricing (server-side so clients cannot choose their own price)  */
/* ------------------------------------------------------------------ */

export function pcbPrice(spec: { lengthMm: number; widthMm: number; layers: number; quantity: number; surfaceFinish: string }) {
  const area = spec.lengthMm * spec.widthMm;
  const basePrice = 500;
  const areaCost = (area / 100) * 0.5;
  const layerMultiplier = spec.layers * 0.5;
  const quantityMultiplier = spec.quantity * 0.8;
  const finishMultiplier = spec.surfaceFinish.includes('ENIG') ? 1.5 : 1;
  return Math.round((basePrice + areaCost * layerMultiplier) * quantityMultiplier * finishMultiplier);
}

function pcbOrderView(doc: Doc) {
  return {
    id: doc._id,
    fileName: doc.file_name,
    user_id: doc.user_id,
    user_name: doc.user_name,
    tenant_id: doc.tenant_id,
    storagePath: doc.storage_path,
    status: doc.status,
    specs: doc.specs ?? {},
    cost: Number(doc.cost ?? 0),
    submitDate: doc.created_at,
    paymentStatus: doc.payment_status,
    paymentMethod: doc.payment_method ?? null,
    paidAt: doc.paid_at ?? null,
    hasDesignFile: Boolean(doc.storage_path),
    rejectionReason: doc.rejection_reason ?? undefined,
  };
}

// Today's date in India (YYYY-MM-DD), for "no bookings in the past".
const todayIst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/* ---------------- Slot booking: one booking per time slot for the whole lab ---------------- */

// Bookings that hold their time; rejected and cancelled ones free it.
const ACTIVE_SLOT_STATUSES = ['pending', 'approved'];
// So one account cannot hold the lab: a few upcoming bookings each, not too far ahead.
export const MAX_ACTIVE_BOOKINGS_PER_STUDENT = 3;
export const MAX_DAYS_AHEAD = 60;
const CELL_MINUTES = 30;
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// Half-hour cells a booking covers. Bookings without times (older data) hold the whole day.
export function slotCells(start?: string | null, end?: string | null): number[] {
  const from = start ? minutesOf(start) : 0;
  const to = end ? minutesOf(end) : 24 * 60;
  const cells: number[] = [];
  for (let m = Math.floor(from / CELL_MINUTES) * CELL_MINUTES; m < to; m += CELL_MINUTES) cells.push(m / CELL_MINUTES);
  return cells;
}

type TimeRange = { start_time?: string | null; end_time?: string | null };
const slotsOverlap = (a: TimeRange, b: TimeRange) => {
  const taken = new Set(slotCells(a.start_time, a.end_time));
  return slotCells(b.start_time, b.end_time).some((c) => taken.has(c));
};

export function labRoutes(deps: Deps, guards: Guards): Router {
  const router = Router();
  const { db, config } = deps;
  const inventory = collection(db, 'inventory');
  const slots = collection(db, 'slot_bookings');
  const blockedDates = collection(db, 'blocked_dates');
  const closures = collection(db, 'lab_closures');
  const indents = collection(db, 'indents');
  const notifications = collection(db, 'notifications');
  const machineUsage = collection(db, 'machine_usage');
  const pcbOrders = collection(db, 'pcb_orders');
  const inventoryWrite = guards.requireStaff(...ACCESS.inventoryWrite);

  /* ---------------- Inventory ---------------- */

  router.get('/inventory', guards.requireAuth, async (_req, res) => {
    res.json(toApiList(await inventory.find({}).sort({ name: 1 }).toArray()));
  });

  router.post('/inventory', inventoryWrite, async (req, res) => {
    const payload = inventoryPayload(body(req));
    if (!payload.name) throw badRequest('name is required');
    const doc = { _id: newId(), ...payload, tenant_id: config.tenantId, created_at: nowIso(), updated_at: nowIso() };
    await inventory.insertOne(doc);
    res.status(201).json(toApi(doc));
  });

  // Declared before /inventory/:id.
  router.delete('/inventory/batch-delete', inventoryWrite, async (req, res) => {
    const { ids } = body(req);
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
      throw badRequest('ids must be an array of 1 to 500 item ids');
    }
    const validIds = ids.map((id) => idParam(id, 'item id'));
    const { deletedCount } = await inventory.deleteMany({ _id: { $in: validIds } });
    res.json({ message: `Deleted ${deletedCount} items` });
  });

  router.put('/inventory/:id', inventoryWrite, async (req, res) => {
    const payload = inventoryPayload(body(req));
    const doc = await inventory.findOneAndUpdate(
      { _id: idParam(req.params.id) },
      { $set: { ...payload, updated_at: nowIso() } },
      { returnDocument: 'after' },
    );
    if (!doc) throw notFound('Inventory item not found');
    res.json(toApi(doc));
  });

  router.delete('/inventory/:id', inventoryWrite, async (req, res) => {
    const { deletedCount } = await inventory.deleteOne({ _id: idParam(req.params.id) });
    if (!deletedCount) throw notFound('Inventory item not found');
    res.json({ message: 'Deleted' });
  });

  /* ---------------- Slot bookings ---------------- */

  router.get('/slots/blocked', async (_req, res) => {
    const docs = await blockedDates.find({}).sort({ date: 1 }).toArray();
    res.json(docs.map((d) => d.date));
  });

  // Public availability calendar: which dates are booked, without who booked them.
  router.get('/slots/calendar', async (_req, res) => {
    const docs = await slots
      .find(
        { status: { $in: ACTIVE_SLOT_STATUSES } },
        { projection: { _id: 0, date: 1, status: 1, purpose: 1, start_time: 1, end_time: 1 } },
      )
      .toArray();
    // start_time/end_time let the booking form grey out taken slots (null = whole day).
    res.json(
      docs.map((d) => ({ date: d.date, status: d.status, purpose: d.purpose, start_time: d.start_time ?? null, end_time: d.end_time ?? null })),
    );
  });

  router.get('/slots', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    // Staff see every request; students only their own.
    const filter = isStaff(principal) ? {} : { user_id: principal.id };
    res.json(toApiList(await slots.find(filter).sort({ date: -1 }).toArray()));
  });

  router.post('/slots', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    // Lab time is for REVA students and staff (general-access visitors use public services).
    if (principal.kind === 'user' && principal.record.type === 'non-university') {
      throw forbidden('Lab slot booking is only for REVA students. Sign in with your REVA Microsoft account.');
    }
    const input = body(req);
    const dateInput = optDate(input.bookingDate ?? input.date, 'bookingDate');
    if (!dateInput) throw badRequest('bookingDate is required');
    const date = dateInput.slice(0, 10);
    if (date < todayIst()) throw badRequest('bookingDate cannot be in the past');
    const lastDay = new Date(Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (date > lastDay) throw badRequest(`Bookings can be made up to ${MAX_DAYS_AHEAD} days ahead`);
    if (!isStaff(principal)) {
      const active = await slots.countDocuments({ user_id: principal.id, status: { $in: ACTIVE_SLOT_STATUSES }, date: { $gte: todayIst() } });
      if (active >= MAX_ACTIVE_BOOKINGS_PER_STUDENT) {
        throw new HttpError(409, `You already have ${MAX_ACTIVE_BOOKINGS_PER_STUDENT} upcoming bookings. Cancel one to book another.`);
      }
    }
    if (await blockedDates.findOne({ date })) throw new HttpError(409, 'The lab is closed on this date');
    if (await closures.findOne({ date })) throw new HttpError(409, 'The lab is closed on this date');

    const sessionType = optString(input.sessionType, 'sessionType', 50);
    const purpose = reqString(input.purpose, 'purpose', 1000);
    const startTime = optTime(input.startTime ?? input.start_time, 'startTime');
    const endTime = optTime(input.endTime ?? input.end_time, 'endTime');
    if (!startTime || !endTime) throw badRequest('startTime and endTime are required');
    if (minutesOf(startTime) >= minutesOf(endTime)) throw badRequest('endTime must be after startTime');
    const doc = {
      _id: newId(),
      tenant_id: principal.tenantId,
      user_id: principal.id,
      user_name: principal.name,
      date,
      start_time: startTime.slice(0, 5),
      end_time: endTime.slice(0, 5),
      purpose: sessionType ? `[${sessionType}] ${purpose}` : purpose,
      attendees: optNumber(input.attendees, 'attendees', { min: 1, max: 200, integer: true }) ?? 1,
      status: 'pending',
      request_date: nowIso(),
      created_at: nowIso(),
    };
    await holdSlot(doc);
    try {
      await slots.insertOne(doc);
    } catch (err) {
      await releaseSlot(doc._id);
      throw err;
    }
    res.status(201).json(toApi(doc));
  });

  const heldCells = collection(db, 'slot_cells');
  const slotTaken = () =>
    new HttpError(409, 'This time slot is already booked. Please choose another time or date.');

  // Claims every half hour the booking covers. Two requests for overlapping times cannot
  // both succeed: the cell ids are unique, so the second insert fails and is rolled back.
  const holdSlot = async (booking: Doc) => {
    // Also covers older bookings that were stored before time slots were held.
    const sameDay = await slots
      .find({ _id: { $ne: booking._id }, date: booking.date, status: { $in: ACTIVE_SLOT_STATUSES } })
      .toArray();
    if (sameDay.some((other) => slotsOverlap(other as TimeRange, booking as TimeRange))) throw slotTaken();
    const cells = slotCells(booking.start_time, booking.end_time).map((cell) => ({
      _id: `${booking.date}|${cell}`,
      booking_id: booking._id,
      date: booking.date,
      created_at: nowIso(),
    }));
    try {
      await heldCells.insertMany(cells, { ordered: true });
    } catch (err: any) {
      await releaseSlot(booking._id);
      if (err?.code === 11000) throw slotTaken();
      throw err;
    }
  };
  const releaseSlot = (bookingId: string) => heldCells.deleteMany({ booking_id: bookingId });

  const reviewSlot = async (id: string, input: Record<string, any>) => {
    const updates = compact({
      status: oneOf(input.status, 'status', ['pending', 'approved', 'rejected'] as const),
      rejection_reason: optString(input.rejectionReason ?? input.rejection_reason, 'rejectionReason', 1000),
    });
    if (!Object.keys(updates).length) throw badRequest('Nothing to update');
    const current = await slots.findOne({ _id: id });
    if (!current) throw notFound('Slot booking not found');
    const wasActive = ACTIVE_SLOT_STATUSES.includes(current.status);
    const willBeActive = ACTIVE_SLOT_STATUSES.includes(updates.status ?? current.status);
    // Re-opening a rejected/cancelled booking must win the time slot back first.
    if (!wasActive && willBeActive) await holdSlot(current);
    const doc = await slots.findOneAndUpdate({ _id: id }, { $set: { ...updates, updated_at: nowIso() } }, { returnDocument: 'after' });
    if (wasActive && !willBeActive) await releaseSlot(id);
    return toApi(doc!);
  };

  // Students cancel their own upcoming booking, which frees the time slot.
  router.post('/slots/:id/cancel', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    const id = idParam(req.params.id);
    const booking = await slots.findOne({ _id: id });
    if (!booking || booking.user_id !== principal.id) throw notFound('Slot booking not found');
    if (!ACTIVE_SLOT_STATUSES.includes(booking.status)) throw new HttpError(409, 'This booking is not active');
    if (booking.date < todayIst()) throw new HttpError(409, 'Past bookings cannot be cancelled');
    const doc = await slots.findOneAndUpdate(
      { _id: id, status: { $in: ACTIVE_SLOT_STATUSES } },
      { $set: { status: 'cancelled', cancelled_at: nowIso(), updated_at: nowIso() } },
      { returnDocument: 'after' },
    );
    await releaseSlot(id);
    res.json(toApi(doc ?? booking));
  });

  // The dashboard sends PUT /api/slots?id=<id>; /api/slots/:id is also accepted.
  router.put('/slots', guards.requireStaff(...ACCESS.slotReview), async (req, res) => {
    res.json(await reviewSlot(idParam(req.query.id), body(req)));
  });
  router.put('/slots/:id', guards.requireStaff(...ACCESS.slotReview), async (req, res) => {
    res.json(await reviewSlot(idParam(req.params.id), body(req)));
  });

  /* ---------------- Lab closures ---------------- */

  router.get('/lab-closures', async (_req, res) => {
    res.json(toApiList(await closures.find({}).sort({ date: 1 }).toArray()));
  });

  router.post('/lab-closures', guards.requireStaff(...ACCESS.eventsWrite), async (req, res) => {
    const staff = principalOf(req);
    const input = body(req);
    const date = optDate(input.date, 'date');
    if (!date) throw badRequest('date is required');
    const doc = await closures.findOneAndUpdate(
      { date: date.slice(0, 10) },
      {
        $set: {
          reason: reqString(input.reason, 'reason', 300),
          closure_type: optString(input.closure_type, 'closure_type', 50) ?? 'other',
          created_by: staff.id,
          updated_at: nowIso(),
        },
        $setOnInsert: { _id: newId(), created_at: nowIso() },
      },
      { upsert: true, returnDocument: 'after' },
    );
    res.status(201).json(toApi(doc));
  });

  router.delete('/lab-closures/:id', guards.requireStaff(...ACCESS.eventsWrite), async (req, res) => {
    const { deletedCount } = await closures.deleteOne({ _id: idParam(req.params.id) });
    if (!deletedCount) throw notFound('Closure not found');
    res.json({ message: 'Deleted' });
  });

  /* ---------------- Indents (component requests) ---------------- */

  router.get('/indents', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    const filter = isStaff(principal) ? {} : { user_id: principal.id };
    res.json(toApiList(await indents.find(filter).sort({ created_at: -1 }).toArray()));
  });

  router.post('/indents', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    // Borrowing components is for REVA students (the catalog is hidden for general access).
    if (principal.kind === 'user' && principal.record.type === 'non-university') {
      throw forbidden('Borrowing components is only for REVA students. Sign in with your REVA Microsoft account.');
    }
    const input = body(req);
    const cart = input.items_json ?? input.items;
    if (!Array.isArray(cart) || cart.length === 0 || cart.length > 100) {
      throw badRequest('items_json must list 1 to 100 items');
    }
    const requested = cart.map((item: unknown) => {
      if (!isPlainObject(item)) throw badRequest('Invalid item in items_json');
      return {
        id: idParam(item.id, 'item id'),
        quantity: optNumber(item.quantity, 'quantity', { min: 1, max: 1000, integer: true }) ?? 1,
      };
    });

    // Price the request from the inventory, not from the client.
    const stock = await inventory.find({ _id: { $in: requested.map((r) => r.id) } }).toArray();
    const byId = new Map(stock.map((s) => [s._id, s]));
    const items = requested.map((r) => {
      const item = byId.get(r.id);
      if (!item) throw badRequest(`Unknown inventory item: ${r.id}`);
      return {
        id: r.id,
        name: item.name,
        category: item.category,
        type: item.type,
        quantity: r.quantity,
        costPerUnit: Number(item.cost_per_unit ?? 0),
      };
    });
    const totalCost = items.reduce((sum, i) => sum + i.costPerUnit * i.quantity, 0);

    const doc = {
      _id: `IND-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`,
      user_id: principal.id,
      user_name: principal.name,
      tenant_id: principal.tenantId,
      projectTitle: reqString(input.projectTitle, 'projectTitle', 300),
      supervisor: optString(input.supervisor, 'supervisor', 200) ?? null,
      purpose: optString(input.purpose, 'purpose', 2000) ?? null,
      items_json: items,
      requestDate: new Date().toLocaleDateString('en-IN'),
      status: 'pending',
      paymentStatus: totalCost > 0 ? 'pending' : 'na',
      totalCost,
      created_at: nowIso(),
    };
    await indents.insertOne(doc);
    res.status(201).json(toApi(doc));
  });

  /* ---------------- Notifications & stats ---------------- */

  router.get('/notifications', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    const filter = isStaff(principal) ? {} : { user_id: principal.id };
    res.json(toApiList(await notifications.find(filter).sort({ timestamp: -1 }).limit(200).toArray()));
  });

  router.get('/stats/machine-usage', guards.requireStaff(), async (_req, res) => {
    res.json(toApiList(await machineUsage.find({}).toArray()));
  });

  /* ---------------- PCB orders ---------------- */

  // Unpaid online PCB orders are cancelled after 30 minutes, like 3D print orders.
  const cancelStalePcbOrders = () =>
    pcbOrders.updateMany(
      { status: 'pending_payment', created_at: { $lt: new Date(Date.now() - STALE_ORDER_MS).toISOString() } },
      { $set: { status: 'cancelled', updated_at: nowIso() } },
    );

  router.get('/pcb-orders', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    await cancelStalePcbOrders();
    const filter = isStaff(principal) ? {} : { user_id: principal.id };
    const docs = await pcbOrders.find(filter).sort({ created_at: -1 }).toArray();
    res.json(docs.map(pcbOrderView));
  });

  router.post('/pcb-orders', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    const input = body(req);
    const specsIn = input.specs;
    if (!isPlainObject(specsIn)) throw badRequest('specs is required');

    // Length-capped and unambiguous: the previous pattern backtracked catastrophically
    // on long inputs (a single request could stall the server).
    const dimensions = optString(specsIn.dimensions, 'specs.dimensions', 24) ?? '';
    const dims = /^(\d{1,4}(?:\.\d{1,2})?) ?x ?(\d{1,4}(?:\.\d{1,2})?) ?(?:mm)?$/i.exec(dimensions);
    if (!dims) throw badRequest('specs.dimensions must look like "100x100mm"');
    const lengthMm = Number(dims[1]);
    const widthMm = Number(dims[2]);
    if (lengthMm < 5 || widthMm < 5 || lengthMm > 1000 || widthMm > 1000) {
      throw badRequest('Board dimensions must be between 5mm and 1000mm');
    }
    const layers = optNumber(specsIn.layers, 'specs.layers', { min: 1, max: 16, integer: true }) ?? 2;
    const quantity = optNumber(specsIn.quantity, 'specs.quantity', { min: 1, max: 1000, integer: true }) ?? 1;
    const surfaceFinish = optString(specsIn.surfaceFinish, 'specs.surfaceFinish', 50) ?? 'HASL';

    const specs = {
      material: optString(specsIn.material, 'specs.material', 50) ?? 'FR-4',
      layers,
      dimensions: `${lengthMm}x${widthMm}mm`,
      quantity,
      thickness: optString(specsIn.thickness, 'specs.thickness', 20) ?? null,
      copperWeight: optString(specsIn.copperWeight, 'specs.copperWeight', 20) ?? null,
      solderMaskColor: optString(specsIn.solderMaskColor, 'specs.solderMaskColor', 30) ?? null,
      silkscreenColor: optString(specsIn.silkscreenColor, 'specs.silkscreenColor', 30) ?? null,
      surfaceFinish,
    };

    // The design file must be one this student uploaded (POST /api/uploads, bucket pcb-files).
    const storagePath = optString(input.storagePath ?? input.storage_path, 'storagePath', 1024) ?? null;
    if (storagePath) {
      if (!storagePath.startsWith(`${principal.id}/`)) throw forbidden('That design file belongs to another account');
      if ((await deps.files.size('pcb-files', storagePath).catch(() => null)) === null) {
        throw badRequest('The design file was not found. Please upload it again.');
      }
    }
    // "online": pay now with Razorpay (order waits in pending_payment); "lab": pay at the lab.
    const paymentMethod = oneOf(input.paymentMethod ?? 'lab', 'paymentMethod', ['online', 'lab'] as const)!;
    if (paymentMethod === 'online' && !deps.payments.configured) {
      throw new HttpError(503, 'Online payments are not configured. Choose "Pay at Lab".');
    }

    const doc = {
      _id: newId(),
      tenant_id: principal.tenantId,
      user_id: principal.id,
      user_name: principal.name,
      file_name: reqString(input.fileName ?? input.file_name, 'fileName', 255),
      storage_path: storagePath,
      specs,
      cost: pcbPrice({ lengthMm, widthMm, layers, quantity, surfaceFinish }),
      status: paymentMethod === 'online' ? 'pending_payment' : 'queued',
      payment_status: 'pending',
      payment_method: paymentMethod === 'online' ? 'Online (pending)' : 'At lab',
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await pcbOrders.insertOne(doc);
    res.status(201).json(pcbOrderView(doc));
  });

  // Lab staff download the student's design files through a short-lived signed link.
  router.get('/pcb-orders/:id/download', guards.requireStaff(...ACCESS.printOrderReview), async (req, res) => {
    const order = await pcbOrders.findOne({ _id: idParam(req.params.id) });
    if (!order) throw notFound('PCB order not found');
    if (!order.storage_path || (await deps.files.size('pcb-files', order.storage_path).catch(() => null)) === null) {
      throw notFound('No design file was uploaded for this order');
    }
    res.json({ url: signedDownloadPath(config.jwtSecret, 'pcb-files', order.storage_path) });
  });

  router.put('/pcb-orders/:id', guards.requireStaff(...ACCESS.printOrderReview), async (req, res) => {
    const input = body(req);
    const updates = compact({
      status: oneOf(input.status, 'status', ['queued', 'processing', 'completed', 'rejected'] as const),
      payment_status: oneOf(input.paymentStatus ?? input.payment_status, 'paymentStatus', ['pending', 'paid'] as const),
      rejection_reason: optString(input.rejectionReason ?? input.rejection_reason, 'rejectionReason', 1000),
    });
    if (!Object.keys(updates).length) throw badRequest('Nothing to update');
    const current = await pcbOrders.findOne({ _id: idParam(req.params.id) });
    if (!current) throw notFound('PCB order not found');
    // Online orders that were never paid cannot be fabricated or marked paid by hand
    // (Razorpay confirms online payments); staff can only reject them.
    if (['pending_payment', 'cancelled'].includes(current.status) && current.payment_status !== 'paid') {
      if (updates.payment_status === 'paid' || (updates.status && updates.status !== 'rejected')) {
        throw new HttpError(409, 'This online order has not been paid yet');
      }
    }
    const doc = await pcbOrders.findOneAndUpdate(
      { _id: idParam(req.params.id) },
      { $set: { ...updates, updated_at: nowIso() } },
      { returnDocument: 'after' },
    );
    if (!doc) throw notFound('PCB order not found');
    res.json(pcbOrderView(doc));
  });

  return router;
}
