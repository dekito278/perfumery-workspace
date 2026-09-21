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
const branch = page.match(/\{closedForPayment \? \(([\s\S]*?)\n        \) : \(\n          <>([\s\S]*?)\n          <\/>\n        \)\}/);
assert.ok(branch, 'the page must choose between a closed notice and the payment details');
const [, closedSide, openSide] = branch;
for (const [what, needle] of [
  ['the bank account block', "t(\"pay.bankAccount\")"],
  ['the account number', 'transfer.accountNumber'],
  ['the account holder', 'transfer.accountName'],
  ['the amount to transfer', "t('pay.step1', { amount: formatTotal(session.amount) })"],
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

console.log('closedOrderPayment selfcheck OK (a cancelled order stops handing out the bank account)');
