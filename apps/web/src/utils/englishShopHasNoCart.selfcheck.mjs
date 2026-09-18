// `node src/utils/englishShopHasNoCart.selfcheck.mjs`
//
// The English shop does not take orders through this checkout. It cannot: shipping is priced by
// RajaOngkir, which only knows Indonesian addresses, and the product pages quote the INTERNATIONAL
// price while the cart totals the domestic one.
//
// Measured before this guard existed: /en/catalog/la-tulipe offered La Tulipe 30 ml at Rp 1.020.000
// under the line "Price for delivery outside Indonesia", and the quick-add button on the catalogue card
// beside it put the same bottle in the cart at Rp 260.000 — where /en/checkout then asked for a domestic
// courier. The product PAGE had been gated; the card, the header cart, the phone's cart tab and the two
// routes had not. Half a rule is what this guard exists to stop.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { buildOverseasDraft, overseasDraftKeys } from './overseasEnquiry.js';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, '..');
const read = (...parts) => readFileSync(join(srcRoot, ...parts), 'utf8');

// --- 1. The draft that replaces the cart actually names what is being bought ------------------------
// Both sticky bars used to send t('intl.noticeMessage') — a generic line naming no perfume at all. On
// the phone the sticky bar is the only button most buyers ever press, so most orders arrived nameless.
const t = (key, vars = {}) => {
  const table = {
    'export.waDraft': 'ASK about international shipping for {item}.{line}',
    'export.waOrderDraft': 'ORDER {item}.{line}',
    'export.waDraftPrice': ' price {price}.',
  };
  return String(table[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
};

const english = buildOverseasDraft({ t, isInternational: true, name: 'La Tulipe', size: '30 ml', price: 'Rp 1.020.000' });
assert.ok(english.includes('La Tulipe'), `the draft does not name the perfume:\n${english}`);
assert.ok(english.includes('30 ml'), `the draft does not say which bottle:\n${english}`);
assert.ok(english.includes('Rp 1.020.000'), `the draft does not carry the price the page quoted:\n${english}`);
assert.ok(english.startsWith('ORDER'), 'the English shop has no cart, so its draft must read as an order, not an enquiry');

const indonesian = buildOverseasDraft({ t, isInternational: false, name: 'La Tulipe', size: '30 ml', price: 'Rp 260.000' });
assert.ok(indonesian.startsWith('ASK'), 'the Indonesian shop still sells through the cart; its overseas button is an enquiry beside it');
assert.notEqual(english, indonesian, 'both shops send the same draft — one of the two is wrong');

// A price the caller could not resolve must leave the line out rather than print an empty one.
assert.ok(!buildOverseasDraft({ t, isInternational: true, name: 'La Tulipe' }).includes('price'),
  'an unknown price printed an empty price line');
// No product, no draft: a WhatsApp link with an empty body is worse than no link.
assert.equal(buildOverseasDraft({ t, isInternational: true, name: '' }), '');
assert.equal(buildOverseasDraft(), '');

assert.notEqual(overseasDraftKeys(true).labelKey, overseasDraftKeys(false).labelKey,
  'the button reads the same in both shops, so one of them is lying about what it does');

// --- 1b. And every WhatsApp link on a product page uses that builder ---------------------------------
// The assertions above prove the builder is right; they say nothing about whether the page still calls
// it. Both sticky bars passed a generic message for months while a perfectly good builder sat beside
// them, so the call sites are checked by rule rather than by memory.
for (const page of ['pages/PublicProductDetailPage.jsx', 'pages/mobile/MobileProductDetailPage.jsx']) {
  const source = read(page);
  const calls = [...source.matchAll(/buildWhatsAppCheckoutUrl\(/g)];
  assert.ok(calls.length, `${page} no longer opens WhatsApp at all`);
  for (const call of calls) {
    const window = source.slice(call.index, call.index + 200);
    assert.match(window, /buildOverseasDraft/,
      `${page} opens WhatsApp with a message that is not built from the product — the buyer taps "order" `
      + `and Dekito receives a note naming no perfume:\n  ${window.split('\n')[0].trim()}`);
  }
}

// --- 2. The cart and checkout routes do not exist in the English shop --------------------------------
const app = read('App.jsx');
for (const path of ['/cart', '/checkout', '/mobile/cart', '/mobile/checkout']) {
  const line = app.split('\n').find((row) => row.includes(`<Route path="${path}"`));
  assert.ok(line, `the route ${path} has disappeared from App.jsx`);
  assert.match(line, /<DomesticOnly>/,
    `${path} is reachable in the English shop, where its prices and its courier list are both wrong:\n  ${line.trim()}`);
}
// And the wrapper must actually send the visitor away, not merely exist.
const gate = app.slice(app.indexOf('const DomesticOnly'), app.indexOf('const DomesticOnly') + 400);
assert.match(gate, /isInternational/, 'DomesticOnly does not consult the shop at all');
assert.match(gate, /<Navigate/, 'DomesticOnly renders no redirect, so the gated pages still render');

// --- 3. NO buyer surface reaches the cart without asking which shop it is in -------------------------
// Found by scanning, not by a list: the next add-to-cart button somebody adds has to be caught by this
// too, and a hardcoded list would quietly pass it.
const jsxFilesIn = (rel) => readdirSync(join(srcRoot, rel))
  .filter((name) => name.endsWith('.jsx'))
  .map((name) => join(rel, name));

const STUDIO = /Studio|Admin|Formula|Material|Batch|Inventory|Supplier|Report|Dashboard|Order|Shipment|Customers|Journal(Editor|Page|Detail)|Validation|Curation|Voucher|Quotation|Login|Auth/;
// Reached only after an order already exists, and the destination it links to is itself gated above.
const EXEMPT = new Set(['pages/PaymentPage.jsx']);
// These ARE the cart and the checkout. They are kept out of the English shop by their routes, not by a
// branch inside themselves — a page that renders half of itself is how the first attempt leaked.
const GATED_BY_ROUTE = /^(pages\/CartPage|pages\/CheckoutPage|pages\/mobile\/MobileCartPage|pages\/mobile\/MobileCheckoutPage)\.jsx$/;

const candidates = [
  ...jsxFilesIn('pages'),
  ...jsxFilesIn(join('pages', 'mobile')),
  ...jsxFilesIn(join('components', 'storefront')),
  ...jsxFilesIn('layouts'),
].map((rel) => rel.split('\\').join('/'));

const REACHES_CART = /addItem\(|to="\/cart"|'\/cart'|"\/mobile\/cart"|'\/mobile\/cart'/;
let checked = 0;
for (const rel of candidates) {
  if (EXEMPT.has(rel) || GATED_BY_ROUTE.test(rel) || STUDIO.test(rel)) continue;
  const source = read(rel);
  if (!REACHES_CART.test(source)) continue;
  checked += 1;
  // TWO tests, because the obvious one is not enough. Simply searching for the word `isInternational`
  // passes on a file that still MENTIONS it in dead JSX after the binding was deleted — which is what
  // three of the sabotage runs did: remove it from the destructuring and the gate silently stops working
  // while the guard stays green. So: the file must BIND it, and must actually branch on it.
  assert.match(source, /const\s*\{[^}]*\bisInternational\b[^}]*\}\s*=/,
    `${rel} reaches the cart but never reads which shop it is in — in the English shop that is a domestic `
    + 'price under an international one.');
  assert.match(source, /isInternational\s*\?|!\s*isInternational/,
    `${rel} reads which shop it is in and then does nothing with it — the cart is still offered in the `
    + 'English shop.');
}
// The scan must actually be finding files. A regex that matches nothing would pass every assertion above
// while guarding nothing at all, which is the way this class of guard usually dies.
assert.ok(checked >= 4, `the cart-surface scan only found ${checked} file(s); it has stopped seeing the shop`);

console.log(`englishShopHasNoCart selfcheck OK (no cart in the English shop: ${checked} buy surface(s) gated, 4 routes redirected, and the WhatsApp draft names the bottle and its international price)`);
