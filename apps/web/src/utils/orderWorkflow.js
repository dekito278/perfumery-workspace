import { getBespokeItem, isBespokeOrder } from '@/services/orderService.js';

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
