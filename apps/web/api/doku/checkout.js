import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import process from 'node:process';

const CHECKOUT_TARGET = '/checkout/v1/payment';

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

const contactToCustomer = (contact = '') => {
  const trimmedContact = String(contact).trim();
  if (!trimmedContact) return {};
  if (trimmedContact.includes('@')) {
    return { email: trimmedContact };
  }
  let phone = trimmedContact.replace(/[^0-9]/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (phone.startsWith('0')) phone = `62${phone.slice(1)}`;
  if (phone.startsWith('8')) phone = `62${phone}`;
  if (phone.startsWith('620')) phone = `62${phone.slice(3)}`;
  return { phone };
};

const normalizeCallbackPath = (value) => {
  const path = String(value || '/payment').trim();
  if (!path.startsWith('/') || path.startsWith('//')) {
    return '/payment';
  }
  return path;
};

const normalizeUrlBase = (value = '') => String(value || '').trim().replace(/\/$/, '');

const toDokuLineItems = (items = []) => (
  Array.isArray(items)
    ? items.map((item) => ({
      name: String(item.name || item.slug || 'Solivagant item').slice(0, 255),
      quantity: Math.max(1, Math.round(Number(item.quantity || 1))),
      price: Math.round(Number(item.priceNumber || item.totalPrice || item.price || 0)),
      ...(item.slug ? { sku: String(item.slug).slice(0, 64) } : {}),
      ...(item.type ? { type: String(item.type).slice(0, 64) } : {}),
    })).filter((item) => item.price > 0)
    : []
);

const parseDokuExpiredDate = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!match) return '';
  const [, year, month, day, hour, minute, second] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 7, Number(minute), Number(second));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
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

// Authoritative order total lives in storefront_orders.subtotal (set server-side at
// order creation to the final amount due). Never trust the amount sent by the client.
const getOrderAmountByInvoice = async (invoiceNumber) => {
  const { restUrl, headers } = getSupabaseRestConfig();
  const url = `${restUrl}/storefront_orders?order_number=eq.${encodeURIComponent(invoiceNumber)}&select=order_number,subtotal,payment_status`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to read order ${invoiceNumber}: ${await response.text()}`);
  }

  const rows = await response.json();
  return rows?.[0] || null;
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return jsonResponse(response, 405, { message: 'Method not allowed' });
  }

  const clientId = String(process.env.DOKU_CLIENT_ID || '').trim();
  const secretKey = String(process.env.DOKU_SECRET_KEY || process.env.DOKU_API_KEY || '').trim();

  if (!clientId || !secretKey) {
    return jsonResponse(response, 500, {
      message: 'DOKU is not configured. Set DOKU_CLIENT_ID and DOKU_SECRET_KEY.',
    });
  }

  try {
    const rawBody = await readBody(request);
    const input = rawBody ? JSON.parse(rawBody) : {};
    const orderNumber = String(input.orderNumber || '').trim();

    if (!orderNumber) {
      return jsonResponse(response, 400, { message: 'Order number is required' });
    }

    // SECURITY: derive the payable amount from the order stored server-side, never
    // from the request body — otherwise anyone can pay an arbitrary amount for any order.
    let order;
    try {
      order = await getOrderAmountByInvoice(orderNumber);
    } catch (lookupError) {
      console.error('DOKU checkout order lookup failed:', lookupError.message || lookupError);
      return jsonResponse(response, 502, { message: 'Unable to verify order amount' });
    }

    if (!order) {
      return jsonResponse(response, 404, { message: 'Order not found' });
    }
    if (order.payment_status === 'paid') {
      return jsonResponse(response, 409, { message: 'Order is already paid' });
    }

    const amount = Math.round(Number(order.subtotal || 0));
    if (amount <= 0) {
      return jsonResponse(response, 422, { message: 'Order has no payable amount' });
    }

    // Base URLs must come from server env only; a client-supplied notification URL
    // could redirect DOKU's payment webhooks away from us.
    const callbackBaseUrl = normalizeUrlBase(process.env.DOKU_CALLBACK_BASE_URL);
    const callbackPath = normalizeCallbackPath(input.callbackPath);
    const notificationBaseUrl = normalizeUrlBase(process.env.DOKU_NOTIFICATION_BASE_URL || callbackBaseUrl);
    const lineItems = toDokuLineItems(input.items);
    const lineItemsTotal = lineItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
    if (lineItems.length && lineItemsTotal > 0 && lineItemsTotal < amount) {
      lineItems.push({
        name: 'Shipping',
        quantity: 1,
        price: amount - lineItemsTotal,
        type: 'shipping',
      });
    }
    const requestLineItemsTotal = lineItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
    const requestLineItems = requestLineItemsTotal === amount ? lineItems : [];
    const checkoutBody = {
      order: {
        amount,
        invoice_number: orderNumber,
        currency: 'IDR',
        language: 'ID',
        auto_redirect: false,
        ...(requestLineItems.length ? { line_items: requestLineItems } : {}),
        ...(callbackBaseUrl ? {
          callback_url: `${callbackBaseUrl}${callbackPath}?order=${encodeURIComponent(orderNumber)}`,
          callback_url_result: `${callbackBaseUrl}${callbackPath}?order=${encodeURIComponent(orderNumber)}&payment=doku`,
        } : {}),
      },
      payment: {
        payment_due_date: Number(String(process.env.DOKU_PAYMENT_DUE_DATE || 60).trim()),
      },
      customer: {
        name: String(input.customerName || 'Solivagant Customer').trim(),
        ...contactToCustomer(input.contact),
      },
      ...(notificationBaseUrl ? {
        additional_info: {
          override_notification_url: `${notificationBaseUrl}/api/doku/notification`,
        },
      } : {}),
    };

    const dokuBody = JSON.stringify(checkoutBody);
    const digest = createDigest(dokuBody);
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const signature = createSignature({
      clientId,
      requestId,
      timestamp,
      target: CHECKOUT_TARGET,
      digest,
      secretKey,
    });

    const dokuResponse = await fetch(`${getDokuBaseUrl()}${CHECKOUT_TARGET}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        Signature: signature,
      },
      body: dokuBody,
    });

    const responseText = await dokuResponse.text();
    const dokuData = responseText ? JSON.parse(responseText) : {};

    if (!dokuResponse.ok) {
      const dokuMessage = dokuData?.error?.message || dokuData?.message || 'Failed to create DOKU checkout';
      const isInvalidSignature = String(dokuData?.error?.code || '').toLowerCase() === 'invalid_signature'
        || /invalid header signature/i.test(dokuMessage);
      console.error('DOKU checkout failed:', JSON.stringify(dokuData));
      return jsonResponse(response, dokuResponse.status, {
        message: isInvalidSignature
          ? 'DOKU menolak signature. Pastikan DOKU_CLIENT_ID dan DOKU_SECRET_KEY berasal dari environment yang sama di DOKU Dashboard.'
          : dokuMessage,
      });
    }

    const checkoutPayload = dokuData?.response || dokuData;
    const paymentUrl = checkoutPayload?.payment?.url;
    if (!paymentUrl) {
      console.error('DOKU returned no payment URL:', JSON.stringify(dokuData));
      return jsonResponse(response, 502, { message: 'DOKU did not return a payment URL' });
    }

    const paymentSessionId = checkoutPayload?.order?.session_id || checkoutPayload?.payment?.token_id || checkoutPayload?.uuid || '';
    const paymentExpiresAt = parseDokuExpiredDate(checkoutPayload?.payment?.expired_date);

    // Persist the payment window here, with the service-role key. The browser used to write this itself,
    // but storefront_orders UPDATE is admin-only under RLS, so every customer-side write was filtered out
    // and PostgREST still answered 200 — the order kept no payment_url and no payment_expires_at, which is
    // what the reservation sweep reads to free stock (audit round 7).
    try {
      const { restUrl, headers } = getSupabaseRestConfig();
      await fetch(`${restUrl}/storefront_orders?order_number=eq.${encodeURIComponent(orderNumber)}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          payment_provider: 'doku',
          payment_url: paymentUrl,
          payment_reference: requestId,
          payment_session_id: paymentSessionId || null,
          payment_expires_at: paymentExpiresAt || null,
          payment_response: checkoutPayload,
          doku_response: checkoutPayload,
          status: 'pending_payment',
        }),
      });
    } catch (persistError) {
      // The buyer can still pay — do not fail the checkout over bookkeeping.
      console.warn('Failed to persist DOKU payment session:', persistError.message || persistError);
    }

    return jsonResponse(response, 200, {
      paymentUrl,
      invoiceNumber: checkoutPayload?.order?.invoice_number || orderNumber,
      paymentSessionId,
      paymentExpiresAt,
      dokuResponse: checkoutPayload,
      requestId,
    });
  } catch (error) {
    return jsonResponse(response, 500, {
      message: error.message || 'Unexpected DOKU checkout error',
    });
  }
}
