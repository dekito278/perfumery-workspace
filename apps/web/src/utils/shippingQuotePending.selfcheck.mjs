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

console.log('shippingQuotePending selfcheck OK (no account and no clock until the total is final)');
