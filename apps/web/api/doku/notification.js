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

const safeParseJson = (value) => {
  try {
    return value ? JSON.parse(value) : {};
  } catch (error) {
    return {};
  }
};

const getDokuHeaders = (request) => ({
  client_id: request.headers['client-id'] || '',
  request_id: request.headers['request-id'] || '',
  request_timestamp: request.headers['request-timestamp'] || '',
  signature_present: Boolean(request.headers.signature),
  user_agent: request.headers['user-agent'] || '',
});

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

const getSupabaseRestConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return {
    restUrl: `${supabaseUrl.replace(/\/$/, '')}/rest/v1`,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  };
};

const getOrderByInvoice = async (invoiceNumber) => {
  const { restUrl, headers } = getSupabaseRestConfig();
  const response = await fetch(`${restUrl}/storefront_orders?order_number=eq.${encodeURIComponent(invoiceNumber)}&select=*`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to read order ${invoiceNumber}: ${await response.text()}`);
  }

  const rows = await response.json();
  return rows?.[0] || null;
};

const deductInventoryForPaidOrder = async (order) => {
  const { restUrl, headers } = getSupabaseRestConfig();
  if (!order?.id && !order?.order_number) return [];

  const response = await fetch(`${restUrl}/rpc/storefront_deduct_inventory_for_order`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_order_id: order.id || order.order_number,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to deduct inventory for ${order.order_number || order.id}: ${await response.text()}`);
  }

  return response.json();
};

const restoreInventoryForOrder = async (order, reason) => {
  const { restUrl, headers } = getSupabaseRestConfig();
  if (!order?.id && !order?.order_number) return [];

  const response = await fetch(`${restUrl}/rpc/storefront_restore_inventory_for_order`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_order_id: order.id || order.order_number,
      p_reason: reason,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to restore inventory for ${order.order_number || order.id}: ${await response.text()}`);
  }

  return response.json();
};

// Best-effort: return reserved voucher quota when a DOKU payment fails/expires.
// Never throws — a missing RPC (not deployed yet) must not fail the webhook.
const releaseVoucherUsageForOrder = async (order) => {
  if (!order?.id && !order?.order_number) return;
  try {
    const { restUrl, headers } = getSupabaseRestConfig();
    await fetch(`${restUrl}/rpc/storefront_release_voucher_usage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_order_id: order.id || null,
        p_order_number: order.order_number || null,
      }),
    });
  } catch (error) {
    console.warn('Failed to release voucher usage:', error.message || error);
  }
};

const updateOrder = async ({ invoiceNumber, statusPatch, paymentReference, paidAmount = 0 }) => {
  const { restUrl, headers } = getSupabaseRestConfig();
  const currentOrder = await getOrderByInvoice(invoiceNumber);

  const incomingStatus = statusPatch.paymentStatus;
  const isTerminalCancel = ['failed', 'expired', 'refunded', 'cancelled'].includes(incomingStatus);

  // Terminal-state guard: once an order is paid, a late or duplicate failure/expiry
  // webhook must not flip it back to cancelled or release its stock.
  if (currentOrder?.payment_status === 'paid' && isTerminalCancel) {
    return { skipped: 'already_paid' };
  }

  // Symmetric guard: a late/duplicate 'paid' webhook must NOT resurrect an order that was already
  // cancelled/expired (its stock was restored and may have been resold). Re-flipping to paid would
  // re-deduct stock and revive a dead order — needs a manual refund/re-order decision instead.
  if (incomingStatus === 'paid'
    && (currentOrder?.status === 'cancelled' || ['expired', 'failed', 'refunded'].includes(currentOrder?.payment_status))) {
    return { skipped: 'order_closed' };
  }

  // Amount verification: never mark an order paid for less than its stored total.
  if (incomingStatus === 'paid') {
    const expected = Math.round(Number(currentOrder?.subtotal || 0));
    const paid = Math.round(Number(paidAmount || 0));
    if (expected > 0 && paid > 0 && paid < expected) {
      throw new Error(`DOKU amount mismatch for ${invoiceNumber}: paid ${paid} < expected ${expected}`);
    }
  }

  const endpoint = `${restUrl}/storefront_orders?order_number=eq.${encodeURIComponent(invoiceNumber)}`;
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      ...headers,
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

  // Only deduct once — guard against a second 'paid' webhook or an order whose
  // inventory was already deducted at creation.
  if (incomingStatus === 'paid' && !currentOrder?.inventory_deducted) {
    await deductInventoryForPaidOrder(currentOrder);
  }

  if (isTerminalCancel && currentOrder?.inventory_deducted) {
    await restoreInventoryForOrder(currentOrder, `DOKU ${statusPatch.paymentStatus} stock released`);
  }

  if (isTerminalCancel) {
    await releaseVoucherUsageForOrder(currentOrder);
  }
};

const insertPaymentLog = async ({
  request,
  rawBody = '',
  payload = {},
  statusPatch = null,
  processingStatus = 'received',
  httpStatus = null,
  signatureValid = null,
  errorMessage = '',
}) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return;
  }

  const transaction = payload?.transaction || {};
  const order = payload?.order || {};
  const body = {
    order_number: order?.invoice_number || null,
    request_id: request.headers['request-id'] || null,
    original_request_id: transaction?.original_request_id || null,
    transaction_status: transaction?.status || null,
    mapped_order_status: statusPatch?.orderStatus || null,
    mapped_payment_status: statusPatch?.paymentStatus || null,
    processing_status: processingStatus,
    http_status: httpStatus,
    signature_valid: signatureValid,
    headers: getDokuHeaders(request),
    payload: payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {},
    raw_body: rawBody || null,
    error_message: errorMessage || null,
  };

  try {
    await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/storefront_doku_payment_logs`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.warn('Failed to write DOKU payment log:', error.message || error);
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

  let rawBody = '';
  let parsedPayload = {};
  let currentStatusPatch = null;
  let signatureVerified = null;

  try {
    rawBody = await readBody(request);
    parsedPayload = safeParseJson(rawBody);
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
      await insertPaymentLog({
        request,
        rawBody,
        payload: parsedPayload,
        processingStatus: 'rejected',
        httpStatus: 401,
        signatureValid: false,
        errorMessage: 'Invalid DOKU signature',
      });
      return jsonResponse(response, 401, { message: 'Invalid DOKU signature' });
    }
    signatureVerified = true;

    const payload = parsedPayload;
    const invoiceNumber = payload?.order?.invoice_number;
    const transactionStatus = payload?.transaction?.status;
    const statusPatch = mapDokuStatus(transactionStatus);
    currentStatusPatch = statusPatch;

    if (!invoiceNumber) {
      await insertPaymentLog({
        request,
        rawBody,
        payload,
        processingStatus: 'rejected',
        httpStatus: 400,
        signatureValid: true,
        errorMessage: 'Missing invoice number',
      });
      return jsonResponse(response, 400, { message: 'Missing invoice number' });
    }

    if (!statusPatch) {
      await insertPaymentLog({
        request,
        rawBody,
        payload,
        processingStatus: 'ignored',
        httpStatus: 200,
        signatureValid: true,
        errorMessage: `Unhandled DOKU status ${transactionStatus || '-'}`,
      });
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
      paidAmount: Number(payload?.order?.amount || payload?.transaction?.amount || 0),
    });

    await insertPaymentLog({
      request,
      rawBody,
      payload,
      statusPatch,
      processingStatus: 'applied',
      httpStatus: 200,
      signatureValid: true,
    });

    return jsonResponse(response, 200, { acknowledged: true });
  } catch (error) {
    await insertPaymentLog({
      request,
      rawBody,
      payload: parsedPayload,
      statusPatch: currentStatusPatch,
      processingStatus: 'error',
      httpStatus: 500,
      signatureValid: signatureVerified,
      errorMessage: error.message || 'DOKU notification error',
    });
    return jsonResponse(response, 500, { message: error.message || 'DOKU notification error' });
  }
}
