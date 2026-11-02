import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Config } from '../config.js';
import { HttpError } from './http.js';

export interface GatewayOrder {
  id: string;
  amount: number; // paise
  amount_paid?: number;
  currency: string;
  status: string;
  notes?: Record<string, string>;
}

export interface PaymentGateway {
  readonly configured: boolean;
  readonly keyId?: string;
  createOrder(input: {
    amount: number;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<GatewayOrder>;
  fetchOrder(orderId: string): Promise<GatewayOrder>;
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}

function safeEqualHex(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(actual, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createRazorpayGateway(config: Config): PaymentGateway {
  const { keyId, keySecret, webhookSecret, apiBase } = config.razorpay;
  const configured = Boolean(keyId && keySecret);

  const call = async (path: string, init?: RequestInit): Promise<GatewayOrder> => {
    if (!configured) throw new HttpError(503, 'Online payments are not configured');
    const res = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error('[razorpay]', res.status, await res.text().catch(() => ''));
      throw new HttpError(502, 'Payment provider request failed');
    }
    return (await res.json()) as GatewayOrder;
  };

  return {
    configured,
    keyId,
    createOrder: ({ amount, receipt, notes }) =>
      call('/orders', {
        method: 'POST',
        body: JSON.stringify({ amount, currency: 'INR', receipt, notes }),
      }),
    fetchOrder: (orderId) => call(`/orders/${encodeURIComponent(orderId)}`),
    verifyPaymentSignature(orderId, paymentId, signature) {
      if (!keySecret) return false;
      const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
      return safeEqualHex(expected, signature);
    },
    verifyWebhookSignature(rawBody, signature) {
      if (!webhookSecret) return false;
      const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      return safeEqualHex(expected, signature);
    },
  };
}
