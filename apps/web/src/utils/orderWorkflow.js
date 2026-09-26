import {
  getBespokeItem,
  getOrderReservationExpiresAt,
  isBespokeOrder,
  PAYMENT_RESERVATION_TTL_HOURS,
} from '@/services/orderService.js';

// Single source for payment-status labels in order lists, order detail, and customer tracking.
// Consolidated to stop 7 copies drifting — e.g. desktop showed "Expired" while mobile showed
// "Kedaluwarsa" for the same order. (PaymentPage keeps its own payment-flow-specific wording.)
export const paymentStatusLabels = {
  unpaid: 'Belum dibayar',
  pending: 'Menunggu bayar',
  paid: 'Sudah dibayar',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
  refunded: 'Refund',
};

export const isArchivedOrder = (order = {}) => (
  ['completed', 'cancelled'].includes(order.status)
  || order.shipmentStatus === 'delivered'
);

export const hasShippingLabelPrinted = (order = {}) => order.shipmentStatus === 'packing';

export const isShippedOrder = (order = {}) => (
  order.shipmentStatus === 'shipped'
  || order.status === 'shipped'
);

/**
 * The order is paid and can be packed RIGHT NOW.
 *
 * Both dashboards used to count this themselves — paid, not shipped, not finished — and sent Dekito to
 * the fulfillment screen, which counts it differently: it also holds back a bespoke order whose
 * production is not Ready, and it treats status 'shipped' as gone. Measured on his own Studio, same
 * moment: the card said "3 order siap packing" and the screen it opened said 1.
 *
 * A number that promises what another screen will show has to be the same number.
 */
export const isReadyToPack = (order) => {
  // Guarded here rather than by clause order: the helpers below read order.status directly, and a
  // default parameter does not catch an explicit null. Reordering the conditions used to turn this into
  // a crash, which is not a property a shared rule should have.
  if (!order || typeof order !== 'object') return false;
  return order.paymentStatus === 'paid'
    && !isArchivedOrder(order)
    && !isShippedOrder(order)
    && (!isBespokeOrder(order) || order.bespokeProductionStatus === 'ready');
};

/**
 * The order is standing still because its BESPOKE production has not finished — the one case where a
 * shipping row should talk about formula/sample/approval instead of about the parcel.
 *
 * The fulfillment screen asked a different question: "is this row not ready to pack?" — and answered
 * every such row with a bespoke production stage, defaulting to "Review brief". So its Dikirim queue
 * showed ten shipped orders all labelled "Review brief", and a plain storefront order that was merely
 * unpaid claimed to be a bespoke brief under review. Read on his own Studio, 2026-09-24.
 *
 * Shipped and archived are excluded: once the parcel is gone, the production stage is history, and the
 * row should say where the parcel is.
 */
export const isBlockedByBespokeProduction = (order = {}) => (
  isBespokeOrder(order)
  && order.bespokeProductionStatus !== 'ready'
  && !isShippedOrder(order)
  && !isArchivedOrder(order)
);

/**
 * The order exists, the buyer is waiting on US for a shipping figure, and nothing can be paid yet.
 *
 * Europe and anything else outside the regions whose shipping is already in the price get their freight
 * quoted by hand. Dekito's decision, 2026-09-25: the order is created anyway rather than turning the
 * buyer away, and it waits.
 *
 * Two things follow from that, and both matter more than the label:
 *
 *   1. The bank account must NOT be shown. A buyer who transfers the goods total before the shipping is
 *      added has paid the wrong amount into a foreign account, and getting it back costs more than the
 *      parcel.
 *   2. The payment clock must NOT run. A reserved order cancels itself 24 hours after it is created; an
 *      order waiting on a quote would die of OUR slowness while its buyer sat watching a page that never
 *      asked them for anything. The clock starts when the quote is sent, because that is when the ball
 *      moves back.
 *
 * The flag rides on payment_response, the free-form column the public payment lookup already returns —
 * the same route the dollar amount and the international account details travel.
 */
export const isAwaitingShippingQuote = (order = {}) => {
  if (!order || typeof order !== 'object') return false;
  // Both spellings on purpose: the client normalises to paymentResponse, the expiry cron reads raw rows.
  const response = order.paymentResponse || order.payment_response || {};
  if (!response?.shippingQuotePending) return false;
  const paymentStatus = order.paymentStatus ?? order.payment_status;
  return ['unpaid', 'pending'].includes(paymentStatus) && !isArchivedOrder(order);
};

export const isFrontQueueOrder = (order = {}) => (
  !isArchivedOrder(order)
  && !hasShippingLabelPrinted(order)
  && !isShippedOrder(order)
);

// Order still waiting on the CUSTOMER to pay (no proof submitted yet). These abandoned/pending orders
// pile up, so we keep them out of the default "Aktif" queue — the "Perlu dibayar" tab owns them.
// Proof-submitted orders stay in Aktif because the admin needs to act on them.
export const isAwaitingCustomerPayment = (order = {}) => (
  ['unpaid', 'pending'].includes(order.paymentStatus)
  && order.paymentProofStatus !== 'submitted'
);

// Single definition of what each order-list tab shows. This used to be written out
// three times — the desktop list, the desktop tab counts, and the mobile list — and
// they had already drifted apart: desktop has a `payment` tab, mobile a wider
// `follow_up` one that also sweeps in shipped orders. Both keys are kept here so
// neither page changes behaviour; the point is that a list and its count can no
// longer disagree about the same tab.
export const matchesOrderFilter = (order = {}, filter = 'active') => {
  switch (filter) {
    case 'proof_review':
      return order.paymentProofStatus === 'submitted' && isFrontQueueOrder(order);
    case 'payment':
      return ['unpaid', 'pending'].includes(order.paymentStatus) && isFrontQueueOrder(order);
    case 'follow_up':
      return !isArchivedOrder(order)
        && (['unpaid', 'pending'].includes(order.paymentStatus) || isShippedOrder(order));
    case 'paid':
      return order.paymentStatus === 'paid' && isFrontQueueOrder(order);
    case 'packing':
      return hasShippingLabelPrinted(order);
    case 'shipped':
      return isShippedOrder(order) && !isArchivedOrder(order);
    case 'bespoke':
      return isBespokeOrder(order) && isFrontQueueOrder(order);
    case 'archive':
      return isArchivedOrder(order);
    // Payment-status lenses, deliberately NOT scoped to the queue: these back the
    // Menunggu/Dibayar/Masalah summary tiles, so tapping a tile has to show exactly
    // the orders it counted — including the completed and cancelled ones.
    case 'payment_pending':
      return ['unpaid', 'pending'].includes(order.paymentStatus);
    case 'payment_paid':
      return order.paymentStatus === 'paid';
    case 'payment_problem':
      return ['failed', 'expired'].includes(order.paymentStatus);
    default:
      // "Aktif": the queue the admin still has to act on, minus orders that are only
      // waiting on the customer to pay — those live in the payment/follow-up tab.
      return isFrontQueueOrder(order) && !isAwaitingCustomerPayment(order);
  }
};

export const countOrdersByFilter = (orders = [], filters = []) => Object.fromEntries(
  filters.map((filter) => [filter, orders.filter((order) => matchesOrderFilter(order, filter)).length]),
);

export const getBespokeOrderSummary = (order = {}) => {
  if (!isBespokeOrder(order)) return null;

  const item = getBespokeItem(order) || {};
  const bottleParts = [
    item.size,
    item.bottleType,
  ].filter(Boolean);
  const designParts = [
    item.capDesign ? `Cap: ${item.capDesign}` : '',
    item.labelDesign ? `Label: ${item.labelDesign}` : '',
    item.exoticMaterial ? `Material: ${item.exoticMaterial}` : '',
  ].filter(Boolean);
  const aroma = item.preferredNotes || item.notes || item.mood || '';
  const story = item.story || item.description || '';
  const perfumeName = String(item.perfumeName || '').trim();

  return {
    item,
    perfumeName: perfumeName || 'Belum diberi nama',
    bottle: bottleParts.join(' / ') || '-',
    design: designParts.join(' / ') || '-',
    aroma,
    story,
  };
};

// The order status that must accompany a payment-status change. Was written out three times (order detail,
// the orders hook, and nowhere at all on mobile order detail, which is why mobile could not change payment
// status) — keep it here so the three agree (audit round 7).
export const getNextOrderStatusForPayment = (paymentStatus) => {
  if (paymentStatus === 'paid') return 'paid';
  if (['failed', 'expired'].includes(paymentStatus)) return 'cancelled';
  return 'pending_payment';
};

/**
 * What is happening to this order's stock, in three states.
 *
 * The desktop worked it out twice, in an inline ternary on the order list and another on the order
 * detail, and the two had already drifted: the list guarded the expiry before printing "sampai X", the
 * detail did not — so an order with nothing to count from read "Stok reserved sampai N/A". The phone
 * worked it out nowhere and said nothing at all, on either screen, which on a phone-first shop means
 * the question "is this order still holding a bottle" had no answer where it is usually asked.
 *
 * Stock is the scarcest thing here. Returning the state rather than a sentence keeps each screen's own
 * date formatting — and keeps a missing expiry away from them, because MobileOrdersPage's formatDate has
 * no empty guard and Intl throws a RangeError on an invalid date.
 */
export const describeStockReservation = (order = {}) => {
  if (order?.inventoryDeducted) {
    return { state: 'reserved', expiresAt: getOrderReservationExpiresAt(order) || '' };
  }
  if (['expired', 'failed', 'refunded'].includes(order?.paymentStatus) || order?.status === 'cancelled') {
    return { state: 'released', expiresAt: '' };
  }
  return { state: 'pending', expiresAt: '' };
};

/** The one wording for the three states; the caller brings its own date format. */
export const stockReservationLabel = (reservation, formatDate = (value) => value) => {
  if (reservation?.state === 'released') return 'Stok dilepas';
  if (reservation?.state === 'reserved') {
    return reservation.expiresAt ? `Stok reserved sampai ${formatDate(reservation.expiresAt)}` : 'Stok reserved';
  }
  return `Batas reserved ${PAYMENT_RESERVATION_TTL_HOURS} jam`;
};

/** Tailwind tone per state, so four screens do not each invent a colour for "released". */
export const stockReservationTone = (reservation) => (
  reservation?.state === 'reserved'
    ? 'bg-emerald-50 text-emerald-700'
    : reservation?.state === 'released'
      ? 'bg-stone-100 text-stone-600'
      : 'bg-amber-50 text-amber-800'
);

/**
 * A bespoke brief as rows, for Studio.
 *
 * Written four times, once per Studio screen, and the four disagreed about two things.
 *
 * Language: the desktop order list labelled them in English — "Preferred aroma", "Occasion", "Bottle",
 * "Reference scent" — while its three siblings used Indonesian. Studio is Indonesian on purpose.
 *
 * Content, which is the half that matters: `avoidedNotes` — the aromas the customer asked NOT to have —
 * appeared on the desktop LIST and on no other screen. Not on either order detail page, which is where
 * a brief is actually read before the perfume is made. It is stored on every bespoke order and it is
 * the single most consequential line in the brief, because every other line describes what to aim for
 * and this one describes what ruins it.
 *
 * The buyer-facing portal keeps its own translated version: it speaks the reader's language, Studio
 * speaks Dekito's, and that difference is deliberate.
 */
export const bespokeBriefRows = (item = {}) => [
  ['Nama parfum', item?.perfumeName],
  ['Aroma', item?.preferredNotes || item?.scentDescription || item?.notes],
  ['Aroma dihindari', item?.avoidedNotes],
  ['Momen', item?.occasion],
  ['Ukuran', item?.size],
  ['Botol', item?.bottleType],
  ['Cap', item?.capDesign],
  ['Label', item?.labelDesign],
  ['Material', item?.exoticMaterial],
  ['Budget', item?.budget],
  ['Reference', item?.referenceProductName],
  ['Story', item?.story],
].filter(([, value]) => value);
