// Runnable check that the QRIS endpoint will not mint a payable QR for a dead order.
// `node tools/api-selfchecks/qris-refuses-a-closed-order.selfcheck.mjs`
//
// #322 taught api/doku/checkout.js to refuse a closed order before minting a payment session: a
// cancelled or expired order has had its stock restored by the expiry sweep and possibly resold, so a
// payment link for it takes money for something that no longer exists.
//
// api/doku/qris.js mints the other kind of payable thing — a QR — and writes nothing to the order, which
// is exactly why the structural walk in closedOrderPayment.selfcheck.mjs never looked at it: that walk
// asks which endpoints WRITE payment state. It checked only `payment_status === 'paid'` and did not even
// SELECT `status`, under a comment promising it mirrored checkout.js:168 — the line number of the half
// that existed before #322 added the other.
//
// QRIS is not switched on today (QRIS_ENABLED is false in services/cartService.js), so this is money code
// waiting rather than money lost. The handler is plain node and fetch, and the guard fires before any
// DOKU credential is needed, so the real one runs here with the network stubbed.
import assert from 'node:assert/strict';
import handler from '../../api/doku/qris.js';

process.env.SUPABASE_URL = 'https://project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

let orderRow = null;
let dokuCalls = 0;

globalThis.fetch = async (url) => {
  const target = String(url);
  if (target.includes('/storefront_orders')) {
    return { ok: true, status: 200, json: async () => (orderRow ? [orderRow] : []), text: async () => '' };
  }
  // Anything else here is DOKU: reaching it at all means the order was accepted as payable.
  dokuCalls += 1;
  return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
};

const post = async (orderNumber = 'DKT-test') => {
  dokuCalls = 0;
  const res = {
    statusCode: null,
    body: null,
    setHeader() {},
    end(value) { this.body = JSON.parse(value); },
  };
  await handler({
    method: 'POST',
    headers: { host: 'shop.test' },
    async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ orderNumber })); },
  }, res);
  return res;
};

const order = (overrides = {}) => ({
  order_number: 'DKT-test',
  subtotal: 359000,
  payment_status: 'unpaid',
  status: 'pending_payment',
  ...overrides,
});

// --- 1. A cancelled order gets no QR ------------------------------------------------------------------
// The shape that slipped through: cancelled by the sweep, payment_status still reads 'unpaid', so the
// only check this endpoint had said nothing.
orderRow = order({ status: 'cancelled', payment_status: 'unpaid' });
const cancelled = await post();
assert.equal(cancelled.statusCode, 409,
  `a cancelled order was given a payable QR (${cancelled.statusCode}) — its stock is already back on the shelf`);
assert.equal(dokuCalls, 0, 'and DOKU must never be asked for one');

// --- 2. Expired, failed and refunded are the same answer ----------------------------------------------
for (const paymentStatus of ['expired', 'failed', 'refunded']) {
  orderRow = order({ payment_status: paymentStatus });
  const closed = await post();
  assert.equal(closed.statusCode, 409, `payment_status ${paymentStatus} must not be given a QR`);
  assert.equal(dokuCalls, 0, `and ${paymentStatus} must not reach DOKU`);
}

// --- 3. The half that already worked still works ------------------------------------------------------
orderRow = order({ payment_status: 'paid', status: 'paid' });
const paid = await post();
assert.equal(paid.statusCode, 409, 'a paid order still gets no second QR');

// --- 4. The must-pass half: a live order is still payable ----------------------------------------------
// The opposite direction matters as much. A guard that refuses everything is not a fix — and this one
// has to let the order through far enough to need DOKU credentials, which is where it stops here.
orderRow = order();
const live = await post();
assert.notEqual(live.statusCode, 409,
  `a live unpaid order was refused: ${JSON.stringify(live.body)}`);

console.log('qris-refuses-a-closed-order selfcheck OK (a cancelled, expired, failed or refunded order is never handed a payable QR; a live one still is)');
