// `node src/utils/shippingQuotePending.selfcheck.mjs`
//
// An international order whose freight cannot be priced automatically — Europe, and anywhere else the
// price does not already carry the shipping — is written down anyway and the figure follows by hand.
// Dekito's decision, 2026-09-25: turning the buyer away at that point loses the sale, and guessing the
// freight loses money.
//
// Two properties make that safe, and they are the whole reason this file exists:
//
//   1. NO BANK ACCOUNT until the total is final. A buyer who transfers the goods total before the
//      shipping is added has sent the wrong amount into a foreign account, and clawing it back costs
//      more than the parcel.
//   2. NO 24-HOUR CLOCK while the order waits on us. A reserved order cancels itself a day after it is
//      written; one waiting on our quote would die of our own slowness, having never been shown an
//      amount to pay. The clock starts when the quote is sent, because that is when the ball moves back.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';
import { MESSAGES } from '../i18n/messages.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(srcRoot, ...parts), 'utf8'));

const workflowSource = readFileSync(join(srcRoot, 'utils', 'orderWorkflow.js'), 'utf8')
  .replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '');
const stubs = `
const isBespokeOrder = (order = {}) => order?.source === 'bespoke' || order?.requestType === 'bespoke'
  || (Array.isArray(order?.items) && order.items.some((item) => item.type === 'bespoke'));
const getBespokeItem = (order = {}) => (Array.isArray(order?.items) ? order.items.find((item) => item.type === 'bespoke') : null);
`;
const { isAwaitingShippingQuote } = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + workflowSource, 'utf8').toString('base64')}`
);

const pending = (extra = {}) => ({ paymentStatus: 'unpaid', paymentResponse: { shippingQuotePending: true }, ...extra });

// --- 1. What counts as waiting ------------------------------------------------------------------------
assert.equal(isAwaitingShippingQuote(pending()), true);
assert.equal(isAwaitingShippingQuote(pending({ paymentStatus: 'pending' })), true,
  'a manual-transfer order sits at pending and is still waiting on us');

// Raw server rows use snake_case; the expiry cron reads them without normalising.
assert.equal(isAwaitingShippingQuote({ payment_status: 'unpaid', payment_response: { shippingQuotePending: true } }), true,
  'the cron reads the same flag off an unnormalised row');

// --- 2. What does not ---------------------------------------------------------------------------------
assert.equal(isAwaitingShippingQuote({ paymentStatus: 'unpaid', paymentResponse: {} }), false, 'no flag, no wait');
assert.equal(isAwaitingShippingQuote({ paymentStatus: 'unpaid' }), false);
assert.equal(isAwaitingShippingQuote(pending({ paymentStatus: 'paid' })), false,
  'paid is not waiting — whatever happened, the money is in');
assert.equal(isAwaitingShippingQuote(pending({ status: 'cancelled' })), false,
  'a cancelled order is not waiting on anything');
assert.equal(isAwaitingShippingQuote(pending({ status: 'completed' })), false);
assert.equal(isAwaitingShippingQuote(), false, 'called with nothing at all, no crash');
assert.equal(isAwaitingShippingQuote(null), false);

// --- 3. The account stays hidden ----------------------------------------------------------------------
// Same shape as the closed-order rule: the bank block sits on a branch this state never reaches.
const page = read('pages', 'PaymentPage.jsx');
assert.match(page, /const awaitingShippingQuote = isAwaitingShippingQuote\(session\);/,
  'the payment page must recognise the waiting state');
const branch = page.match(/\{awaitingShippingQuote \? \(([\s\S]*?)\n        \) : closedForPayment \? \(/);
assert.ok(branch, 'the waiting state must be its own branch, ahead of the closed one');
const waitingSide = branch[1];
for (const forbidden of ['transfer.accountNumber', 'transfer.bankName', 'transfer.swift', "t('pay.copyTotal')", "t('pay.step1'"]) {
  assert.ok(!waitingSide.includes(forbidden),
    `the waiting panel must not show ${forbidden} — there is no final total to transfer yet`);
}
assert.match(waitingSide, /pay\.quoteConfirm/, 'and must offer the WhatsApp confirmation Dekito asked for');

// --- 4. The clock is stopped, on both sides -----------------------------------------------------------
// Client and cron decide expiry separately; a rule applied to one of them is a rule that does not hold.
const service = read('services', 'orderService.js');
assert.match(service, /if \(order\.paymentResponse\?\.shippingQuotePending\) return false;/,
  'the client expiry guard must not expire an order that is waiting on our quote');
const cron = stripComments(readFileSync(join(srcRoot, '..', 'api', 'orders', 'expire-reservations.js'), 'utf8'));
assert.match(cron, /if \(order\.payment_response\?\.shippingQuotePending\) return false;/,
  'and neither must the cron that actually cancels them');

// --- 4b. And the storefront checkout sets it from the DESTINATION, server-side -------------------------
// The Studio calculator sets the flag by hand, because Dekito is the one deciding. A buyer checking out
// on /en decides nothing: the endpoint reads the country they chose and works it out, and the account
// and the dollar figure are written there too — a browser that could name its own bank account is a
// browser that can be edited.
const endpoint = stripComments(readFileSync(join(srcRoot, '..', 'api', 'orders', 'create.js'), 'utf8'));
assert.match(endpoint, /\.\.\.\(destination\.shippingQuoted \? \{ shippingQuotePending: true \} : \{\}\)/,
  'the endpoint must flag an order whose freight it cannot price');
assert.match(endpoint, /bankName: INTERNATIONAL_TRANSFER_PAYMENT\.bankName/,
  'and must write the account server-side, not accept one from the request');
assert.doesNotMatch(endpoint, /payment_response: input\./,
  'the endpoint must never take payment_response from the browser');

// --- 5. The flag is only ever set where there is something left to quote -------------------------------
const calculator = read('pages', 'ExportShippingCalculatorPage.jsx');
assert.match(calculator, /const canQuoteLater = !shippingInPrice && !typedShipping;/,
  'a destination whose price already carries the freight has nothing to quote, and a typed figure IS the quote');
assert.match(calculator, /shippingQuotePending: true/, 'the calculator must be able to write the flag');
assert.match(calculator, /const shippingCharged = quoteLater\s*\?\s*0/,
  'an order awaiting a quote is written with no shipping, not with a guess');

// --- 6. And Studio has somewhere to see them -----------------------------------------------------------
// These orders cannot be paid and their clock is stopped, so nothing moves them along on its own. That
// is the point — and also the risk: without a queue they sit until the buyer gives up, and the buyer has
// been told the figure is coming within 24 hours.
const fulfillment = read('pages', 'mobile', 'MobileFulfillmentPage.jsx');
assert.match(fulfillment, /orders\.filter\(isAwaitingShippingQuote\)/,
  'the shipping screen must collect the orders waiting on a quote');
assert.match(fulfillment, /Menunggu ongkir dari kamu/,
  'and say whose turn it is — the buyer is not the one holding this up');
assert.match(fulfillment, /awaitingQuoteOrders\.slice\(0, 5\)\.map/,
  'and list them, so the queue is one tap from the order rather than a number to go looking for');

// --- 7. Nothing else may write over the column this order lives in -------------------------------------
// payment_response carries all three of an international order's facts: the dollar amount, the account,
// and the pending flag. api/doku/checkout.js writes its own session into that same column, so a buyer who
// picked DOKU would have had the lot replaced — shown an Indonesian virtual account they cannot pay into,
// and handed back the 24-hour clock on an order waiting for a freight figure nobody had sent. It would
// have cancelled itself while the buyer waited.
//
// So the endpoint refuses the combination. The form not offering DOKU is the courtesy; this is the rule,
// because the provider is whatever the browser sent.
assert.match(endpoint, /if \(destination && !\[[^\]]*\]\.includes\(paymentProvider\)\)/,
  'an international order must be refused unless it is paid by manual transfer — DOKU overwrites '
  + 'payment_response and takes the account, the amount and the pending flag with it');
const dokuEndpoint = read('..', 'api', 'doku', 'checkout.js');
assert.match(dokuEndpoint, /payment_response:/,
  'this rule exists because api/doku/checkout.js writes payment_response; if it stopped, re-examine it '
  + 'rather than deleting the refusal');

// And the form does not offer what the endpoint will refuse.
const hook = read('hooks', 'useCheckoutFlow.js');
assert.match(hook, /checkoutPaymentMethodsFor\(destination\)/,
  'the payment list must narrow on the DESTINATION — not on the shop language, because an Indonesian '
  + 'reading the English shop ships domestically and still pays with DOKU');
assert.doesNotMatch(hook, /\bcheckoutPaymentMethods\b(?!For)/,
  'the hook must never reach for the unnarrowed list; that is how DOKU gets back onto a form for Berlin');

// --- 8. The international method is the same payment, pointed at the right bank -------------------------
// It is deliberately NOT INTERNATIONAL_TRANSFER_PAYMENT itself: that object carries its own id,
// 'manual_transfer_usd', which api/orders/create.js does not recognise — it would land the order as
// 'unpaid' and then be refused by the very rule above. The id and provider have to stay the manual
// transfer's, so the order goes down the same upload-your-receipt path a local buyer's does.
const cart = read('services', 'cartService.js');
const method = cart.slice(cart.indexOf('export const INTERNATIONAL_TRANSFER_METHOD'),
  cart.indexOf('export const checkoutPaymentMethodsFor'));
assert.match(method, /\.\.\.MANUAL_TRANSFER_PAYMENT,/,
  'the international method must inherit the manual transfer id and provider, or the endpoint refuses it');
assert.doesNotMatch(method, /\bid:|\bprovider:/,
  'it must not set its own id or provider — payment_status and the receipt flow key off the inherited ones');
for (const field of ['bankName', 'swift', 'accountNumber', 'accountName']) {
  assert.match(method, new RegExp(`${field}: INTERNATIONAL_TRANSFER_PAYMENT\\.${field}`),
    `the international method must take ${field} from the Jenius account — these values are copied into `
    + 'the payment session, and BCA\'s numbers in front of a buyer in Berlin is the defect this fixes');
}
assert.match(method, /labelKey: 'paymethod\.international'/,
  'the buyer must read the international label, not "BCA bank transfer"');
assert.match(method, /label: 'Transfer bank internasional \(USD\)'/,
  'and Studio must read the same fact in Indonesian — label is what buildOrderNotes stores');
for (const locale of ['id', 'en']) {
  assert.ok(MESSAGES[locale]['paymethod.international'],
    `paymethod.international is missing in ${locale}`);
}
assert.notEqual(MESSAGES.id['paymethod.international'], MESSAGES.en['paymethod.international'],
  'the two shops must say it in their own language');

// The details the payment page falls back to must follow the destination, not a lookup in the full list.
assert.match(hook, /const paymentMethodDetails = destination/,
  'paymentMethodDetails must resolve from the narrowed list — resolving the chosen id against the full '
  + 'one hands back the BCA account for a parcel to Berlin');
assert.ok(hook.indexOf('const availablePaymentMethods') < hook.indexOf('const paymentMethodDetails'),
  'availablePaymentMethods must be declared before the line that reads it — a const used above itself is '
  + 'a blank page at runtime with a green build');
for (const page of [['pages', 'CheckoutPage.jsx'], ['pages', 'mobile', 'MobileCheckoutPage.jsx']]) {
  const source = read(...page);
  assert.match(source, /availablePaymentMethods\.map\(/,
    `${page.join('/')} must render the narrowed list`);
  assert.doesNotMatch(source, /checkoutPaymentMethods\.map\(/,
    `${page.join('/')} still renders the unfiltered list, so DOKU is offered for a parcel to Berlin`);
}

console.log('shippingQuotePending selfcheck OK (no account and no clock until the total is final)');
