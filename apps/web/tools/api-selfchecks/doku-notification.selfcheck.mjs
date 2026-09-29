// Runnable check for the DOKU notification webhook. `node tools/api-selfchecks/doku-notification.selfcheck.mjs`.
// This endpoint is what turns a payment into a paid order and moves stock, so the
// invariants worth pinning are the ones about when it must NOT write: an unknown
// invoice, a replayed cancel on a paid order, a late paid on a dead order, and an
// underpayment. Signs real payloads with the same HMAC the handler verifies.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import handler from '../../api/doku/notification.js';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

process.env.DOKU_CLIENT_ID = 'test-client';
process.env.DOKU_SECRET_KEY = 'test-secret';
process.env.SUPABASE_URL = 'https://project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

let orderRow = null;
let calls = [];

globalThis.fetch = async (url, init = {}) => {
  const target = String(url);
  const method = init.method || 'GET';
  calls.push({ target, method, body: init.body });

  if (target.includes('/storefront_orders') && method === 'GET') {
    return { ok: true, json: async () => (orderRow ? [orderRow] : []) };
  }
  // PATCH orders, RPCs, and the payment log all just need to look successful.
  return { ok: true, status: 200, json: async () => [], text: async () => '' };
};

const patchesIssued = () => calls.filter((c) => c.method === 'PATCH' && c.target.includes('/storefront_orders'));
const deductsIssued = () => calls.filter((c) => c.target.includes('storefront_deduct_inventory_for_order'));

const post = async ({ payload, signature: override }) => {
  calls = [];
  const rawBody = JSON.stringify(payload);
  const requestId = 'req-1';
  const timestamp = '2026-08-17T06:00:00Z';
  const digest = crypto.createHash('sha256').update(rawBody, 'utf8').digest('base64');
  const component = [
    `Client-Id:${process.env.DOKU_CLIENT_ID}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    'Request-Target:/api/doku/notification',
    `Digest:${digest}`,
  ].join('\n');
  const signature = override ?? `HMACSHA256=${crypto
    .createHmac('sha256', process.env.DOKU_SECRET_KEY)
    .update(component, 'utf8')
    .digest('base64')}`;

  const res = {
    statusCode: null,
    body: null,
    setHeader() {},
    end(value) { this.body = JSON.parse(value); },
  };
  await handler({
    method: 'POST',
    headers: { 'request-id': requestId, 'request-timestamp': timestamp, signature },
    async *[Symbol.asyncIterator]() { yield Buffer.from(rawBody); },
  }, res);
  return res;
};

const notification = (status, amount = 500000) => ({
  order: { invoice_number: 'DKT-abc-123456', amount },
  transaction: { status, original_request_id: 'doku-txn-1' },
});

const paidOrder = (overrides = {}) => ({
  id: 'order-1',
  order_number: 'DKT-abc-123456',
  subtotal: 500000,
  status: 'pending_payment',
  payment_status: 'pending',
  inventory_deducted: false,
  ...overrides,
});

// A forged signature is rejected before anything is read from the database.
orderRow = paidOrder();
const forged = await post({ payload: notification('SUCCESS'), signature: 'HMACSHA256=nope' });
assert.equal(forged.statusCode, 401);
assert.equal(patchesIssued().length, 0, 'forged signature must not write');

// The happy path still works: signed SUCCESS on a pending order marks it paid and
// deducts stock once.
orderRow = paidOrder();
const ok = await post({ payload: notification('SUCCESS') });
assert.equal(ok.statusCode, 200, `expected 200, got ${ok.statusCode}: ${JSON.stringify(ok.body)}`);
assert.equal(patchesIssued().length, 1);
assert.match(patchesIssued()[0].body, /"payment_status":"paid"/);
assert.equal(deductsIssued().length, 1, 'paid order should deduct inventory once');

// Unknown invoice: previously this PATCHed zero rows and answered {acknowledged:true},
// so a callback that raced ahead of the order row silently lost a real payment.
orderRow = null;
const unknown = await post({ payload: notification('SUCCESS') });
assert.equal(unknown.statusCode, 404, `expected 404, got ${unknown.statusCode}`);
assert.equal(patchesIssued().length, 0, 'unknown invoice must not write');
assert.match(unknown.body.message, /No order found/);

// Underpayment never marks an order paid.
orderRow = paidOrder();
const underpaid = await post({ payload: notification('SUCCESS', 1000) });
assert.notEqual(underpaid.statusCode, 200);
assert.equal(patchesIssued().length, 0, 'underpayment must not write');

// A SUCCESS with no amount at all is not a verified payment (D-2: this used to skip the check).
orderRow = paidOrder();
const amountless = await post({ payload: notification('SUCCESS', null) });
assert.notEqual(amountless.statusCode, 200);
assert.equal(patchesIssued().length, 0, 'amount-less success must not write');

// Late or duplicate cancel on an order that is already paid must not undo it.
orderRow = paidOrder({ payment_status: 'paid', status: 'paid', inventory_deducted: true });
const lateExpiry = await post({ payload: notification('EXPIRED') });
assert.equal(lateExpiry.statusCode, 200);
assert.equal(patchesIssued().length, 0, 'paid order must not be cancelled by a late webhook');

// Late paid on an order already cancelled must not resurrect it or re-deduct stock
// that may have been resold.
orderRow = paidOrder({ status: 'cancelled', payment_status: 'expired' });
const latePaid = await post({ payload: notification('SUCCESS') });
assert.equal(latePaid.statusCode, 200);
assert.equal(patchesIssued().length, 0, 'cancelled order must not be revived');
assert.equal(deductsIssued().length, 0, 'cancelled order must not re-deduct stock');

// --- The two DOKU paths must read a verdict the same way -----------------------------------------------
// dokuOrderGuards.js exists because the webhook and the unauthenticated status poll write the same order
// row and their rules had already drifted once. Only the TERMINAL-state rules moved in. The status MAP
// stayed behind in both files and drifted again: the poll learned REDIRECT and read `order.status` —
// which is how DOKU says ORDER_GENERATED and ORDER_EXPIRED — while the webhook knew neither, and read
// only `transaction.status`. An expiry that arrived as an order status was therefore acted on when the
// browser happened to poll and ignored when DOKU pushed it, leaving the order pending and its stock
// reserved until the daily sweep. This file's own log line already read `transaction.status ||
// order.status`.
const restoresIssued = () => calls.filter((c) => c.target.includes('storefront_restore_inventory_for_order'));

orderRow = paidOrder({ inventory_deducted: true });
const orderExpired = await post({
  payload: { order: { invoice_number: 'DKT-abc-123456', amount: 500000, status: 'ORDER_EXPIRED' }, transaction: {} },
});
assert.equal(orderExpired.statusCode, 200);
assert.equal(patchesIssued().length, 1, 'an expiry pushed as an ORDER status must still close the order');
assert.match(patchesIssued()[0].body, /"payment_status":"expired"/);
assert.equal(restoresIssued().length, 1, 'and give the reserved stock back, exactly as the poll does');

// The must-pass half: a word neither path recognises still changes nothing. Ignoring what we cannot read
// is the safe answer, and widening the vocabulary must not turn into guessing at it.
orderRow = paidOrder();
const gibberish = await post({
  payload: { order: { invoice_number: 'DKT-abc-123456', amount: 500000, status: 'ORDER_SOMETHING_NEW' }, transaction: {} },
});
assert.equal(gibberish.statusCode, 200);
assert.equal(patchesIssued().length, 0, 'an unreadable verdict must not write');
assert.equal(gibberish.body.ignored, true, 'and must be logged as ignored rather than acted on');

// And the vocabulary itself lives in exactly one place, so this cannot drift a third time. Counted
// rather than listed: every file that turns a DOKU verdict into an order status must be the shared one.
const definitions = [];
for (const dir of ['api/doku', 'src/utils']) {
  for (const name of readdirSync(join(webRoot, dir))) {
    if (!name.endsWith('.js') || name.includes('.selfcheck.')) continue;
    const source = readFileSync(join(webRoot, dir, name), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/mapDokuStatus\s*=\s*\(/.test(source)) definitions.push(`${dir}/${name}`);
  }
}
assert.deepEqual(definitions, ['src/utils/dokuOrderGuards.js'],
  `the DOKU verdict vocabulary is defined ${definitions.length} times, and the copies have drifted twice `
  + `already:\n  ${definitions.join('\n  ')}`);
for (const endpoint of ['notification.js', 'status.js']) {
  assert.match(readFileSync(join(webRoot, 'api', 'doku', endpoint), 'utf8'),
    /import \{[^}]*mapDokuStatus[^}]*\} from '\.\.\/\.\.\/src\/utils\/dokuOrderGuards\.js';/,
    `api/doku/${endpoint} must read the verdict through the shared rule, not its own copy`);
}

console.log('doku notification selfcheck OK');
