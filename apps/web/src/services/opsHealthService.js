import { refreshDokuPaymentStatus } from '@/services/dokuCheckoutService.js';
import {
  getOrderReservationExpiresAt,
  getOrderSyncQueue,
  retryOrderSyncQueue,
  sweepExpiredOrderReservations,
} from '@/services/orderService.js';
import { searchShippingDestinations } from '@/services/shippingService.js';

const toTimestamp = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

export const getOpsHealthSnapshot = (orders = []) => {
  const now = Date.now();
  const syncQueue = getOrderSyncQueue();
  const pendingPaymentOrders = orders.filter((order) => (
    order.paymentProvider === 'doku'
    && ['unpaid', 'pending'].includes(order.paymentStatus)
    && !['completed', 'cancelled'].includes(order.status)
  ));
  const expiredPaymentOrders = pendingPaymentOrders.filter((order) => {
    const expiresAt = toTimestamp(order.paymentExpiresAt || getOrderReservationExpiresAt(order));
    return expiresAt && expiresAt <= now;
  });
  const shipmentNeedsResi = orders.filter((order) => (
    order.paymentStatus === 'paid'
    && ['packing', 'ready_to_ship', 'shipped'].includes(order.shipmentStatus)
    && !order.trackingNumber
  ));
  const localOrders = orders.filter((order) => order.persistence === 'local' || order.syncStatus === 'sync_required');

  return {
    syncQueue,
    pendingPaymentOrders,
    expiredPaymentOrders,
    shipmentNeedsResi,
    localOrders,
    hasCriticalIssues: Boolean(syncQueue.some((item) => item.severity === 'critical') || expiredPaymentOrders.length),
  };
};

export const checkDokuHealth = async (orders = []) => {
  const pending = getOpsHealthSnapshot(orders).pendingPaymentOrders;
  if (!pending.length) {
    return {
      ok: true,
      label: 'Tidak ada pending DOKU',
      checked: 0,
      synced: 0,
    };
  }

  const candidates = pending
    .slice()
    .sort((first, second) => toTimestamp(first.paymentExpiresAt) - toTimestamp(second.paymentExpiresAt))
    .slice(0, 5);
  const results = await Promise.allSettled(candidates.map((order) => refreshDokuPaymentStatus(order.orderNumber)));
  const failed = results.filter((result) => result.status === 'rejected');
  const synced = results.filter((result) => result.status === 'fulfilled' && result.value?.syncApplied);

  return {
    ok: failed.length === 0,
    label: failed.length
      ? `${failed.length}/${candidates.length} DOKU check gagal`
      : `${candidates.length} DOKU order dicek`,
    checked: candidates.length,
    synced: synced.length,
    failed: failed.length,
  };
};

export const checkShippingHealth = async () => {
  const destinations = await searchShippingDestinations('Jakarta');
  return {
    ok: destinations.length > 0,
    label: destinations.length ? 'RajaOngkir destination OK' : 'RajaOngkir tidak mengembalikan area',
    checked: destinations.length,
  };
};

export const runOpsHealthRetry = async (orders = []) => {
  const [syncResults, expiredResult, dokuResult] = await Promise.allSettled([
    retryOrderSyncQueue(),
    sweepExpiredOrderReservations(orders),
    checkDokuHealth(orders),
  ]);

  return {
    syncResults: syncResults.status === 'fulfilled' ? syncResults.value : [],
    expiredOrders: expiredResult.status === 'fulfilled' ? expiredResult.value.expiredOrders : [],
    doku: dokuResult.status === 'fulfilled' ? dokuResult.value : null,
    errors: [syncResults, expiredResult, dokuResult]
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason?.message || 'Health retry failed'),
  };
};
