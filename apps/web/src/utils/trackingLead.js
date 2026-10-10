/**
 * The order is FINISHED.
 *
 * Studio writes status 'completed' two ways. The fulfillment screen writes it together with
 * shipment_status 'delivered' (orderService.js: `...(shipmentStatus === 'delivered' ? { status: 'completed' } : {})`),
 * and the order-status <select> writes it on its own — leaving the shipment fields wherever they were.
 *
 * The two readers below used to look only at the shipment fields, so the second way was invisible to
 * them. Measured on production 2026-10-10: 8 of 35 orders are completed, and 3 of those 8 carry no
 * shipment_status 'delivered'. The page the parcel's own QR code points at showed one of them at
 * "Dikemas", one at "Dikirim", and one all the way back at "Dibayar" — step 2 of 6, for an order this
 * shop considers done and refuses to edit (isArchivedOrder; orderService refuses writes to it).
 *
 * orderHasShipped already counted status 'completed' as gone. The other two did not: one question,
 * one file, three answers.
 */
export const orderIsDelivered = (order) => Boolean(
  order?.deliveredAt
  || order?.shipmentStatus === 'delivered'
  || order?.status === 'completed',
);

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

/**
 * How many of the public tracking page's six steps are behind this order.
 *
 * Lives here, beside the sentence that has to agree with it: the page prints the lead from
 * describeOrderKey above a timeline built from this count, so "Paket sudah sampai" over a ticked
 * "Dibayar" is two functions disagreeing about one order. Both now ask the same two questions first —
 * is it delivered, has it shipped — and the guard runs the pair over every status combination the live
 * table actually holds and requires them to answer together.
 *
 * Returns 0..TRACKING_STEP_COUNT. The page brings its own labels; the guard checks that it still has
 * exactly this many steps rather than trusting the number written here.
 */
export const TRACKING_STEP_COUNT = 6;

export const orderProgressStepCount = (order) => {
  if (!order) return 0;
  if (orderIsDelivered(order)) return TRACKING_STEP_COUNT;
  if (orderHasShipped(order)) return 5;
  if (order.shipmentStatus === 'packing') return 4;
  if (order.status === 'processing') return 3;
  if (order.paymentStatus === 'paid' || order.status === 'paid') return 2;
  return 1;
};

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
  if (orderIsDelivered(order)) return 'track.delivered';
  if (orderHasShipped(order)) {
    // A waybill that is whitespace is not a waybill. The field is typed by hand in Studio.
    return String(order.trackingNumber || '').trim() ? 'track.shipped' : 'track.shippedNoWaybill';
  }
  if (order.status === 'processing' || order.shipmentStatus === 'packing') return 'track.preparing';
  if (order.paymentStatus === 'paid' || order.status === 'paid') return 'track.queued';
  return 'track.recorded';
};

export default describeOrderKey;
