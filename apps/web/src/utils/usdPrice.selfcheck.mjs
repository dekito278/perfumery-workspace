// `node src/utils/usdPrice.selfcheck.mjs`
//
// Since 2026-09-24 an international buyer pays in DOLLARS, into a USD account. That turns a number that
// was decoration into a number someone transfers, and moves the failure from "slightly stale" to "the
// wrong amount arrived and nobody can tell which order it belongs to".
//
// Two properties carry the whole thing:
//   * the dollar price, converted back at the rate it was set with, is NEVER below the rupiah price. The
//     rate is deliberately under the market and the rounding only goes up, so both cushions point the
//     same way and absorb the $15-25 an intermediary bank can take on the way.
//   * the figure is frozen onto the ORDER, not recomputed when the page loads. A Wise transfer can take
//     three days; the amount asked for on day three must be the amount quoted on day zero.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { USD_PRICE_RATE, USD_PRICE_STEP, usdPriceFor, formatUsdPrice } from './usdPrice.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(srcRoot, ...parts), 'utf8'));

// --- 1. The prices actually in the catalogue today ----------------------------------------------------
// Both tiers, both price points, plus the two that were left alone. If the rate or the step ever moves,
// this is the line that says which shelf price moved with it.
const CATALOGUE = [
  [789800, 50], [943800, 60], [1427800, 90], [1650000, 100],
  [1260000, 80], [1510000, 95], [2280000, 140], [2630000, 160],
];
for (const [rupiah, usd] of CATALOGUE) {
  assert.equal(usdPriceFor(rupiah), usd, `Rp ${rupiah} must be asked for as US$${usd}`);
}

// --- 2. Rounding never lands under the rupiah price ---------------------------------------------------
// The one property that cannot be allowed to fail: a dollar figure that converts back to LESS than the
// rupiah price means every single international sale quietly loses money.
for (let rupiah = 50000; rupiah <= 5000000; rupiah += 1337) {
  const usd = usdPriceFor(rupiah);
  assert.ok(usd * USD_PRICE_RATE >= rupiah,
    `Rp ${rupiah} -> US$${usd} converts back to Rp ${usd * USD_PRICE_RATE}, which is less than the price`);
}

// --- 3. Prices land on a price point, not on a conversion ---------------------------------------------
for (const rupiah of [100000, 250000, 999999, 1260000, 7777777]) {
  assert.equal(usdPriceFor(rupiah) % USD_PRICE_STEP, 0, `US$${usdPriceFor(rupiah)} is not a price point`);
}
// An exact multiple must not be pushed up a step — Rp 825.000 is exactly US$50 at this rate.
assert.equal(usdPriceFor(USD_PRICE_RATE * 50), 50, 'an exact price point stays where it is');

// --- 4. Nothing is not free ---------------------------------------------------------------------------
for (const nothing of [0, -1, null, undefined, '', 'abc', NaN, Infinity]) {
  assert.equal(usdPriceFor(nothing), null, `${JSON.stringify(nothing)} has no dollar price`);
  assert.equal(formatUsdPrice(nothing), '', 'and prints nothing rather than US$0');
}
assert.equal(formatUsdPrice(1260000), 'US$80');

// --- 5. The rate that sets prices is not the rate that decorates them ----------------------------------
// overseasVisitor's constant exists to show a rough figure beside a rupiah price and may be corrected
// toward the market whenever. This one decides what a buyer is asked to send. Collapsing the two would
// let a display tweak silently reprice every international order.
const priceRule = read('utils', 'usdPrice.js');
assert.doesNotMatch(priceRule, /USD_PER_RUPIAH_RATE/,
  'the pricing rate must not be borrowed from the display approximation');
assert.match(priceRule, /Math\.ceil/, 'rounding must go up; rounding to nearest would price under the rupiah');

// --- 6. The amount is frozen onto the order, and the page reads it from there -------------------------
const calculator = read('pages', 'ExportShippingCalculatorPage.jsx');
assert.match(calculator, /amountUsd: usdPriceFor\(orderData\.subtotal\)|const amountUsd = usdPriceFor\(orderData\.subtotal\)/,
  'the order must be written with the dollar figure it was quoted at');
assert.match(calculator, /paymentResponse:/, 'and must carry it on the order, not only in a note');

const paymentPage = read('pages', 'PaymentPage.jsx');
assert.match(paymentPage, /amountUsd: Number\(order\.paymentResponse\?\.amountUsd \|\| 0\)/,
  'the payment page must take the dollar figure off the order');
assert.doesNotMatch(paymentPage, /usdPriceFor|USD_PRICE_RATE/,
  'and must never recompute it at page load — three days of Wise is three days of rate movement');

// Every headline amount on that page speaks the order's currency. Printing rupiah beside a USD account
// number is exactly how someone transfers the wrong number.
// Exactly one rupiah print of the order total survives — the reference line under a dollar total — and
// it has to sit inside the branch that only renders when there IS a dollar total. Anything else is a
// headline that ignores the currency the buyer was quoted in.
const rupiahPrints = [...paymentPage.matchAll(/\{formatTotal\(session\.amount\)\}/g)];
assert.equal(rupiahPrints.length, 1,
  `${rupiahPrints.length} headline amounts print rupiah regardless of the order currency`);
const guarded = paymentPage.slice(Math.max(0, rupiahPrints[0].index - 200), rupiahPrints[0].index);
assert.match(guarded, /amountUsd \|\| 0\) > 0/,
  'the rupiah line must only render underneath a dollar total, never instead of one');
assert.match(paymentPage, /const payableAmount = \(session\)/, 'one function must decide how the amount reads');

// --- 6b. The dollars and the account they go to are written together ----------------------------------
// A payment page that knows the amount but hands out the domestic BCA account is worse than one that
// knows neither: the buyer sends the right number to the wrong bank.
// It moved out of cartService and into its own data module so the ORDER ENDPOINT can read it: that
// endpoint runs in plain node and cannot resolve the '@/' alias cartService uses, and the account an
// order hands out must not be decided by the browser.
const account = read('data', 'internationalAccount.js');
assert.match(account, /INTERNATIONAL_TRANSFER_PAYMENT = \{/, 'the international account must have one home');
for (const field of ['bankName', 'swift', 'accountNumber', 'accountName']) {
  assert.match(account, new RegExp(`${field}:`), `the international account is missing ${field}`);
}
// A SWIFT code is what makes an international transfer possible at all — an account number alone sends
// the buyer back to ask, and a buyer who has to ask has already lost confidence.
assert.match(account, /swift: '[A-Z]{6}[A-Z0-9]{2,5}'/, 'the SWIFT/BIC must be a real code, not a placeholder');
// Import-free, or the endpoint cannot read it.
assert.doesNotMatch(account, /^import /m, 'the account module must stay import-free for plain node');

assert.match(calculator, /INTERNATIONAL_TRANSFER_PAYMENT\.swift/,
  'an order quoted in dollars must carry the account those dollars go to');

assert.match(paymentPage, /swift: session\.manualTransfer\?\.swift \|\| ''/,
  'the payment page must read the SWIFT off the order, and show nothing when there is none');
assert.match(paymentPage, /t\('pay\.ourCharges'\)/,
  'the charge-option instruction must reach the buyer — it is what makes the full amount arrive');
// Both are meaningless on a domestic transfer and must not render there.
const swiftBlock = paymentPage.slice(paymentPage.indexOf('pay.ourCharges') - 300, paymentPage.indexOf('pay.ourCharges'));
assert.match(swiftBlock, /transfer\.swift \?/,
  'the OUR instruction must be gated on an international order — a BCA transfer has no such option');

// --- 7. The English payment page has no Indonesian left in it -----------------------------------------
// "Ongkir" sat hardcoded in the breakdown, inside a ternary, so the i18n guards never saw it: a bare
// string in JSX is not a missing key.
assert.doesNotMatch(paymentPage, /'Ongkir'|"Ongkir"/,
  'the payment page must not hardcode an Indonesian word — the English shop renders this screen too');

console.log('usdPrice selfcheck OK (the dollar price is the price, rounded up, and frozen onto the order)');
