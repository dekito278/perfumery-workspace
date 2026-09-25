// `node src/utils/paidOrderAsksNothing.selfcheck.mjs`
//
// An order that has been paid must not ask for money again.
//
// It did. Order DKT-MUEUY0EL-LV1D1D has payment_status 'paid' and a receipt already submitted, and
// opening its own payment link showed: "Transfer the exact total to the account below", the BCA account
// number, "1. Transfer exactly Rp 289.000", and a live receipt upload form. A buyer who follows their
// own link back after paying is told to pay again, and the second transfer is Dekito's to refund.
//
// The QRIS panel had asked since it was written — `if (session.paymentStatus === 'paid') return
// <PaymentSuccessPanel />`. The manual transfer panel, which is how nearly every order in this shop is
// actually paid, never did. One rule, taught to one of the two screens that needed it.
//
// isOrderClosedForPayment does NOT answer this and must not be made to: there it means "dead — cancelled,
// expired, refunded, stock already released", and two admin paths throw on exactly that. A settled order
// is alive. It is a different question and every panel has to ask it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'pages', 'PaymentPage.jsx'), 'utf8');

// The predicate alone, lifted out of orderService.js and run. Importing that module would drag in the
// whole '@/' alias graph for the sake of one pure function — and reading its source instead of running
// it is how a guard ends up agreeing with the words rather than the behaviour.
const service = readFileSync(join(root, 'services', 'orderService.js'), 'utf8');
const start = service.indexOf('export const isOrderClosedForPayment');
const predicate = service.slice(start, service.indexOf(');', start) + 2);
const { isOrderClosedForPayment } = await import(
  `data:text/javascript;base64,${Buffer.from(predicate, 'utf8').toString('base64')}`
);

// --- 1. The other predicate keeps its meaning ----------------------------------------------------------
// If someone "fixes" this by folding paid into isOrderClosedForPayment, approving a receipt and marking
// an order paid both start throwing — the admin paths read it as "stock released, do not revive".
assert.equal(isOrderClosedForPayment({ paymentStatus: 'paid' }), false,
  'a paid order is not CLOSED for payment — it is settled. Two admin paths throw on closed orders, and '
  + 'folding paid into that predicate stops a receipt from ever being approved');
assert.equal(isOrderClosedForPayment({ status: 'cancelled' }), true, 'cancelled still is');
assert.equal(isOrderClosedForPayment({ paymentStatus: 'expired' }), true, 'and expired');

// --- 2. Every panel that asks for money asks whether it has already arrived -----------------------------
// The panels are found, not listed: a top-level component in this file that renders a bank account, a
// payment URL or a receipt upload IS a panel that asks for money.
const ASKS_FOR_MONEY = /transfer\.accountNumber|session\.paymentUrl|type="file"|qrDataUrl/;
const panels = [];
const declaration = /^const ([A-Z][A-Za-z]*) = \(\{[\s\S]*?\n\};$/gm;
let match = declaration.exec(page);
while (match) {
  panels.push({ name: match[1], body: match[0] });
  match = declaration.exec(page);
}
assert.ok(panels.length >= 3,
  `expected to find the payment panels by scan, found ${panels.length} — the scan is broken, not the code`);

// A container is not a panel. PaymentPageContent chooses between them and therefore mentions their
// innards; its job is the choosing, and the things it chooses are each checked below on their own.
const RENDERS_A_PANEL = /<(?:QrisPanel|ManualTransferPanel)\b/;
const asking = panels.filter((panel) => ASKS_FOR_MONEY.test(panel.body) && !RENDERS_A_PANEL.test(panel.body));
assert.ok(asking.length >= 2,
  `expected at least the QRIS and manual-transfer panels to ask for money, found ${asking.length}`);

for (const panel of asking) {
  assert.match(panel.body, /paymentStatus === 'paid'/,
    `${panel.name} asks a buyer for money without ever asking whether the order is already paid — the `
    + 'one thing it must check before showing an account number');
  // And the answer has to STOP the panel, not merely be computed. Checked as "does this panel hand back
  // the success panel at all", rather than by looking near the check: the QRIS panel asks the question
  // first in a useState initialiser and returns fifty lines later, so a proximity window read that
  // initialiser and called the panel broken.
  assert.match(panel.body, /return\s*(?:\(\s*)?<PaymentSuccessPanel/,
    `${panel.name} works out that the order is paid and carries on asking anyway — the answer has to end `
    + 'the panel, not sit in a variable');
  // The CONDITION that guards it, with no boolean literal in it. `if (settled && false)` still contains
  // a return of the success panel, and the first version of this check — which looked for `if (false)` —
  // let that straight through.
  const gate = panel.body.match(/if \(([^)]*)\)\s*\{\s*return\s*\(?\s*<PaymentSuccessPanel/);
  if (gate) {
    assert.doesNotMatch(gate[1], /\b(?:true|false)\b/,
      `${panel.name} guards its success panel on a boolean literal — the branch either always runs or `
      + `never does: if (${gate[1]})`);
  }
}

// --- 3. The success panel says what was paid and where to go next --------------------------------------
// A dead end that says "paid" and nothing else sends the buyer back to the same link to check.
const success = page.slice(page.indexOf('const PaymentSuccessPanel'), page.indexOf('const QrisPanel'));
assert.ok(success, 'PaymentSuccessPanel has moved; this check no longer points at anything');
// The PARAMETER, not a mention of it. Dropping orderNumber from the signature leaves every use of it in
// the body, so a check for the word passed while the panel rendered "order undefined".
assert.match(success, /const PaymentSuccessPanel = \(\{[^}]*\borderNumber\b/,
  'it must be given the order number, or the buyer cannot tell which order settled');
assert.match(success, /customerCode|trackingPath|\/customer/,
  'and must offer somewhere to go — tracking or the account — rather than ending the conversation');

console.log(`paidOrderAsksNothing selfcheck OK (${asking.length} panels that ask for money, each one `
  + 'checking first whether it already arrived)');
