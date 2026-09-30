// `node src/utils/oneQueueOneRule.selfcheck.mjs`
//
// A queue tab and every other screen's count of it must be the same list.
//
// utils/orderWorkflow.js owns those rules, and its header says why: they "used to be written out three
// times — the desktop list, the desktop tab counts, and the mobile list — and they had already drifted
// apart: desktop has a `payment` tab, mobile a wider `follow_up` one that also sweeps in shipped orders.
// Both keys are kept here so neither page changes behaviour."
//
// `follow_up` exists in that file FOR the phone's fulfillment screen — which then went on spelling the
// rule out itself, along with `shipped`. And they had drifted, in the way the shared rule was written to
// absorb: there are TWO ways an order says it has shipped, `status` and `shipmentStatus`, and the shared
// rule accepts either while that screen read only the second.
//
// Measured on the live shop the day this was written: one real order sits at status 'shipped' with
// shipmentStatus 'not_ready' — marked shipped from the status control, which never touches the shipment
// row. The phone's Dikirim tab counted 10 where every other screen counted 11.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

// --- the shared rule, LIFTED and RUN ------------------------------------------------------------------
// orderWorkflow speaks '@/...' and reaches orderService, so it cannot be imported.
const workflow = readFileSync(join(src, 'utils', 'orderWorkflow.js'), 'utf8');
const lift = (pattern, what) => {
  const found = workflow.match(pattern);
  assert.ok(found, `could not lift ${what} out of orderWorkflow — update this guard, not the app`);
  return found[0];
};
const { matchesOrderFilter } = await import(`data:text/javascript;base64,${Buffer.from([
  "import { CLOSED_PAYMENT_STATUSES } from 'file://" + join(src, 'utils', 'orderClosed.js') + "';",
  'const isBespokeOrder = (o) => o?.source === "bespoke_request";',
  lift(/export const isArchivedOrder = [\s\S]*?\n\);/, 'isArchivedOrder'),
  lift(/export const hasShippingLabelPrinted = [^\n]*/, 'hasShippingLabelPrinted'),
  lift(/export const isShippedOrder = [\s\S]*?\n\);/, 'isShippedOrder'),
  lift(/export const isFrontQueueOrder = [\s\S]*?\n\);/, 'isFrontQueueOrder'),
  lift(/export const isAwaitingCustomerPayment = [\s\S]*?\n\);/, 'isAwaitingCustomerPayment'),
  lift(/export const matchesOrderFilter = [\s\S]*?\n\};/, 'matchesOrderFilter'),
].join('\n'), 'utf8').toString('base64')}`);

// The exact shape that diverged, and the reason it exists: two controls say "shipped" and only one of
// them writes the shipment row.
const markedShippedFromStatus = { status: 'shipped', shipmentStatus: 'not_ready', paymentStatus: 'paid' };
const markedShippedFromFulfillment = { status: 'shipped', shipmentStatus: 'shipped', paymentStatus: 'paid' };
for (const [how, order] of [['the status control', markedShippedFromStatus], ['the shipment control', markedShippedFromFulfillment]]) {
  assert.equal(matchesOrderFilter(order, 'shipped'), true,
    `an order marked shipped from ${how} belongs in the Dikirim queue — a screen that reads only one of `
    + 'the two fields counts a different number from every other screen');
  assert.equal(matchesOrderFilter(order, 'follow_up'), true, `and in follow-up, from ${how}`);
}
// The directions that keep it honest.
assert.equal(matchesOrderFilter({ status: 'completed', shipmentStatus: 'delivered', paymentStatus: 'paid' }, 'shipped'), false,
  'a delivered order has left the shipped queue');
assert.equal(matchesOrderFilter({ status: 'cancelled', shipmentStatus: 'shipped', paymentStatus: 'expired' }, 'shipped'), false,
  'and a cancelled one is not in it either');
assert.equal(matchesOrderFilter({ status: 'paid', shipmentStatus: 'not_ready', paymentStatus: 'paid' }, 'shipped'), false,
  'an order that has not shipped at all must not appear there');

// --- and the fulfillment screen must ASK, not re-spell ------------------------------------------------
// Counted, not listed: its queues are whichever keys it branches on.
const page = strip(readFileSync(join(src, 'pages', 'mobile', 'MobileFulfillmentPage.jsx'), 'utf8'));
const keys = [...page.matchAll(/queueFilter === '(\w+)'/g)].map((m) => m[1]);
assert.ok(keys.length >= 4, `only ${keys.length} queue branch(es) found — the derivation broke`);

// One documented exception, with the condition that makes it true.
// `packing` here is deliberately NARROWER than the shared rule: this is a fulfillment screen, so its
// packing tab means "paid, packable, and ready to pack", not merely "a label was printed". Measured the
// day this was written: both answers were the same three orders, so nothing is hidden by it today. The
// exception dies the moment it stops being narrower.
// Sliced to the packing BRANCH, not searched across the file: `readyOrders.filter(` and `isReadyToPack`
// both appear elsewhere on this screen, so a whole-page search stayed green with the packing tab already
// widened back to every printed label. The narrowing has to be visible in the branch itself.
const excused = {
  packing: () => {
    const branch = page.match(/queueFilter === 'packing'\) return ([^\n;]*)/);
    return Boolean(branch) && /readyOrders/.test(branch[1]) && /paidOrders\.filter\(isFulfillmentReady\)/.test(page);
  },
};

// Only the keys the shared rule actually OWNS, lifted from its own case labels. Two of this screen's
// queues — need_resi and blocked — have no case there at all; they are its own questions, and they are
// already built from orderWorkflow's shared helpers rather than from re-spelled status logic, which is
// asserted below. Requiring them to call matchesOrderFilter would be demanding a rule that does not exist.
const sharedKeys = new Set([...lift(/export const matchesOrderFilter = [\s\S]*?\n\};/, 'matchesOrderFilter')
  .matchAll(/case '(\w+)':/g)].map((m) => m[1]));
assert.ok(sharedKeys.size >= 8, `only ${sharedKeys.size} case(s) lifted from matchesOrderFilter — the derivation broke`);
assert.ok(sharedKeys.has('shipped') && sharedKeys.has('follow_up'),
  'the two keys this screen was getting wrong are gone from the shared rule');

// The queues it owns alone must still come from orderWorkflow's shared helpers, not from status strings
// written out here.
const ownQueues = keys.filter((key) => !sharedKeys.has(key));
const workflowHelpers = [...workflow.matchAll(/export const (is\w+) = /g)].map((m) => m[1]);
for (const key of ownQueues) {
  const list = page.match(new RegExp(`queueFilter === '${key}'\\) return ([\\s\\S]*?);`));
  assert.ok(list, `the '${key}' branch changed shape — update this guard`);
  // Followed to a fixed point, not one hop: need_resi names isNeedsResi, which names isFulfillmentReady,
  // which is the one that finally names the shared isReadyToPack. Stopping at the first hop would be
  // checking the spelling again rather than the rule.
  let reachable = list[1];
  for (let hop = 0; hop < 4; hop += 1) {
    const before = reachable;
    for (const id of new Set([...reachable.matchAll(/\b([A-Za-z_]\w*)\b/g)].map((m) => m[1]))) {
      const definition = page.match(new RegExp(`const ${id} = [^\n]*`));
      if (definition && !reachable.includes(definition[0])) reachable += `\n${definition[0]}`;
    }
    if (reachable === before) break;
  }
  assert.ok(workflowHelpers.some((helper) => reachable.includes(helper)),
    `the '${key}' queue decides membership with its own status logic instead of one of orderWorkflow's `
    + 'shared helpers, which is how a screen starts answering a question differently from the rest');
}

const byHand = [];
for (const key of keys.filter((k) => sharedKeys.has(k))) {
  if (key in excused) {
    assert.ok(excused[key](page),
      `the reason the '${key}' queue is excused from the shared rule is no longer true — either restore `
      + 'it or route that queue through matchesOrderFilter like the others');
    continue;
  }
  const list = page.match(new RegExp(`queueFilter === '${key}'\\) return (\\w+)`));
  if (!list) { byHand.push(`${key} (branch shape changed)`); continue; }
  const built = page.match(new RegExp(`const ${list[1]} = useMemo\\([\\s\\S]*?\\), \\[`));
  if (!built || !/matchesOrderFilter\(/.test(built[0])) byHand.push(key);
}
assert.deepEqual(byHand, [],
  'these queues are spelled out on the screen instead of asked of matchesOrderFilter, so this tab and '
  + `every other screen's count of it drift apart:\n  ${byHand.join('\n  ')}`);

console.log(`oneQueueOneRule selfcheck OK (${keys.length} queues: ${keys.filter((k) => sharedKeys.has(k)).length} shared, ${ownQueues.length} its own)`);
