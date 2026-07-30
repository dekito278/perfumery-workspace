// DOKU SNAP QRIS (MPM) generate — native in-app payment (no DOKU iframe).
// Flow: get a B2B access token (asymmetric RSA-SHA256 signature), then call qr-mpm-generate
// (symmetric HMAC-SHA512 signature). Returns the QRIS string (qrContent) which the frontend renders
// as a QR code. Payment is confirmed via the DOKU SNAP payment notification webhook (see notification.js).
//
// Env (all runtime; set SANDBOX values on Vercel Preview scope, PRODUCTION values on Production scope):
//   DOKU_ENVIRONMENT       'sandbox' | 'production' (already used by checkout.js)
//   DOKU_SNAP_CLIENT_KEY   SNAP X-CLIENT-KEY / X-PARTNER-ID (e.g. MCH-xxxx-...). Falls back to DOKU_CLIENT_ID.
//   DOKU_SECRET_KEY        client secret for the HMAC-SHA512 service signature (reused from Jokul).
//   DOKU_PRIVATE_KEY       RSA private key (PEM) whose public key is uploaded to DOKU SNAP config.
//   DOKU_MERCHANT_ID       SNAP QRIS merchantId (from DOKU).
//   DOKU_TERMINAL_ID       SNAP QRIS terminalId (from DOKU).
//   DOKU_MERCHANT_POSTAL   merchant postal code, 5 numeric (additionalInfo.postalCode). Default '00000'.
//   DOKU_PAYMENT_DUE_DATE  minutes until the QR expires (reused; default 60).

import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import process from 'node:process';

const TOKEN_TARGET = '/authorization/v1/access-token/b2b';
const QRIS_TARGET = '/snap-adapter/b2b/v1.0/qr/qr-mpm-generate';

const jsonResponse = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
};

const getDokuBaseUrl = () => {
  const explicit = String(process.env.DOKU_BASE_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  return String(process.env.DOKU_ENVIRONMENT || '').trim() === 'production'
    ? 'https://api.doku.com'
    : 'https://api-sandbox.doku.com';
};

// SNAP timestamp: ISO8601 with timezone offset, e.g. 2022-10-07T14:18:39+07:00
const snapTimestamp = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  // Emit in UTC with +00:00 offset — SNAP accepts UTC+0.
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`
    + `T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}+00:00`;
};

const getSupabaseRest = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return {
    restUrl: `${url.replace(/\/$/, '')}/rest/v1`,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  };
};

// Authoritative amount from the order (never trust the client).
const getOrderAmountByInvoice = async (invoiceNumber) => {
  const { restUrl, headers } = getSupabaseRest();
  const r = await fetch(`${restUrl}/storefront_orders?order_number=eq.${encodeURIComponent(invoiceNumber)}&select=order_number,subtotal,payment_status`, { headers });
  if (!r.ok) throw new Error(`Failed to read order ${invoiceNumber}: ${await r.text()}`);
  const [order] = await r.json();
  if (!order) throw new Error(`Order ${invoiceNumber} not found`);
  return { amount: Math.round(Number(order.subtotal || 0)), paymentStatus: order.payment_status };
};

// --- SNAP auth ------------------------------------------------------------------------------------

// B2B access token: X-SIGNATURE = base64(SHA256withRSA(`${clientKey}|${timestamp}`, privateKey)).
const getSnapAccessToken = async () => {
  const clientKey = String(process.env.DOKU_SNAP_CLIENT_KEY || process.env.DOKU_CLIENT_ID || '').trim();
  // Vercel may store the PEM with literal \n; normalise to real newlines so crypto can parse it.
  const privateKey = String(process.env.DOKU_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (!clientKey || !privateKey) throw new Error('Missing DOKU_SNAP_CLIENT_KEY or DOKU_PRIVATE_KEY');
  const timestamp = snapTimestamp();
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${clientKey}|${timestamp}`, 'utf8')
    .sign(privateKey, 'base64');

  const r = await fetch(`${getDokuBaseUrl()}${TOKEN_TARGET}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CLIENT-KEY': clientKey,
      'X-TIMESTAMP': timestamp,
      'X-SIGNATURE': signature,
    },
    body: JSON.stringify({ grantType: 'client_credentials' }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.accessToken) {
    throw new Error(`DOKU token failed: ${data?.responseMessage || JSON.stringify(data) || r.status}`);
  }
  return data.accessToken;
};

// Service signature for the QRIS call: HMAC-SHA512(clientSecret,
//   `${method}:${endpoint}:${accessToken}:${sha256HexLower(minifiedBody)}:${timestamp}`)
const serviceSignature = ({ method, endpoint, accessToken, minifiedBody, timestamp, clientSecret }) => {
  const bodyHash = crypto.createHash('sha256').update(minifiedBody, 'utf8').digest('hex').toLowerCase();
  const stringToSign = `${method}:${endpoint}:${accessToken}:${bodyHash}:${timestamp}`;
  return crypto.createHmac('sha512', clientSecret).update(stringToSign, 'utf8').digest('base64');
};

// --- handler --------------------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return jsonResponse(res, 405, { message: 'Method not allowed' }); }
  try {
    const input = JSON.parse((await readBody(req)) || '{}');
    const orderNumber = String(input.orderNumber || input.invoiceNumber || '').trim();
    if (!orderNumber) return jsonResponse(res, 422, { message: 'orderNumber is required' });

    const { amount } = await getOrderAmountByInvoice(orderNumber);
    if (amount <= 0) return jsonResponse(res, 422, { message: 'Order has no payable amount' });

    const clientKey = String(process.env.DOKU_SNAP_CLIENT_KEY || process.env.DOKU_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.DOKU_SECRET_KEY || '').trim();
    if (!clientSecret) {
      return jsonResponse(res, 500, { message: 'DOKU SNAP QRIS not configured (need DOKU_SECRET_KEY + DOKU_PRIVATE_KEY).' });
    }
    // merchantId/terminalId/postalCode are often DOKU-assigned or optional — send only when explicitly
    // configured. If DOKU actually requires them, its error response names the missing field.
    const merchantId = String(process.env.DOKU_MERCHANT_ID || '').trim();
    const terminalId = String(process.env.DOKU_TERMINAL_ID || '').trim();
    const postalCode = String(process.env.DOKU_MERCHANT_POSTAL || '').trim();

    const accessToken = await getSnapAccessToken();
    const validityMinutes = Number(process.env.DOKU_PAYMENT_DUE_DATE || 60);

    const body = {
      partnerReferenceNo: orderNumber,
      amount: { value: `${amount}.00`, currency: 'IDR' },
      ...(merchantId ? { merchantId } : {}),
      ...(terminalId ? { terminalId } : {}),
      validityPeriod: new Date(Date.now() + validityMinutes * 60 * 1000).toISOString(),
      ...(postalCode ? { additionalInfo: { postalCode: postalCode.slice(0, 5), feeType: 1 } } : {}),
    };
    const minifiedBody = JSON.stringify(body);
    const timestamp = snapTimestamp();
    const signature = serviceSignature({
      method: 'POST', endpoint: QRIS_TARGET, accessToken, minifiedBody, timestamp, clientSecret,
    });

    const dokuRes = await fetch(`${getDokuBaseUrl()}${QRIS_TARGET}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PARTNER-ID': clientKey,
        // X-EXTERNAL-ID: numeric, unique within the same day.
        'X-EXTERNAL-ID': `${Date.now()}`,
        'X-TIMESTAMP': timestamp,
        'X-SIGNATURE': signature,
        'CHANNEL-ID': 'H2H',
        Authorization: `Bearer ${accessToken}`,
      },
      body: minifiedBody,
    });
    const doku = await dokuRes.json().catch(() => ({}));
    // SNAP success codes start with 200 (e.g. 2004900).
    if (!dokuRes.ok || !doku?.qrContent) {
      return jsonResponse(res, 502, {
        message: doku?.responseMessage || 'DOKU QRIS generate failed',
        dokuResponseCode: doku?.responseCode,
        doku,
      });
    }

    return jsonResponse(res, 200, {
      orderNumber,
      amount,
      qrContent: doku.qrContent,
      referenceNo: doku.referenceNo,
      expiresAt: body.validityPeriod,
    });
  } catch (error) {
    return jsonResponse(res, 400, { message: error.message || 'QRIS creation failed' });
  }
}
