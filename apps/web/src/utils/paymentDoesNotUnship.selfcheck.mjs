// `node src/utils/paymentDoesNotUnship.selfcheck.mjs`
//
// Marking a payment must not move the ORDER backwards.
//
// updateOrderPaymentStatus takes a `status` alongside the payment status and wrote it unconditionally.
// getNextOrderStatusForPayment('paid') answers 'paid', and FOUR screens carry a bulk "tandai lunas" that
// maps that over a whole selection — on the shipments screen the selection is shipped orders by
// definition. Select-all on the "Dikirim" tab, mark paid, and every one of them was rewritten from
// `shipped` to `paid`, quietly emptying the queue they were in.
//
// Measured on the live shop the day this was written: 11 shipped and 7 completed orders, 22 of 33
// already paid — so re-marking any of them paid was a no-op for the payment and a demotion for the
// order. The existing guard in that function only refuses CANCELLED and EXPIRED orders; a shipped one
// sailed through.
//
// The one direction that must survive: a refund or an expiry closes an order wherever it had got to.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
const orderService = strip(readFileSync(join(src, 'services', 'orderService.js'), 'utf8'));

// --- lifted and RUN, because what matters is which rows come out carrying a status ---------------------
const lifted = orderService.match(
  /const ORDER_STATUS_REPLACEABLE_BY_PAYMENT = [\s\S]*?export const updateOrderPaymentStatus = async [\s\S]*?\n\};/,
);
assert.ok(lifted, 'could not lift updateOrderPaymentStatus out of orderService — update this guard, not the service');

const run = async (order, { paymentStatus, status }) => {
  const writes = [];
  const audits = [];
  const make = new Function(
    'getOrderById', 'updateOrderRow', 'createOrderAuditLog', 'isOrderClosedForPayment',
    'deductInventoryForOrder', 'markOrderInventoryDeducted', 'restoreInventoryForOrder',
    'markOrderInventoryRestored', 'releaseVoucherUsageForOrder', 'INVENTORY_RESTORE_PAYMENT_STATUSES',
    'window', 'CustomEvent',
    `${lifted[0].replace('export const', 'const')}\n return updateOrderPaymentStatus;`,
  );
  const fn = make(
    async () => order,
    async (orderId, patch) => { writes.push(patch); },
    async (entry) => { audits.push(entry); },
    // Only the cancelled/expired refusal this function already had — deliberately NOT widened here, so
    // the fixtures below have to pass the new rule rather than be stopped by the old one.
    (o) => o?.status === 'cancelled' || ['expired', 'failed', 'refunded'].includes(o?.paymentStatus),
    async () => [], async () => {}, async () => [], async () => {}, async () => {},
    ['expired', 'failed', 'refunded'],
    { dispatchEvent: () => {} }, function CustomEvent() {},
  );
  await fn('DKT-1', { paymentStatus, status, paymentProvider: 'manual_transfer_bca' });
  assert.equal(writes.length, 1, 'the payment write must happen exactly once');
  return { patch: writes[0], audit: audits[0] };
};

// Forwards: the move this is for.
{
  const { patch, audit } = await run({ status: 'pending_payment', paymentStatus: 'unpaid' }, { paymentStatus: 'paid', status: 'paid' });
  assert.equal(patch.status, 'paid', 'marking an unpaid order paid must move it to paid');
  assert.equal(audit.nextValues.status, 'paid');
}
// Backwards: every status that has already moved past this point keeps it.
for (const current of ['shipped', 'completed', 'processing', 'a_status_added_later']) {
  for (const wanted of ['paid', 'pending_payment']) {
    const { patch, audit } = await run(
      { status: current, paymentStatus: 'paid' },
      { paymentStatus: wanted === 'paid' ? 'paid' : 'unpaid', status: wanted },
    );
    assert.equal('status' in patch, false,
      `an order at '${current}' must keep it — "tandai lunas" is not a way to un-ship an order`);
    assert.equal(audit.nextValues.status, current,
      'and the audit must report the status the row will actually have, not the one that was asked for');
  }
}
// Already there: writing the same value back is harmless and stays allowed.
{
  const { patch } = await run({ status: 'paid', paymentStatus: 'paid' }, { paymentStatus: 'paid', status: 'paid' });
  assert.equal(patch.status, 'paid');
}
// The direction that must ALWAYS survive: a refund closes an order wherever it had got to.
for (const current of ['pending_payment', 'paid', 'processing', 'shipped', 'completed']) {
  const { patch } = await run({ status: current, paymentStatus: 'paid' }, { paymentStatus: 'refunded', status: 'cancelled' });
  assert.equal(patch.status, 'cancelled', `a refund must close an order that was '${current}'`);
}
// No status asked for, none written.
{
  const { patch } = await run({ status: 'shipped', paymentStatus: 'paid' }, { paymentStatus: 'paid' });
  assert.equal('status' in patch, false);
}

// --- and every bulk "mark paid" goes through the hook, not round it -------------------------------------
// Counted, not listed: the screens are whichever ones map a payment update over a selection.
const bulkScreens = [];
const roundTheSide = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (!/\.jsx$/.test(entry.name)) continue;
    const text = strip(readFileSync(join(src, rel), 'utf8'));
    if (!/\.map\(\(order\) => updatePaymentStatus\(|\.map\(\(order\) => updateOrderPaymentStatus\(/.test(text)) continue;
    bulkScreens.push(rel);
    if (/updateOrderPaymentStatus\(/.test(text)) roundTheSide.push(rel);
  }
};
walk('pages');
assert.ok(bulkScreens.length >= 4,
  `only ${bulkScreens.length} bulk mark-paid screen(s) found (${bulkScreens.join(', ')}) — the derivation broke`);
assert.deepEqual(roundTheSide, [],
  'these screens call the service directly instead of the hook, so they can pass a status of their own '
  + `and step around the rule above:\n  ${roundTheSide.join('\n  ')}`);

console.log(`paymentDoesNotUnship selfcheck OK (${bulkScreens.length} bulk screens, forward only)`);
