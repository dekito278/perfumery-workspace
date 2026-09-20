/**
 * Does marking this order shipped need the waybill asked for, right now?
 *
 * The field has always existed, in "Pengiriman & fulfillment", with its own save button — a second
 * gesture, in a second place, for the same event. It was skipped eleven times in a row.
 *
 * Measured on production through storefront_public_tracking_lookup, the RPC a buyer's own browser calls:
 * 11 of 11 shipped orders had tracking_number null. So the tracking page said "belum tersedia" and the
 * WhatsApp message — whose courier, waybill and link lines are all conditional — came out as a single
 * sentence: "Order DKT-… sudah dikirim." Nothing to act on, at the one moment a buyer is anxious.
 *
 * Pure so both order screens can share one rule. There are two of them and they have drifted apart
 * before; the phone is the one Dekito actually works from.
 */
export const needsWaybillPrompt = (order, nextStatus) => (
  nextStatus === 'shipped' && !String(order?.trackingNumber || '').trim()
);

export default needsWaybillPrompt;
