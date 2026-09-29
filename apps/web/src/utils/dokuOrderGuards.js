// Shared terminal-state rules for DOKU order transitions.
//
// api/doku/notification.js (webhook) and api/doku/status.js (unauthenticated status poll) both write the
// same order row from the same DOKU verdicts, but the guards only ever existed in the webhook. The poll
// could therefore flip a cancelled/expired order back to paid and re-deduct stock that had already been
// restored and resold (audit round 7). Keep the rules here so the two paths cannot drift again.

import { CLOSED_PAYMENT_STATUSES } from './orderClosed.js';

// A cancel VERDICT can also name the order status itself, which is why this one carries 'cancelled'.
const TERMINAL_CANCEL_STATUSES = [...CLOSED_PAYMENT_STATUSES, 'cancelled'];

export const isTerminalCancelStatus = (status) => TERMINAL_CANCEL_STATUSES.includes(status);

/**
 * What a DOKU verdict MEANS, for both paths.
 *
 * This lived twice, and the two copies had already drifted. The webhook knew four transaction words per
 * outcome; the poll knew those plus REDIRECT, and also read `order.status` — which is how DOKU says
 * ORDER_GENERATED and ORDER_EXPIRED. So an expiry that arrived as an order status was acted on when the
 * browser happened to poll and ignored when DOKU pushed it, leaving the order pending and its stock
 * reserved until the daily sweep. The webhook's own log line already read `transaction.status ||
 * order.status`: the same file knew the field existed and then decided without it.
 *
 * The poll's vocabulary is the one kept, because it is the wider of the two and nothing in it is
 * invented here. Returns null for anything unrecognised — both callers log that and change nothing,
 * which is the only safe answer to a word we cannot read.
 */
export const mapDokuStatus = ({ transactionStatus, orderStatus } = {}) => {
  const transaction = String(transactionStatus || '').toUpperCase();
  const order = String(orderStatus || '').toUpperCase();

  if (['SUCCESS', 'PAID', 'SETTLEMENT', 'CAPTURED'].includes(transaction)) {
    return { orderStatus: 'paid', paymentStatus: 'paid' };
  }
  if (['PENDING', 'PROCESSING', 'REDIRECT'].includes(transaction) || order === 'ORDER_GENERATED') {
    return { orderStatus: 'pending_payment', paymentStatus: 'pending' };
  }
  if (['EXPIRED', 'TIMEOUT'].includes(transaction) || order === 'ORDER_EXPIRED') {
    return { orderStatus: 'cancelled', paymentStatus: 'expired' };
  }
  if (['FAILED', 'DENIED', 'CANCELLED', 'CANCELED'].includes(transaction)) {
    return { orderStatus: 'cancelled', paymentStatus: 'failed' };
  }
  return null;
};

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

  // Never mark an order paid for less than its stored total — and a notification that carries no amount
  // at all is not a verified payment either (it used to skip the check entirely, audit round 9, D-2).
  const expected = Math.round(Number(currentOrder?.subtotal || 0));
  const paid = Math.round(Number(paidAmount || 0));
  if (expected > 0 && paid < expected) {
    return { error: `DOKU amount mismatch: paid ${paid} < expected ${expected}` };
  }

  return null;
};
