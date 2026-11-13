// Runnable check for the order endpoint's shipping guard.
// `node tools/api-selfchecks/catalog-order-is-shipped.selfcheck.mjs`
//
// api/orders/create.js prices shipping itself, on purpose: the fee the order is created at must be the
// one the browser quoted, not one the client sends. The guard it shipped with reads:
//
//     if ((ship.courier || ship.service || ship.destination) && !ship.destinationId) -> 422
//
// and its comment says it exists because "otherwise computeShippingFee silently returns fee 0 and the
// buyer ships for free". It only fires when the caller VOLUNTEERS part of a shipping intent. A caller
// that omits `shipping` entirely walks straight past it, computeShippingFee returns fee 0 at its first
// line, and the order is created with the freight never charged.
//
// This endpoint is unauthenticated, and the order it leaves behind looks ordinary: measured on the live
// database, thirty of the thirty-three orders carry no courier line at all, because every bespoke
// request is quoted by hand afterwards. A catalogue order is not — it is shipped, so it has to be priced.
//
// The handler is plain node and fetch, so this drives the REAL one with the network stubbed.
import assert from 'node:assert/strict';
import handler from '../../api/orders/create.js';

process.env.SUPABASE_URL = 'https://project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

let inserted = [];
let ratesAsked = 0;

globalThis.fetch = async (url, init = {}) => {
  const target = String(url);
  const ok = (json) => ({ ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) });

  if (target.includes('/api/shipping/rates')) {
    ratesAsked += 1;
    return ok({ rates: [{ courierCode: 'jne', service: 'REG', courierName: 'JNE', serviceLabel: 'Reguler', cost: 25000 }] });
  }
  if (target.includes('/auth/v1/user')) return { ok: false, status: 401, json: async () => ({}), text: async () => '' };
  if (target.includes('/storefront_products?')) {
    return ok([{ id: 'p1', slug: 'hug-n-1', name: 'HUG N°1', category: 'Floral', price_number: 359000, tags: [], variants: [{ id: 'v1', size: '30 ml', priceNumber: 359000, stock: 5 }] }]);
  }
  if (target.includes('/storefront_bespoke_options')) {
    return ok([{ id: 'size-30', collection_key: 'bottleSizes', label: '30 ml', price: 240000, enabled: true }]);
  }
  if (target.includes('/storefront_orders') && (init.method || 'GET') === 'POST') {
    inserted.push(JSON.parse(init.body));
    return ok([{ id: 'o1', order_number: 'DKT-test', subtotal: 0, items: [] }]);
  }
  return ok([]);
};

const post = async (body) => {
  inserted = []; ratesAsked = 0;
  const res = {
    statusCode: null,
    body: null,
    setHeader() {},
    end(value) { this.body = JSON.parse(value); },
  };
  await handler({
    method: 'POST',
    headers: { host: 'shop.test' },
    async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)); },
  }, res);
  return res;
};

const line = { productSlug: 'hug-n-1', variantId: 'v1', size: '30 ml', quantity: 1, name: 'HUG N°1' };

// --- 1. A catalogue order with NO shipping block at all must be refused -------------------------------
// This is the shape that slipped past: nothing to trip the volunteered-intent guard, and fee 0 waiting
// at the first line of computeShippingFee.
const silent = await post({ customerName: 'Uji', contact: '0800', items: [line] });
assert.equal(silent.statusCode, 422,
  `an order with no shipping at all was accepted (${silent.statusCode}) — it ships for free`);
assert.match(silent.body.message, /Pilih area tujuan pengiriman di Indonesia/);
assert.equal(silent.body.reason, 'domestic_destination_required');
assert.equal(inserted.length, 0, 'and nothing may be written');

// --- 2. The half that already worked keeps working -----------------------------------------------------
const partial = await post({ customerName: 'Uji', contact: '0800', items: [line], shipping: { courier: 'jne', service: 'REG' } });
assert.equal(partial.statusCode, 422, 'a courier without a destination is still refused');

// --- 3. The must-pass half: a real catalogue order still goes through ----------------------------------
// The opposite direction matters as much — a guard that refuses every order is not a fix.
const real = await post({
  customerName: 'Uji', contact: '0800', items: [line],
  shipping: { destinationId: '12345', destination: { id: '12345', label: 'Jakarta Selatan' }, courier: 'jne', service: 'REG' },
});
assert.notEqual(real.statusCode, 422, `a properly addressed order was refused: ${JSON.stringify(real.body)}`);
assert.ok(ratesAsked > 0, 'and its shipping must actually be priced');

// --- 4. Calling a cart of bottles "bespoke" must not buy free freight ----------------------------------
// The first version of this guard asked `!isBespoke`, and isBespoke is
// `input.source === 'bespoke' || Boolean(input.bespoke)` — both come from the request. One extra word in
// the payload skipped the check entirely and the order was created, 200, freight never priced. The test
// is what is in the parcel: catalog.resolved is the endpoint's own lookup of the items against the
// database, and it cannot be talked out of.
const disguised = await post({ customerName: 'Uji', contact: '0800', items: [line], source: 'bespoke' });
assert.equal(disguised.statusCode, 422,
  `a cart of bottles labelled "bespoke" was accepted (${disguised.statusCode}) — it ships for free`);
assert.equal(inserted.length, 0, 'and nothing may be written');

// A brief that ALSO carries bottles is shipped too, so it is priced like any other parcel.
const mixed = await post({
  customerName: 'Uji', contact: '0800', items: [line], source: 'bespoke',
  bespoke: { optionIds: { size: 'size-30' }, brief: { aroma: 'kayu' } },
});
assert.equal(mixed.statusCode, 422, 'a brief carrying catalogue bottles still needs a destination');

// --- 5. A bespoke request needs an Indonesian destination too ----------------------------------------
// Until 14 Nov 2026 a brief with no bottles could arrive unshipped, "quoted by hand afterwards" — which
// also meant a rupiah order with any address at all, a parcel abroad at the domestic price, through an
// unauthenticated endpoint. Dekito's brief (P0-2): rupiah is for delivery inside Indonesia, and the
// bespoke form has asked for the area, courier and service since #648. Abroad is the international branch.
const bespoke = await post({
  customerName: 'Uji', contact: '0800', source: 'bespoke',
  delivery: { address: '123 Orchard Rd, Singapore 238858', area: '' },
  // A priced option on purpose: without one the endpoint refuses at "Order has no priced items", the
  // request never reaches the shipping guard, and this section would pass without testing anything.
  bespoke: { optionIds: { size: 'size-30' }, brief: { aroma: 'kayu' } },
});
assert.equal(bespoke.statusCode, 422, `a rupiah bespoke order with no domestic destination was accepted (${bespoke.statusCode})`);
assert.equal(bespoke.body.reason, 'domestic_destination_required');
assert.equal(inserted.length, 0, 'and nothing may be written');

// --- 6. And one addressed in Indonesia still goes through, its freight priced -------------------------
const shippedBrief = await post({
  customerName: 'Uji', contact: '0800', source: 'bespoke',
  bespoke: { optionIds: { size: 'size-30' }, brief: { aroma: 'kayu' } },
  shipping: { destinationId: '12345', destination: { id: '12345', label: 'Jakarta Selatan' }, courier: 'jne', service: 'REG' },
});
assert.notEqual(shippedBrief.statusCode, 422, `a bespoke order addressed in Indonesia was refused: ${JSON.stringify(shippedBrief.body)}`);
assert.ok(ratesAsked > 0, 'and its shipping must actually be priced');

console.log('catalog-order-is-shipped selfcheck OK (every rupiah order — bottles or a brief, whatever the caller calls it — names an Indonesian destination and is priced for freight, or is refused)');
