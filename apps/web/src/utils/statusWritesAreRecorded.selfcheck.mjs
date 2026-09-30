// `node src/utils/statusWritesAreRecorded.selfcheck.mjs`
//
// An order's `status` is the column every queue in Studio is built from. Four functions in orderService
// write it, and for three of them the status IS what the admin asked to change. For the fourth it is a
// SIDE EFFECT: moving the bespoke workflow to "Produksi" also moves the order to processing.
//
// A side effect must never undo a decision further along than itself, and it must leave a record.
// Unguarded, this one did neither: setting the workflow back to Produksi on an order already shipped or
// completed pulled it out of the finished queue, and the audit entry named only the workflow field, so
// nothing anywhere said the status had moved.
//
// Measured on the live shop the day this was written: seventeen bespoke orders, ELEVEN of them already
// shipped or completed, and all seventeen still at review_brief — so the first real use of that dropdown
// lands on orders that have already gone out.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// Comments first: this file's own prose names `status` and both audit fields repeatedly, and a search
// that counts an explanation as the fix is a guard nobody can fail.
const orderService = readFileSync(join(here, '..', 'services', 'orderService.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

// --- every function that writes the status must name it in its audit entry ------------------------------
// Counted, not listed: the writers are whichever exported functions put a `status:` into the row patch.
const exported = [...orderService.matchAll(/export const (\w+) = /g)];
assert.ok(exported.length >= 10, `only ${exported.length} exports parsed from orderService — the derivation broke`);

const statusWriters = [];
const unrecorded = [];
for (let index = 0; index < exported.length; index += 1) {
  const from = exported[index].index;
  const to = index + 1 < exported.length ? exported[index + 1].index : orderService.length;
  const body = orderService.slice(from, to);
  // A status written into the row, not merely read from it.
  if (!/\bstatus: '/.test(body) && !/\{ status \}/.test(body)) continue;
  if (!/updateOrderRow\(/.test(body)) continue;
  statusWriters.push(exported[index][1]);
  const previous = body.match(/previousValues: \{[\s\S]*?\n\s*\},/);
  const next = body.match(/nextValues: \{[\s\S]*?\n\s*\},/);
  if (!previous || !next || !/\bstatus\b/.test(previous[0]) || !/\bstatus\b/.test(next[0])) {
    unrecorded.push(exported[index][1]);
  }
}
assert.ok(statusWriters.length >= 4,
  `only ${statusWriters.length} status-writing path(s) found (${statusWriters.join(', ')}) — the derivation broke`);

// Two write the status and are right not to name it in an audit entry of their own. Each carries its
// reason AND the condition that makes the reason true, so the exception dies when the reason does.
const bodyOf = (name) => {
  const at = orderService.indexOf(`export const ${name} = `);
  const rest = orderService.slice(at + 1);
  const nextExport = rest.indexOf('\nexport const ');
  return nextExport === -1 ? rest : rest.slice(0, nextExport);
};
const excused = {
  // Creates the row, then compensates by cancelling the order it just inserted when validation fails.
  // Nothing moved: the buyer never saw this order in any other state. Stale the moment it stops being
  // the creation path.
  createOrder: (body) => /\.insert\(/.test(body),
  // Writes status:'paid' and then hands the same transition to updateOrderPaymentStatus, which audits it
  // properly. The record exists, one call along. Stale the moment that hand-off goes.
  reviewOrderPaymentProof: (body) => /await updateOrderPaymentStatus\(/.test(body) && /status: 'paid',/.test(body),
};
for (const [name, stillTrue] of Object.entries(excused)) {
  assert.ok(statusWriters.includes(name),
    `${name} no longer writes the order status — drop it from this guard's exceptions instead of leaving a dead excuse`);
  assert.ok(stillTrue(bodyOf(name)),
    `the reason ${name} is excused from naming the status in its own audit entry is no longer true — `
    + 'either restore it or record the status here');
}

const stillUnrecorded = unrecorded.filter((name) => !(name in excused));
assert.deepEqual(stillUnrecorded, [],
  'these paths write the order status and do not name it in the audit entry they create, so the move '
  + `leaves no trace on the order it happened to:\n  ${stillUnrecorded.join('\n  ')}`);

// --- and the side effect only moves the order FORWARD ---------------------------------------------------
// Lifted and RUN with its five collaborators stubbed, rather than asserting the shape of the condition:
// what matters is which rows come out carrying a status and which do not.
const lifted = orderService.match(/const ORDER_STATUSES_BEFORE_PRODUCTION = [\s\S]*?export const updateOrderBespokeProductionStatus = async [\s\S]*?\n\};/);
assert.ok(lifted, 'could not lift updateOrderBespokeProductionStatus out of orderService — update this guard, not the service');

const run = async (order, productionStatus) => {
  const writes = [];
  const audits = [];
  const make = new Function(
    'getOrderById', 'updateOrderRow', 'createOrderAuditLog', 'appendBespokeProductionTimeline',
    `${lifted[0].replace('export const', 'const')}\n return updateOrderBespokeProductionStatus;`,
  );
  const fn = make(
    async () => order,
    async (orderId, patch) => { writes.push(patch); },
    async (entry) => { audits.push(entry); },
    () => [],
  );
  await fn('DKT-1', productionStatus);
  assert.equal(writes.length, 1, 'the workflow write must happen exactly once');
  return { patch: writes[0], audit: audits[0] };
};

// Forwards: an order that has not reached production yet.
for (const status of ['pending_payment', 'paid']) {
  const { patch, audit } = await run({ status, bespokeProductionStatus: 'sample' }, 'production');
  assert.equal(patch.status, 'processing', `reaching production must move a '${status}' order to processing`);
  assert.equal(audit.previousValues.status, status, 'and the audit must say where it came from');
  assert.equal(audit.nextValues.status, 'processing', 'and where it went');
}

// Backwards: every status that has already moved past this point keeps it.
for (const order of [
  { status: 'shipped' },
  { status: 'completed' },
  { status: 'cancelled' },
  { status: 'some_status_added_later' },
]) {
  const { patch, audit } = await run({ ...order, bespokeProductionStatus: 'ready' }, 'production');
  assert.equal('status' in patch, false,
    `an order at '${order.status}' must keep it — the workflow dropdown is not a way to un-ship an order`);
  assert.equal('status' in audit.nextValues, false, 'and an unwritten status must not be claimed in the audit');
}

// Already there: nothing to move, nothing to record.
{
  const { patch, audit } = await run({ status: 'processing' }, 'production');
  assert.equal('status' in patch, false, 'an order already processing needs no status write');
  assert.equal('status' in audit.nextValues, false, 'and no audit line saying it changed to what it already was');
}

// Every other workflow step leaves the order status alone, in both directions.
for (const step of ['review_brief', 'formula', 'sample', 'approval', 'ready']) {
  const { patch } = await run({ status: 'paid' }, step);
  assert.equal('status' in patch, false, `moving the workflow to '${step}' must not touch the order status`);
  assert.equal(patch.bespoke_production_status, step, 'but it must still record the workflow step itself');
}

console.log('statusWritesAreRecorded selfcheck OK');
