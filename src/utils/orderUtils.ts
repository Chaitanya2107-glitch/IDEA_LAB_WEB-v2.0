import { authService } from '../services/api';

const PENDING_KEY = 'pending_payment_confirmation';
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Finishes a Razorpay payment whose confirmation was interrupted (for example when the
 * checkout reloaded the page). The server verifies the Razorpay signature before marking
 * the order paid; the Razorpay webhook also confirms it independently.
 */
export const recoverPendingPayment = async () => {
  const stored = localStorage.getItem(PENDING_KEY);
  if (!stored) return;
  try {
    const pending = JSON.parse(stored);
    if (!pending?.razorpay_signature || Date.now() - (pending.timestamp || 0) > PENDING_TTL_MS) {
      localStorage.removeItem(PENDING_KEY);
      return;
    }
    await authService.verifyPayment({
      razorpay_order_id: pending.razorpay_order_id,
      razorpay_payment_id: pending.razorpay_payment_id,
      razorpay_signature: pending.razorpay_signature,
    });
    localStorage.removeItem(PENDING_KEY);
  } catch (e) {
    console.error('[PaymentRecovery] Could not confirm payment yet:', e);
  }
};

/** Name of the staff member who last updated the order's status, if any. */
export const fetchOrderApprover = async (orderId: string): Promise<string | null> => {
  if (!orderId) return null;
  return authService.getPrintOrderApprover(orderId).catch(() => null);
};
