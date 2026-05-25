import { getBespokeItem, isBespokeOrder } from '@/services/orderService.js';

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

  return {
    item,
    bottle: bottleParts.join(' / ') || '-',
    design: designParts.join(' / ') || '-',
    aroma,
    story,
  };
};
