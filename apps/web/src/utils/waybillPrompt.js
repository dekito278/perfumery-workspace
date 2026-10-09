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

/**
 * The same question, for a selection rather than an order: which of these would ship untrackable?
 *
 * The prompt above only ever reached the two order DETAIL screens. Fulfillment can move a whole
 * selection to "Dikirim" from one dropdown, carrying each order's existing tracking number along
 * unchanged — so one gesture could mark any number of orders shipped with nothing for the buyer to
 * follow, and nobody was asked anything. That is the likeliest way eleven of them got there.
 *
 * A single order may still ship without a waybill: Dekito is asked, and "belum ada" is a real answer
 * when the courier has not handed the number over yet. What cannot happen is answering it for twenty
 * orders at once by not being asked.
 *
 * `waybillFor` reads the number the screen is about to SAVE, which on the fulfillment page is the row's
 * unsaved draft rather than the stored value — otherwise a number just typed would count as missing.
 */
export const ordersMissingWaybill = (orders = [], nextStatus, waybillFor = (order) => order?.trackingNumber) => (
  nextStatus !== 'shipped'
    ? []
    : (Array.isArray(orders) ? orders : []).filter((order) => !String(waybillFor(order) || '').trim())
);

export default needsWaybillPrompt;
