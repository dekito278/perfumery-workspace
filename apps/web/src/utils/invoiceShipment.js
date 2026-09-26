import { orderHasShipped } from './trackingLead.js';
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

/** 'closed' | 'shipped' | 'waiting' — the one reading both lines of the block are built from. */
export const invoiceShipmentState = (order = {}) => {
  if (isClosedOrder(order)) return 'closed';
  return orderHasShipped(order) ? 'shipped' : 'waiting';
};

/** The sentence under the headline, for an order with no waybill yet. */
export const shipmentNoteKey = (order = {}) => ({
  closed: 'inv.waybillNever',
  shipped: 'inv.waybillMissing',
  waiting: 'inv.waybillLater',
}[invoiceShipmentState(order)]);

export default invoiceShipmentState;
