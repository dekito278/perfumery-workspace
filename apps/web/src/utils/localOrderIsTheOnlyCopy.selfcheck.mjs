// `node src/utils/localOrderIsTheOnlyCopy.selfcheck.mjs`
//
// Every row in the local order store is an order the SERVER DOES NOT HAVE.
//
// createLocalOrder is the only thing that writes one, and it stamps persistence:'local',
// sync_status:'sync_required' and raises a sync issue. It exists for the one case where the order could not
// reach Supabase and the browser is the only copy there is. So emptying that store is not housekeeping — it
// is the only way to lose an order permanently.
//
// `clearOrders` was `writeOrders([])`, and useOrders exposed it as `clearAll` with no confirmation and a
// name that promised something it could not do: the 33 orders on the server would be untouched, so the
// screen would empty, the owner would believe they were deleted, and a reload would bring them all back —
// while the unsynced ones, the only ones it actually removed, were gone for good.
//
// Counted before deleting: `clearAll` had exactly one reference across src, api and tools — its own
// definition — and every useOrders() call site destructures explicitly, so nothing could reach it. Dead,
// and dead code that reads like a destructive control is worse than none.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');
const orders = strip(readFileSync(join(src, 'services', 'orderService.js'), 'utf8'));

// --- 1. The store's writers, counted ------------------------------------------------------------------
//
// Three are legitimate and this check names what each may do. A fourth has to justify itself here.
const writers = [...orders.matchAll(/writeOrders\(([^)]*)\)/g)].map((match) => match[1].trim());
console.log(`  writeOrders callers (${writers.length}): ${writers.join(' | ')}`);
assert.ok(writers.length >= 2,
  `expected the add and the post-sync removal; found ${writers.length}. Either the store moved, or this `
  + 'check no longer sees its writers.');

// Nothing may hand it an empty list. That is the whole rule: an empty store is an order destroyed, never
// an order tidied.
const emptied = writers.filter((argument) => /^\[\s*\]$/.test(argument));
assert.deepEqual(emptied, [],
  'something empties the local order store. Every row in it is an order the server does not have, so this '
  + 'is the one write in the app that can lose an order permanently — and it cannot be undone from any '
  + 'screen, because no screen can see what was in there.');

// Nor by going around it to the storage key.
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (/\.jsx?$/.test(entry.name) && !/selfcheck/.test(entry.name)) files.push(rel);
  }
};
walk('');
const key = /const ORDERS_STORAGE_KEY = '([^']+)'/.exec(orders);
assert.ok(key, 'orderService must still name the local order storage key');
const bypass = [];
for (const rel of files) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  for (const match of source.matchAll(/removeItem\(\s*([^)]*)\)/g)) {
    if (match[1].includes('ORDERS_STORAGE_KEY') || match[1].includes(key[1])) bypass.push(`${rel}: ${match[0]}`);
  }
}
assert.deepEqual(bypass, [],
  'these drop the local order store through localStorage directly, which is the same loss by another '
  + 'door:\n  ' + bypass.join('\n  '));

// --- 2. The one legitimate removal still checks that the order synced ----------------------------------
const retry = orders.slice(orders.indexOf('export const retryLocalOrderSync'));
const body = retry.slice(0, retry.indexOf('\n};'));
assert.ok(body.length > 200, 'retryLocalOrderSync is gone — update this chain, not the rule');
const removals = [...body.matchAll(/writeOrders\(localOrders\.filter\(/g)];
assert.ok(removals.length >= 1,
  'the post-sync removal must drop ONE order by filter, never replace the list');
// PER USAGE, not "somewhere in the function": this same body calls clearOrderSyncIssue on its early-return
// path too, and a presence test was satisfied by that one while the real removal lost its pairing.
const orphaned = [];
for (const match of removals) {
  const after = body.slice(match.index, match.index + 200);
  if (!/clearOrderSyncIssue\(/.test(after)) orphaned.push(after.split('\n')[0].trim());
}
assert.deepEqual(orphaned, [],
  'an order leaves the store without its sync issue, so the queue keeps asking to retry something that is '
  + 'no longer there:\n  ' + orphaned.join('\n  '));

// --- 3. And no hook hands a clear-everything control to a screen ---------------------------------------
const hooks = files.filter((rel) => rel.startsWith('hooks/'));
assert.ok(hooks.length >= 5, `expected to sweep the hooks; found ${hooks.length}`);
const exposed = [];
for (const rel of hooks) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  for (const match of source.matchAll(/\b(clearAll|clearOrders|wipeOrders|resetOrders)\b/g)) {
    exposed.push(`${rel}: ${match[1]}`);
  }
}
assert.deepEqual(exposed, [],
  'a hook offers a clear-everything control over the order store again. The server copy would survive it '
  + 'and the unsynced copy would not, so the screen empties, the owner believes the orders are gone, and a '
  + 'reload brings back everything except the ones that mattered:\n  ' + exposed.join('\n  '));

console.log('localOrderIsTheOnlyCopy selfcheck OK (nothing empties the store; one order leaves it, after it syncs)');
