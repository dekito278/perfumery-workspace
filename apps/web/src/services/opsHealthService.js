import { refreshDokuPaymentStatus } from '@/services/dokuCheckoutService.js';
import {
  getOrderSyncQueue,
  isOrderReservationExpired,
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
  const nowDate = new Date(now);
  const syncQueue = getOrderSyncQueue();
  const pendingPaymentOrders = orders.filter((order) => (
    order.paymentProvider === 'doku'
    && ['unpaid', 'pending'].includes(order.paymentStatus)
    && !['completed', 'cancelled'].includes(order.status)
  ));
  // ONE spelling of "this reservation has run out", and it is orderService's. This had its own, which
  // compared the same two timestamps and then stopped — missing every exception the real rule spells out
  // with its reasons: inventory that was never deducted (nothing is being held, so there is nothing to
  // reclaim), a manual-transfer buyer whose proof is in and "must NEVER auto-cancel", and an international
  // buyer still waiting on US for a shipping figure, who "loses their order to our slowness" otherwise.
  //
  // Measured 2026-10-02: zero rows reach this today, because all five orders awaiting payment are
  // manual_transfer_bca and the filter above takes only DOKU. The copy was alive on today's data alone —
  // the first DOKU order to sit past its window with a submitted proof would have been called expired.
  const dokuWindowLapsedOrders = pendingPaymentOrders.filter((order) => isOrderReservationExpired(order, nowDate));
  // A paid parcel with no waybill was counted here as something to notice. It is not: not one of the
  // 35 orders on production carries a tracking_number, 13 of them shipped, and Dekito confirmed on
  // 2026-10-10 that this is how he ships — so the count could only ever be "all of them", on both
  // dashboards, forever. An alarm that never stops is not an alarm.
  const localOrders = orders.filter((order) => order.persistence === 'local' || order.syncStatus === 'sync_required');

  return {
    syncQueue,
    pendingPaymentOrders,
    dokuWindowLapsedOrders,
    localOrders,
    hasCriticalIssues: Boolean(syncQueue.some((item) => item.severity === 'critical') || dokuWindowLapsedOrders.length),
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
