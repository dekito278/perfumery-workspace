// Runnable check for the DOKU transition guards. `node src/utils/dokuOrderGuards.selfcheck.mjs`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkDokuOrderTransition, isTerminalCancelStatus, orderBecomesPaid } from './dokuOrderGuards.js';

const open = { status: 'pending_payment', payment_status: 'pending', subtotal: 250000 };
const paid = { status: 'paid', payment_status: 'paid', subtotal: 250000 };
const cancelled = { status: 'cancelled', payment_status: 'expired', subtotal: 250000 };

// Normal payment goes through
assert.equal(checkDokuOrderTransition({ currentOrder: open, incomingStatus: 'paid', paidAmount: 250000 }), null);

// A late failure/expiry cannot un-pay a paid order
assert.deepEqual(checkDokuOrderTransition({ currentOrder: paid, incomingStatus: 'expired' }), { skip: 'already_paid' });
assert.deepEqual(checkDokuOrderTransition({ currentOrder: paid, incomingStatus: 'cancelled' }), { skip: 'already_paid' });

// A late payment cannot resurrect a closed order — this is what status.js was missing
assert.deepEqual(checkDokuOrderTransition({ currentOrder: cancelled, incomingStatus: 'paid', paidAmount: 250000 }), { skip: 'order_closed' });
assert.deepEqual(
  checkDokuOrderTransition({ currentOrder: { status: 'cancelled', payment_status: 'pending' }, incomingStatus: 'paid' }),
  { skip: 'order_closed' },
);

// Underpayment is refused
assert.ok(checkDokuOrderTransition({ currentOrder: open, incomingStatus: 'paid', paidAmount: 1000 })?.error,
  'paying 1.000 for a 250.000 order must be refused, not accepted');
// A verdict carrying NO amount is not a verified payment either. This line used to assert the opposite,
// on the stated grounds that "the status poll has none" — and audit round 9 (D-2) deliberately closed
// that hole without anybody updating this file, because this guard was never registered in the
// selfcheck script and therefore never ran. Both halves are now true: the rule refuses it, and the
// premise was wrong anyway — all 54 poll payloads in the live log carry order.amount, so the tightening
// costs the poll nothing. An order with no stored total still passes: there is nothing to compare to.
assert.ok(checkDokuOrderTransition({ currentOrder: open, incomingStatus: 'paid' })?.error,
  'a paid verdict with no amount, against an order that HAS a total, is not a verified payment');
assert.equal(checkDokuOrderTransition({ currentOrder: { status: 'pending_payment', payment_status: 'pending' }, incomingStatus: 'paid' }), null,
  'but an order with no stored total has nothing to check the amount against');
// Duplicate paid verdict on an already-paid order still proceeds (the caller's inventory_deducted flag
// is what makes the deduction idempotent)
assert.equal(checkDokuOrderTransition({ currentOrder: paid, incomingStatus: 'paid', paidAmount: 250000 }), null);

assert.equal(isTerminalCancelStatus('refunded'), true);
assert.equal(isTerminalCancelStatus('paid'), false);


// --- Who tells Dekito the money landed ----------------------------------------------------------------
// Both paths write the same row. Only the webhook ever sent the alert, and the browser's poll is often
// the one that gets there first — measured on 14 Oct 2026, four of the eight orders that reached paid in
// the payment log were flipped by the poll with no webhook row behind them at all. The question is the
// TRANSITION, not the verdict.
const open2 = { status: 'pending_payment', payment_status: 'pending' };
assert.equal(orderBecomesPaid({ currentOrder: open2, incomingStatus: 'paid' }), true,
  'an unpaid order turning paid is the one moment worth interrupting someone for');
assert.equal(orderBecomesPaid({ currentOrder: { payment_status: 'paid' }, incomingStatus: 'paid' }), false,
  'a repeat paid verdict is not news — 13 of them are in the live log');
assert.equal(orderBecomesPaid({ currentOrder: open2, incomingStatus: 'expired' }), false);
assert.equal(orderBecomesPaid({ currentOrder: { payment_status: 'unpaid' }, incomingStatus: 'pending' }), false);
assert.equal(orderBecomesPaid(), false, 'called with nothing: no alert, no crash');

// --- And both paths have to use it, the same way ------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const api = (...parts) => readFileSync(join(here, '..', '..', 'api', 'doku', ...parts), 'utf8');
for (const file of ['notification.js', 'status.js']) {
  const source = api(file);
  assert.match(source, /orderBecomesPaid\(\{ currentOrder, incomingStatus \}\)/,
    `api/doku/${file} must decide the alert from the shared transition rule, not from the verdict alone`);
  assert.match(source, /if \(becomesPaid\) \{\s*\n\s*await sendOrderAlert\(/,
    `api/doku/${file} must send the paid alert on the transition — ${file === 'status.js' ? 'this path had no alert at all, which is why four paid orders went unannounced' : 'it used to alert on every paid verdict'}`);
  assert.doesNotMatch(source, /if \(incomingStatus === 'paid'\) \{\s*\n\s*await sendOrderAlert/,
    `api/doku/${file} is back to alerting on the verdict, which re-alerts on every repeat notification`);
  // Computed BEFORE the write, or it can only ever answer "already paid".
  assert.ok(source.indexOf('orderBecomesPaid(') < source.indexOf("method: 'PATCH'"),
    `api/doku/${file} reads the transition after patching the row, by which time it is paid either way`);
  // A refused transition is not an applied one.
  assert.match(source, /skipped \? 'ignored' : 'applied'|\(syncSkipped \? 'ignored' : 'applied'\)/,
    `api/doku/${file} logs a refused transition as "applied", so the guard that stops a paid order being `
    + 'un-paid can fire in production and leave no trace');
  assert.match(source, /Skipped: \$\{/,
    `api/doku/${file} must record WHICH rule refused the verdict — already_paid and order_closed mean `
    + 'very different things');
}
assert.match(api('status.js'), /import \{ sendOrderAlert \} from '\.\.\/\.\.\/src\/utils\/orderNotifier\.js'/,
  'the status poll cannot alert at all without this import, and it is the path that flips most orders');

console.log('dokuOrderGuards selfcheck OK (transition rules, and both DOKU paths alerting on the same transition)');
