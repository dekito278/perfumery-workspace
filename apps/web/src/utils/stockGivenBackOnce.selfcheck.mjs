// `node src/utils/stockGivenBackOnce.selfcheck.mjs`
//
// Reserved stock may be handed back to the catalogue exactly once.
//
// orderService holds the flag that makes that true: `inventory_deducted`. Restoring the units and leaving
// the flag up means the order still claims to hold stock it no longer holds, and the next thing that ends
// that order restores the same units a second time — Dekito is then told he has bottles he does not have,
// which is the direction that oversells.
//
// markOrderInventoryRestored exists for this and says so in its own comment. Two of the three paths that
// hand stock back called it; deleteOrder did not, on the reasoning that its row is about to disappear —
// which is exactly untrue whenever the delete is refused, and the line that performs it says how that
// arrives: 200 with zero rows and no error.
//
// Counted, not listed: any exported function that gives reserved stock back must also put the flag down,
// and must do it AFTER the restore. A new way to end an order is covered by being written.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
// Comments first. Both function names are discussed in prose all over this file, so an unstripped body
// would satisfy every search below without a single call being made.
const orderService = readFileSync(join(src, 'services', 'orderService.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const exported = [...orderService.matchAll(/export const (\w+) = /g)];
assert.ok(exported.length >= 10, `only ${exported.length} exports parsed from orderService — the derivation broke`);

const handsStockBack = [];
const leavesTheFlagUp = [];
const marksTooEarly = [];
for (let index = 0; index < exported.length; index += 1) {
  const from = exported[index].index;
  const to = index + 1 < exported.length ? exported[index + 1].index : orderService.length;
  const body = orderService.slice(from, to);
  const restoreAt = body.indexOf('restoreInventoryForOrder(');
  if (restoreAt < 0) continue;
  handsStockBack.push(exported[index][1]);
  const markAt = body.indexOf('markOrderInventoryRestored(');
  if (markAt < 0) leavesTheFlagUp.push(exported[index][1]);
  // Putting the flag down first and restoring afterwards reads as done and is not: a restore that then
  // fails leaves the units unreturned on an order that no longer admits to holding them.
  else if (markAt < restoreAt) marksTooEarly.push(exported[index][1]);
}

assert.ok(handsStockBack.length >= 3,
  `only ${handsStockBack.length} stock-returning paths found (${handsStockBack.join(', ')}) — the derivation broke`);
assert.deepEqual(leavesTheFlagUp, [],
  'these paths hand reserved stock back and leave inventory_deducted up, so the next thing that ends the '
  + `order restores the same units again:\n  ${leavesTheFlagUp.join('\n  ')}`);
assert.deepEqual(marksTooEarly, [],
  `these paths put the flag down before the stock was actually returned:\n  ${marksTooEarly.join('\n  ')}`);

// --- and the function they all call has to be the one that actually clears the flag -------------------
// Named after what it is believed to do, so it is RUN rather than trusted. Its two collaborators are
// stubbed: the write is captured, and the event normaliser is identity so the two lists stay countable.
const lifted = orderService.match(/const markOrderInventoryRestored = async [\s\S]*?\n\};/);
assert.ok(lifted, 'could not lift markOrderInventoryRestored out of orderService — update this guard, not the service');

const writes = [];
const marker = new Function('updateOrderRow', 'normalizeInventoryEvents', `
  ${lifted[0]}
  return markOrderInventoryRestored;
`)(
  async (orderId, patch) => { writes.push({ orderId, patch }); },
  (events = []) => events,
);

await marker('DKT-1', [{ quantity: 2 }], [{ quantity: 2, type: 'restore' }]);
assert.equal(writes.length, 1, 'marking the stock restored must write exactly once');
assert.equal(writes[0].orderId, 'DKT-1');
assert.equal(writes[0].patch.inventory_deducted, false,
  'markOrderInventoryRestored must put inventory_deducted DOWN — with it still up, the same units are '
  + 'restored again by the next path that ends the order');
assert.equal(writes[0].patch.inventory_events.length, 2,
  'both the original deduction and the restore have to survive, or the order cannot say what happened');

console.log('stockGivenBackOnce selfcheck OK');
