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
import { bespokeFlowSteps, bespokeStepKeys, bespokeTakesPayment, buildBespokeEnquiryDraft } from './bespokeOrder.js';

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

// Any name of the shape add…Item(, not the one spelling we happened to look for first: the customer
// portal's reorder calls addCartItem(), slipped past a pattern that only knew addItem(), and quietly
// filled a basket the English shop cannot open.
const REACHES_CART = /\badd[A-Za-z]*Item\(|to="\/cart"|'\/cart'|"\/mobile\/cart"|'\/mobile\/cart'/;
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
  // Branching on it directly, or handing it to a named rule that does — bespoke routes three surfaces
  // through bespokeTakesPayment() rather than repeating the ternary, which is the better answer and
  // must not read as "never used".
  assert.match(source, /isInternational\s*\?|!\s*isInternational|\w+\(\s*isInternational\s*\)|\(\s*\w+,\s*isInternational\s*\)/,
    `${rel} reads which shop it is in and then does nothing with it — the cart is still offered in the `
    + 'English shop.');
}
// The scan must actually be finding files. A regex that matches nothing would pass every assertion above
// while guarding nothing at all, which is the way this class of guard usually dies.
assert.ok(checked >= 4, `the cart-surface scan only found ${checked} file(s); it has stopped seeing the shop`);

// --- 4. And no buyer page takes a PAYMENT in the English shop ----------------------------------------
//
// The cart is not the only till. /en/bespoke carried its own complete checkout — name, address, an
// Indonesian courier list, a domestic voucher box, "Amount to transfer Rp 255.000" and a working Pay
// button — on the same screen as a notice reading "International orders are not placed through this
// checkout". Removing the cart and leaving that was half a rule, and the half left standing was the
// one that takes money.
const TAKES_PAYMENT = /checkoutPaymentMethods|createDokuCheckout|createBespokeRequest|isManualTransferPayment/;
let payChecked = 0;
for (const rel of candidates) {
  // PaymentPage settles an order that ALREADY exists; it never starts one. Gating it would stop a buyer
  // paying for something they have already agreed to — which is the opposite of the point.
  if (EXEMPT.has(rel) || GATED_BY_ROUTE.test(rel) || STUDIO.test(rel)) continue;
  const source = read(rel);
  if (!TAKES_PAYMENT.test(source)) continue;
  payChecked += 1;
  assert.match(source, /const\s*\{[^}]*\bisInternational\b[^}]*\}\s*=/,
    `${rel} takes a payment without asking which shop it is in — in the English shop that is a domestic `
    + 'price and an Indonesian courier for a buyer neither can serve.');
  // Branching on it directly, or handing it to a named rule that does — bespoke routes three surfaces
  // through bespokeTakesPayment() rather than repeating the ternary, which is the better answer and
  // must not read as "never used".
  assert.match(source, /isInternational\s*\?|!\s*isInternational|\w+\(\s*isInternational\s*\)|\(\s*\w+,\s*isInternational\s*\)/,
    `${rel} knows which shop it is in and takes the payment anyway.`);
}
assert.ok(payChecked >= 2, `the payment-surface scan only found ${payChecked} file(s); it has stopped seeing the tills`);

// --- 4b. Reorder is not offered where there is no cart to reorder into --------------------------------
//
// Pinned to the BUTTON, not to the file. The scan above only asks whether the portal consults the shop
// somewhere, and it does — in a second, belt-and-braces line — so deleting the gate around the button
// itself left every other assertion green while an English customer got a Reorder button that fills a
// basket they cannot open and drops them on the catalogue.
{
  const portal = read('pages/CustomerPortalPage.jsx');
  const at = portal.indexOf('onReorder(order)');
  assert.ok(at > 0, 'the reorder button has moved; this check no longer points at anything');
  const before = portal.slice(Math.max(0, at - 400), at);
  assert.match(before, /isInternational \? null :/,
    'the Reorder button is offered in the English shop, which has no cart to put anything into');
}

// --- 5. Bespoke stops at the design in the English shop ----------------------------------------------
//
// Tested as a RULE rather than as a branch spotted in JSX: three surfaces ask this question — the
// desktop checkout panel, the phone's wizard and the numbered list in the hero — and gating them one at
// a time is exactly how /en/bespoke kept a working till after the cart was removed. Two sabotage runs
// re-opened it while every file still "mentioned" isInternational.
assert.equal(bespokeTakesPayment(false), true, 'the Indonesian shop must still take bespoke payments');
assert.equal(bespokeTakesPayment(true), false, 'the English shop has no bespoke price to charge and no courier that reaches the buyer');

const steps = [{ key: 'aroma' }, { key: 'package' }, { key: 'bottle' }, { key: 'delivery' }, { key: 'payment' }];
assert.deepEqual(bespokeFlowSteps(steps, true).map((step) => step.key), ['aroma', 'package', 'bottle'],
  'the English wizard still walks to an address form and a Pay button');
assert.deepEqual(bespokeFlowSteps(steps, false).map((step) => step.key), steps.map((step) => step.key),
  'the Indonesian wizard lost a step');
assert.equal(bespokeStepKeys(['a', 'b', 'c', 'd', 'e'], true).length, 3,
  'the English hero promises five steps and delivers three');
assert.equal(bespokeStepKeys(['a', 'b', 'c', 'd', 'e'], false).length, 5);

// The three surfaces must ROUTE THROUGH those functions rather than each re-deciding.
for (const [page, needles] of [
  ['pages/BespokePage.jsx', [/checkoutOpen && bespokeTakesPayment\(isInternational\)/, /bespokeStepKeys\(stepKeys, isInternational\)/]],
  ['pages/mobile/MobileBespokePage.jsx', [/bespokeFlowSteps\(allFlowSteps, isInternational\)/]],
]) {
  const source = read(page);
  for (const needle of needles) {
    assert.match(source, needle, `${page} decides for itself where bespoke stops, instead of asking the one rule`);
  }
}

// --- 5b. And the English bespoke copy does not promise the steps that were removed -------------------
// The page can stop at the bottle while its own lead paragraph still says "delivery and payment in one
// short flow", which is the kind of leftover nobody reads twice.
{
  const messages = read('i18n', 'messages.js');
  const en = messages.slice(messages.lastIndexOf('"bsp.toCheckout"') - 20000);
  for (const key of ['bsp.flowLead']) {
    const line = en.split('\n').find((row) => row.includes(`"${key}"`));
    assert.ok(line, `${key} has gone missing from the English block`);
    assert.doesNotMatch(line, /\bpayment\b/i,
      `${key} still promises a payment step the English shop no longer has:\n  ${line.trim()}`);
  }

  // The one rupiah figure the English bespoke page still shows. It is the DOMESTIC cost of the build,
  // printed a few lines above "the price is quoted on WhatsApp" — true, but read as the final price
  // unless it says which price it is. Same shape as Rp 1.020.000 on the product page against Rp 260.000
  // in the cart: two honest numbers that contradict each other when neither is labelled.
  const subtotalLine = en.split('\n').find((row) => row.includes('"bsp.subtotal"'));
  assert.ok(subtotalLine, 'bsp.subtotal has gone missing from the English block');
  assert.match(subtotalLine, /Indonesian/,
    `the English bespoke summary prints a rupiah figure without saying which price it is:\n  ${subtotalLine.trim()}`);
}

// --- 6. The bespoke handoff is written in the message file, and quotes no price -----------------------
// There IS no international bespoke price — the options are one domestic set — so a number here would be
// invented. Run the real builder against a stub translator: a draft hardcoded in the component would not
// come back as the stub's output.
const stub = (key, vars = {}) => `${key}|${vars.name}|${vars.scent}|${vars.occasion}|${vars.bottle}`;
assert.equal(
  buildBespokeEnquiryDraft({ t: stub, perfumeName: 'Rain Letter', scent: 'Woody', occasion: 'A gift', bottle: '30 ml / Classic' }),
  'bsp.waOrderDraft|Rain Letter|Woody|A gift|30 ml / Classic',
  'the bespoke draft is not built from the message file, so it cannot follow the shop language',
);
assert.match(buildBespokeEnquiryDraft({ t: stub }), /\|-\|-\|-\|-$/, 'an unanswered field must read as a dash, not as "undefined"');
assert.equal(buildBespokeEnquiryDraft(), '', 'no translator, no draft');

console.log(`englishShopHasNoCart selfcheck OK (no cart and no till in the English shop: ${checked} buy surface(s) and ${payChecked} payment surface(s) gated, 4 routes redirected, and the WhatsApp draft names the bottle and its international price)`);
