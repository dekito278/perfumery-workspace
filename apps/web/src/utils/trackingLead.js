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

export default describeOrderKey;
