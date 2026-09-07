// storefront_submit_payment_proof (migration 20260819122000) accepts only
//   orders/<ORDER NUMBER, upper-cased>/<anything>
// and compares with LIKE, which is case-sensitive. The old builder lower-cased the order number, so every
// manual-transfer buyer since that migration uploaded their proof successfully and then got
// "Payment proof path does not belong to order" from the RPC — the file sat orphaned in the bucket and the
// order never recorded a proof. Keep the order number's case exactly as the RPC does.
export const buildPaymentProofPath = ({
  orderNumber,
  extension,
  now = Date.now(),
  token = Math.random().toString(36).slice(2, 10),
}) => `orders/${String(orderNumber || '').trim().toUpperCase() || 'ORDER'}/${now}-${token}.${extension}`;
