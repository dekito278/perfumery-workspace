// A manual-transfer buyer uploads their slip through a Postgres RPC, straight from the browser — no
// serverless function is involved, so nothing could send the owner an alert at the one moment that
// matters most: the money has arrived and the order sits still until somebody looks at the proof.
//
// The browser cannot send that alert itself; the webhook URL and its token are server-side secrets. So
// the page pings this endpoint after a successful upload, and this endpoint decides for itself whether
// an alert is warranted — it never trusts the caller for anything but an order number.
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { sendOrderAlert } from '../../src/utils/orderNotifier.js';

// Only a proof uploaded in the last few minutes is worth announcing. Without this, anyone who learned an
// order number could replay this endpoint and turn the owner's WhatsApp into a drum.
const FRESH_PROOF_WINDOW_MS = 15 * 60 * 1000;

const jsonResponse = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { ok: false });

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const body = await readBody(req);
  const orderNumber = String(body.orderNumber || '').trim().toUpperCase();

  // Always 200, whatever happens. This runs after the buyer's upload already succeeded; a failure here
  // must never make them think their proof did not go through, and the response must not reveal whether
  // a given order number exists.
  if (!orderNumber || !supabaseUrl || !serviceRoleKey) return jsonResponse(res, 200, { ok: true });

  try {
    const query = new URLSearchParams({
      select: '*',
      order_number: `eq.${orderNumber}`,
      limit: '1',
    });
    const response = await fetch(`${supabaseUrl}/rest/v1/storefront_orders?${query}`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    if (!response.ok) return jsonResponse(res, 200, { ok: true });

    const [order] = await response.json();
    if (!order || order.payment_proof_status !== 'submitted') return jsonResponse(res, 200, { ok: true });

    const uploadedAt = Date.parse(order.payment_proof_uploaded_at || '');
    if (!Number.isFinite(uploadedAt) || Date.now() - uploadedAt > FRESH_PROOF_WINDOW_MS) {
      return jsonResponse(res, 200, { ok: true });
    }

    await sendOrderAlert({ order, event: 'proof', env: process.env });
  } catch {
    // The alert is best-effort by design; the proof is already recorded either way.
  }

  return jsonResponse(res, 200, { ok: true });
}
