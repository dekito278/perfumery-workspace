// node src/utils/orderNotifier.selfcheck.mjs
import assert from 'node:assert/strict';
import { buildOrderAlert, sendOrderAlert } from './orderNotifier.js';

const order = {
  order_number: 'SLV-1001',
  subtotal: 1250000,
  customer_name: 'Rizki',
  contact: '628123',
  payment_provider: 'manual_transfer_bca',
};

// The whole point of the message is the next action, and it differs per case.
const manual = buildOrderAlert({ order, event: 'created', siteUrl: 'https://x.id/' });
assert.match(manual.text, /ORDER BARU — SLV-1001/);
assert.match(manual.text, /Rp 1\.250\.000/, 'must be Indonesian grouping, not 1,250,000');
assert.match(manual.text, /Review bukti/, 'manual transfer must point at the proof queue');
assert.match(manual.text, /https:\/\/x\.id\/studio\/orders/, 'trailing slash must not double up');

const gateway = buildOrderAlert({ order: { ...order, payment_provider: 'doku' }, event: 'created' });
assert.doesNotMatch(gateway.text, /Review bukti/, 'gateway orders have no proof to review');

const paid = buildOrderAlert({ order, event: 'paid' });
assert.match(paid.text, /PEMBAYARAN MASUK/);
assert.match(paid.text, /Sudah bayar/);

// Missing everything must still produce a sendable message rather than "undefined".
const bare = buildOrderAlert({ order: {}, event: 'created' });
assert.doesNotMatch(bare.text, /undefined|NaN/);
assert.match(bare.text, /Rp 0/);

// Unconfigured is silence, not a crash.
assert.equal((await sendOrderAlert({ order, env: {} })).reason, 'not_configured');

// A broken webhook must never take the order down with it.
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
assert.equal((await sendOrderAlert({ order, env: { ORDER_ALERT_WEBHOOK_URL: 'https://x' } })).sent, false);
globalThis.fetch = async () => ({ ok: false, status: 500 });
assert.equal((await sendOrderAlert({ order, env: { ORDER_ALERT_WEBHOOK_URL: 'https://x' } })).reason, 'http_500');

// Garbage in ORDER_ALERT_HEADERS must degrade to "no extra headers", not abort the send.
let seen = null;
globalThis.fetch = async (_u, init) => { seen = init.headers; return { ok: true, status: 200 }; };
await sendOrderAlert({ order, env: { ORDER_ALERT_WEBHOOK_URL: 'https://x', ORDER_ALERT_HEADERS: 'not json' } });
assert.equal(seen['Content-Type'], 'application/json');
await sendOrderAlert({ order, env: { ORDER_ALERT_WEBHOOK_URL: 'https://x', ORDER_ALERT_HEADERS: '{"Authorization":"Bearer t"}' } });
assert.equal(seen.Authorization, 'Bearer t');

// Aliases + recipient: what makes "paste any webhook URL" true.
let body = null;
globalThis.fetch = async (_u, init) => { body = JSON.parse(init.body); return { ok: true, status: 200 }; };
await sendOrderAlert({ order, env: { ORDER_ALERT_WEBHOOK_URL: 'https://x', ORDER_ALERT_EXTRA: '{"chat_id":99}' } });
assert.equal(body.message, body.text, 'Fonnte reads `message`');
assert.equal(body.content, body.text, 'Discord reads `content`');
assert.equal(body.chat_id, 99, 'Telegram needs its recipient merged in');
globalThis.fetch = realFetch;

console.log('orderNotifier selfcheck OK');
