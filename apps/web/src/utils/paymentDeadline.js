/**
 * When this order stops waiting for its transfer — the deadline the CRON actually enforces.
 *
 * api/orders/expire-reservations.js cancels unpaid orders and gives the stock back. A manual-transfer
 * buyer was never told: the payment page had a deadline line, but it only ever read payment_expires_at,
 * which DOKU sets and manual transfer does not. So the page said "transfer sesuai total" with no hint
 * that the order is cancelled 24 hours later, on the screen where someone is about to send money.
 *
 * Every branch below mirrors a branch of the cron, because a deadline that is shown but not enforced
 * frightens people for nothing, and one that is enforced but not shown costs them a transfer.
 */
const ACTIVE_PAYMENT_STATUSES = ['unpaid', 'pending'];
const PROOF_STILL_OPEN = ['missing', 'rejected'];

export const paymentDeadlineAt = (session = {}, ttlHours = 0) => {
  if (!session || typeof session !== 'object') return '';
  if (!ACTIVE_PAYMENT_STATUSES.includes(String(session.paymentStatus || 'pending'))) return '';
  if (['cancelled', 'completed'].includes(session.status)) return '';

  // Proof submitted and waiting for review: the cron will never touch this order, so promising a
  // deadline would be a threat we do not carry out.
  const proof = String(session.paymentProofStatus || '');
  if (proof && !PROOF_STILL_OPEN.includes(proof)) return '';

  if (session.paymentExpiresAt) {
    const explicit = new Date(session.paymentExpiresAt);
    return Number.isFinite(explicit.getTime()) ? explicit.toISOString() : '';
  }

  // No stock reserved (bespoke, stockless, a failed deduction) and no explicit window: the cron leaves
  // these alone on purpose — a bespoke request still being discussed must not be cancelled by a clock.
  if (!session.inventoryDeducted) return '';

  const createdAt = new Date(session.createdAt || '');
  if (!Number.isFinite(createdAt.getTime()) || !(Number(ttlHours) > 0)) return '';
  return new Date(createdAt.getTime() + (Number(ttlHours) * 60 * 60 * 1000)).toISOString();
};

export default paymentDeadlineAt;
