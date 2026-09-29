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
// The three dead payment statuses, named once. They were written out six times — here, in
// dokuOrderGuards, in orderService's inventory-restore list, and three times inside orderWorkflow — and
// on 29 Sep 2026 two of those six had lost `refunded`: marking an order Refund in Studio sent its ORDER
// status back to 'pending_payment' and left it in the active queue, counted by no payment tile at all.
export const CLOSED_PAYMENT_STATUSES = ['expired', 'failed', 'refunded'];

// Both spellings on purpose. The client normalises to camelCase, but the three /api endpoints that write
// this row read it raw from PostgREST and never normalise — and one of them, api/doku/checkout.js, was
// asking the question with a row it had only ever seen in snake_case.
export const isOrderClosedForPayment = (order = {}) => (
  (order?.status ?? order?.order_status) === 'cancelled'
  || CLOSED_PAYMENT_STATUSES.includes(order?.paymentStatus ?? order?.payment_status)
);

export default isOrderClosedForPayment;
