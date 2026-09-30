// `node src/utils/oneWordOneCount.selfcheck.mjs`
//
// "Aktif" is one word and must be one number.
//
// utils/orderWorkflow.js owns the definition, and its own header says why: the rule "used to be written
// out three times — the desktop list, the desktop tab counts, and the mobile list — and they had already
// drifted apart... a list and its count can no longer disagree about the same tab."
//
// A FOURTH definition survived that consolidation, in getOrderSummary: "anything not completed or
// cancelled". Three Studio screens printed it. Measured on the live shop the day this was written: the
// orders page showed **Aktif 20** in its hero, directly above its own **Aktif 1** chip. The phone had
// already hit this and switched to the chip's count, leaving a comment saying exactly that; the desktop
// screens kept the old number.
//
// So: nothing may compute that queue except matchesOrderFilter, and the summary may not offer it.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

// orderWorkflow speaks '@/...' and reaches orderService, so the six pieces that decide what "Aktif"
// means are LIFTED out of it and RUN. Asserting that a file mentions matchesOrderFilter would pass while
// the one expression that decides the number had changed underneath.
const workflowSource = readFileSync(join(src, 'utils', 'orderWorkflow.js'), 'utf8');
const lift = (pattern, what) => {
  const found = workflowSource.match(pattern);
  assert.ok(found, `could not lift ${what} out of orderWorkflow — update this guard, not the app`);
  return found[0];
};
const { matchesOrderFilter, countOrdersByFilter } = await import(`data:text/javascript;base64,${Buffer.from([
  "import { CLOSED_PAYMENT_STATUSES } from 'file://" + join(src, 'utils', 'orderClosed.js') + "';",
  // Only the 'bespoke' case uses it, and no fixture here is bespoke.
  'const isBespokeOrder = () => false;',
  lift(/export const isArchivedOrder = [\s\S]*?\n\);/, 'isArchivedOrder'),
  lift(/export const hasShippingLabelPrinted = [^\n]*/, 'hasShippingLabelPrinted'),
  lift(/export const isShippedOrder = [\s\S]*?\n\);/, 'isShippedOrder'),
  lift(/export const isFrontQueueOrder = [\s\S]*?\n\);/, 'isFrontQueueOrder'),
  lift(/export const isAwaitingCustomerPayment = [\s\S]*?\n\);/, 'isAwaitingCustomerPayment'),
  lift(/export const matchesOrderFilter = [\s\S]*?\n\};/, 'matchesOrderFilter'),
  lift(/export const countOrdersByFilter = [\s\S]*?\n\);/, 'countOrdersByFilter'),
].join('\n'), 'utf8').toString('base64')}`);

// --- the shared rule really does disagree with the one that was deleted -------------------------------
// Run both over the same orders, so this guard fails if the two ever become the same question — at which
// point the deletion below would be pointless and this file should be rethought rather than kept green.
const orders = [
  { status: 'pending_payment', paymentStatus: 'unpaid', paymentProofStatus: 'missing', shipmentStatus: 'not_ready' },
  { status: 'paid', paymentStatus: 'paid', paymentProofStatus: 'approved', shipmentStatus: 'not_ready' },
  { status: 'shipped', paymentStatus: 'paid', paymentProofStatus: 'approved', shipmentStatus: 'shipped' },
  { status: 'completed', paymentStatus: 'paid', paymentProofStatus: 'approved', shipmentStatus: 'delivered' },
  { status: 'cancelled', paymentStatus: 'expired', paymentProofStatus: 'missing', shipmentStatus: 'not_ready' },
];
const notFinished = orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length;
const queue = countOrdersByFilter(orders, ['active']).active;
assert.equal(queue, 1, 'the "Aktif" queue is the one order still waiting on the shop');
assert.ok(notFinished > queue,
  'the deleted definition must still be the WIDER one, or this guard is protecting nothing');
// And it is the same answer through either door, so a screen may use whichever reads better.
assert.equal(orders.filter((order) => matchesOrderFilter(order, 'active')).length, queue);

// --- the summary may not offer the word at all --------------------------------------------------------
const orderService = strip(readFileSync(join(src, 'services', 'orderService.js'), 'utf8'));
const summary = orderService.slice(orderService.indexOf('export const getOrderSummary'));
const summaryBody = summary.slice(0, summary.indexOf('});') + 1);
assert.ok(summaryBody.length > 40, 'could not isolate getOrderSummary — update this guard');
assert.doesNotMatch(summaryBody, /\bactive\b/,
  'getOrderSummary offers an "active" count again. It is a fourth definition of a word three screens '
  + 'print beside the order list\'s own count of it — delete it and take the number from matchesOrderFilter');

// --- every screen that PRINTS the word takes it from the shared rule ---------------------------------
// Counted, not listed: the screens are whichever ones label a number "Aktif" or "Active orders". Each
// must get it from matchesOrderFilter, and must not spell the queue out itself.
//
// Scoped to the screens that print the word on purpose. The completed/cancelled pair appears elsewhere
// for genuinely different questions — the customer portal calls a shipped order "still going", which is
// true for the buyer and false for the admin's work queue — and widening this rule to every use of the
// pair would force those to lie.
const printers = [];
const byHand = [];
const walkPrinters = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walkPrinters(rel); continue; }
    if (!/\.jsx$/.test(entry.name)) continue;
    const text = strip(readFileSync(join(src, rel), 'utf8'));
    // About ORDERS, not just any list: VoucherManagementPage labels a voucher "Aktif" too, and a
    // voucher's word has nothing to do with the order queue.
    if (!/useOrders\(\)/.test(text)) continue;
    // Any label carrying the word, however it is phrased — "Aktif", "Order aktif", "Active orders",
    // "N aktif / M total". Pinned to the exact spelling, this missed the shipments hero, which is one of
    // the screens the number was wrong on.
    if (!/\baktif\b/i.test(text) && !/\bactive orders\b/i.test(text)) continue;
    printers.push(rel);
    const asksTheRule = /matchesOrderFilter\(|countOrdersByFilter\(|filterCounts\.active/.test(text);
    const spellsItOut = /\[['"]completed['"], ?['"]cancelled['"]\]\.includes\(\w+\.status\)/.test(text);
    if (!asksTheRule || spellsItOut) byHand.push(rel);
  }
};
walkPrinters('pages');
assert.ok(printers.length >= 4, `only ${printers.length} screen(s) print the word — the derivation broke`);
assert.deepEqual(byHand, [],
  'these screens print an "Aktif" number they did not get from the shared rule, which is how one word '
  + `came to carry two numbers on one screen:\n  ${byHand.join('\n  ')}`);

console.log(`oneWordOneCount selfcheck OK (${printers.length} screens, one definition)`);
