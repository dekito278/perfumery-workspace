// `node src/utils/closedOrderPayment.selfcheck.mjs`
//
// Measured on production, 2026-09-21, with the anon key — the buyer's own view of order
// DKT-MU9L5XW2-JNBGGD: status "cancelled", payment_status "expired", stock already given back by
// api/orders/expire-reservations.js. The payment page for that order was still printing
//
//     REKENING TUJUAN — BCA — 7401775441 — Ade Rizki Wiranto
//     1. Transfer tepat sebesar Rp 235.900.
//
// and offering the upload form. Someone opening the WhatsApp link a day late is told, in detail, to send
// money for an order that no longer exists. The only hint was "Link kedaluwarsa" in small type.
//
// The rule: a closed order may not be given a way to pay. isOrderClosedForPayment is the same helper the
// admin side uses to refuse approving a proof — the screen must agree with it.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

const page = read('pages', 'PaymentPage.jsx');

// --- 1. The page asks the same question the rest of the app asks ----------------------------------------
assert.match(page, /const closedForPayment = isOrderClosedForPayment\(session\);/,
  'the screen must read the shared helper, not re-invent which statuses count as closed');
const service = read('services', 'orderService.js');
assert.match(service, /export const isOrderClosedForPayment = \(order = \{\}\) => \(\s*order\?\.status === 'cancelled' \|\| \['expired', 'failed', 'refunded'\]\.includes\(order\?\.paymentStatus\)/,
  'and that helper still covers a cancelled order and the three dead payment statuses');

// --- 2. Nothing that invites a transfer may render for a closed order ------------------------------------
// The bank account, the account holder and the "transfer exactly this much" step are the three things
// that cost a buyer money. Each must sit on the open side of the branch.
//
// Written against the SHAPE of a two-way branch, this broke the day a third state was added (an order
// waiting on a hand-quoted shipping figure) — the rule was untouched, only the number of branches moved.
// So it now splits on the open side rather than counting branches: everything before the fragment is a
// state where payment is NOT offered, however many of those there come to be, and every one of them has
// to be as empty of bank details as the closed one.
const openMatch = page.match(/\) : \(\n          <>([\s\S]*?)\n          <\/>\n        \)\}/);
assert.ok(openMatch, 'the page must still have one branch that offers payment');
const openSide = openMatch[1];
// Everything from the first branch of the chain up to the open fragment: the closed notice, the
// waiting-on-a-quote notice, and any state added after them.
const chainStart = page.indexOf('{awaitingShippingQuote ? (') >= 0
  ? page.indexOf('{awaitingShippingQuote ? (')
  : page.indexOf('{closedForPayment ? (');
assert.ok(chainStart >= 0 && chainStart < openMatch.index, 'the payment details must sit behind a branch');
const closedSide = page.slice(chainStart, openMatch.index);
assert.ok(closedSide.includes('closedForPayment'), 'the closed-order notice must still be one of those branches');
assert.ok(closedSide.length > 0, 'the closed-order notice must still be one of those branches');
for (const [what, needle] of [
  ['the bank account block', "t(\"pay.bankAccount\")"],
  ['the account number', 'transfer.accountNumber'],
  ['the account holder', 'transfer.accountName'],
  // The needle is the step, not the formatter: this pinned `formatTotal(session.amount)` and broke the
  // day international orders started being quoted in dollars — a rename of how the amount READS is not a
  // change to whether the amount SHOWS, which is the only thing this rule cares about.
  ['the amount to transfer', "t('pay.step1'"],
  ['the copy-the-total button', "t('pay.copyTotal')"],
]) {
  assert.ok(openSide.includes(needle), `${what} must stay on the open side of the branch`);
  assert.ok(!closedSide.includes(needle), `${what} must NEVER render for a closed order`);
}

// --- 3. What a closed order says instead ------------------------------------------------------------------
for (const key of ['pay.closedTitle', 'pay.closedBody', 'pay.closedTransferred', 'pay.closedShopAgain']) {
  assert.ok(closedSide.includes(`t('${key}')`), `the closed notice must say ${key}`);
  for (const language of ['id', 'en']) {
    assert.ok(MESSAGES[language][key], `${language}.${key} is missing`);
  }
}
assert.match(MESSAGES.id['pay.closedBody'], /[Jj]angan transfer/, 'the Indonesian notice says it plainly');
assert.match(MESSAGES.en['pay.closedBody'], /[Dd]o not transfer/, 'and so does the English one');
assert.match(closedSide, /<AskAtelierButton/,
  'someone who already transferred needs a person, not a dead end');

// --- 4. And the lead sentence stops telling them to transfer ---------------------------------------------
assert.match(page, /t\(closedForPayment \? 'pay\.closedHint' : 'pay\.manualHint'\)/,
  'the opening line pointed at "the account below", which a closed order no longer shows');
for (const language of ['id', 'en']) {
  assert.ok(MESSAGES[language]['pay.closedHint'], `${language}.pay.closedHint is missing`);
  assert.notEqual(MESSAGES[language]['pay.closedHint'], MESSAGES[language]['pay.manualHint'],
    `${language}: the closed lead must not repeat the transfer instruction`);
}

// --- 5. And stops asking for a receipt it can never accept -----------------------------------------------
// The bank account was withheld from a closed order, correctly, and the RECEIPT section underneath went
// on saying "a receipt is required so the order can move" with a working file picker. The order cannot
// move: approving a receipt on a closed order is precisely what orderService throws on. So the person it
// invited to upload was the one the notice above was speaking to — someone who had already transferred
// to an order that was cancelled underneath them, sending proof into a dead end instead of a message.
//
// Read on a real order: DKT-MU9L5XW2-JNBGGD, status cancelled, payment_status expired.
assert.match(page, /const needsProofUpload = !hasSubmittedProof && !closedForPayment;/,
  'a closed order must not be marked as needing a receipt — that flag drives the REQUIRED tag and the '
  + 'required attribute on the file input');
assert.match(page, /\{closedForPayment \? null : \(\s*\n\s*<div className="mt-4 grid gap-3">/,
  'the upload form itself must not render for a closed order; hiding only the REQUIRED tag leaves a file '
  + 'picker under a notice saying not to pay');
assert.match(page, /closedForPayment\s*\n?\s*\? t\('pay\.proofClosed'\)/,
  'and the receipt section must say why, rather than going quiet — a section with a heading and no '
  + 'sentence reads as a page that failed to load');
for (const locale of ['id', 'en']) {
  const message = MESSAGES[locale]['pay.proofClosed'];
  assert.ok(message, `pay.proofClosed is missing in ${locale}`);
  // Deliberately NOT an instruction to message us. The closed-order notice directly above already says
  // that AND carries the button — contactPrompt.selfcheck refuses a sentence that asks without one, and
  // repeating it here would either break that rule or put a second WhatsApp button on the same screen.
  // This sentence has one job: say there is nothing to upload.
  assert.doesNotMatch(message, /WhatsApp/i,
    `${locale}.pay.proofClosed repeats the "message us" instruction away from the button that carries `
    + 'it — the notice above this section already asks, and already offers the way');
  assert.match(message, /ditutup|closed/i,
    `${locale}.pay.proofClosed must say why there is nothing to send`);
  assert.notEqual(message, MESSAGES[locale]['pay.proofRequired'],
    `${locale} still asks a closed order for a receipt`);
}

console.log('closedOrderPayment selfcheck OK (a cancelled order stops handing out the bank account)');
