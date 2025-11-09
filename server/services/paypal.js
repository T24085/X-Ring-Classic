const https = require('https');
const { URL } = require('url');

const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

const httpRequest = ({ url, method = 'GET', headers = {}, body }) => {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const options = {
        method,
        hostname: urlObj.hostname,
        path: urlObj.pathname + (urlObj.search || ''),
        headers,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const statusCode = res.statusCode || 500;
          if (statusCode >= 200 && statusCode < 300) {
            try {
              const parsed = data ? JSON.parse(data) : {};
              resolve(parsed);
            } catch (parseError) {
              reject(new Error(`Failed to parse PayPal response: ${parseError.message}`));
            }
          } else {
            let errorMessage = `PayPal request failed with status ${statusCode}`;
            if (data) {
              errorMessage += `: ${data}`;
            }
            const error = new Error(errorMessage);
            error.status = statusCode;
            reject(error);
          }
        });
      });

      req.on('error', (err) => reject(err));

      if (body) {
        req.write(body);
      }
      req.end();
    } catch (error) {
      reject(error);
    }
  });
};

const getAccessToken = async () => {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials are not configured');
  }

  const authString = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const body = 'grant_type=client_credentials';

  const tokenResponse = await httpRequest({
    url: `${PAYPAL_API_BASE}/v1/oauth2/token`,
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  });

  if (!tokenResponse.access_token) {
    throw new Error('Unable to obtain PayPal access token');
  }

  return tokenResponse.access_token;
};

const getOrderDetails = async (orderId) => {
  if (!orderId) {
    throw new Error('PayPal orderId is required');
  }
  const accessToken = await getAccessToken();

  return httpRequest({
    url: `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
};

const verifyHostedButtonOrder = async ({ orderId, expectedAmount = 20, expectedCurrency = 'USD' }) => {
  const order = await getOrderDetails(orderId);

  if (!order || !order.status) {
    throw new Error('Unable to retrieve PayPal order details');
  }

  if (order.status !== 'COMPLETED') {
    const err = new Error('PayPal order is not completed');
    err.status = 400;
    err.paypalStatus = order.status;
    throw err;
  }

  const purchaseUnit = Array.isArray(order.purchase_units) ? order.purchase_units[0] : null;
  const amount = purchaseUnit?.amount?.value ? parseFloat(purchaseUnit.amount.value) : null;
  const currency = purchaseUnit?.amount?.currency_code;

  if (amount == null || Number.isNaN(amount)) {
    throw new Error('PayPal order amount is missing');
  }

  if (amount < expectedAmount) {
    const err = new Error('Insufficient PayPal payment amount');
    err.status = 400;
    err.amount = amount;
    throw err;
  }

  if (expectedCurrency && currency !== expectedCurrency) {
    const err = new Error('Unexpected PayPal currency');
    err.status = 400;
    err.currency = currency;
    throw err;
  }

  return {
    id: order.id,
    amount,
    currency,
    status: order.status,
    payer: order.payer || null,
    purchaseUnit,
    raw: order,
  };
};

module.exports = {
  verifyHostedButtonOrder,
};
