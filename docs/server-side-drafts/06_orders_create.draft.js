// DRAFT — finding #2. Authoritative order creation as a Node serverless endpoint.
// NOT wired in. Copy to apps/web/api/orders/create.js only after verifying on staging, then do the
// frontend switch + revoke the anon INSERT on storefront_orders (see 05_create_order_design.md).
//
// Money path: the price recompute below (catalog + bespoke) is written against the real schemas
// (storefront_products.price_number + .variants jsonb; storefront_bespoke_options.price). The SHIPPING
// and VOUCHER sections are marked TODO because they call an external API / replicate discount logic —
// wire them to the existing implementations and verify the totals on staging BEFORE locking down INSERT.
//
// Reuses the service-role pattern from api/doku/checkout.js and api/orders/expire-reservations.js.

import { Buffer } from 'node:buffer';
import process from 'node:process';

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

const getSupabaseRest = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return {
    restUrl: `${url.replace(/\/$/, '')}/rest/v1`,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  };
};

const sbSelect = async (path) => {
  const { restUrl, headers } = getSupabaseRest();
  const r = await fetch(`${restUrl}/${path}`, { headers });
  if (!r.ok) throw new Error(`Supabase read failed: ${await r.text()}`);
  return r.json();
};

// --- price recompute (authoritative, from DB) ------------------------------------------------------

// Sum catalog lines from storefront_products. Never trust any client price.
const priceCatalogItems = async (items = []) => {
  let subtotal = 0;
  const resolved = [];
  for (const line of items) {
    const slug = String(line.productSlug || '').trim();
    const qty = Math.max(1, Math.round(Number(line.quantity || 1)));
    if (!slug) throw new Error('Item missing productSlug');
    const rows = await sbSelect(`storefront_products?slug=eq.${encodeURIComponent(slug)}&select=slug,name,price_number,variants,stock`);
    const product = rows?.[0];
    if (!product) throw new Error(`Unknown product: ${slug}`);

    let unitPrice = Number(product.price_number || 0);
    let size = null;
    if (line.variantId) {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      const variant = variants.find((v) => (v.id || v.size) === line.variantId);
      if (!variant) throw new Error(`Unknown variant ${line.variantId} for ${slug}`);
      unitPrice = Number(variant.priceNumber ?? variant.price_number ?? product.price_number ?? 0);
      size = variant.size || null;
    }
    subtotal += unitPrice * qty;
    resolved.push({ slug, name: product.name, quantity: qty, priceNumber: unitPrice, size });
  }
  return { subtotal, resolved };
};

// Sum bespoke option lines from storefront_bespoke_options (server-side prices).
const priceBespokeOptions = async (optionIds = []) => {
  if (!optionIds.length) return { subtotal: 0, resolved: [] };
  const inList = optionIds.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',');
  const rows = await sbSelect(`storefront_bespoke_options?id=in.(${encodeURIComponent(inList)})&select=id,label,price,enabled`);
  const byId = new Map(rows.map((r) => [r.id, r]));
  let subtotal = 0;
  const resolved = [];
  for (const id of optionIds) {
    const opt = byId.get(id);
    if (!opt || opt.enabled === false) throw new Error(`Unknown or disabled bespoke option: ${id}`);
    subtotal += Number(opt.price || 0);
    resolved.push({ id, label: opt.label, priceNumber: Number(opt.price || 0) });
  }
  return { subtotal, resolved };
};

// --- handler ---------------------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return jsonResponse(res, 405, { message: 'Method not allowed' }); }
  try {
    const input = JSON.parse((await readBody(req)) || '{}');

    // 1. Catalog + bespoke prices (authoritative)
    const catalog = await priceCatalogItems(input.items || []);
    const bespoke = await priceBespokeOptions(input.bespoke?.optionIds || []);
    const itemsSubtotal = catalog.subtotal + bespoke.subtotal;

    // 2. Shipping — TODO: call RajaOngkir the same way api/shipping/rates.js does, for input.destination
    //    + computed weight, then pick the rate for the SELECTED input.courier/input.service, then apply
    //    the storefront_shipping_promotion row. Do NOT trust any client-sent shipping cost.
    const shippingFee = 0; // <-- replace with server-computed rate

    // 3. Voucher — TODO: read the voucher server-side (storefront_vouchers), replicate the discount calc
    //    in voucherService.applyVoucherToSubtotalAsync, then reserve it via storefront_record_voucher_usage.
    const voucherDiscount = 0; // <-- replace with server-computed discount

    // 4. Authoritative total
    const subtotal = Math.max(itemsSubtotal - voucherDiscount, 0) + shippingFee;
    if (subtotal <= 0) return jsonResponse(res, 422, { message: 'Order has no payable amount' });

    // 5. Insert — match buildOrderPayload() in orderService.js exactly (order_number, status,
    //    customer_*, items (incl. voucher discount line via withVoucherDiscountItem), quantity,
    //    subtotal, checkout_draft, payment_provider, payment_status, source, bespoke_production_status).
    //    Insert with the service-role headers (bypasses RLS). Return the created row.
    // const { restUrl, headers } = getSupabaseRest();
    // const insert = await fetch(`${restUrl}/storefront_orders`, { method: 'POST', headers: {...headers, Prefer:'return=representation'}, body: JSON.stringify(payload) });

    return jsonResponse(res, 200, { message: 'DRAFT — finish shipping/voucher/insert before use', itemsSubtotal, subtotal });
  } catch (error) {
    return jsonResponse(res, 400, { message: error.message || 'Order creation failed' });
  }
}
