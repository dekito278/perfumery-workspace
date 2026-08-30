// Authoritative order creation (finding #1/#2). Recomputes every price server-side from the DB so a
// crafted client can't underpay. Reuses the service-role pattern from api/orders/expire-reservations.js
// and the isomorphic builders/validators in src/utils (import-free, safe to import here).
//
// STAGING-GATED. The frontend IS wired to POST here (useCheckoutFlow.submitOrder + createBespokeRequest,
// gated on authoritativeOrdersEnabled / VITE_AUTHORITATIVE_ORDERS), but this endpoint enforces nothing
// against tampering until the direct-insert bypass is removed. Two switches remain (see
// docs/server-side-drafts/08_rollout_runbook.md):
//   1. VITE_AUTHORITATIVE_ORDERS=true  → checkout prefers this endpoint (falls back to a client-priced
//      direct insert if it errors — so the flag ALONE does not close tampering).
//   2. `revoke insert on public.storefront_orders from anon;` (07_orders_anon_insert_revoke.sql) → the
//      actual enforcement: it kills the direct-insert fallback, so a tampered order can't be inserted.
// Verify on staging first (curl a tampered price → the stored subtotal must match the server recompute).

import process from 'node:process';
import { Buffer } from 'node:buffer';
import { buildBespokeCheckoutDraft, buildBespokeItem, buildBespokeNotes } from '../../src/utils/bespokeOrder.js';
import { validateVoucher } from '../../src/utils/voucherValidation.js';
import { applyShippingPromotionToRates } from '../../src/utils/shippingPromotion.js';
import { sendOrderAlert } from '../../src/utils/orderNotifier.js';

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

const rupiah = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

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

const sbRpc = async (fn, body) => {
  const { restUrl, headers } = getSupabaseRest();
  const r = await fetch(`${restUrl}/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Supabase rpc ${fn} failed: ${await r.text()}`);
  return r.json();
};

// --- authoritative price recompute (never trust a client price) ------------------------------------

const priceCatalogItems = async (items = []) => {
  let subtotal = 0;
  const resolved = [];
  for (const line of items) {
    const slug = String(line.productSlug || line.product_slug || line.slug || '').trim();
    const qty = Math.max(1, Math.round(Number(line.quantity || 1)));
    if (!slug) throw new Error('Item missing productSlug');
    const rows = await sbSelect(`storefront_products?slug=eq.${encodeURIComponent(slug)}&select=slug,name,category,price_number,variants`);
    const product = rows?.[0];
    if (!product) throw new Error(`Unknown product: ${slug}`);
    let unitPrice = Number(product.price_number || 0);
    let size = line.size || null;
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const variantRef = line.variantId || line.variant_id || '';
    // Match the same way findVariantForOrderItem does: by id when given, else by size.
    const variant = variants.find((v) => (variantRef ? (v.id === variantRef) : (v.size === line.size)));
    if (variantRef && !variant) throw new Error(`Unknown variant ${variantRef} for ${slug}`);
    // Products carry their real price on variants; if the product has variants but the client's
    // size/variantId matches none, refuse rather than silently charging the base price_number.
    if (variants.length && !variant) throw new Error(`No matching variant for ${slug} (size "${line.size || ''}")`);
    if (variant) {
      unitPrice = Number(variant.priceNumber ?? variant.price_number ?? product.price_number ?? 0);
      size = variant.size || size;
    }
    subtotal += unitPrice * qty;
    // Preserve the client line's display fields (image, name, ...) but enforce the DB price AND category —
    // voucher category-restrictions read item.category, so a client-sent category must never be trusted.
    resolved.push({ ...line, slug, name: line.name || product.name, category: product.category || line.category, quantity: qty, priceNumber: unitPrice, price: rupiah(unitPrice), size });
  }
  return { subtotal, resolved, quantity: resolved.reduce((sum, l) => sum + l.quantity, 0) };
};

// Deduct stock for a catalog order via the atomic, idempotent RPC (it sets inventory_deducted itself).
const deductInventory = async (orderId) => {
  if (!orderId) return;
  await sbRpc('storefront_deduct_inventory_for_order', { p_order_id: String(orderId) });
};

// Resolve the bespoke option ids to authoritative {label, price} per collection. Rejects unknown/disabled
// ids (covers finding #4 server-side). `optionIds` is the {size, bottleType, capDesign, labelDesign,
// exoticMaterial} object the client now stores on the brief.
const priceBespokeOptions = async (optionIds = {}) => {
  const ids = Object.values(optionIds).map((id) => String(id || '').trim()).filter(Boolean);
  if (!ids.length) return { subtotal: 0, labels: {} };
  const inList = ids.map((id) => `"${id.replace(/"/g, '')}"`).join(',');
  const rows = await sbSelect(`storefront_bespoke_options?id=in.(${encodeURIComponent(inList)})&select=id,label,price,enabled,collection_key`);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const collectionToField = {
    bottleSizes: 'size', bottleTypes: 'bottleType', capDesigns: 'capDesign',
    labelDesigns: 'labelDesign', exoticMaterials: 'exoticMaterial',
  };
  let subtotal = 0;
  const labels = {};
  for (const [, id] of Object.entries(optionIds)) {
    const trimmed = String(id || '').trim();
    if (!trimmed) continue;
    const opt = byId.get(trimmed);
    if (!opt || opt.enabled === false) throw new Error(`Unknown or disabled bespoke option: ${trimmed}`);
    subtotal += Number(opt.price || 0);
    const field = collectionToField[opt.collection_key];
    if (field) labels[field] = opt.label;
  }
  return { subtotal, labels };
};

// --- authoritative shipping (reuse the RajaOngkir proxy, apply the DB promo) ------------------------

const computeShippingFee = async (baseUrl, { destinationId, destination, weight, courier, service, subtotal }) => {
  if (!destinationId) return { fee: 0, summary: '' };
  const res = await fetch(`${baseUrl}/api/shipping/rates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destinationId, weight, couriers: courier ? [courier] : undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'Failed to price shipping');
  const rates = Array.isArray(data.rates) ? data.rates : [];
  // Fail closed. Silently falling back to rates[0] charged the buyer a different courier and price than
  // the one they picked and saw on the checkout screen (audit round 7).
  const exact = rates.find((r) => r.courierCode === courier && r.service === service);
  if (!exact && courier && service) {
    throw new Error('Layanan pengiriman yang dipilih sudah tidak tersedia. Pilih ulang kurir dan layanan.');
  }
  const chosen = exact || rates[0];
  if (!chosen) throw new Error('No shipping rate for the selected destination/courier');

  const [promoRow] = await sbSelect('storefront_shipping_promotion_settings?id=eq.default&select=*').catch(() => []);
  const [promoted] = applyShippingPromotionToRates(
    [{ ...chosen, cost: Math.round(Number(chosen.cost || 0)) }],
    destination,
    promoRow
      ? {
        enabled: promoRow.enabled, preset: promoRow.preset, javaAmount: promoRow.java_amount,
        otherAmount: promoRow.other_amount, minimumSubtotal: promoRow.minimum_subtotal,
        startsAt: promoRow.starts_at, endsAt: promoRow.ends_at,
      }
      : undefined,
    { subtotal },
  );
  const fee = Math.round(Number(promoted?.cost ?? chosen.cost ?? 0));
  const summary = `${promoted?.courierName || chosen.courierName || courier} ${promoted?.serviceLabel || chosen.serviceLabel || service} / ${rupiah(fee)}`;
  return { fee, summary };
};

// --- handler ---------------------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return jsonResponse(res, 405, { message: 'Method not allowed' }); }
  try {
    const input = JSON.parse((await readBody(req)) || '{}');
    const baseUrl = `https://${req.headers.host}`;
    const isBespoke = input.source === 'bespoke' || Boolean(input.bespoke);

    // 1. Item prices (authoritative, from DB)
    const catalog = await priceCatalogItems(input.items || []);
    const bespoke = isBespoke ? await priceBespokeOptions(input.bespoke?.optionIds || {}) : { subtotal: 0, labels: {} };
    const itemsSubtotal = catalog.subtotal + bespoke.subtotal;
    if (itemsSubtotal <= 0) return jsonResponse(res, 422, { message: 'Order has no priced items' });

    // 2. Shipping (authoritative)
    // If the client expressed any shipping intent (courier/service/destination) it MUST include a
    // destinationId — otherwise computeShippingFee silently returns fee 0 and the buyer ships for free.
    const ship = input.shipping || {};
    if ((ship.courier || ship.service || ship.destination) && !ship.destinationId) {
      return jsonResponse(res, 422, { message: 'Shipping destination is required to price shipping' });
    }
    // Keep the per-item weight in sync with the client (shippingService.js VITE_DEFAULT_ITEM_WEIGHT_GRAM);
    // a hardcoded 300 here would under/over-quote shipping vs the client once ops change the default.
    const itemWeight = Number(process.env.DEFAULT_ITEM_WEIGHT_GRAM || process.env.VITE_DEFAULT_ITEM_WEIGHT_GRAM || 300);
    const weight = Math.max((catalog.quantity || (isBespoke ? 1 : 0)) * itemWeight, itemWeight);
    const { fee: shippingFee, summary: shippingSummary } = await computeShippingFee(baseUrl, {
      destinationId: input.shipping?.destinationId,
      destination: input.shipping?.destination,
      weight,
      courier: input.shipping?.courier,
      service: input.shipping?.service,
      subtotal: itemsSubtotal,
    });

    // 3. Voucher (authoritative — validate against the DB row, compute the discount here)
    let voucherDiscount = 0;
    let voucherSnapshot = null;
    const voucherCode = String(input.voucherCode || '').trim().toUpperCase();
    if (voucherCode) {
      const [voucherRow] = await sbSelect(`storefront_vouchers?code=eq.${encodeURIComponent(voucherCode)}&select=*`);
      const verdict = validateVoucher({ code: voucherCode, voucher: voucherRow, subtotal: itemsSubtotal, items: catalog.resolved });
      // Dropping an invalid voucher server-side charged the buyer more than the total they confirmed.
      // Refuse instead, so checkout can re-price and show them the real number (audit round 7).
      if (!verdict.valid) {
        return jsonResponse(res, 422, {
          message: verdict.message || `Voucher ${voucherCode} tidak bisa dipakai`,
          reason: verdict.reason,
        });
      }
      if (verdict.valid) {
        voucherDiscount = Math.max(Number(verdict.discountAmount || 0), 0);
        voucherSnapshot = {
          code: voucherCode,
          discountType: voucherRow.discount_type,
          discountValue: voucherRow.discount_value,
          discountAmount: voucherDiscount,
          subtotalBeforeDiscount: itemsSubtotal,
          subtotalAfterDiscount: Math.max(itemsSubtotal - voucherDiscount, 0),
        };
      }
    }

    // 4. Authoritative total (matches the client: (items − voucher) + shipping). Ignore any client total.
    const subtotal = Math.max(itemsSubtotal - voucherDiscount, 0) + shippingFee;
    if (subtotal <= 0) return jsonResponse(res, 422, { message: 'Order has no payable amount' });

    // 5. Customer (same upsert/dedupe the browser uses)
    const customer = (await sbRpc('storefront_upsert_customer', {
      p_customer_code: input.customer?.code || null,
      p_customer_name: input.customer?.name?.trim() || 'Walk-in customer',
      p_contact: input.customer?.contact?.trim() || '-',
      p_delivery_address: input.delivery?.address || null,
      p_delivery_area: input.delivery?.area || null,
      p_notes: null,
      p_increment_order: true,
    }))?.[0] || null;

    // 6. Build the order lines + brief (bespoke uses the shared isomorphic builders + server prices/labels)
    const briefRequest = isBespoke ? {
      ...input.bespoke,
      ...bespoke.labels, // server-resolved labels override any client-sent ones
      customerCode: customer?.customer_code || input.customer?.code || '',
      customerName: input.customer?.name,
      contact: input.customer?.contact,
      deliveryAddress: input.delivery?.address,
      deliveryArea: input.delivery?.area,
      itemPrice: bespoke.subtotal,
      totalPrice: subtotal,
      shippingFee,
      shippingSummary,
      voucherCode: voucherSnapshot?.code || '',
      voucherDiscount,
      paymentProvider: input.paymentProvider || 'manual',
    } : null;

    const productItems = isBespoke ? [buildBespokeItem(briefRequest)] : catalog.resolved;
    const items = voucherSnapshot
      ? [...productItems, {
        id: `voucher-${voucherSnapshot.code}`,
        slug: `voucher-${voucherSnapshot.code.toLowerCase()}`,
        type: 'voucher_discount',
        name: `Voucher ${voucherSnapshot.code}`,
        category: 'Voucher',
        size: '-',
        price: `-${rupiah(voucherSnapshot.discountAmount)}`,
        priceNumber: -voucherSnapshot.discountAmount,
        quantity: 1,
        voucherCode: voucherSnapshot.code,
        discountAmount: voucherSnapshot.discountAmount,
        subtotalBeforeDiscount: voucherSnapshot.subtotalBeforeDiscount,
        subtotalAfterDiscount: voucherSnapshot.subtotalAfterDiscount,
        voucherSnapshot,
      }]
      : productItems;

    const paymentProvider = input.paymentProvider || 'manual';
    const payload = {
      // High-entropy suffix so order numbers can't be enumerated by guessing timestamps (matches
      // orderService.createOrderNumber). The anon payment-session lookup RPC keys off this number.
      order_number: `DKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: 'pending_payment',
      customer_name: input.customer?.name?.trim() || 'Walk-in customer',
      customer_code: customer?.customer_code || input.customer?.code || null,
      customer_id: customer?.id || null,
      contact: input.customer?.contact?.trim() || '-',
      notes: isBespoke ? buildBespokeNotes(briefRequest) : (input.notes || ''),
      items,
      quantity: isBespoke ? 1 : (catalog.quantity || 0),
      subtotal,
      checkout_draft: isBespoke ? buildBespokeCheckoutDraft(briefRequest) : (input.checkoutDraft || ''),
      payment_provider: paymentProvider,
      // Real provider ids are 'manual_transfer_bca'/'doku'; ['manual','whatsapp'] never matched.
      payment_status: ['manual_transfer_bca', 'manual'].includes(paymentProvider) ? 'pending' : 'unpaid',
      source: isBespoke ? 'bespoke_request' : (input.source || 'storefront'),
      ...(isBespoke ? { bespoke_production_status: 'review_brief' } : {}),
    };

    const { restUrl, headers } = getSupabaseRest();
    const insertRes = await fetch(`${restUrl}/storefront_orders`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    if (!insertRes.ok) {
      console.error('Order insert failed:', await insertRes.text());
      throw new Error('Gagal membuat pesanan. Coba lagi sebentar.');
    }
    const [order] = await insertRes.json();

    // Reserve stock for catalog lines (bespoke has none). The RPC is atomic + idempotent and raises on
    // insufficient stock — if it does, cancel the just-created order so no orphan holds a payment window,
    // then surface the error (the client falls back / shows "stok tidak cukup").
    if (!isBespoke) {
      try {
        await deductInventory(order.id || order.order_number);
      } catch (stockError) {
        await fetch(`${restUrl}/storefront_orders?order_number=eq.${encodeURIComponent(order.order_number)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'cancelled', payment_status: 'expired' }),
        }).catch(() => {});
        throw new Error(stockError.message || 'Stok tidak cukup untuk salah satu produk');
      }
    }

    // NOTE: voucher-usage reservation is intentionally NOT done here — the current page flows call
    // recordVoucherUsageForOrder() after the order is created, so doing it here too would double count.
    // If those client calls are ever removed, record usage here (storefront_record_voucher_usage:
    // p_voucher_code, p_order_id, p_order_number, p_amount:1) instead.

    // Tell the owner. Awaited (serverless freezes after the response) but never fatal — sendOrderAlert
    // swallows its own failures, so a dead webhook cannot cost us a paid order.
    await sendOrderAlert({ order, event: 'created', env: process.env });

    return jsonResponse(res, 200, { order, itemsSubtotal, shippingFee, voucherDiscount, subtotal });
  } catch (error) {
    return jsonResponse(res, 400, { message: error.message || 'Order creation failed' });
  }
}
