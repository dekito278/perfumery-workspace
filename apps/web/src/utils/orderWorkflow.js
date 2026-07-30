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
