import { authService } from '../services/api';

// Opens Razorpay Checkout for an order the server has already priced, then asks the server
// to verify the payment. Same steps as the 3D print page; the server's signature check
// (and Razorpay's webhook) decide whether the order is paid.

export type CheckoutResult = { outcome: 'paid' } | { outcome: 'dismissed' } | { outcome: 'failed'; message: string } | { outcome: 'unconfirmed' };

const PENDING_KEY = 'pending_payment_confirmation';

function loadScript(): Promise<boolean> {
  if ((window as any).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function payWithRazorpay(
  checkout: { keyId: string; orderId: string; amount: number; currency: string },
  details: { description: string; name?: string; email?: string },
): Promise<CheckoutResult> {
  if (!(await loadScript())) return { outcome: 'failed', message: 'Could not load the payment window. Are you online?' };

  return new Promise<CheckoutResult>((resolve) => {
    let settled = false;
    const finish = (result: CheckoutResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const razorpay = new (window as any).Razorpay({
      key: checkout.keyId,
      order_id: checkout.orderId,
      amount: checkout.amount, // paise
      currency: checkout.currency,
      name: 'REVA IDEA Lab',
      description: details.description,
      image: '/img/logo_orange_new.png',
      prefill: { name: details.name ?? '', email: details.email ?? '' },
      theme: { color: '#ea580c' },
      handler: async (response: any) => {
        const payment = {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        };
        // Saved first: if the page reloads, the dashboard finishes the confirmation.
        localStorage.setItem(PENDING_KEY, JSON.stringify({ ...payment, timestamp: Date.now() }));
        try {
          await authService.verifyPayment(payment);
          localStorage.removeItem(PENDING_KEY);
          finish({ outcome: 'paid' });
        } catch {
          finish({ outcome: 'unconfirmed' });
        }
      },
      modal: { ondismiss: () => finish({ outcome: 'dismissed' }) },
    });
    razorpay.on('payment.failed', (response: any) =>
      finish({ outcome: 'failed', message: response?.error?.description || 'Payment failed' }),
    );
    razorpay.open();
  });
}
