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
 * Which step of a progress strip an order is standing on — for every screen that draws one.
 *
 * Four screens drew one and four worked it out separately, over three different step lists:
 *
 *   /track                 pending_payment paid processing packing shipped delivered   (6)
 *   /customer              created pending_payment paid processing shipped completed   (6)
 *   Studio order detail    pending_payment paid processing shipped completed           (5)   × 2 screens
 *
 * The lists genuinely differ. The QUESTION does not, and the four answers disagreed about real orders
 * on production, read 2026-10-10:
 *
 *   3 orders   paid + shipment_status packing
 *              /track ticked "Dikemas"; the portal greyed out "Diproses" and captioned that same
 *              greyed step "Dikemas"; Studio's strip said "Sudah dibayar"
 *   6 orders   cancelled
 *              Studio's desktop strip ticked "Menunggu bayar" as the current step, because its
 *              `Math.max(0, statusSteps.indexOf(status))` turns the -1 for an unlisted status into 0.
 *              Its own phone twin returned -1 and ticked nothing.
 *
 * So: one ladder, read once, and a table per screen mapping the phase onto that screen's own list.
 * Agreement is structural rather than lucky, and a screen that wants a different answer has to say so
 * in its table.
 */
export const ORDER_PHASES = ['cancelled', 'recorded', 'paid', 'preparing', 'packed', 'shipped', 'delivered'];

export const orderPhase = (order) => {
  if (!order || order.status === 'cancelled') return 'cancelled';
  if (orderIsDelivered(order)) return 'delivered';
  if (orderHasShipped(order)) return 'shipped';
  // Before 'preparing', the order the old tracking ladder used: an order that is both processing and
  // being packed is further along than one that is only processing.
  if (order.shipmentStatus === 'packing') return 'packed';
  if (order.status === 'processing') return 'preparing';
  if (order.paymentStatus === 'paid' || order.status === 'paid') return 'paid';
  return 'recorded';
};

const stepIndexBy = (table) => {
  // Every phase needs a number. A phase added to the ladder without one returned undefined, which is
  // neither a step nor an error: React renders nothing and every comparison against it is false.
  const missing = ORDER_PHASES.filter((phase) => !Object.hasOwn(table, phase));
  if (missing.length) throw new Error(`step table is missing ${missing.join(', ')}`);
  return (order) => table[orderPhase(order)];
};

/**
 * The public tracking page: how many of its six steps are behind the order.
 *
 * Lives here beside the sentence that has to agree with it — the page prints the lead from
 * describeOrderKey above a timeline built from this count, so "Paket sudah sampai" over a ticked
 * "Dibayar" is two functions disagreeing about one order.
 *
 * The page brings its own labels; the guard checks that it still has exactly this many steps rather
 * than trusting the number written here.
 */
export const TRACKING_STEP_COUNT = 6;

export const orderProgressStepCount = stepIndexBy({
  cancelled: 0, recorded: 1, paid: 2, preparing: 3, packed: 4, shipped: 5, delivered: TRACKING_STEP_COUNT,
});

/** The member portal's six steps, and which one the order is on. 'created' is behind every live order. */
export const PORTAL_STEP_KEYS = ['created', 'pending_payment', 'paid', 'processing', 'shipped', 'completed'];

export const portalActiveStepIndex = stepIndexBy({
  cancelled: -1, recorded: 1, paid: 2, preparing: 3, packed: 3, shipped: 4, delivered: 5,
});

/**
 * Studio's order-status strip, on both the desktop screen and its phone twin.
 *
 * The list was written out as a bare literal in each of those two files. One home, so the strip and
 * the synthetic timeline both pages slice out of it cannot be sliced from two different lists.
 */
export const STUDIO_STEP_KEYS = ['pending_payment', 'paid', 'processing', 'shipped', 'completed'];

export const studioActiveStepIndex = stepIndexBy({
  cancelled: -1, recorded: 0, paid: 1, preparing: 2, packed: 2, shipped: 3, delivered: 4,
});

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
  // A cancelled order used to fall all the way through to 'track.recorded' — "Pesanan tercatat. Kami
  // menunggu konfirmasi pembayaran." — printed directly above the red box saying the order was
  // cancelled. True of all 6 cancelled orders on production: the page waited forever for a payment it
  // will never accept. The red box keeps the actionable half; this is only the lead.
  if (orderPhase(order) === 'cancelled') return 'track.cancelledLead';
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
