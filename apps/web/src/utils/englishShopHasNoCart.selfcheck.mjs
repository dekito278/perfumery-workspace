// `node src/utils/englishShopHasNoCart.selfcheck.mjs`
//
// THIS RULE INVERTED on 2026-09-25, and the file keeps its name so the history is findable.
//
// It used to hold that the English shop has no cart, and it had to: shipping was priced by RajaOngkir,
// which only knows Indonesian addresses, and the product pages quoted the INTERNATIONAL price while the
// cart totalled the domestic one. Measured before that guard existed: /en/catalog/la-tulipe offered
// La Tulipe 30 ml at Rp 1.020.000 under "Price for delivery outside Indonesia", and the quick-add button
// on the card beside it put the same bottle in the cart at Rp 260.000 — where /en/checkout then asked
// for a domestic courier. The product PAGE had been gated; the card, the header cart, the phone's cart
// tab and the two routes had not. Half a rule is what it existed to stop.
//
// Both reasons are now answered: the checkout asks for a destination COUNTRY instead of a courier, the
// cart totals the same international price the product page shows, and the order endpoint recomputes
// that price server-side from the country. So the cart is offered in both shops — and the rule that
// replaces "no cart" is NARROWER, not gone:
//
//   the English shop may sell, but every number in it must be the international one, and the checkout
//   must ask where the parcel is going before it will take an order.
//
// Deleting the old rule without putting this in its place would reopen the exact bug above, which is why
// the file was rewritten rather than removed.
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
    'export.waDraftPrice': ' price {price}.',
  };
  return String(table[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
};

const english = buildOverseasDraft({ t, isInternational: true, name: 'La Tulipe', size: '30 ml', price: 'Rp 1.020.000' });
assert.ok(english.includes('La Tulipe'), `the draft does not name the perfume:\n${english}`);
assert.ok(english.includes('30 ml'), `the draft does not say which bottle:\n${english}`);
assert.ok(english.includes('Rp 1.020.000'), `the draft does not carry the price the page quoted:\n${english}`);
// INVERTED. This required the English draft to read as an ORDER, because that shop had no cart and the
// WhatsApp button was the purchase. Once /en had a checkout, that draft became a second till sitting
// directly under "Add to cart — US$95" — and this assertion was holding it there.
//
// One errand in both shops now: ask. Each language's draft already addresses its own reader, so the
// same key serves both, and neither may read as placing an order.
assert.ok(english.startsWith('ASK'),
  'the English draft reads as placing an order. The checkout takes the order; this button asks about '
  + 'the destinations it cannot price');

const indonesian = buildOverseasDraft({ t, isInternational: false, name: 'La Tulipe', size: '30 ml', price: 'Rp 260.000' });
assert.ok(indonesian.startsWith('ASK'), 'the Indonesian shop sells through the cart; its overseas button is an enquiry beside it');
// Same inputs, not merely the same shape: the two above carry different prices on purpose, so comparing
// THEM would have compared the prices. The first version of this assertion did exactly that and failed
// on a difference it had introduced itself.
const sameInputs = (isInternational) => buildOverseasDraft({ t, isInternational, name: 'La Tulipe', size: '30 ml', price: 'Rp 260.000' });
assert.equal(sameInputs(true), sameInputs(false),
  'the two shops draft different errands again — they have the same cart and the same checkout, so the '
  + 'button has the same job in both');

// A price the caller could not resolve must leave the line out rather than print an empty one.
assert.ok(!buildOverseasDraft({ t, isInternational: true, name: 'La Tulipe' }).includes('price'),
  'an unknown price printed an empty price line');
// No product, no draft: a WhatsApp link with an empty body is worse than no link.
assert.equal(buildOverseasDraft({ t, isInternational: true, name: '' }), '');
assert.equal(buildOverseasDraft(), '');

assert.equal(overseasDraftKeys().labelKey, 'export.ask',
  'the button must name the errand it actually has — asking, not ordering');
assert.equal(overseasDraftKeys.length, 0,
  'the keys must not depend on which shop the reader is in again: both shops have a cart, so the button '
  + 'has one job');

// --- 1b. And the button that opens WhatsApp still builds its message from the product ---------------
// This used to scan the product pages, because both sticky bars called buildWhatsAppCheckoutUrl directly
// and passed a generic line for months. They no longer call it at all — the primary action there is now
// Add to cart — so the rule follows the call to where it actually lives.
const inquiry = read('components/storefront/OverseasInquiryButton.jsx');
const inquiryCalls = [...inquiry.matchAll(/buildWhatsAppCheckoutUrl\(/g)];
assert.ok(inquiryCalls.length, 'OverseasInquiryButton no longer opens WhatsApp at all');
assert.match(inquiry, /buildOverseasDraft\(/,
  'OverseasInquiryButton opens WhatsApp with a message that is not built from the product — the buyer '
  + 'taps "ask" and Dekito receives a note naming no perfume');

// --- 2. The cart and checkout are reachable in BOTH shops --------------------------------------------
// The gate is gone, and its absence is asserted: a redirect quietly reintroduced here would send an
// international buyer back to the catalogue from a cart they had just filled, with no message.
const app = read('App.jsx');
for (const path of ['/cart', '/checkout', '/mobile/cart', '/mobile/checkout']) {
  const line = app.split('\n').find((row) => row.includes(`<Route path="${path}"`));
  assert.ok(line, `the route ${path} has disappeared from App.jsx`);
  assert.doesNotMatch(line, /DomesticOnly|StorefrontPurchase/,
    `${path} is wrapped in a gate again — the English shop can check out now, and a pass-through wrapper
     also hides the page from every guard that resolves a route to what it renders:\n  ${line.trim()}`);
}
assert.doesNotMatch(app, /const DomesticOnly/, 'the old gate is back');

// The price of that exemption: each exempt page must take its currency from the ORDER. PaymentPage
// reads amountUsd off the payment session it builds; the portal goes through internationalOrderSummary.
// Neither may go back to asking which shop the reader is in, because that answers a different question.
for (const rel of ['pages/PaymentPage.jsx', 'pages/CustomerPortalPage.jsx']) {
  const source = read(rel);
  assert.match(source, /amountUsd|internationalOrderSummary\(/,
    `${rel} is exempt from the shop check because it reads the order instead — and it has stopped doing `
    + 'that, so it now settles a dollar order in rupiah with nothing watching');
  assert.match(source, /isAwaitingShippingQuote\(/,
    `${rel} must also know an order whose freight has not been quoted: it has no total yet, and this page `
    + 'is where someone would otherwise be invited to pay one');
}

// --- 2b. Reachable by the BUYER, not merely by the URL -------------------------------------------------
// The route check above passed for three commits while an English buyer could not actually get to the
// cart. The header's cart icon was hidden from the whole English shop, the catalogue's quick-add button
// was hidden, and a returning overseas customer's "Order again" was hidden — each behind its own
// isInternational gate, each with a comment citing a premise that had already expired: "the English shop
// has no cart". So someone could press "Add to cart — US$95" on a product page and have no way back to
// the cart except to know the URL.
//
// A route nobody can see is not a route. These three are the buyer's only doors into the cart, which is
// why they are named here rather than scanned for.
const doors = [
  [['components', 'storefront', 'PublicHeader.jsx'], /<Link to="\/cart"/, 'the header cart icon'],
  // The phone's bottom navigation, which is the surface almost every buyer is on. Its cart tab was the
  // last of these to be found, three commits after the cart opened: the desktop header, the catalogue
  // and the account page were all fixed while the phone still had no cart anywhere in its navigation.
  [['layouts', 'MobileCommerceLayout.jsx'], /path: '\/mobile\/cart'/, "the phone's cart tab"],
  [['pages', 'CatalogPage.jsx'], /onClick=\{\(event\) => handleQuickAdd\(event, product\)\}/, "the catalogue's quick-add"],
  [['pages', 'CustomerPortalPage.jsx'], /onClick=\{\(\) => onReorder\(order\)\}/, "the account page's Order again"],
];
for (const [file, affordance, what] of doors) {
  const source = read(...file);
  const at = source.search(affordance);
  assert.ok(at > 0, `${what} is gone from ${file.join('/')}`);
  // The 400 characters before it: an `isInternational ? null :` or `!isInternational &&` wrapper sits
  // immediately above the thing it hides, so that is where a returning gate would be.
  const above = source.slice(Math.max(0, at - 400), at).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(above, /isInternational\s*\?|!isInternational\s*&&/,
    `${what} is hidden from the English shop again. The cart, the checkout and the international prices `
    + 'all work; hiding the way in just means the buyer fills a basket they cannot open.');
}

// --- 3. …but every number the English shop shows is the international one -----------------------------
// This replaces "no surface may reach the cart". The surfaces may reach it; what they may not do is put
// a domestic price on an English screen, which is the bug the old rule prevented by amputation.
//
// The cart totals what the product page quoted.
const cartHook = read('hooks/useCart.js');
assert.match(cartHook, /isInternational/,
  'useCart no longer asks which shop it is in — the English cart totals the Indonesian price again');
assert.match(cartHook, /internationalPriceFor\(/,
  'the English cart must total the international price, from the shared rule');
assert.match(cartHook, /retailPriceNumber/,
  'the international price must be built on RETAIL — a member discount multiplied into an export price '
  + 'made the same bottle cheaper abroad the moment someone signed in');

// The buy button says the price it will charge.
const detail = read('pages/PublicProductDetailPage.jsx');
assert.match(detail, /const buyPriceLabel = exportPrice \?/,
  'the buy button must name the international price where there is one');
assert.match(detail, /addToCartWithPrice', \{ price: buyPriceLabel \}/,
  'the button prints a price that is not the one the buyer is charged');

// The checkout asks where the parcel goes, in both layouts, and never offers a domestic courier abroad.
for (const page of ['pages/CheckoutPage.jsx', 'pages/mobile/MobileCheckoutPage.jsx']) {
  const source = read(page);
  // Imported AND rendered. Checking for the bare name passed a sabotage that renamed only the import,
  // leaving a JSX element bound to nothing — a page that crashes for the buyer while the guard is green.
  assert.match(source, /import InternationalDeliveryFields from/,
    `${page} does not import the country field`);
  assert.match(source, /<InternationalDeliveryFields/,
    `${page} does not ask an international buyer which country the parcel is going to`);
  assert.match(source, /isInternational \?/,
    `${page} shows the same delivery step to both shops — one of them is being offered a courier it `
    + 'cannot use');
}

// And the order it creates carries that country, or the endpoint prices it as domestic.
const flow = read('hooks/useCheckoutFlow.js');
assert.match(flow, /deliveryCountry: isInternational \? deliveryCountry : ''/,
  'the order must carry the destination country — it is what makes the endpoint price it internationally');
assert.match(flow, /const shippingFee = isInternational \? 0 :/,
  'an international order must not add a domestic courier fee');
const service = read('services/orderService.js');
assert.match(service, /country: orderData\.deliveryCountry \|\| ''/,
  'the endpoint payload drops the country, so the server prices the order as domestic');

// The file scan §4 uses. It lived under the old §3 ("no surface may reach the cart"), which this rewrite
// replaced — the tills are still worth scanning even though the cart is no longer one of them.
const jsxFilesIn = (rel) => readdirSync(join(srcRoot, rel))
  .filter((name) => name.endsWith('.jsx'))
  .map((name) => join(rel, name));

const STUDIO = /Studio|Admin|Formula|Material|Batch|Inventory|Supplier|Report|Dashboard|Order|Shipment|Customers|Journal(Editor|Page|Detail)|Validation|Curation|Voucher|Quotation|Login|Auth/;
// Reached only after an order already exists.
// Both of these SETTLE an order that already exists rather than starting one, and both now read the
// currency off the order itself instead of off the shop the reader happens to be in — which is the more
// accurate question anyway: an order placed from Berlin is a dollar order whichever shop its buyer opens
// afterwards. The exemption is paired with an assertion below that they really do read the order, so it
// is not a hole.
const EXEMPT = new Set(['pages/PaymentPage.jsx', 'pages/CustomerPortalPage.jsx']);
// These ARE the cart and the checkout, and they are now allowed to take an international payment — that
// is the whole point of this rewrite. They answer to §2 and §3 instead.
const GATED_BY_ROUTE = /^(pages\/CartPage|pages\/CheckoutPage|pages\/mobile\/MobileCartPage|pages\/mobile\/MobileCheckoutPage)\.jsx$/;

const candidates = [
  ...jsxFilesIn('pages'),
  ...jsxFilesIn(join('pages', 'mobile')),
  ...jsxFilesIn(join('components', 'storefront')),
  ...jsxFilesIn('layouts'),
].map((rel) => rel.split('\\').join('/'));

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
// INVERTED, and the reason it used to read the other way is kept. It required the Reorder button to be
// HIDDEN in the English shop, because that shop had no cart to put anything into. When /en got one, the
// rule went on enforcing the old world: a returning overseas customer — the one this project exists to
// win — was refused the single button on the page that makes them a repeat buyer, and the guard held the
// door shut.
//
// The button now belongs to both shops. What survives is the finer point the old rule made: it is
// DISABLED rather than hidden when there is nothing to put back, because a greyed button explains
// itself and a missing one does not.
{
  const portal = read('pages/CustomerPortalPage.jsx');
  const at = portal.indexOf('onReorder(order)');
  assert.ok(at > 0, 'the reorder button has moved; this check no longer points at anything');
  const before = portal.slice(Math.max(0, at - 400), at);
  assert.doesNotMatch(before, /isInternational \? null :|!isInternational &&/,
    'the Reorder button is hidden from the English shop again — it has a cart, and useCart re-prices '
    + 'every line internationally, so the basket it fills is the right one');
  assert.match(portal, /onClick=\{\(\) => onReorder\(order\)\}[\s\S]{0,120}disabled=\{!canReorder\}/,
    'the button must be disabled rather than hidden when the order has nothing to put back — a greyed '
    + 'button explains itself, a missing one reads as a bug');
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

console.log(`englishShopHasNoCart selfcheck OK (the English shop sells, at international prices: 4 routes open, ${payChecked} payment surface(s) still gated, and the checkout asks where the parcel goes)`);
