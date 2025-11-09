const PAYPAL_SCRIPT_BASE = 'https://www.paypal.com/sdk/js';

export const loadPaypalHostedButtons = (clientId, { currency = 'USD' } = {}) => {
  return new Promise((resolve, reject) => {
    if (!clientId) {
      reject(new Error('PayPal client ID is not configured'));
      return;
    }

    if (window.paypal && window.paypal.HostedButtons) {
      resolve(window.paypal);
      return;
    }

    const existing = document.querySelector('script[data-paypal-sdk="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.paypal));
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = `${PAYPAL_SCRIPT_BASE}?client-id=${encodeURIComponent(clientId)}&components=hosted-buttons&currency=${currency}`;
    script.async = true;
    script.dataset.paypalSdk = 'true';
    script.onload = () => resolve(window.paypal);
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
};

export default loadPaypalHostedButtons;
