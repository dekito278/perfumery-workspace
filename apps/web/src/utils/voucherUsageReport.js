import {
  getOrderProductsSubtotal,
  getOrderSubtotalAfterVoucher,
  getOrderVoucherSnapshot,
} from '@/utils/orderTotals.js';

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
      revenueBeforeDiscount: order ? getOrderProductsSubtotal(order) : 0,
      revenueAfterDiscount: order ? getOrderSubtotalAfterVoucher(order) : 0,
      usedAt: record.usedAt,
    };
  });
};

const addRankingEntry = (map, key, label, entry) => {
  if (!key) return;
  const current = map.get(key) || {
    key,
    label,
    count: 0,
    discountTotal: 0,
    revenueBeforeDiscount: 0,
    revenueAfterDiscount: 0,
  };
  current.count += 1;
  current.discountTotal += Number(entry.discountAmount || 0);
  current.revenueBeforeDiscount += Number(entry.revenueBeforeDiscount || 0);
  current.revenueAfterDiscount += Number(entry.revenueAfterDiscount || 0);
  map.set(key, current);
};

const sortRanking = (entries) => entries.sort((a, b) => (
  b.count - a.count
  || b.discountTotal - a.discountTotal
  || b.revenueAfterDiscount - a.revenueAfterDiscount
));

export const buildVoucherAnalytics = (usageReport = []) => {
  const topVoucherMap = new Map();
  const topCustomerMap = new Map();

  const summary = (usageReport || []).reduce((current, entry) => {
    addRankingEntry(topVoucherMap, entry.voucherCode, entry.voucherCode, entry);
    addRankingEntry(
      topCustomerMap,
      entry.customerCode || entry.contact || entry.customerName,
      entry.customerName || entry.customerCode || entry.contact || '-',
      entry,
    );

    return {
      totalUsage: current.totalUsage + 1,
      totalDiscount: current.totalDiscount + Number(entry.discountAmount || 0),
      revenueBeforeDiscount: current.revenueBeforeDiscount + Number(entry.revenueBeforeDiscount || 0),
      revenueAfterDiscount: current.revenueAfterDiscount + Number(entry.revenueAfterDiscount || 0),
    };
  }, {
    totalUsage: 0,
    totalDiscount: 0,
    revenueBeforeDiscount: 0,
    revenueAfterDiscount: 0,
  });

  return {
    ...summary,
    topVouchers: sortRanking(Array.from(topVoucherMap.values())),
    topCustomers: sortRanking(Array.from(topCustomerMap.values())),
  };
};
