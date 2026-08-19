// Runnable check for the DOKU transition guards. `node src/utils/dokuOrderGuards.selfcheck.mjs`.
import assert from 'node:assert/strict';
import { checkDokuOrderTransition, isTerminalCancelStatus } from './dokuOrderGuards.js';

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
assert.ok(checkDokuOrderTransition({ currentOrder: open, incomingStatus: 'paid', paidAmount: 1000 }).error);
// An unknown amount (the status poll has none) is not treated as underpayment
assert.equal(checkDokuOrderTransition({ currentOrder: open, incomingStatus: 'paid' }), null);
// Duplicate paid verdict on an already-paid order still proceeds (the caller's inventory_deducted flag
// is what makes the deduction idempotent)
assert.equal(checkDokuOrderTransition({ currentOrder: paid, incomingStatus: 'paid', paidAmount: 250000 }), null);

assert.equal(isTerminalCancelStatus('refunded'), true);
assert.equal(isTerminalCancelStatus('paid'), false);

console.log('dokuOrderGuards selfcheck OK');
