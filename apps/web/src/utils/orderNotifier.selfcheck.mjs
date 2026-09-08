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

// The alert lays out facts, a blank line, then the action. Optional lines are null so that dropping them
// cannot drop the separator too — the same fault this had in common with the customer notifications and
// the checkout draft.
const full = buildOrderAlert({
  order: { order_number: 'DKT-ABC-123456', subtotal: 898000, customer_name: 'Ade', contact: '08120000000', payment_provider: 'manual_transfer_bca' },
  event: 'proof',
  siteUrl: 'https://www.solivagantscent.com',
}).text;
assert.match(full, /^BUKTI TRANSFER MASUK — DKT-ABC-123456$/m, 'a submitted proof needs its own heading');
assert.ok(full.includes('\n\n'), 'the alert has no blank line between the facts and the action');
assert.match(full, /manual_transfer_bca\n\nPembeli sudah upload bukti transfer/, 'the action is glued to the payment method');

// An alert with no payment provider and no site URL must not leave holes where they would have been.
const bareAlert = buildOrderAlert({ order: { order_number: 'X', subtotal: 1000 }, event: 'created' }).text;
assert.ok(!/\n\n\n/.test(bareAlert), `omitted lines left a gap:\n${JSON.stringify(bareAlert)}`);
assert.ok(!bareAlert.includes('Bayar   :'), 'an absent payment provider was printed anyway');
assert.ok(bareAlert.includes('\n\n'), 'the bare alert lost its separator');

// The three events must not share wording; the whole point is knowing which one arrived.
const headings = ['created', 'proof', 'paid'].map((event) => buildOrderAlert({ order: { order_number: 'X', subtotal: 1 }, event }).text.split('\n')[0]);
assert.equal(new Set(headings).size, 3, `events share a heading: ${headings.join(' | ')}`);

console.log('orderNotifier selfcheck OK');
