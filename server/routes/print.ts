import { Router, type Request } from 'express';
import { collection, newId, nowIso, toApi, toApiList, type Doc } from '../db.js';
import type { Deps } from '../deps.js';
import { isStaff, principalOf, type Guards } from '../lib/auth.js';
import {
  HttpError,
  badRequest,
  body,
  compact,
  idParam,
  isPlainObject,
  notFound,
  oneOf,
  optNumber,
  optString,
  reqString,
} from '../lib/http.js';
import { ACCESS } from '../lib/roles.js';
import { PRINT_QUALITIES, StlError, analyzeStl, quotePrint } from '../lib/stl.js';
import { assertKey, signedDownloadPath } from '../lib/storage.js';
import { MAX_STL_BYTES } from './storage.js';

// Unpaid orders are cancelled after this long. Long enough for UPI/netbanking checkouts.
export const STALE_ORDER_MS = 30 * 60 * 1000;

const STAFF_STATUSES = ['queued', 'printing', 'completed', 'rejected'] as const;

function materialPayload(input: Record<string, any>) {
  let colors: unknown;
  if (input.colors !== undefined) {
    if (!Array.isArray(input.colors) || input.colors.length > 50) {
      throw badRequest('colors must be a list of at most 50 colours');
    }
    colors = input.colors.map((c: unknown) => {
      if (typeof c === 'string') return c.slice(0, 50);
      if (!isPlainObject(c)) throw badRequest('Invalid colour');
      return { name: optString(c.name, 'colour name', 50), hex: optString(c.hex, 'colour hex', 20) };
    });
  }
  return compact({
    name: optString(input.name, 'name', 100) ?? undefined,
    description: optString(input.description, 'description', 1000),
    density: optNumber(input.density, 'density', { min: 0.1, max: 25 }),
    price_per_gram: optNumber(input.price_per_gram, 'price_per_gram', { min: 0, max: 10_000 }),
    colors,
  });
}

export function printRoutes(deps: Deps, guards: Guards): Router {
  const router = Router();
  const { db, files, config } = deps;
  const materials = collection(db, 'print_materials_config');
  const orders = collection(db, 'print_orders');
  const stlFiles = collection(db, 'stl_files');
  const users = collection(db, 'users');
  const activity = collection(db, 'activity_log');
  const reviewer = guards.requireStaff(...ACCESS.printOrderReview);

  /* ---------------- Material configuration ---------------- */

  router.get('/print-materials', async (_req, res) => {
    res.json(toApiList(await materials.find({}).sort({ name: 1 }).toArray()));
  });

  router.post('/print-materials', reviewer, async (req, res) => {
    const payload = materialPayload(body(req));
    if (!payload.name) throw badRequest('name is required');
    const doc = { _id: newId(), ...payload, created_at: nowIso() };
    await materials.insertOne(doc);
    res.status(201).json(toApi(doc));
  });

  router.put('/print-materials/:id', reviewer, async (req, res) => {
    const doc = await materials.findOneAndUpdate(
      { _id: idParam(req.params.id) },
      { $set: materialPayload(body(req)) },
      { returnDocument: 'after' },
    );
    if (!doc) throw notFound('Material not found');
    res.json(toApi(doc));
  });

  router.delete('/print-materials/:id', reviewer, async (req, res) => {
    const { deletedCount } = await materials.deleteOne({ _id: idParam(req.params.id) });
    if (!deletedCount) throw notFound('Material not found');
    res.json({ message: 'Deleted' });
  });

  /* ---------------- Print orders ---------------- */

  const cancelStaleOrders = () =>
    orders.updateMany(
      { status: 'pending_payment', created_at: { $lt: new Date(Date.now() - STALE_ORDER_MS).toISOString() } },
      { $set: { status: 'cancelled', updated_at: nowIso() } },
    );

  // Joins in the STL file and the requester, in the flat shape the dashboards render.
  const withDetails = async (list: Doc[]) => {
    const stlIds = [...new Set(list.map((o) => o.stl_file_id).filter(Boolean))];
    const userIds = [...new Set(list.map((o) => o.user_id).filter(Boolean))];
    const [fileDocs, userDocs]: Doc[][] = await Promise.all([
      stlIds.length ? stlFiles.find({ _id: { $in: stlIds } }).toArray() : Promise.resolve([]),
      userIds.length
        ? users.find({ _id: { $in: userIds } }, { projection: { name: 1, email: 1 } }).toArray()
        : Promise.resolve([]),
    ]);
    const fileById = new Map<string, Doc>(fileDocs.map((f) => [f._id, f]));
    const userById = new Map<string, Doc>(userDocs.map((u) => [u._id, u]));
    return list.map((o): Record<string, any> => {
      const file: any = fileById.get(o.stl_file_id) ?? {};
      const user: any = userById.get(o.user_id) ?? {};
      return {
        ...toApi(o),
        file_name: file.filename ?? o.file_name ?? null,
        storage_path: file.storage_path ?? null,
        volume: file.volume ?? null,
        weight: file.weight ?? null,
        user_name: user.name ?? null,
        user_email: user.email ?? null,
        quality: o.quality ?? 'Standard',
      };
    });
  };

  router.get('/print-orders', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    await cancelStaleOrders();
    // Lab staff see the whole queue; everyone else sees their own orders.
    const filter = isStaff(principal, ...ACCESS.printOrderReview) ? {} : { user_id: principal.id };
    res.json(await withDetails(await orders.find(filter).sort({ created_at: -1 }).toArray()));
  });

  router.post('/print-orders', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    const input = body(req);

    // Must be this user's own upload (paths are "<user id>/<file>").
    const storagePath = reqString(input.storagePath, 'storagePath', 1024);
    const segments = storagePath.split('/');
    if (segments.length !== 2 || segments[0] !== String(principal.id)) throw badRequest('Upload the model first');
    assertKey(storagePath);

    const fileName = reqString(input.fileName, 'fileName', 255);
    const infill = optNumber(input.infill, 'infill', { min: 0, max: 100, integer: true }) ?? 20;
    const scale = optNumber(input.scale, 'scale', { min: 10, max: 500 }) ?? 100;
    const qualityId = oneOf(input.quality ?? '0.2-std', 'quality', Object.keys(PRINT_QUALITIES))!;

    const material = await materials.findOne({ _id: idParam(input.materialId, 'materialId') });
    if (!material) throw badRequest('Unknown material');
    const colors: any[] = Array.isArray(material.colors) ? material.colors : [];
    const colorName = optString(input.color, 'color', 50);
    const color =
      colors.map((c) => (typeof c === 'string' ? c : c?.name)).find((name) => name && name === colorName) ?? 'Standard';

    // Price from the uploaded file itself, not from the browser's numbers.
    const buffer = await files.read('stl-files', storagePath, MAX_STL_BYTES);
    if (!buffer) throw badRequest('Uploaded model not found. Please upload it again.');
    let analysis;
    try {
      analysis = analyzeStl(buffer);
    } catch (err) {
      if (err instanceof StlError) throw badRequest(err.message);
      throw err;
    }
    const quote = quotePrint({
      volumeCm3: analysis.volumeCm3,
      scalePercent: scale,
      infillPercent: infill,
      density: material.density,
      pricePerGram: material.price_per_gram,
      qualityMultiplier: PRINT_QUALITIES[qualityId],
    });

    const stlFile = {
      _id: newId(),
      tenant_id: principal.tenantId,
      user_id: principal.id,
      filename: fileName,
      storage_path: storagePath,
      volume: quote.volumeCm3,
      weight: quote.weightGrams,
      price: quote.cost,
      created_at: nowIso(),
    };
    await stlFiles.insertOne(stlFile);
    const order = {
      _id: newId(),
      tenant_id: principal.tenantId,
      user_id: principal.id,
      stl_file_id: stlFile._id,
      material: material.name,
      color,
      infill,
      cost: quote.cost,
      status: 'pending_payment',
      payment_status: 'pending',
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await orders.insertOne(order);
    res.status(201).json({ ...toApi(order), file_name: fileName, weight: quote.weightGrams, volume: quote.volumeCm3 });
  });

  router.put('/print-orders/:id/status', reviewer, async (req, res) => {
    const staff = principalOf(req);
    const input = body(req);
    const status = oneOf(input.status, 'status', STAFF_STATUSES);
    if (!status) throw badRequest('status is required');
    const current = await orders.findOne({ _id: idParam(req.params.id) });
    if (!current) throw notFound('Order not found');
    // An online order that was never paid cannot be printed (only rejected).
    if (['pending_payment', 'cancelled'].includes(current.status) && current.payment_status !== 'paid' && status !== 'rejected') {
      throw new HttpError(409, 'This order has not been paid yet');
    }
    const updates = compact({
      status,
      rejection_reason: optString(input.rejectionReason ?? input.rejection_reason, 'rejectionReason', 1000),
      updated_at: nowIso(),
    });
    const order = await orders.findOneAndUpdate({ _id: idParam(req.params.id) }, { $set: updates }, { returnDocument: 'after' });
    if (!order) throw notFound('Order not found');
    const [detailed] = await withDetails([order]);

    // Audit trail the student's order view reads the approver name from.
    await activity.insertOne({
      _id: newId(),
      action: 'Status Update',
      actorId: staff.id,
      actorName: staff.name,
      targetId: order._id,
      targetName: detailed.file_name ?? 'Order',
      details: `Set status to ${status}`,
      type: status === 'rejected' ? 'rejection' : 'approval',
      timestamp: nowIso(),
    });

    res.json(detailed);
  });

  const loadVisibleOrder = async (req: Request) => {
    const principal = principalOf(req);
    const order = await orders.findOne({ _id: idParam(req.params.id) });
    if (!order || (order.user_id !== principal.id && !isStaff(principal, ...ACCESS.printOrderReview))) {
      throw notFound('Order not found');
    }
    const [detailed] = await withDetails([order]);
    return detailed;
  };

  router.get('/print-orders/:id/approver', guards.requireAuth, async (req, res) => {
    const order = await loadVisibleOrder(req);
    const entry = await activity.findOne(
      { action: 'Status Update', $or: [{ targetId: order.id }, { targetName: order.file_name ?? '\u0000' }] },
      { sort: { timestamp: -1 } },
    );
    res.json({ name: entry?.actorName ?? null });
  });

  router.get('/print-orders/:id/download', reviewer, async (req, res) => {
    const order = await loadVisibleOrder(req);
    if (!order.storage_path) throw notFound('This order has no model file');
    if ((await files.size('stl-files', order.storage_path)) === null) throw notFound('The model file is missing');
    res.json({ url: signedDownloadPath(config.jwtSecret, 'stl-files', order.storage_path) });
  });

  return router;
}
