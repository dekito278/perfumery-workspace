// `node src/utils/paymentProofPath.selfcheck.mjs` — pins the client path to the RPC's rule.
import assert from 'node:assert/strict';
import { buildPaymentProofPath } from './paymentProofPath.js';

// Mirror of the check in storefront_submit_payment_proof.
const rpcAccepts = (path, orderNumber) => path.startsWith(`orders/${orderNumber.trim().toUpperCase()}/`);

for (const orderNumber of ['DKT-MTQ270FV-8WECG6', 'dkt-mtq270fv-8wecg6', '  DKT-MTQ270FV-8WECG6 ']) {
  const path = buildPaymentProofPath({ orderNumber, extension: 'pdf', now: 1, token: 'abc' });
  assert.equal(path, 'orders/DKT-MTQ270FV-8WECG6/1-abc.pdf');
  assert.ok(rpcAccepts(path, orderNumber), `RPC would reject ${path}`);
}
assert.equal(buildPaymentProofPath({ orderNumber: '', extension: 'jpg', now: 1, token: 'x' }), 'orders/ORDER/1-x.jpg');
console.log('paymentProofPath selfcheck OK');
