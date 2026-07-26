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

// --- shipping (authoritative) ----------------------------------------------------------------------

// Reuse the existing /api/shipping/rates endpoint (which already calls RajaOngkir) instead of
// re-implementing the courier call. Pick the rate for the courier+service the customer selected —
// never trust a client-sent cost.
const computeShippingFee = async (baseUrl, { destinationId, weight, courier, service }) => {
  if (!destinationId) return 0;
  const res = await fetch(`${baseUrl}/api/shipping/rates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destinationId, weight, couriers: courier ? [courier] : undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'Failed to price shipping');
  const rates = Array.isArray(data.rates) ? data.rates : [];
  const chosen = rates.find((r) => r.courierCode === courier && r.service === service) || rates[0];
  const baseFee = Math.round(Number(chosen?.cost || 0));

  // ponytail: DB promo NOT applied here. applyShippingPromotionToRates + getShippingPromotionSettingsAsync
  // live in the client (services/shippingPromotion*.js). Extract them into a shared module the client AND
  // this endpoint import, OR a storefront_shipping_promotion RPC — then apply the promo to baseFee here.
  // Duplicating the promo math would drift from the client. Until extracted, this returns the raw fee.
  return baseFee;
};

// --- handler ---------------------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return jsonResponse(res, 405, { message: 'Method not allowed' }); }
  try {
    const input = JSON.parse((await readBody(req)) || '{}');
    const baseUrl = `https://${req.headers.host}`;

    // 1. Catalog + bespoke prices (authoritative, from DB)
    const catalog = await priceCatalogItems(input.items || []);
    const bespoke = await priceBespokeOptions(input.bespoke?.optionIds || []);
    const itemsSubtotal = catalog.subtotal + bespoke.subtotal;

    // 2. Shipping (authoritative) — reuse /api/shipping/rates; see computeShippingFee for the promo caveat.
    const weight = Math.max(catalog.resolved.reduce((sum, l) => sum + l.quantity, 0) * 300, 300); // match getCheckoutShippingWeight
    const shippingFee = await computeShippingFee(baseUrl, {
      destinationId: input.destination?.id,
      weight,
      courier: input.courier,
      service: input.service,
    });

    // 3. Voucher (authoritative). validateVoucher is now an ISOMORPHIC module — utils/voucherValidation.js
    //    (zero browser/supabase imports), so this endpoint can import it directly and run it against a
    //    voucher row read from storefront_vouchers. Do NOT re-implement the rules here.
    //      import { validateVoucher } from '../../src/utils/voucherValidation.js';  // adjust path when wired
    //      const [vRow] = await sbSelect(`storefront_vouchers?code=eq.${enc(input.voucherCode)}&select=*`);
    //      const v = validateVoucher({ code: input.voucherCode, voucher: vRow, subtotal: itemsSubtotal,
    //                                  items: catalog.resolved });
    //      const voucherDiscount = v.valid ? v.discountAmount : 0;
    //    Then reserve it via the existing storefront_record_voucher_usage RPC.
    const voucherDiscount = 0; // <-- wire the import above (voucherValidation.js is ready)

    // 4. Authoritative total (matches useCheckoutFlow: (items − voucher) + shipping)
    const subtotal = Math.max(itemsSubtotal - voucherDiscount, 0) + shippingFee;
    if (subtotal <= 0) return jsonResponse(res, 422, { message: 'Order has no payable amount' });

    // 5. Insert with the service-role key (bypasses RLS). Shape MUST match buildOrderPayload() in
    //    orderService.js. Note: order_number here uses a timestamp like createOrderNumber(); the voucher
    //    discount line is added to items the same way withVoucherDiscountItem() does — reuse that helper
    //    (extract it too) rather than re-deriving it.
    const { restUrl, headers } = getSupabaseRest();
    const orderNumber = `DKT-${Date.now().toString(36).toUpperCase()}`;
    const paymentProvider = input.paymentProvider || 'manual';
    const payload = {
      order_number: orderNumber,
      status: 'pending_payment',
      customer_name: input.customer?.name?.trim() || 'Walk-in customer',
      customer_code: input.customer?.code || null,
      contact: input.customer?.contact?.trim() || '-',
      items: [...catalog.resolved, ...bespoke.resolved], // + voucher discount line via withVoucherDiscountItem
      quantity: catalog.resolved.reduce((sum, l) => sum + l.quantity, 0) || 1,
      subtotal,
      payment_provider: paymentProvider,
      payment_status: ['manual', 'whatsapp'].includes(paymentProvider) ? 'pending' : 'unpaid',
      source: input.source || 'storefront',
      ...(input.source === 'bespoke' ? { bespoke_production_status: 'review_brief' } : {}),
    };
    const insertRes = await fetch(`${restUrl}/storefront_orders`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    if (!insertRes.ok) throw new Error(`Order insert failed: ${await insertRes.text()}`);
    const [order] = await insertRes.json();

    // TODO before going live: reserve the voucher (step 3), and confirm the payload matches
    // buildOrderPayload exactly (checkout_draft, customer_id, internalTags-derived tags, etc.).
    return jsonResponse(res, 200, { order, itemsSubtotal, shippingFee, subtotal });
  } catch (error) {
    return jsonResponse(res, 400, { message: error.message || 'Order creation failed' });
  }
}
