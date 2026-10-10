/**
 * An audit row, read the same way on every screen that shows one.
 *
 * Three screens read the order audit log and three read it differently — measured against the live log
 * on 2026-10-11 (568 rows, 176 of them for the 35 orders that still exist):
 *
 *   Studio order detail   the full before/after list, and when nothing changed, a line naming the
 *                         values the row holds
 *   Studio dashboard      its own copy of the same three helpers, and for the same case a developer's
 *                         sentence instead: "Tidak ada diff field terdeteksi." Half the log is that
 *                         case — 295 of 568 rows — and the feed has an action filter right above it:
 *                         pick "payment_status_updated" and 3 of the 8 cards say it, "order_cancelled"
 *                         and 4 of 8 do
 *   the phone             fetches the whole log, twice, and renders none of it. Its history tab shows
 *                         status_timeline instead: 45 entries across the 35 orders against the audit
 *                         log's 176, and 14 of those orders have an EMPTY status_timeline, so the phone
 *                         synthesises a history whose every row carries the same updated_at
 *
 * And the two copies of "which keys matter" had already drifted. The dashboard's held
 * paymentProofStatus; the order detail's did not — so the 24 rows that record a payment proof being
 * approved or rejected were highlighted on the dashboard and plain on the screen where a disputed
 * payment is actually read. The union is kept: a proof change matters most exactly there.
 */

/** The keys whose change is worth highlighting. The union of the two lists that had drifted. */
export const AUDIT_KEYS_THAT_MATTER = [
  'paymentStatus', 'payment_status',
  'status',
  'paymentProofStatus', 'payment_proof_status',
  'shipmentStatus', 'shipment_status',
  'trackingNumber', 'tracking_number',
];

export const formatAuditValue = (value) => {
  if (value === '' || value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const formatAuditLabel = (key) => String(key)
  .replace(/([A-Z])/g, ' $1')
  .replace(/_/g, ' ')
  .replace(/^./, (char) => char.toUpperCase());

export const auditChanges = (previousValues = {}, nextValues = {}) => {
  const keys = Array.from(new Set([...Object.keys(previousValues || {}), ...Object.keys(nextValues || {})]));
  return keys
    .filter((key) => formatAuditValue(previousValues?.[key]) !== formatAuditValue(nextValues?.[key]))
    .map((key) => ({
      key,
      label: formatAuditLabel(key),
      before: formatAuditValue(previousValues?.[key]),
      after: formatAuditValue(nextValues?.[key]),
    }));
};

export const auditRowIsImportant = (changes = []) => (
  changes.some((change) => AUDIT_KEYS_THAT_MATTER.includes(change.key))
);

/**
 * What to say when a row changed nothing.
 *
 * Half the log is these: a write that recorded the value it already held. Most come from one burst on
 * 2026-08-02 — 61 rows for a single order in 47 seconds — but 3 were written in September, so they are
 * not only history. The row still happened and belongs in the feed; it just has to say what it HOLDS,
 * which is the order's state at that moment, rather than report that a diff algorithm found nothing.
 */
export const summariseAuditValues = (values = {}) => (
  Object.entries(values || {})
    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(' / ') || '-'
);

/**
 * May this row be clicked through to its order?
 *
 * 63 rows record an order being DELETED, one per order, and the dashboard made every one of them a
 * button to /studio/orders/<id>. getOrderAuditLogs looks the order up first and falls back to querying
 * order_number = <uuid>, which matches nothing — so the click landed on a page with no order and no
 * history, 63 times over.
 */
export const auditRowOpensAnOrder = (log = {}) => log?.action !== 'order_deleted';

export default auditChanges;
