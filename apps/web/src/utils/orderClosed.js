// When an order is closed, and why that is one rule rather than two.
//
// A cancelled/expired/failed/refunded order is closed: its stock was restored on cancel and may already
// be resold, so no payment path may quietly revive it. Reviving one is a deliberate manual re-order.
//
// This lived twice — `isOrderClosedForPayment` in services/orderService.js, deciding whether a screen
// may offer a way to pay, and `isClosedOrder` in utils/invoiceShipment.js, deciding whether the invoice
// may promise a parcel. Byte for byte the same expression under two names, in two modules, read by
// different screens. They agreed, which is exactly how long that kind of pair agrees for.
//
// Import-free on purpose: a guard can run it without dragging supabase in, and orderService can re-export
// it without a cycle.
export const isOrderClosedForPayment = (order = {}) => (
  order?.status === 'cancelled' || ['expired', 'failed', 'refunded'].includes(order?.paymentStatus)
);

export default isOrderClosedForPayment;
