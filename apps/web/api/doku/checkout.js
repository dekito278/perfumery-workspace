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
  if (process.env.DOKU_BASE_URL) {
    return process.env.DOKU_BASE_URL.replace(/\/$/, '');
  }
  return process.env.DOKU_ENVIRONMENT === 'production'
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
  return { phone: trimmedContact.replace(/[^0-9+]/g, '') };
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return jsonResponse(response, 405, { message: 'Method not allowed' });
  }

  const clientId = process.env.DOKU_CLIENT_ID;
  const secretKey = process.env.DOKU_SECRET_KEY;

  if (!clientId || !secretKey) {
    return jsonResponse(response, 500, {
      message: 'DOKU is not configured. Set DOKU_CLIENT_ID and DOKU_SECRET_KEY.',
    });
  }

  try {
    const rawBody = await readBody(request);
    const input = rawBody ? JSON.parse(rawBody) : {};
    const amount = Math.round(Number(input.amount || 0));
    const orderNumber = String(input.orderNumber || '').trim();

    if (!orderNumber || amount <= 0) {
      return jsonResponse(response, 400, { message: 'Order number and positive amount are required' });
    }

    const callbackBaseUrl = String(input.callbackBaseUrl || process.env.DOKU_CALLBACK_BASE_URL || '').replace(/\/$/, '');
    const checkoutBody = {
      order: {
        amount,
        invoice_number: orderNumber,
        currency: 'IDR',
        language: 'ID',
        auto_redirect: false,
        ...(callbackBaseUrl ? {
          callback_url: `${callbackBaseUrl}/home?order=${encodeURIComponent(orderNumber)}`,
          callback_url_result: `${callbackBaseUrl}/home?order=${encodeURIComponent(orderNumber)}&payment=doku`,
        } : {}),
      },
      payment: {
        payment_due_date: Number(process.env.DOKU_PAYMENT_DUE_DATE || 60),
      },
      customer: {
        name: String(input.customerName || 'Solivagant Customer').trim(),
        ...contactToCustomer(input.contact),
      },
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
      return jsonResponse(response, dokuResponse.status, {
        message: dokuData?.error?.message || dokuData?.message || 'Failed to create DOKU checkout',
        doku: dokuData,
      });
    }

    const checkoutPayload = dokuData?.response || dokuData;
    const paymentUrl = checkoutPayload?.payment?.url;
    if (!paymentUrl) {
      return jsonResponse(response, 502, {
        message: 'DOKU did not return a payment URL',
        doku: dokuData,
      });
    }

    return jsonResponse(response, 200, {
      paymentUrl,
      invoiceNumber: checkoutPayload?.order?.invoice_number || orderNumber,
      requestId,
    });
  } catch (error) {
    return jsonResponse(response, 500, {
      message: error.message || 'Unexpected DOKU checkout error',
    });
  }
}
