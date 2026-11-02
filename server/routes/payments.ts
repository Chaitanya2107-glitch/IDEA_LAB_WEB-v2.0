import express, { Router, type RequestHandler } from 'express';
import { collection, nowIso, toApi } from '../db.js';
import type { Deps } from '../deps.js';
import { principalOf, type Guards } from '../lib/auth.js';
import { HttpError, badRequest, body, idParam, notFound } from '../lib/http.js';
import { STALE_ORDER_MS } from './print.js';

// Server-side Razorpay flow for 3D print and PCB orders:
//   1. POST /api/payments/print-orders/:id/order  (or /pcb-orders/:id/order)
//                                                   -> Razorpay order for the amount stored in the DB
//   2. Checkout runs in the browser with that order_id
//   3. POST /api/payments/verify                   -> signature check, then the order is marked paid
//   4. POST /api/payments/razorpay/webhook         -> same, driven by Razorpay (covers closed tabs)
// The Razorpay order's notes say which of our orders it pays for.

const GATEWAY_ID = /^[A-Za-z0-9_]{1,64}$/;

function gatewayId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !GATEWAY_ID.test(value)) throw badRequest(`Invalid ${field}`);
  return value;
}

// What can be paid online. `paidStatus` is the order status once paid: a paid 3D print
// shows as "Paid"; a paid PCB order joins the fabrication queue.
const PAYABLE = {
  print: { collection: 'print_orders', note: 'print_order_id', receipt: 'print', paidStatus: 'Paid', label: 'print order' },
  pcb: { collection: 'pcb_orders', note: 'pcb_order_id', receipt: 'pcb', paidStatus: 'queued', label: 'PCB order' },
} as const;
type PayableKind = keyof typeof PAYABLE;

// Which of our orders a Razorpay order pays for, from the notes we set when creating it.
function payableFromNotes(notes: Record<string, unknown> | undefined): { kind: PayableKind; id: string } | null {
  for (const kind of Object.keys(PAYABLE) as PayableKind[]) {
    const id = notes?.[PAYABLE[kind].note];
    if (typeof id === 'string' && id) return { kind, id: idParam(id) };
  }
  return null;
}

function createMarkPaid(deps: Deps) {
  return async (kind: PayableKind, orderId: string, paymentId: string, amountPaise: number) => {
    const orders = collection(deps.db, PAYABLE[kind].collection);
    const order = await orders.findOne({ _id: orderId });
    if (!order) throw notFound('Order not found');
    if (order.payment_status === 'paid') return toApi(order);

    const expected = Math.round(Number(order.cost) * 100);
    if (expected !== amountPaise) {
      console.error(`[payments] amount mismatch for ${kind} ${orderId}: expected ${expected}, paid ${amountPaise}`);
      throw new HttpError(409, 'Payment amount does not match the order');
    }
    // Conditional update: a webhook and the browser confirming at once mark it paid once.
    const updated = await orders.findOneAndUpdate(
      { _id: orderId, payment_status: { $ne: 'paid' } },
      {
        $set: {
          status: PAYABLE[kind].paidStatus,
          payment_status: 'paid',
          payment_method: `Online: ${paymentId}`,
          payment_id: paymentId,
          paid_at: nowIso(),
          updated_at: nowIso(),
        },
      },
      { returnDocument: 'after' },
    );
    return toApi(updated ?? (await orders.findOne({ _id: orderId })));
  };
}

export function paymentRoutes(deps: Deps, guards: Guards): Router {
  const router = Router();
  const markPaid = createMarkPaid(deps);

  const startCheckout = (kind: PayableKind): RequestHandler => async (req, res) => {
    const principal = principalOf(req);
    const id = idParam(req.params.id);
    const order = await collection(deps.db, PAYABLE[kind].collection).findOne({ _id: id });
    if (!order || order.user_id !== principal.id) throw notFound('Order not found');
    if (order.payment_status === 'paid') throw new HttpError(409, 'This order is already paid');
    if (order.status !== 'pending_payment') throw new HttpError(409, 'This order can no longer be paid');
    if (Date.now() - new Date(order.created_at).getTime() > STALE_ORDER_MS) {
      throw new HttpError(409, 'This order expired before it was paid. Please place it again.');
    }

    const amount = Math.round(Number(order.cost) * 100);
    if (!Number.isInteger(amount) || amount <= 0) throw badRequest('Order has no payable amount');

    const gatewayOrder = await deps.payments.createOrder({
      amount,
      receipt: `${PAYABLE[kind].receipt}_${id}`.slice(0, 40),
      notes: { [PAYABLE[kind].note]: String(id), user_id: String(principal.id) },
    });
    res.json({
      keyId: deps.payments.keyId,
      orderId: gatewayOrder.id,
      amount: gatewayOrder.amount,
      currency: gatewayOrder.currency,
    });
  };

  router.post('/payments/print-orders/:id/order', guards.requireAuth, startCheckout('print'));
  router.post('/payments/pcb-orders/:id/order', guards.requireAuth, startCheckout('pcb'));

  router.post('/payments/verify', guards.requireAuth, async (req, res) => {
    const input = body(req);
    const orderId = gatewayId(input.razorpay_order_id, 'razorpay_order_id');
    const paymentId = gatewayId(input.razorpay_payment_id, 'razorpay_payment_id');
    const signature = typeof input.razorpay_signature === 'string' ? input.razorpay_signature : '';
    if (!deps.payments.configured) throw new HttpError(503, 'Online payments are not configured');
    if (!deps.payments.verifyPaymentSignature(orderId, paymentId, signature)) {
      throw badRequest('Payment verification failed');
    }

    const gatewayOrder = await deps.payments.fetchOrder(orderId);
    const target = payableFromNotes(gatewayOrder.notes);
    if (!target) throw badRequest('Payment is not linked to an order');
    const order = await markPaid(target.kind, target.id, paymentId, gatewayOrder.amount);
    res.json({ status: 'paid', kind: target.kind, order });
  });

  return router;
}

// Mounted ahead of express.json(): the signature is computed over the raw body.
export function paymentWebhook(deps: Deps): RequestHandler[] {
  const markPaid = createMarkPaid(deps);
  const handler: RequestHandler = async (req, res) => {
    const signature = req.get('x-razorpay-signature') ?? '';
    const raw = req.body;
    if (!Buffer.isBuffer(raw) || !signature || !deps.payments.verifyWebhookSignature(raw, signature)) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    let event: any;
    try {
      event = JSON.parse(raw.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Malformed JSON body' });
    }

    if (event?.event === 'order.paid' || event?.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      const gatewayOrder = event.payload?.order?.entity;
      const orderId: string | undefined = gatewayOrder?.id ?? payment?.order_id;
      const notes = gatewayOrder?.notes ?? (orderId ? (await deps.payments.fetchOrder(orderId)).notes : undefined);
      let target: ReturnType<typeof payableFromNotes> = null;
      try {
        target = payableFromNotes(notes);
      } catch {
        target = null; // malformed id in notes: not one of ours
      }

      if (target && typeof payment?.id === 'string' && typeof payment?.amount === 'number') {
        try {
          await markPaid(target.kind, target.id, payment.id, payment.amount);
        } catch (err) {
          // Client-type errors will never succeed on retry; acknowledge so Razorpay stops.
          if (err instanceof HttpError && err.status < 500) {
            console.error('[payments] webhook ignored:', err.message);
            return res.json({ status: 'ignored' });
          }
          throw err;
        }
      }
    }
    res.json({ status: 'ok' });
  };

  return [express.raw({ type: '*/*', limit: '1mb' }), handler];
}
