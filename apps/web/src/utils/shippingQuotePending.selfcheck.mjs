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

// --- 5. The flag is only ever set where there is something left to quote -------------------------------
const calculator = read('pages', 'ExportShippingCalculatorPage.jsx');
assert.match(calculator, /const canQuoteLater = !shippingInPrice && !typedShipping;/,
  'a destination whose price already carries the freight has nothing to quote, and a typed figure IS the quote');
assert.match(calculator, /shippingQuotePending: true/, 'the calculator must be able to write the flag');
assert.match(calculator, /const shippingCharged = quoteLater\s*\?\s*0/,
  'an order awaiting a quote is written with no shipping, not with a guess');

console.log('shippingQuotePending selfcheck OK (no account and no clock until the total is final)');
