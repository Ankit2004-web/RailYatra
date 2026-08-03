const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptPromise = null;

export function loadRazorpayScript() {
  if (typeof window !== 'undefined' && window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }

  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error('Razorpay SDK failed to initialize'));
    };
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Opens Razorpay checkout modal and resolves with payment response on success.
 */
export async function openRazorpayCheckout({
  key,
  orderId,
  amount,
  currency = 'INR',
  name = 'RailYatra',
  description,
  prefill = {},
  notes = {}
}) {
  const Razorpay = await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const options = {
      key,
      amount,
      currency,
      name,
      description,
      order_id: orderId,
      prefill,
      notes,
      theme: { color: '#12B8B8' },
      handler(response) {
        resolve(response);
      },
      modal: {
        ondismiss() {
          reject(new Error('Payment cancelled'));
        }
      }
    };

    const instance = new Razorpay(options);

    instance.on('payment.failed', (response) => {
      const msg = response.error?.description || response.error?.reason || 'Payment failed';
      reject(new Error(msg));
    });

    instance.open();
  });
}
