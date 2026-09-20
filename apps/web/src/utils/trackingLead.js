/**
 * Which sentence the public tracking page opens with, for one order.
 *
 * Pulled out of PublicTrackingPage so it can be tested as behaviour rather than grepped for: the bug it
 * exists to prevent is a SENTENCE that disagrees with the rows underneath it, and a regex over the page
 * can be satisfied by a branch that never runs.
 *
 * The bug, measured on production with the anon key — on storefront_public_tracking_lookup, the RPC a
 * buyer's own browser calls: 11 of 11 shipped orders had tracking_number null, while the page said
 * "Paket sudah dikirim. Resi tersedia di bawah." over a row reading "Belum tersedia". False on every
 * parcel this shop has ever sent.
 */
export const describeOrderKey = (order) => {
  if (!order) return 'track.lead';
  if (order.deliveredAt || order.shipmentStatus === 'delivered') return 'track.delivered';
  if (order.shippedAt || order.shipmentStatus === 'shipped') {
    // A waybill that is whitespace is not a waybill. The field is typed by hand in Studio.
    return String(order.trackingNumber || '').trim() ? 'track.shipped' : 'track.shippedNoWaybill';
  }
  if (order.status === 'processing' || order.shipmentStatus === 'packing') return 'track.preparing';
  if (order.paymentStatus === 'paid' || order.status === 'paid') return 'track.queued';
  return 'track.recorded';
};

/**
 * Has this parcel already left?
 *
 * Three surfaces tell a buyer about the waybill — the tracking page, the member portal's timeline and the
 * invoice — and two of them phrased the empty case in the FUTURE tense: "Resi akan muncul setelah paket
 * dikirim", printed under a step already marked Dikirim. A sentence about something that has already
 * happened, on all 11 shipped orders, because none of them carries a number.
 *
 * Read from four fields because the three screens each trusted a different one.
 */
export const orderHasShipped = (order) => Boolean(
  order?.deliveredAt
  || order?.shippedAt
  || ['shipped', 'delivered'].includes(order?.shipmentStatus)
  || ['shipped', 'completed'].includes(order?.status),
);

export default describeOrderKey;
