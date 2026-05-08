import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import process from 'node:process';

const NOTIFICATION_TARGET = '/api/doku/notification';

const jsonResponse = (response, status, body) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
};

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

const createDigest = (jsonBody) => crypto
  .createHash('sha256')
  .update(jsonBody, 'utf8')
  .digest('base64');

const createSignature = ({ clientId, requestId, timestamp, target, digest, secretKey }) => {
  const component = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${target}`,
    `Digest:${digest}`,
  ].join('\n');

  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(component, 'utf8')
    .digest('base64');

  return `HMACSHA256=${signature}`;
};

const secureCompare = (left, right) => {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const mapDokuStatus = (status) => {
  const normalizedStatus = String(status || '').toUpperCase();
  if (['SUCCESS', 'PAID', 'SETTLEMENT', 'CAPTURED'].includes(normalizedStatus)) {
    return { orderStatus: 'paid', paymentStatus: 'paid' };
  }
  if (['PENDING', 'PROCESSING'].includes(normalizedStatus)) {
    return { orderStatus: 'pending_payment', paymentStatus: 'pending' };
  }
  if (['EXPIRED', 'TIMEOUT'].includes(normalizedStatus)) {
    return { orderStatus: 'cancelled', paymentStatus: 'expired' };
  }
  if (['FAILED', 'DENIED', 'CANCELLED', 'CANCELED'].includes(normalizedStatus)) {
    return { orderStatus: 'cancelled', paymentStatus: 'failed' };
  }
  return null;
};

const updateOrder = async ({ invoiceNumber, statusPatch, paymentReference }) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/storefront_orders?order_number=eq.${encodeURIComponent(invoiceNumber)}`;
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      status: statusPatch.orderStatus,
      payment_status: statusPatch.paymentStatus,
      payment_reference: paymentReference || '',
      payment_provider: 'doku',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update order ${invoiceNumber}: ${await response.text()}`);
  }
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return jsonResponse(response, 405, { message: 'Method not allowed' });
  }

  const clientId = process.env.DOKU_CLIENT_ID;
  const secretKey = process.env.DOKU_SECRET_KEY;

  if (!clientId || !secretKey) {
    return jsonResponse(response, 500, { message: 'DOKU is not configured' });
  }

  try {
    const rawBody = await readBody(request);
    const requestId = request.headers['request-id'];
    const timestamp = request.headers['request-timestamp'];
    const receivedSignature = request.headers.signature;

    const digest = createDigest(rawBody);
    const expectedSignature = createSignature({
      clientId,
      requestId,
      timestamp,
      target: NOTIFICATION_TARGET,
      digest,
      secretKey,
    });

    if (!requestId || !timestamp || !receivedSignature || !secureCompare(receivedSignature, expectedSignature)) {
      return jsonResponse(response, 401, { message: 'Invalid DOKU signature' });
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const invoiceNumber = payload?.order?.invoice_number;
    const transactionStatus = payload?.transaction?.status;
    const statusPatch = mapDokuStatus(transactionStatus);

    if (!invoiceNumber) {
      return jsonResponse(response, 400, { message: 'Missing invoice number' });
    }

    if (!statusPatch) {
      return jsonResponse(response, 200, {
        acknowledged: true,
        ignored: true,
        reason: `Unhandled DOKU status ${transactionStatus || '-'}`,
      });
    }

    await updateOrder({
      invoiceNumber,
      statusPatch,
      paymentReference: payload?.transaction?.original_request_id || requestId,
    });

    return jsonResponse(response, 200, { acknowledged: true });
  } catch (error) {
    return jsonResponse(response, 500, { message: error.message || 'DOKU notification error' });
  }
}
