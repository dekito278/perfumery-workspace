// `node src/utils/englishShopOrdersOnWhatsApp.selfcheck.mjs`
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
import { MESSAGES } from '../i18n/messages.js';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, '..');
const read = (...parts) => readFileSync(join(srcRoot, ...parts), 'utf8');
// Comments stripped for the forbidden-symbol checks: the cart page's own header explains what it must
// not reach, and a check that fails on the sentence explaining the rule is the trap this repo keeps.
const stripComments = (source) => source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const readCode = (...parts) => stripComments(read(...parts));


// --- 0. WHAT CHANGED ON 2026-10-06 -------------------------------------------------------------------
// This file was englishShopHasNoCart.selfcheck: from 18 Sep the English shop sold one bottle at a time
// by WhatsApp enquiry, and every add-to-cart, cart link and reorder was gated out of it, because the
// only cart was the domestic one — rupiah, a voucher box, an Indonesian courier list and DOKU. Dekito
// reversed that: "orang luar itu masukin ke keranjang sama kayak di Indonesia — dari situ baru pilih
// negara dan kelihatan ongkir, baru order ke WA." So the English shop has a cart again, and what this
// guard holds is what that cart may and may not be: a basket in dollars with a destination and the
// shipping beside it, whose till is WhatsApp — and NEVER the domestic checkout.

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

// --- 1. One address, two carts; the checkout stays domestic --------------------------------------
const app = read('App.jsx');
for (const path of ['/cart', '/mobile/cart']) {
  const line = app.split('\n').find((entry) => entry.includes(`path="${path}"`));
  assert.ok(line, `the route ${path} has disappeared from App.jsx`);
  assert.match(line, /<ByShop /, `${path} must render one cart or the other by shop`);
  assert.match(line, /international=\{<(Mobile)?InternationalCartPage/, `${path} must hand the English shop its own cart page`);
  assert.doesNotMatch(line, /DomesticOnly/, `${path} is still closed to the English shop`);
}
for (const path of ['/checkout', '/mobile/checkout']) {
  const line = app.split('\n').find((entry) => entry.includes(`path="${path}"`));
  assert.ok(line, `the route ${path} has disappeared from App.jsx`);
  assert.match(line, /<DomesticOnly>/, `${path} is reachable from the English shop — a dollar basket would meet a rupiah till`);
}
const byShop = (app.match(/const ByShop = [\s\S]*?\n\};/) || [''])[0];
assert.match(byShop, /isInternational \? international : domestic/, 'ByShop must choose by the shop and nothing else');

// --- 2. The English cart can reach the dollar, the destination and WhatsApp — and nothing domestic --
for (const page of ['pages/InternationalCartPage.jsx', 'pages/mobile/MobileInternationalCartPage.jsx']) {
  const source = readCode(page);
  // FreeVialPicker is NOT on this list since 2026-10-06: Dekito opened the gift to both shops, and every
  // word the picker shows comes from the message file, so it reads in English. What it must do here is
  // reach the ORDER — asserted below — because the gift is the one line he cannot infer from the total.
  for (const forbidden of [/formatRupiah/, /\bRp\b/, /useAppliedVoucher|cart-voucher|voucherCode/, /\/checkout/, /checkoutPaymentMethods|createDokuCheckout|isManualTransferPayment/, /memberSavingForCart/]) {
    assert.doesNotMatch(source, forbidden, `${page} reaches something domestic: ${forbidden} — the English cart must not`);
  }
  assert.match(source, /useCartInternationalQuote\(items\)/, `${page} must price the basket through the international quote`);
  assert.match(source, /<InternationalShippingQuote quote=\{quote\}/, `${page} must show the destination, shipping and total from that same quote`);
  assert.match(source, /buildInternationalCartDraft\(\{ t, quote: draft \}\)/, `${page} must send the order through the cart draft builder`);
  assert.match(source, /canOrder \? buildWhatsAppCheckoutUrl\(message, phone\) : '#'/, `${page} must open WhatsApp only with a complete message`);
  assert.match(source, /US\$\$\{/, `${page} must print its prices in dollars`);
  // The gift, offered here and carried into the order. A picker with no line in the message would let a
  // buyer choose an aroma that never reaches him.
  assert.match(source, /<FreeVialPicker items=\{items\} products=\{(catalog|products)\} onPick=\{setGift\} \/>/,
    `${page} does not offer the free vial — both shops have had it since 2026-10-06`);
}
{
  const hook = readCode('hooks/useInternationalQuote.js');
  assert.match(hook, /gift \? \[t\('export\.waCartGiftLine'/,
    'the English cart order does not name the gift, so he would pack the parcel without it');
  for (const shop of ['id', 'en']) {
    assert.ok(MESSAGES[shop]['export.waCartGiftLine'], `export.waCartGiftLine is missing from the ${shop} shop`);
  }
}
// The domestic carts never touch the international quote: a rupiah basket that starts quoting dollars
// is the mirror of the leak this guard was first written for.
for (const page of ['pages/CartPage.jsx', 'pages/mobile/MobileCartPage.jsx', 'pages/CheckoutPage.jsx', 'pages/mobile/MobileCheckoutPage.jsx']) {
  assert.doesNotMatch(readCode(page), /useCartInternationalQuote|buildInternationalCartDraft/, `${page} is the domestic till and must not quote internationally`);
}

// --- 2b. THE CART IS REACHABLE FROM THE NAVIGATION, ON BOTH SHOPS -----------------------------------
// Found on 2026-10-06, four days after the English cart shipped: the phone's bottom nav still dropped the
// cart tab in the English shop. It had been right while that shop had no cart and /mobile/cart redirected
// — "a tab that bounces you back is worse than no tab" — and nothing moved it when the cart arrived. An
// English buyer on a phone could add a bottle and have no way back to the basket from the navigation at
// all; the only door left was the one "View cart" button on the sheet that opens with the add, and
// dismissing it closed the shop's own checkout. On a phone the bottom nav IS the navigation.
//
// Held on the LIST, not on the layout's words: the tab must be there unconditionally.
{
  const layout = readCode('layouts/MobileCommerceLayout.jsx');
  const items = (layout.match(/const COMMERCE_NAV_ITEMS = \[[\s\S]*?\n\];/) || [''])[0];
  assert.ok(items, 'the phone nav no longer declares its tabs as one list');
  assert.match(items, /path: '\/mobile\/cart'/, 'the phone nav has no cart tab at all');
  assert.doesNotMatch(items, /isInternational/,
    'the phone nav drops a tab depending on the shop again — the English shop has a cart to reach');
  // The desktop headers are the same question, asserted where they live.
  for (const header of ['components/storefront/PublicHeader.jsx', 'components/storefront/StorefrontHeader.jsx']) {
    const source = readCode(header);
    assert.match(source, /'\/cart'|to="\/cart"/, `${header} no longer links to the cart`);
    assert.doesNotMatch(source, /isInternational \? (null|\[\]) :/, `${header} hides the cart from one of the shops`);
  }
}

// --- 3. The product page's WhatsApp button is an enquiry again, in both shops ----------------------
const keys = read('utils/overseasEnquiry.js');
assert.match(keys, /export const overseasDraftKeys = \(\) => \(\{ labelKey: 'export\.ask', draftKey: 'export\.waDraft' \}\);/,
  'the product page button must be the enquiry in both shops — the order lives in the cart now');
const messages = read('i18n/messages.js');
assert.doesNotMatch(messages, /'export\.waOrderDraft'|'export\.order'/, 'the order-from-product-page copy is retired with the button');
assert.match(messages, /'export\.waCartDraft'/, 'the cart order draft must exist');
for (const page of ['pages/PublicProductDetailPage.jsx', 'pages/mobile/MobileProductDetailPage.jsx', 'pages/ImmersiveProductPage.jsx']) {
  const source = readCode(page);
  assert.doesNotMatch(source, /buildWhatsAppCheckoutUrl\(|buildOverseasDraft\(/, `${page} builds its own WhatsApp link — the enquiry button is the one surface for that`);
  // The button's own price. Found on the first local run: "Add to cart — Rp 359.000" in the English shop,
  // because the label read the domestic string. Every priced add-to-cart label must go through
  // quotedInternationalPrice, which answers the dollar when there is an export price and the caller's
  // own label when there is not.
  const labels = source.match(/t\('pdp\.addToCartWithPrice', \{[^}]*\}\)/g) || [];
  for (const call of labels) {
    assert.match(call, /quotedInternationalPrice\(exportPrice/, `${page}: an add-to-cart label prints the domestic price in the English shop: ${call}`);
  }
  // And every price a page STORES for its "added to cart" confirmation. The phone's sheet printed
  // "30 ml — Rp 323.000" to Dekito himself under a US$80 page, the hour the English cart went live —
  // the member price, because he was signed in. Any `price:` written into that state must go through the
  // helper, whichever export-price variable the page happens to hold.
  for (const call of source.match(/setLastAddedItem\(\{[^}]*\}\)/g) || []) {
    assert.match(call, /price: quotedInternationalPrice\(/, `${page}: the added-to-cart confirmation stores the domestic price: ${call}`);
  }
}

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

// --- 4b. Reorder is offered in both shops, and must LAND somewhere that exists -------------------------
//
// It was hidden in the English shop until 2026-10-06, when that shop had no cart; Dekito opened it with
// the cart. What had to change with it is the destination: reorder fills the basket and then navigates,
// and /checkout is still domestic-only — so an English customer would have been given a full basket and
// a bounce to the catalogue. Held on the NAVIGATION, which is the half that breaks silently.
{
  const portal = readCode('pages/CustomerPortalPage.jsx');
  const at = portal.indexOf('onReorder(order)');
  assert.ok(at > 0, 'the reorder button has moved; this check no longer points at anything');
  const before = portal.slice(Math.max(0, at - 400), at);
  assert.doesNotMatch(before, /isInternational \? null :/,
    'the Reorder button is hidden from the English shop again — that shop has a cart now');
  assert.match(portal, /if \(isInternational\) navigate\(isMobileRoute \? '\/mobile\/cart' : '\/cart'\);/,
    'reorder must land an English customer in the CART — /checkout is domestic-only and would bounce them');
  assert.match(portal, /navigate\(isMobileRoute \? '\/mobile\/checkout' : '\/checkout'\)/,
    'and an Indonesian customer must still land in the checkout');
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

console.log(`englishShopOrdersOnWhatsApp selfcheck OK (the English cart is dollars, a destination and WhatsApp; ${payChecked} payment surface(s) still gated; the checkout stays domestic)`);
