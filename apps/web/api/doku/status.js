import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import process from 'node:process';

const STATUS_TARGET_PREFIX = '/orders/v1/status';

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

const getDokuBaseUrl = () => {
  const explicitBaseUrl = String(process.env.DOKU_BASE_URL || '').trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, '');
  }
  return String(process.env.DOKU_ENVIRONMENT || '').trim() === 'production'
    ? 'https://api.doku.com'
    : 'https://api-sandbox.doku.com';
};

const createSignature = ({ clientId, requestId, timestamp, target, secretKey }) => {
  const component = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${target}`,
  ].join('\n');

  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(component, 'utf8')
    .digest('base64');

  return `HMACSHA256=${signature}`;
};

const mapDokuStatus = ({ transactionStatus, orderStatus }) => {
  const normalizedTransaction = String(transactionStatus || '').toUpperCase();
  const normalizedOrder = String(orderStatus || '').toUpperCase();

  if (['SUCCESS', 'PAID', 'SETTLEMENT', 'CAPTURED'].includes(normalizedTransaction)) {
    return { orderStatus: 'paid', paymentStatus: 'paid' };
  }

  if (['PENDING', 'PROCESSING', 'REDIRECT'].includes(normalizedTransaction) || normalizedOrder === 'ORDER_GENERATED') {
    return { orderStatus: 'pending_payment', paymentStatus: 'pending' };
  }

  if (['EXPIRED', 'TIMEOUT'].includes(normalizedTransaction) || normalizedOrder === 'ORDER_EXPIRED') {
    return { orderStatus: 'cancelled', paymentStatus: 'expired' };
  }

  if (['FAILED', 'DENIED', 'CANCELLED', 'CANCELED'].includes(normalizedTransaction)) {
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

const updateOrder = async ({ invoiceNumber, statusPatch, paymentReference }) => {
  const { restUrl, headers } = getSupabaseRestConfig();
  const currentOrder = await getOrderByInvoice(invoiceNumber);

  if (!currentOrder) {
    throw new Error(`Order ${invoiceNumber} not found`);
  }

  const response = await fetch(`${restUrl}/storefront_orders?order_number=eq.${encodeURIComponent(invoiceNumber)}`, {
    method: 'PATCH',
    headers: {
      ...headers,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      status: statusPatch.orderStatus,
      payment_status: statusPatch.paymentStatus,
      payment_reference: paymentReference || currentOrder.payment_reference || '',
      payment_provider: 'doku',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update order ${invoiceNumber}: ${await response.text()}`);
  }

  if (statusPatch.paymentStatus === 'paid') {
    await deductInventoryForPaidOrder(currentOrder);
  }

  if (['failed', 'expired', 'refunded'].includes(statusPatch.paymentStatus) && currentOrder?.inventory_deducted) {
    await restoreInventoryForOrder(currentOrder, `DOKU status ${statusPatch.paymentStatus} stock released`);
  }
};

const insertPaymentLog = async ({
  invoiceNumber,
  requestId,
  payload = {},
  statusPatch = null,
  processingStatus = 'received',
  httpStatus = null,
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
    order_number: order?.invoice_number || invoiceNumber || null,
    request_id: requestId || null,
    original_request_id: transaction?.original_request_id || null,
    transaction_status: transaction?.status || order?.status || null,
    mapped_order_status: statusPatch?.orderStatus || null,
    mapped_payment_status: statusPatch?.paymentStatus || null,
    processing_status: processingStatus,
    http_status: httpStatus,
    signature_valid: null,
    headers: {
      source: 'check_status',
    },
    payload: payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {},
    raw_body: null,
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
    console.warn('Failed to write DOKU status log:', error.message || error);
  }
};

const getInvoiceNumber = async (request) => {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const fromQuery = requestUrl.searchParams.get('order') || requestUrl.searchParams.get('invoice');
  if (fromQuery) return String(fromQuery).trim();

  if (request.method === 'POST') {
    const rawBody = await readBody(request);
    const body = rawBody ? JSON.parse(rawBody) : {};
    return String(body.orderNumber || body.invoiceNumber || body.order || '').trim();
  }

  return '';
};

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return jsonResponse(response, 405, { message: 'Method not allowed' });
  }

  const clientId = String(process.env.DOKU_CLIENT_ID || '').trim();
  const secretKey = String(process.env.DOKU_SECRET_KEY || process.env.DOKU_API_KEY || '').trim();

  if (!clientId || !secretKey) {
    return jsonResponse(response, 500, { message: 'DOKU is not configured' });
  }

  let invoiceNumber = '';
  const requestId = crypto.randomUUID();

  try {
    invoiceNumber = await getInvoiceNumber(request);
    if (!invoiceNumber) {
      return jsonResponse(response, 400, { message: 'Order number is required' });
    }

    const requestTarget = `${STATUS_TARGET_PREFIX}/${encodeURIComponent(invoiceNumber)}`;
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const signature = createSignature({
      clientId,
      requestId,
      timestamp,
      target: requestTarget,
      secretKey,
    });

    const dokuResponse = await fetch(`${getDokuBaseUrl()}${requestTarget}`, {
      method: 'GET',
      headers: {
        'Client-Id': clientId,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        Signature: signature,
      },
    });

    const responseText = await dokuResponse.text();
    const dokuData = responseText ? JSON.parse(responseText) : {};

    if (!dokuResponse.ok) {
      const message = dokuData?.error?.message || dokuData?.message || 'Failed to check DOKU status';
      await insertPaymentLog({
        invoiceNumber,
        requestId,
        payload: dokuData,
        processingStatus: 'error',
        httpStatus: dokuResponse.status,
        errorMessage: message,
      });
      return jsonResponse(response, dokuResponse.status, { message, doku: dokuData });
    }

    const transactionStatus = dokuData?.transaction?.status;
    const orderStatus = dokuData?.order?.status;
    const statusPatch = mapDokuStatus({ transactionStatus, orderStatus });

    if (!statusPatch) {
      await insertPaymentLog({
        invoiceNumber,
        requestId,
        payload: dokuData,
        processingStatus: 'ignored',
        httpStatus: 200,
        errorMessage: `Unhandled DOKU status ${transactionStatus || orderStatus || '-'}`,
      });
      return jsonResponse(response, 200, {
        acknowledged: true,
        ignored: true,
        doku: dokuData,
      });
    }

    let syncApplied = true;
    let syncWarning = '';
    try {
      await updateOrder({
        invoiceNumber,
        statusPatch,
        paymentReference: dokuData?.transaction?.original_request_id || requestId,
      });
    } catch (syncError) {
      syncApplied = false;
      syncWarning = syncError.message || 'DOKU status read succeeded, but order sync failed';
    }

    await insertPaymentLog({
      invoiceNumber,
      requestId,
      payload: dokuData,
      statusPatch,
      processingStatus: syncApplied ? 'applied' : 'error',
      httpStatus: 200,
      errorMessage: syncWarning,
    });

    return jsonResponse(response, 200, {
      acknowledged: true,
      syncApplied,
      syncWarning,
      orderStatus: statusPatch.orderStatus,
      paymentStatus: statusPatch.paymentStatus,
      doku: dokuData,
    });
  } catch (error) {
    await insertPaymentLog({
      invoiceNumber,
      requestId,
      payload: {},
      processingStatus: 'error',
      httpStatus: 500,
      errorMessage: error.message || 'DOKU status error',
    });
    return jsonResponse(response, 500, { message: error.message || 'DOKU status error' });
  }
}
