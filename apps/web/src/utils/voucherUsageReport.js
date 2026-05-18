import { getOrderVoucherSnapshot } from '@/utils/orderTotals.js';

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

export const buildVoucherUsageReport = (usageRecords = [], orders = []) => {
  const ordersById = new Map();
  const ordersByNumber = new Map();

  (orders || []).forEach((order) => {
    if (order?.id) ordersById.set(normalizeKey(order.id), order);
    if (order?.orderNumber) ordersByNumber.set(normalizeKey(order.orderNumber), order);
  });

  return (usageRecords || []).map((record) => {
    const order = ordersById.get(normalizeKey(record.orderId))
      || ordersByNumber.get(normalizeKey(record.orderNumber))
      || null;
    const voucherSnapshot = order ? getOrderVoucherSnapshot(order) : null;

    return {
      id: record.id,
      voucherCode: record.voucherCode,
      orderId: record.orderId,
      orderNumber: record.orderNumber || order?.orderNumber || '',
      customerName: order?.customerName || '',
      customerCode: order?.customerCode || '',
      contact: order?.contact || '',
      discountAmount: voucherSnapshot?.discountAmount || 0,
      usedAt: record.usedAt,
    };
  });
};
