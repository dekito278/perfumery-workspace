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
import { sanitizeClientContext } from '../../src/utils/clientContext.js';
import { resolveTierPrice, tierPricesForLine, indexTierPrices } from '../../src/utils/tierPrice.js';
import { destinationFor, internationalPriceFor } from '../../src/utils/internationalDestination.js';
import { DEFAULT_ITEM_WEIGHT_GRAM, totalItemWeightGram } from '../../src/utils/itemWeight.js';
import { sendOrderAlert } from '../../src/utils/orderNotifier.js';
import { asCustomerCode } from '../../src/utils/customerCode.js';
import { isInternalErrorMessage } from '../../src/utils/publicErrorMessage.js';

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

// Reads a table that may not exist yet: the tier pricing migration is applied by hand, and until it is,
// every buyer is simply retail. A missing table is not an error here.
const sbSelectOptional = async (path) => {
  try {
    return await sbSelect(path);
  } catch {
    return [];
  }
};

// Who is buying, taken from their own access token and nothing else. The customer code the browser sends
// is printed on every invoice, so resolving a tier from it would let anyone paste a reseller's code and
// buy at reseller prices. No token, or a token that does not verify, is retail.
// Returns the account id as well as the tier: a per-account voucher limit can only be counted against a
// verified identity, and this is the only place one exists. ANON is the safe answer for both — retail
// prices, and no account, which a per-account voucher refuses rather than waves through.
const ANONYMOUS_BUYER = { tier: 'retail', authUserId: null };

const resolveBuyer = async (req) => {
  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return ANONYMOUS_BUYER;

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return ANONYMOUS_BUYER;

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return ANONYMOUS_BUYER;
    const user = await response.json();
    if (!user?.id) return ANONYMOUS_BUYER;

    const rows = await sbSelectOptional(
      `storefront_customers?auth_user_id=eq.${encodeURIComponent(user.id)}&select=tier&limit=1`,
    );
    // Signed in at all makes someone a member; only a row an admin wrote makes them a reseller.
    return { tier: rows?.[0]?.tier === 'reseller' ? 'reseller' : 'member', authUserId: user.id };
  } catch {
    return ANONYMOUS_BUYER;
  }
};

// How much of this code the account has already redeemed. Advisory: it lets checkout be refused with the
// right message before an order exists, but storefront_record_voucher_usage is what actually enforces
// the limit, inside the lock. A missing auth_user_id column (migration not applied) reads as 0, which is
// exactly right — without the column there is no per-account limit to enforce either.
const countAccountRedemptions = async (code, authUserId) => {
  if (!authUserId) return 0;
  const rows = await sbSelectOptional(
    `storefront_voucher_usage_records?voucher_code=eq.${encodeURIComponent(code)}`
    + `&auth_user_id=eq.${encodeURIComponent(authUserId)}&select=amount`,
  );
  return (rows || []).reduce((sum, row) => sum + (Number(row?.amount) || 0), 0);
};

// --- authoritative price recompute (never trust a client price) ------------------------------------

// This endpoint is unauthenticated and reserves stock, so an unbounded item list is an amplifier: each
// line costs its own sequential Supabase read, and every accepted order holds inventory until the daily
// sweep. The caps are far above any real order (the shop sells perfume by the bottle) — they exist to
// bound the work one request can ask for, not to police buyers (audit round 9).
const MAX_ORDER_LINES = 50;
const MAX_LINE_QUANTITY = 100;

const priceCatalogItems = async (items = [], buyerTier = 'retail', destination = null) => {
  if (items.length > MAX_ORDER_LINES) {
    throw new Error(`Order has too many item lines (${items.length}, max ${MAX_ORDER_LINES})`);
  }
  let subtotal = 0;
  const resolved = [];
  for (const line of items) {
    const slug = String(line.productSlug || line.product_slug || line.slug || '').trim();
    const qty = Math.max(1, Math.round(Number(line.quantity || 1)));
    if (!Number.isFinite(qty) || qty > MAX_LINE_QUANTITY) {
      throw new Error(`Quantity out of range for ${slug || 'item'} (max ${MAX_LINE_QUANTITY})`);
    }
    if (!slug) throw new Error('Item missing productSlug');
    const rows = await sbSelect(`storefront_products?slug=eq.${encodeURIComponent(slug)}&select=id,slug,name,category,price_number,variants`);
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

    // The buyer's tier price, from the same rule the storefront displays with — a buyer shown one price
    // and charged another is the worst version of two implementations disagreeing.
    const tierRows = await sbSelectOptional(
      `storefront_product_prices?product_id=eq.${encodeURIComponent(product.id)}&select=variant_id,tier,price_number`,
    );
    const index = tierRows.length ? indexTierPrices(tierRows.map((row) => ({ ...row, slug }))) : null;
    const lineTierPrices = index ? tierPricesForLine(index, slug, variant?.id || '') : {};

    if (destination) {
      // An international order is priced by WHERE THE PARCEL GOES, not by who is signed in. The member
      // discount is a domestic loyalty price and does not travel (Dekito, 2026-09-24), so buyerTier is
      // deliberately not consulted on this branch.
      const international = internationalPriceFor({
        tierPrices: lineTierPrices,
        linePrice: unitPrice,
        region: destination.priceRegion,
      });
      // Refuse rather than fall back. No international price for a line means the only number available
      // is the Indonesian one, and charging Rp 359.000 for a bottle going to Germany is a loss the buyer
      // would never question.
      if (!international) {
        throw new Error(`No international price set for ${slug} — set one before selling it abroad`);
      }
      unitPrice = international;
    } else if (index) {
      unitPrice = resolveTierPrice({
        retailPrice: unitPrice,
        tierPrices: lineTierPrices,
        tier: buyerTier,
        overseas: false,
      });
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
    const clientContext = sanitizeClientContext(input.client);

    const isBespoke = input.source === 'bespoke' || Boolean(input.bespoke);

    // 1. Item prices (authoritative, from DB)
    const buyer = await resolveBuyer(req);
    const buyerTier = buyer.tier;
    // Where the parcel goes, resolved from the SAME rule the shop prices with. A country the shop does
    // not ship to is refused here rather than quietly priced as domestic — the client picks from a list
    // built by that rule, so anything else arriving is either a stale page or someone editing the body.
    const destinationCountry = String(input.delivery?.country || '').trim().toUpperCase();
    const destination = destinationCountry ? destinationFor(destinationCountry) : null;
    if (destinationCountry && !destination) {
      return jsonResponse(res, 422, { message: `Belum melayani pengiriman ke ${destinationCountry}` });
    }
    const catalog = await priceCatalogItems(input.items || [], buyerTier, destination);
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
    // This must equal what the browser quoted with, because the fee computed here is the one the order is
    // created at. assertPairedEnvAgrees() in apps/web/tools/build.mjs refuses to build when they differ.
    // Note RAJAONGKIR_DEFAULT_WEIGHT_GRAM is NOT this: it is a total-weight fallback inside
    // api/shipping/rates.js for callers that send no weight, which this one never does.
    const itemWeight = Number(process.env.DEFAULT_ITEM_WEIGHT_GRAM || process.env.VITE_DEFAULT_ITEM_WEIGHT_GRAM || DEFAULT_ITEM_WEIGHT_GRAM);
    // Per size, from the same table getCheckoutShippingWeight reads. `catalog.resolved` carries the size
    // this endpoint decided on, not the one the client sent, so the weight is as authoritative as the
    // price. A bespoke order is one bottle whose size is the option the endpoint just priced.
    // A bespoke brief is one bottle, whose size is the option this endpoint just priced. Appended rather
    // than branched: an order carrying both a brief and catalog lines weighs both, which the old
    // quantity-based formula silently did not.
    const weighedLines = isBespoke
      ? [...catalog.resolved, { size: bespoke.labels?.size || '', quantity: 1 }]
      : catalog.resolved;
    const weight = totalItemWeightGram(weighedLines, itemWeight);
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
      const verdict = validateVoucher({
        code: voucherCode,
        voucher: voucherRow,
        subtotal: itemsSubtotal,
        items: catalog.resolved,
        accountId: buyer.authUserId,
        accountRedemptions: await countAccountRedemptions(voucherCode, buyer.authUserId),
      });
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
      // Sanitised, not trusted: the database checks ^SOLI[0-9]{5}$, and a buyer who mistypes her own
      // code must not lose the order over an optional field (2026-09-21, SOLIO932).
      p_customer_code: asCustomerCode(input.customer?.code),
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
      // The courier the buyer picked and paid for. It was written into the notes and nowhere else, so
      // courier_name stayed null on every order ever placed — and the public tracking page, which reads
      // that column, told all 11 shipped buyers "Kurir: belum tersedia" about a parcel already on a van.
      courier_name: shippingSummary || null,
      source: isBespoke ? 'bespoke_request' : (input.source || 'storefront'),
      client_context: clientContext,
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

    // Reserve voucher quota here, server-side, before stock. The page flows used to do this from the
    // browser after create returned, so a closed tab between the two left a discounted order that never
    // consumed quota (audit round 9, V-2). The RPC is idempotent per order. Release paths are already
    // server-side: api/doku/notification (terminal cancel) and api/orders/expire-reservations (sweep).
    if (voucherSnapshot) {
      try {
        const usageArgs = {
          p_voucher_code: voucherSnapshot.code, p_order_id: order.id, p_order_number: order.order_number, p_amount: 1,
        };
        try {
          await sbRpc('storefront_record_voucher_usage', { ...usageArgs, p_auth_user_id: buyer.authUserId });
        } catch (rpcError) {
          // PostgREST resolves a function by its argument NAMES, so passing p_auth_user_id to the
          // pre-migration 4-argument version is "function not found" — not a refusal. Retrying without it
          // keeps every existing voucher checkout working until Dekito applies the migration; a real
          // refusal (quota, per-account) does not match this and is rethrown to the handler below.
          const missingSignature = /PGRST202|Could not find the function|does not exist/i.test(String(rpcError?.message || ''));
          if (!missingSignature) throw rpcError;
          console.warn('Per-account voucher migration not applied; recording usage without the account.');
          await sbRpc('storefront_record_voucher_usage', usageArgs);
        }
      } catch (voucherError) {
        await fetch(`${restUrl}/storefront_orders?order_number=eq.${encodeURIComponent(order.order_number)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'cancelled', payment_status: 'expired' }),
        }).catch(() => {});
        return jsonResponse(res, 409, { message: `Voucher ${voucherSnapshot.code} sudah tidak tersedia (kemungkinan kuota habis). Checkout ulang tanpa voucher tersebut.` });
      }
    }

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
        // A cancelled order is never swept, so give the quota back here or it stays burned.
        if (voucherSnapshot) {
          await sbRpc('storefront_release_voucher_usage', { p_order_id: order.id, p_order_number: order.order_number }).catch(() => {});
        }
        throw new Error(stockError.message || 'Stok tidak cukup untuk salah satu produk');
      }
    }

    // Tell the owner. Awaited (serverless freezes after the response) but never fatal — sendOrderAlert
    // swallows its own failures, so a dead webhook cannot cost us a paid order.
    await sendOrderAlert({ order, event: 'created', env: process.env });

    return jsonResponse(res, 200, { order, itemsSubtotal, shippingFee, voucherDiscount, subtotal });
  } catch (error) {
    // Curated sentences are kept — they are the useful ones ("Voucher tidak bisa digunakan"). Anything
    // that reads like machinery is replaced: this endpoint answers a BUYER, and the failing row of a
    // constraint error carries her own name, phone and address back onto her screen.
    console.error('Order creation failed:', error?.message || error);
    const message = isInternalErrorMessage(error?.message)
      ? 'Pesanan belum bisa dibuat. Coba lagi sebentar lagi, atau hubungi kami lewat WhatsApp.'
      : error.message;
    return jsonResponse(res, 400, { message });
  }
}
