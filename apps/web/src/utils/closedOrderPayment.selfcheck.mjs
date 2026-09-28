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
import { readdirSync, readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walkAll = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walkAll(join(dir, entry.name)) : [join(dir, entry.name)]
));
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

const page = read('pages', 'PaymentPage.jsx');

// --- 1. The page asks the same question the rest of the app asks ----------------------------------------
assert.match(page, /const closedForPayment = isOrderClosedForPayment\(session\);/,
  'the screen must read the shared helper, not re-invent which statuses count as closed');
// Where the helper lives, followed rather than assumed. It started in orderService, moved to a leaf
// util when the invoice's delivery block turned out to hold a word-for-word second copy of it, and this
// guard both READS and RUNS it — so it resolves the re-export instead of pinning a file, the mistake
// productBadge.selfcheck.mjs made twice.
const orderService = read('services', 'orderService.js');
// Either spelling counts as delegation: `export { x } from '…'`, or an import followed by a bare
// re-export — which is what this module needs, since two of its own functions call it and
// `export … from` would not bind the name locally.
const delegate = orderService.match(/(?:import|export) \{[^}]*\bisOrderClosedForPayment\b[^}]*\} from '@\/utils\/([\w.]+)'/);
const service = delegate ? read('utils', delegate[1]) : orderService;
// RUN it rather than pin its text. Pinned to the literal expression, this line failed the day the three
// statuses were lifted into a named constant so five other places could stop writing them out — a change
// that made the rule MORE single, not less.
assert.ok(service.includes('export const isOrderClosedForPayment'), 'the helper still lives where the re-export points');
const { CLOSED_PAYMENT_STATUSES, isOrderClosedForPayment } = await import(`./${delegate ? delegate[1] : 'orderClosed.js'}`);
assert.deepEqual([...CLOSED_PAYMENT_STATUSES].sort(), ['expired', 'failed', 'refunded'],
  'the dead payment statuses are expired, failed and refunded');
for (const paymentStatus of CLOSED_PAYMENT_STATUSES) {
  assert.equal(isOrderClosedForPayment({ status: 'paid', paymentStatus }), true, `${paymentStatus} closes an order`);
}
assert.equal(isOrderClosedForPayment({ status: 'cancelled', paymentStatus: 'pending' }), true, 'so does a cancelled order');
for (const open of ['unpaid', 'pending', 'paid']) {
  assert.equal(isOrderClosedForPayment({ status: 'paid', paymentStatus: open }), false, `${open} leaves it open`);
}

// The invoice's delivery block asks the same question and must not grow a second copy of the answer.
const shipment = read('utils', 'invoiceShipment.js');
assert.match(shipment, /isClosedOrder = isOrderClosedForPayment/,
  'invoiceShipment defines its own closed-order rule again — it was byte-for-byte identical once already');

// And exactly one file defines it. A second copy that happens to be identical would pass every
// assertion above while putting the rule back into two places, which is the state this came from.
const definitions = walkAll(root)
  .filter((file) => /\.(js|jsx)$/.test(file) && !file.endsWith('.selfcheck.mjs'))
  .filter((file) => /export const isOrderClosedForPayment = /.test(readFileSync(file, 'utf8')))
  .map((file) => file.slice(root.length + 1));
assert.deepEqual(definitions, ['utils/orderClosed.js'],
  `the closed-order rule is defined in ${definitions.length} places: ${definitions.join(', ')}`);

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

// --- 5. Every screen that offers payment for a STORED order asks the same question ----------------------
// The portal was the other half of this. It decided payability with its own
// `['unpaid','pending'].includes(paymentStatus)` and offered the upload with `paymentStatus !== 'paid'`
// — and 'expired' is not 'paid', so an order the nightly sweep had already cancelled kept the black
// "Upload bukti transfer" button as its primary action, linking to the payment page that refuses it.
//
// The subject is derived rather than listed: every page that can print the bank account is a candidate,
// and the exemptions are written as reasons, not as names.
const pagesRoot = join(root, 'pages');
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
));
const prints = walk(pagesRoot).filter((file) => file.endsWith('.jsx') && stripComments(readFileSync(file, 'utf8')).includes('accountNumber'));
assert.ok(prints.length >= 4, `only ${prints.length} pages mention the bank account — the scan is broken`);

// Not a stored order, each for a stated reason.
const NO_STORED_ORDER = new Map([
  ['BespokePage.jsx', 'builds the payment payload for the order it is creating in this same submit; there is no saved order yet to be closed'],
  ['MobileBespokePage.jsx', 'same, plus the payment-method picker, which shows the account before any order exists'],
  ['ExportShippingCalculatorPage.jsx', 'Studio: Dekito recording an order himself, not a buyer being invited to pay'],
]);

let asked = 0;
for (const file of prints) {
  const name = file.slice(file.lastIndexOf('/') + 1);
  if (NO_STORED_ORDER.has(name)) continue;
  const source = stripComments(readFileSync(file, 'utf8'));
  assert.match(
    source,
    /isOrderClosedForPayment/,
    `${name} prints the bank account for an order it loaded, but never asks isOrderClosedForPayment. `
    + 'A cancelled order there is still being told how to send money.',
  );
  asked += 1;
}
assert.ok(asked >= 2, `only ${asked} stored-order payment screens checked — the derivation lost them`);

// --- 5b. And every screen that offers a WAY to pay, not only the ones printing the account ------------
// Printing the bank account was one shape of the offer. A button to /payment is the other, and the
// invoice had it: `order.paymentUrl && ['unpaid','pending'].includes(order.paymentStatus)`, which cannot
// see an order cancelled while its payment status still reads alive.
//
// This subject forms itself too: a page that loads an order through the portal lookup (the same set as
// maskedCustomerIsExplained) and links to /payment. Studio's order screens reach the link through
// getOrders, and the bespoke pages offer it for an order they are creating in the same submit — both are
// outside by construction, so there is nothing to exempt and nothing to remember to grow.
const offersAWayToPay = walk(pagesRoot).filter((file) => {
  if (!file.endsWith('.jsx')) return false;
  const source = stripComments(readFileSync(file, 'utf8'));
  return /getCustomerPortalByCode|verifyCustomerPortalSecurity/.test(source) && /\?order=/.test(source);
});
// A floor, not a pin: a screen added tomorrow should be held to the rule below, not rejected for
// existing. Losing one means the scan broke rather than the code improving.
assert.ok(offersAWayToPay.length >= 2,
  `expected at least the portal and the invoice, found ${offersAWayToPay.length} — the scan is broken`);

// Checked inside the expression that DECIDES the offer, not anywhere in the file: both of these files
// mention the helper elsewhere, so a file-wide search would pass over a reverted button. The innermost
// expression around the URL is only the template that builds it, so walk outward until the level that
// actually reads the order's payability, and hold that one to the rule.
const enclosingLevels = (source, at, levels = 6) => {
  const found = [];
  let from = at;
  for (let level = 0; level < levels; level += 1) {
    let depth = 0;
    let open = -1;
    for (let i = from; i >= 0; i -= 1) {
      if (source[i] === '}') depth += 1;
      else if (source[i] === '{') {
        if (depth === 0) { open = i; break; }
        depth -= 1;
      }
    }
    if (open === -1) break;
    depth = 0;
    let close = -1;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) { close = i; break; }
      }
    }
    if (close === -1) break;
    found.push(source.slice(open, close + 1));
    from = open - 1;
  }
  return found;
};

let gates = 0;
for (const file of offersAWayToPay) {
  const name = file.slice(file.lastIndexOf('/') + 1);
  const source = stripComments(readFileSync(file, 'utf8'));
  for (const found of source.matchAll(/\?order=/g)) {
    // Which top-level declaration this occurrence sits in. A *Path builder composes the URL and offers
    // nothing; the portal decides its offer in canOpenPayment and canUploadPaymentProof, which section 6
    // executes rather than reads. Identified by the declaration, not by a window of characters.
    const declarations = [...source.matchAll(/^const (\w+) = /gm)].filter((match) => match.index < found.index);
    const holder = declarations.length ? declarations[declarations.length - 1][1] : '';
    if (/^build\w*Path$/.test(holder)) continue;

    const levels = enclosingLevels(source, found.index);
    assert.ok(levels.length, `${name}: could not read the expression around the payment link in ${holder}`);
    const deciding = levels.find((level) => /paymentStatus|paymentUrl/.test(level));
    assert.ok(deciding,
      `${name} renders a payment link with nothing above it reading the order's payment state at all`);
    assert.match(deciding, /isOrderClosedForPayment|canOpenPayment|canUploadPaymentProof/,
      `${name} offers a link to /payment without asking whether the order is closed. A buyer opening a `
      + 'cancelled order is handed a button that takes her to a page telling her not to pay.');
    gates += 1;
  }
}
assert.ok(gates >= 1, `no payment-link gate was checked — the walk lost them`);

// --- 6. The rule itself, and the portal's own predicates, RUN rather than described --------------------
// The helper is imported above; these states are decided by the real expression, never by a second copy
// of it written here.
// Imported and run as the module the app imports, rather than re-parsed out of the file with
// `new Function` — which broke the moment the statuses moved into a constant the re-parsed body could
// no longer see.

// What api/orders/expire-reservations.js writes, and what Studio's cancel writes: both pair these.
assert.equal(isOrderClosedForPayment({ status: 'cancelled', paymentStatus: 'expired' }), true, 'a swept order is closed');
// The gap that let the portal disagree: cancelled, with a payment status still reading alive.
assert.equal(isOrderClosedForPayment({ status: 'cancelled', paymentStatus: 'unpaid' }), true, 'cancelled is closed whatever the payment status says');
// The opposite failure would be worse: hiding the account from everyone who still has to pay.
assert.equal(isOrderClosedForPayment({ status: 'pending_payment', paymentStatus: 'unpaid' }), false, 'an unpaid live order stays payable');
assert.equal(isOrderClosedForPayment({ status: 'processing', paymentStatus: 'pending' }), false, 'so does one awaiting proof review');

// Now the portal's own predicates, lifted from its source and executed. Asserting that the FILE mentions
// the helper would pass while the one predicate that matters had stopped calling it.
const portalSource = read('pages', 'CustomerPortalPage.jsx');
const topLevelConsts = new Map();
for (const match of portalSource.matchAll(/^const (\w+) = /gm)) {
  const from = match.index;
  let depth = 0;
  let end = -1;
  for (let i = from; i < portalSource.length; i += 1) {
    const ch = portalSource[i];
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth -= 1;
    else if (ch === ';' && depth === 0) { end = i + 1; break; }
  }
  if (end > 0) topLevelConsts.set(match[1], portalSource.slice(from, end));
}
assert.ok(topLevelConsts.size >= 15, `only ${topLevelConsts.size} top-level consts parsed from the portal — the parse is broken`);

// Anything the portal uses to decide whether to OFFER a way to pay. Named by pattern, so a
// canResumePayment added next month is caught the day it is written.
const offers = [...topLevelConsts.keys()].filter((name) => /^can[A-Z]\w*Pay|^isPayable/.test(name));
assert.deepEqual(offers.sort(), ['canOpenPayment', 'canUploadPaymentProof', 'isPayableOrder'],
  'the portal grew (or lost) a payment-offer predicate — read it before changing this list');

// Evaluate them together with their dependencies. isManualTransferPayment comes from cartService; the
// closed helper is the one built from orderService above.
const needed = ['DOKU_PAYMENT_TTL_MINUTES', 'isDokuPayment', 'isPayableOrder', 'getDokuExpiryDate',
  'isDokuPaymentExpired', 'canOpenPayment', 'canUploadPaymentProof'];
for (const name of needed) assert.ok(topLevelConsts.has(name), `${name} is gone from the portal — update this guard`);
const evaluate = new Function('isManualTransferPayment', 'isOrderClosedForPayment',
  `${needed.map((name) => topLevelConsts.get(name)).join('\n')}\nreturn { isPayableOrder, canOpenPayment, canUploadPaymentProof };`);
const portal = evaluate(
  (provider) => ['manual', 'manual_transfer_bca'].includes(provider),
  isOrderClosedForPayment,
);

// DKT-MU9L5XW2-JNBGGD as the sweep left it, with every other field set so each predicate would
// otherwise say yes: manual transfer, no proof yet, a payment URL on file.
const swept = {
  status: 'cancelled',
  paymentStatus: 'expired',
  paymentProvider: 'manual_transfer_bca',
  paymentProofStatus: 'missing',
  paymentUrl: 'https://example.test/pay',
  createdAt: new Date().toISOString(),
};
// The same order as Studio's cancel button would leave it if it ever stopped expiring the payment
// status alongside the order. That pairing is done in both writers today, so this second shape is the
// latent half — and it is the half a predicate reading only payment_status cannot see.
const cancelledButAlive = { ...swept, paymentStatus: 'unpaid' };

for (const [label, order] of [['swept', swept], ['cancelled with a live payment status', cancelledButAlive]]) {
  for (const [name, predicate] of Object.entries(portal)) {
    assert.equal(predicate(order), false,
      `${name} still says yes for an order ${label} — the portal would offer to take money for it`);
  }
}

// And a live one still gets both offers, or this guard would have closed the shop instead of the hole.
const live = { ...swept, status: 'pending_payment', paymentStatus: 'unpaid' };
assert.equal(portal.isPayableOrder(live), true, 'an unpaid manual order is still payable');
assert.equal(portal.canUploadPaymentProof(live), true, 'and can still send its transfer receipt');

// --- 7. A refunded order is CLOSED everywhere, not only on the payment page ---------------------------
// Found 29 Sep 2026 by running these rules rather than reading them. Studio's order-detail payment select
// is built from paymentStatusLabels, so "Refund" is one change away — and picking it used to send the
// ORDER status to 'pending_payment' (failed and expired both go to 'cancelled'), leaving a refunded order
// sitting in the active queue, shown by none of the three payment tiles and listed by none of them. The
// stock was restored correctly the whole time, which is what kept the disagreement invisible.
const workflowSource = readFileSync(join(root, 'utils', 'orderWorkflow.js'), 'utf8')
  .replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '');
const stubs = [
  'const PAYMENT_RESERVATION_TTL_HOURS = 24;',
  'const getOrderReservationExpiresAt = () => "";',
  `const CLOSED_PAYMENT_STATUSES = ${JSON.stringify(CLOSED_PAYMENT_STATUSES)};`,
  '',
].join('\n');
const workflow = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + workflowSource, 'utf8').toString('base64')}`
);

for (const paymentStatus of CLOSED_PAYMENT_STATUSES) {
  assert.equal(workflow.getNextOrderStatusForPayment(paymentStatus), 'cancelled',
    `marking an order ${paymentStatus} must cancel it — the stock is restored either way, so any other `
    + 'status leaves a dead order in the queue');
  const order = { status: 'pending_payment', paymentStatus };
  assert.equal(workflow.matchesOrderFilter(order, 'payment_problem'), true,
    `a ${paymentStatus} order must appear under the payment-problem lens`);
  assert.equal(workflow.describeStockReservation(order).state, 'released',
    `a ${paymentStatus} order has already given its stock back`);
}

// Every payment status the Studio select offers falls under exactly one of the three tiles, so none can
// go missing from all of them again. The subject is the label map the select is built from, not a list.
const LENSES = ['payment_pending', 'payment_paid', 'payment_problem'];
const offered = Object.keys(workflow.paymentStatusLabels);
assert.ok(offered.length >= 6, `only ${offered.length} payment statuses offered — the parse is broken`);
for (const paymentStatus of offered) {
  const matched = LENSES.filter((lens) => workflow.matchesOrderFilter({ paymentStatus }, lens));
  assert.equal(matched.length, 1,
    `"${workflow.paymentStatusLabels[paymentStatus]}" (${paymentStatus}) is shown by ${matched.length} of the `
    + `three payment tiles (${matched.join(', ') || 'none'}) — Studio offers it, so exactly one must own it`);
}

// And the phone counts those tiles with the same lens it filters by. A second implementation is how
// "Masalah 0" could sit above a list that had orders in it.
const mobileOrders = read('pages', 'mobile', 'MobileOrdersPage.jsx');
assert.match(mobileOrders, /countOrdersByFilter\(orders, \['payment_pending', 'payment_paid', 'payment_problem'\]\)/,
  'the phone must count the payment tiles through the shared lens');
assert.doesNotMatch(mobileOrders, /attention: orders\.filter/, 'the hand-rolled tile count must not come back');

console.log(`closedOrderPayment selfcheck OK (a cancelled order stops handing out the bank account on ${asked} screens that load one, and ${gates} payment link gated on the same question)`);
