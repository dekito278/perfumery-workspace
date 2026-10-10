import { orderHasShipped, orderIsDelivered } from './trackingLead.js';
import { isOrderClosedForPayment } from './orderClosed.js';

/**
 * What the invoice's delivery block says — the headline and the line under it, from ONE reading of the
 * order.
 *
 * Measured on Dekito's own invoices, 2026-09-21:
 *
 *   PENGIRIMAN · Belum siap · "Sudah dikirim, resi belum masuk ke sistem"   (a paid, shipped order)
 *   PENGIRIMAN · Belum siap · "Resi akan muncul setelah dikirim"            (an EXPIRED order)
 *
 * The first contradicts itself in two lines, because the headline trusted shipment_status alone while
 * the line under it used orderHasShipped(), which reads four fields — the broader, deliberate truth from
 * the waybill work earlier today. The second promises a parcel for an order that was cancelled and whose
 * stock has already gone back on the shelf.
 *
 * A closed order is the state neither of them had: nothing is coming, and saying so is kinder than a
 * sentence that waits forever.
 */
// The same question the payment screens ask, and now literally the same function: this was a
// word-for-word second copy under a second name.
export const isClosedOrder = isOrderClosedForPayment;

/**
 * 'closed' | 'delivered' | 'shipped' | 'waiting' — the one reading every line of the block is built from.
 *
 * 'delivered' was missing, and flattening it into 'shipped' put the same contradiction back into the
 * same card, one pair of lines over: the status badge in the invoice header reads straight from
 * shipment_status and said "Diterima", while the delivery block headlined the parcel "Dikirim". True of
 * 5 of the 35 orders on production (2026-10-10), and of the 6th — completed with shipment_status
 * not_ready — the header showed no badge at all while the block said the parcel was merely on its way.
 */
export const invoiceShipmentState = (order = {}) => {
  if (isClosedOrder(order)) return 'closed';
  if (orderIsDelivered(order)) return 'delivered';
  return orderHasShipped(order) ? 'shipped' : 'waiting';
};

/** The sentence under the headline, for an order with no waybill yet. */
export const shipmentNoteKey = (order = {}) => ({
  closed: 'inv.waybillNever',
  // A delivered parcel with no waybill has the same thing to say as a shipped one: a number was never
  // recorded. The headline above it already carries the difference.
  delivered: 'inv.waybillMissing',
  shipped: 'inv.waybillMissing',
  waiting: 'inv.waybillLater',
}[invoiceShipmentState(order)]);

export default invoiceShipmentState;
