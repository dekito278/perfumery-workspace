// Shared terminal-state rules for DOKU order transitions.
//
// api/doku/notification.js (webhook) and api/doku/status.js (unauthenticated status poll) both write the
// same order row from the same DOKU verdicts, but the guards only ever existed in the webhook. The poll
// could therefore flip a cancelled/expired order back to paid and re-deduct stock that had already been
// restored and resold (audit round 7). Keep the rules here so the two paths cannot drift again.

const TERMINAL_CANCEL_STATUSES = ['failed', 'expired', 'refunded', 'cancelled'];
const CLOSED_PAYMENT_STATUSES = ['expired', 'failed', 'refunded'];

export const isTerminalCancelStatus = (status) => TERMINAL_CANCEL_STATUSES.includes(status);

// Returns null when the transition may proceed, { skip } when it must be ignored, or { error } when it
// must fail loudly. Callers decide how to surface each.
export const checkDokuOrderTransition = ({ currentOrder, incomingStatus, paidAmount = 0 }) => {
  // Once an order is paid, a late or duplicate failure/expiry verdict must not flip it back to cancelled
  // or release its stock.
  if (currentOrder?.payment_status === 'paid' && isTerminalCancelStatus(incomingStatus)) {
    return { skip: 'already_paid' };
  }

  if (incomingStatus !== 'paid') return null;

  // The mirror image: a late 'paid' verdict must not resurrect an order we already closed. Its stock was
  // restored and may have been resold, so reviving it needs a manual refund/re-order decision.
  if (currentOrder?.status === 'cancelled' || CLOSED_PAYMENT_STATUSES.includes(currentOrder?.payment_status)) {
    return { skip: 'order_closed' };
  }

  // Never mark an order paid for less than its stored total.
  const expected = Math.round(Number(currentOrder?.subtotal || 0));
  const paid = Math.round(Number(paidAmount || 0));
  if (expected > 0 && paid > 0 && paid < expected) {
    return { error: `DOKU amount mismatch: paid ${paid} < expected ${expected}` };
  }

  return null;
};
