// One order, two payment columns: doku_response (what DOKU answered) and payment_response (what this shop
// wrote: the dollar amount and international account of an English-cart order, the "waiting for a shipping
// quote" flag). Both are `not null default '{}'`.
//
// They are MERGED, not picked. Picking "the first that holds something" (#589) fixed the empty-object case,
// but an order that has BOTH — a domestic order quoted by hand and then paid through DOKU, or any order
// whose payment page tried DOKU once — lost every payment_response field to doku_response: the dollars,
// the account details, shippingQuotePending (audit, 13 Nov 2026). DOKU still wins a key both carry, so a
// DOKU order reads exactly as before. Import-free so the guard runs it.
const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

export const mergePaymentResponse = (order = {}) => ({
  ...asObject(order?.paymentResponse),
  ...asObject(order?.payment_response),
  ...asObject(order?.doku_response),
});

export default mergePaymentResponse;
