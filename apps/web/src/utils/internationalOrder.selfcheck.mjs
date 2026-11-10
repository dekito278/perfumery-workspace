// `node src/utils/internationalOrder.selfcheck.mjs`
//
// The English shop writes its own orders (Dekito, 10 Nov 2026: tired of every overseas sale going through
// WhatsApp). Money, and an unauthenticated endpoint, so the arithmetic AND the endpoint are RUN here —
// against a fake database, never the real one.
//
// What must hold:
//   1. the server charges exactly what the cart showed (same primitives, same rounding);
//   2. nothing the browser sends can change a price, the shipping or the total;
//   3. the payment page asks for that exact total, not the next $5 up;
//   4. stock is held, and a stock refusal cancels the order it just wrote;
//   5. no voucher, bespoke brief or domestic courier rides in; the free vial stays free and single.
import assert from 'node:assert/strict';
import process from 'node:process';
import { Readable } from 'node:stream';
import { quoteInternationalOrder, paymentAmountUsd } from './internationalOrder.js';
import { usdPriceFor, USD_PRICE_RATE } from './usdPrice.js';
import { internationalPriceFor } from './shippingRegion.js';
import { quoteInternationalShippingPrice } from './internationalShippingPrice.js';
import { isPaymentToken } from './paymentLinkToken.js';
import { FREE_VIAL_TAG } from './freeVial.js';

// --- 1. The quote, against the cart's own composition ---------------------------------------------------
const rose = { name: 'La Rose', size: '30 ml', quantity: 2, retailPrice: 569000, tierPrices: { overseas: 1260000 } };
const oud = { name: 'Oud', size: '30 ml', quantity: 1, retailPrice: 689000, tierPrices: { overseas: 1500000 } };
const quote = quoteInternationalOrder({ country: 'us', lines: [rose, oud] });
assert.equal(quote.ok, true, quote.reason);
const cartUnit = (line) => usdPriceFor(internationalPriceFor({ tierPrices: line.tierPrices, linePrice: line.retailPrice }));
const cartShipping = quoteInternationalShippingPrice({ countryCode: 'US', bottles: 3 }).usd;
assert.equal(quote.goodsUsd, cartUnit(rose) * 2 + cartUnit(oud), 'bottles priced exactly as the cart prices them');
assert.equal(quote.shippingUsd, cartShipping, 'shipping priced exactly as the cart prices it');
assert.equal(quote.totalUsd, quote.goodsUsd + quote.shippingUsd);
assert.equal(quote.subtotalIdr, quote.totalUsd * USD_PRICE_RATE);
assert.equal(paymentAmountUsd(quote.subtotalIdr), quote.totalUsd, 'the payment page asks for the cart total exactly');
assert.equal(paymentAmountUsd(1260000), usdPriceFor(1260000), 'an order Studio wrote in rupiah keeps the usual rounding');
assert.equal(paymentAmountUsd(147 * USD_PRICE_RATE), 147, 'a total off the $5 step (Dekito can set any subsidy) is asked for exactly, not rounded up');
assert.equal(paymentAmountUsd(0), null);

for (const [country, why] of [['ID', 'Indonesia is the domestic shop'], ['XX', '"another country" is quoted by message'], ['', 'no country']]) {
  assert.equal(quoteInternationalOrder({ country, lines: [rose] }).ok, false, why);
}
assert.equal(quoteInternationalOrder({ country: 'US', lines: [{ ...rose, size: '50 ml' }] }).ok, false,
  'a size the shipping rule was not written for is never quoted as if it were 30 ml');
assert.equal(quoteInternationalOrder({ country: 'US', lines: [{ ...rose, tierPrices: {} }] }).ok, false,
  'no export price set = no price invented from the domestic one');
assert.equal(quoteInternationalOrder({ country: 'US', lines: [{ ...rose, tierPrices: { overseas: 500000 } }] }).ok, false,
  'an export price below retail is a slip, not a price');
assert.equal(quoteInternationalOrder({ country: 'US', lines: [{ ...rose, quantity: 7 }] }).ok, false,
  'more bottles than the policy quotes is asked for, not priced');
assert.equal(quoteInternationalOrder({ country: 'US', lines: [{ ...rose, quantity: 7 }], policy: { maxQuotedBottles: 8 } }).ok, true,
  'and the cap is Dekito\'s policy, not a constant');

// --- 2. The endpoint, run ---------------------------------------------------------------------------------
process.env.SUPABASE_URL = 'https://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
delete process.env.TELEGRAM_BOT_TOKEN;

const PRODUCTS = {
  'la-rose': { id: 'p-rose', slug: 'la-rose', name: 'La Rose', category: 'Floral', price_number: 569000, tags: ['cogs:120000'],
    variants: [{ id: '30-ml', size: '30 ml', priceNumber: 569000 }] },
  'vial-hadiah': { id: 'p-vial', slug: 'vial-hadiah', name: 'Vial hadiah', category: 'Gift', price_number: 0, tags: [FREE_VIAL_TAG],
    variants: [{ id: 'la-rose', size: 'La Rose', priceNumber: 0 }] },
};
const PRICES = { 'p-rose': [{ product_id: 'p-rose', variant_id: '30-ml', tier: 'overseas', price_number: 1260000 }] };

const run = async (body, { stockFails = false } = {}) => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    calls.push({ href, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
    const ok = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
    if (href.includes('/storefront_products?')) return ok([PRODUCTS[decodeURIComponent(href.match(/slug=eq\.([^&]+)/)[1])]].filter(Boolean));
    if (href.includes('/storefront_product_prices?')) return ok(PRICES[href.match(/product_id=eq\.([^&]+)/)[1]] || []);
    if (href.includes('/storefront_price_schedule?')) return ok([]);
    if (href.includes('/storefront_export_shipping_settings?')) return ok([]);
    if (href.includes('/rpc/storefront_upsert_customer')) return ok([{ id: 'c1', customer_code: 'SOLI00001' }]);
    if (href.includes('/rpc/storefront_deduct_inventory_for_order')) {
      return stockFails ? { ok: false, status: 400, text: async () => 'insufficient stock', json: async () => ({}) } : ok(null);
    }
    if (href.endsWith('/storefront_orders') && init.method === 'POST') return ok([{ id: 'o1', ...JSON.parse(init.body) }]);
    if (href.includes('/storefront_orders?') && init.method === 'PATCH') return ok(null);
    throw new Error(`unexpected fetch ${href}`);
  };
  const { default: handler } = await import('../../api/orders/create.js');
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = 'POST';
  req.headers = { host: 'shop.test' };
  let status = 0;
  let text = '';
  const res = { setHeader() {}, end(chunk) { text = chunk; }, set statusCode(code) { status = code; }, get statusCode() { return status; } };
  await handler(req, res);
  return { status, json: JSON.parse(text || '{}'), calls };
};

const buyer = { country: 'DE', name: 'Anna Example', email: 'anna@example.test', phone: '+49 30 000', address: 'Teststrasse 1', city: 'Berlin', postcode: '10115' };
// Tampered on purpose: a client price, subtotal and shipping that are all wrong.
const tampered = {
  international: buyer,
  items: [{ productSlug: 'la-rose', variantId: '30-ml', quantity: 2, priceNumber: 1, price: 'US$1' }],
  subtotal: 1, shippingFee: 0, totalUsd: 2,
  client: { shop: 'en', surface: 'desktop' },
};
const good = await run(tampered);
assert.equal(good.status, 200, JSON.stringify(good.json));
const insert = good.calls.find((c) => c.href.endsWith('/storefront_orders') && c.method === 'POST').body;
const expected = quoteInternationalOrder({ country: 'DE', lines: [{ name: 'La Rose', size: '30 ml', quantity: 2, retailPrice: 569000, tierPrices: { overseas: 1260000 } }] });
assert.equal(insert.subtotal, expected.subtotalIdr, 'the stored total is the server\'s, whatever the browser sent');
assert.equal(good.json.totalUsd, expected.totalUsd);
assert.equal(paymentAmountUsd(insert.subtotal), expected.totalUsd, 'and /pay will ask for exactly that');
assert.equal(insert.items[0].priceNumber * 2 + expected.shippingIdr, insert.subtotal, 'lines + shipping add up to the total');
assert.deepEqual(insert.items[0].tags, [], 'the product\'s internal tags (COGS) never reach an order line');
assert.equal(insert.payment_provider, 'manual', 'the proof-upload RPC only accepts manual orders');
assert.equal(insert.payment_status, 'pending');
assert.equal(insert.client_context.shop, 'en', 'every message about it goes out in English');
assert.ok(isPaymentToken(insert.payment_token), 'a /pay token in the format the page accepts');
assert.equal(good.json.paymentToken, insert.payment_token);
assert.match(insert.notes, /Berlin/);
assert.equal(insert.payment_response.amountUsd, expected.totalUsd,
  '/payment?order= (Studio templates, the portal) reads the dollars from here, as on a Studio export order');
assert.equal(insert.payment_response.currency, 'USD');
assert.ok(insert.payment_response.bankName && insert.payment_response.swift,
  'and the international account — without it that page shows the domestic BCA account for a dollar order');
assert.ok(!('contact' in good.json) && !('order' in good.json), 'the response carries no customer data back');
assert.ok(good.calls.some((c) => c.href.includes('storefront_deduct_inventory_for_order')), 'stock is held');
const upserts = good.calls.filter((c) => c.href.includes('storefront_upsert_customer')).map((c) => c.body.p_increment_order);
assert.deepEqual(upserts, [false, true], 'the order is counted only once it exists');

const second = await run(tampered);
assert.notEqual(second.json.paymentToken, good.json.paymentToken, 'one token per order');

const stock = await run(tampered, { stockFails: true });
assert.equal(stock.status, 409);
assert.ok(stock.calls.some((c) => c.method === 'PATCH' && c.body?.status === 'cancelled'), 'a stock refusal cancels the order it wrote');

for (const [extra, why] of [
  [{ voucherCode: 'HEMAT10' }, 'a voucher'],
  [{ shipping: { destinationId: '1', courier: 'jne', service: 'REG' } }, 'a domestic courier'],
  [{ bespoke: { optionIds: {} } }, 'a bespoke brief'],
]) {
  const refused = await run({ ...tampered, ...extra });
  assert.equal(refused.status, 422, `${why} is refused on an international order`);
  assert.ok(!refused.calls.some((c) => c.method === 'POST' && c.href.endsWith('/storefront_orders')), `${why}: nothing written`);
}
// The free vial rides along, as the English cart offers it: free, one, and outside the bottle count.
const vialLine = { productSlug: 'vial-hadiah', variantId: 'la-rose', quantity: 5, priceNumber: 999 };
const vial = await run({ ...tampered, items: [...tampered.items, vialLine] });
assert.equal(vial.status, 200, JSON.stringify(vial.json));
const vialOrder = vial.calls.find((c) => c.href.endsWith('/storefront_orders') && c.method === 'POST').body;
const gift = vialOrder.items.find((item) => item.slug === 'vial-hadiah');
assert.equal(gift.priceNumber, 0, 'the gift costs nothing, whatever the browser says');
assert.equal(gift.quantity, 1, 'and there is one of it, however many were asked for');
assert.deepEqual(gift.tags, [FREE_VIAL_TAG], 'tagged as the gift for the packing screens');
assert.equal(vialOrder.subtotal, insert.subtotal, 'the gift changes neither the shipping nor the total');
const twoVials = await run({ ...tampered, items: [...tampered.items, vialLine, vialLine] });
assert.equal(twoVials.status, 400, 'a second vial line is refused');
const onlyVial = await run({ ...tampered, items: [vialLine] });
assert.equal(onlyVial.status, 422, 'a gift alone is not an order');
for (const country of ['ID', 'XX']) {
  const refused = await run({ ...tampered, international: { ...buyer, country } });
  assert.equal(refused.status, 422, `country ${country} is not an international quote`);
}
const noEmail = await run({ ...tampered, international: { ...buyer, email: 'not-an-email' } });
assert.equal(noEmail.status, 422);
assert.equal(noEmail.json.field, 'email');

console.log('internationalOrder selfcheck OK (server charges what the cart showed; /pay asks for it exactly; browser prices ignored)');

// --- 3. The wiring: cart → form → endpoint → /pay → receipt -----------------------------------------------
{
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const read = (...parts) => readFileSync(join(srcDir, ...parts), 'utf8');
  const cart = read('pages', 'InternationalCartPage.jsx');
  assert.match(cart, /const canPlaceHere = quote\.settled && !unpriced\.length && !unfulfillable\.length;/,
    'the cart takes the order itself only when every line and the parcel are priced');
  assert.match(cart, /canPlaceHere \? \(\s*<>\s*<InternationalOrderForm quote=\{quote\} \/>/, 'and then it shows the form');
  const service = read('services', 'orderService.js');
  const place = service.slice(service.indexOf('export const placeInternationalOrder'), service.indexOf('const createBespokeOrderViaEndpoint'));
  assert.ok(place.includes("fetch('/api/orders/create'"), 'the form posts to the one order endpoint');
  assert.doesNotMatch(place, /priceNumber|subtotal|totalUsd|shippingUsd|unitUsd/,
    'the browser sends which bottles and where — never a price');
  const form = read('components', 'storefront', 'InternationalOrderForm.jsx');
  assert.match(form, /navigate\(`\/pay\/\$\{paymentToken\}`\)/, 'a placed order goes straight to its payment page');
  assert.match(form, /quote\.gift \? \[quote\.gift\]/, 'the free vial the buyer picked travels with the order');
  const pay = read('pages', 'PaymentInstructionsPage.jsx');
  assert.match(pay, /paymentAmountUsd\(order\.amountIdr\)/, 'the payment page asks for the exact total');
  assert.match(pay, /submitOrderPaymentProof\(orderNumber/, 'the receipt is recorded on the order');
  assert.match(pay, /notify-proof/, 'and Dekito is told');
  const cartService = read('services', 'cartService.js');
  const endpointSource = readFileSync(join(srcDir, '..', 'api', 'orders', 'create.js'), 'utf8');
  for (const fallback of ["'PT Bank SMBC Indonesia Tbk (Jenius)'", "'SUNIIDJA'"]) {
    assert.ok(cartService.includes(fallback) && endpointSource.includes(fallback),
      `the endpoint and INTERNATIONAL_TRANSFER_PAYMENT disagree on the fallback ${fallback}`);
  }
  const studio = read('pages', 'ExportShippingCalculatorPage.jsx');
  for (const key of ['amountUsd', 'currency', 'amountIdr', 'usdRate', 'bankName', 'swift', 'accountNumber', 'accountName', 'bankAddress']) {
    assert.ok(studio.includes(key) && new RegExp(`\\b${key}:`).test(endpointSource.slice(endpointSource.indexOf('payment_response:'))),
      `payment_response.${key} is written by one order writer and not the other`);
  }
}

// --- 4. PayPal: shown only once Dekito sets the link, and only ever to paypal.me ------------------------
{
  const { paypalLinkFor } = await import('../data/paymentDetails.js');
  assert.equal(paypalLinkFor(180, ''), '', 'no link set = no PayPal block (nothing invented)');
  assert.equal(paypalLinkFor(180, 'https://paypal.me/solivagant'), 'https://paypal.me/solivagant/180USD', 'the amount rides in the link');
  assert.equal(paypalLinkFor(180, 'https://www.paypal.me/solivagant/'), 'https://paypal.me/solivagant/180USD');
  assert.equal(paypalLinkFor(180, 'https://paypal.me.evil.test/x'), '', 'a look-alike host is refused');
  assert.equal(paypalLinkFor(180, 'http://paypal.me/solivagant'), '', 'only https');
  assert.equal(paypalLinkFor(null, 'https://paypal.me/solivagant'), '', 'no amount, no link');
}

console.log('internationalOrder wiring OK');
