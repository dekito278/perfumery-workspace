// `node src/utils/recoveredOrderKeepsEverything.selfcheck.mjs`
//
// An order recovered from the local queue must come back whole.
//
// When the direct insert fails, the order is kept in localStorage and re-sent later through
// toOrderDatabasePayload — a hand-written column list. normalizeOrder reads the row back through another
// hand-written list. Two lists facing each other is how a field goes missing in exactly one direction,
// and the direction that loses it is the RECOVERY path: the one that only runs after something has
// already gone wrong.
//
// It had. buildOrderPayload writes client_context on the direct insert, and its own comment says what
// that is for: without it "an order created here had no shop at all and every message about it went out
// in Indonesian by default". The re-send dropped it again, so an English buyer whose order failed to
// save would be recovered as an Indonesian one.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// Comments first: this subject is discussed in prose throughout that file, and a column named only in an
// explanation must not count as a column written.
const service = readFileSync(join(here, '..', 'services', 'orderService.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

const slice = (start, end) => {
  const from = service.indexOf(start);
  assert.ok(from > 0, `${start} is gone from orderService — update this guard, not the service`);
  const body = service.slice(from);
  const to = body.indexOf(end);
  assert.ok(to > 0, `could not find the end of ${start}`);
  return body.slice(0, to);
};

// What the app reads back off a row — the mapper's own column list, derived rather than restated.
const mapper = slice('const normalizeOrder = (order)', '\n};');
const readColumns = new Set([...mapper.matchAll(/order\.([a-z][a-z0-9]*(?:_[a-z0-9]+)+)/g)].map((m) => m[1]));
assert.ok(readColumns.size >= 25, `only ${readColumns.size} columns read by normalizeOrder — the derivation broke`);

// What the recovery path writes back.
const payload = slice('const toOrderDatabasePayload = (order)', '\n});');
const writtenColumns = new Set([...payload.matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]));
assert.ok(writtenColumns.size >= 30, `only ${writtenColumns.size} columns written — the derivation broke`);

// Columns the DATABASE owns. Writing these from a localStorage copy would be worse than dropping them.
const DATABASE_OWNS = new Set(['id', 'created_at', 'updated_at']);

// One documented exception, with the condition that makes its reason true.
const EXCUSED = {
  sync_: {
    // Not database columns at all: they describe the LOCAL queue entry, and storefront_orders has no
    // such columns — writing them would make the recovery fail outright. createLocalOrder stamps them
    // when the draft is kept, and retryLocalOrderSync drops the draft once the row lands, which is what
    // makes them local-only. The exception dies if that stops being where they come from.
    why: 'local-queue bookkeeping, not columns on storefront_orders',
    stillTrue: () => /sync_status: 'sync_required'/.test(service) && /clearOrderSyncIssue\(/.test(service),
  },
  payment_proof: {
    why: 'written only once the row exists — by the storefront_submit_payment_proof RPC and by '
      + 'reviewOrderPaymentProof — so an order still in the local queue has never had one. On a re-send '
      + 'the upsert sets only the columns it lists, so a proof already on the server survives untouched.',
    stillTrue: () => /storefront_submit_payment_proof/.test(service) && /payment_proof_status:/.test(service),
  },
};
for (const [prefix, exception] of Object.entries(EXCUSED)) {
  assert.ok([...readColumns].some((column) => column.startsWith(prefix)),
    `nothing reads a '${prefix}' column any more — drop the exception rather than leaving a dead excuse`);
  assert.ok(exception.stillTrue(),
    `the reason '${prefix}' columns are excused from the recovery payload is no longer true: ${exception.why}`);
}

const dropped = [...readColumns]
  .filter((column) => !writtenColumns.has(column))
  .filter((column) => !DATABASE_OWNS.has(column))
  .filter((column) => !Object.keys(EXCUSED).some((prefix) => column.startsWith(prefix)))
  .sort();
assert.deepEqual(dropped, [],
  'the app reads these columns off an order but the recovery path does not write them back, so an order '
  + `rescued from the local queue returns without them:\n  ${dropped.join('\n  ')}`);

// And the shop hint goes through the WHITELIST, not straight across: that value has been sitting in
// localStorage, where the buyer can edit it.
assert.match(payload, /client_context: sanitizeClientContext\(/,
  'the recovery path copies client_context straight out of localStorage instead of through the one '
  + 'whitelist the other two writers use');

console.log(`recoveredOrderKeepsEverything selfcheck OK (${readColumns.size} read, ${writtenColumns.size} written back)`);
