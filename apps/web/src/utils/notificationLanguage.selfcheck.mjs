// `node src/utils/notificationLanguage.selfcheck.mjs`
//
// A buyer who read the whole shop in English then gets every word about their own order in Indonesian.
// The messages are built in one place and sent from fifteen call sites, so the language cannot be a
// parameter — it has to come off the order, which records the shop it was placed in.
//
// This runs the REAL service with its imports stubbed, the same way notificationMessage.selfcheck does.
// A reimplementation here would pass while the shipped templates went back to Indonesian.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'services', 'notificationTemplateService.js'), 'utf8');

const stubs = `
const window = { location: { origin: 'https://www.solivagantscent.com' } };
const getOrderProductItems = (order = {}) => order.items || [];
const getOrderVoucherSnapshot = (order = {}) => order.voucherSnapshot || null;
const normalizeWhatsAppPhoneNumber = (value = '') => String(value).replace(/\\D/g, '');
// The templates now ask which currency the buyer was asked for. Stubbed as "domestic, not waiting" so
// the language assertions below keep testing language; notificationAmount.selfcheck.mjs owns the money.
const internationalOrderSummary = () => null;
const isAwaitingShippingQuote = () => false;
`;
const runnable = stubs + source.split('\n').filter((line) => !line.startsWith('import ')).join('\n');
const { buildNotificationMessage, buildNotificationSubject } = await import(
  `data:text/javascript;base64,${Buffer.from(runnable, 'utf8').toString('base64')}`
);

const EVENTS = ['order_created', 'paid', 'payment_proof_rejected', 'processing', 'shipped', 'completed'];

const base = {
  orderNumber: 'DKT-ABC-123456',
  customerName: 'Ade',
  subtotal: 898000,
  paymentStatus: 'pending',
  customerCode: 'SOLI89523',
  courierName: 'JNE',
  trackingNumber: 'JP123',
  paymentProofNotes: 'blurry',
  items: [{ name: 'La Rose', size: '30 ml', quantity: 1 }],
};
const idOrder = { ...base, clientContext: { surface: 'mobile', shop: 'id' } };
const enOrder = { ...base, clientContext: { surface: 'mobile', shop: 'en' } };

// --- 1. The English shop gets English, and no event is missing from it ------------------------------
//
// Asserted on the OUTPUT, not on the template object: a message assembled from an English template that
// then pastes in an Indonesian helper line is exactly as wrong to the buyer, and a template map compared
// to itself would prove nothing.
//
// The word list is deliberately made of words an English order message could never contain — no "order",
// no "total", no "invoice", all of which are the same in both languages and would make this guard fire
// on a correct message.
const INDONESIAN = [
  'Halo', 'kamu', 'Kak', 'sudah', 'belum', 'kami', 'akan', 'yang', 'dengan', 'untuk', 'Terima kasih',
  'Kurir', 'Resi', 'Bukti', 'Mohon', 'Kode customer', 'Status pembayaran', 'Detail order', 'Tim Solivagant',
];
for (const event of EVENTS) {
  const message = buildNotificationMessage(enOrder, event);
  assert.ok(message.length > 40, `${event} produced almost nothing for the English shop — is it missing from the English templates?`);
  const leaked = INDONESIAN.filter((word) => new RegExp(`\\b${word}\\b`, 'i').test(message));
  assert.deepEqual(leaked, [], `${event} still speaks Indonesian to an English buyer (${leaked.join(', ')}):\n${message}`);
  assert.ok(!message.includes('undefined') && !message.includes('[object'), `${event} leaked a raw value:\n${message}`);
}

// --- 2. The Indonesian shop is untouched --------------------------------------------------------------
// The other half of the same rule: this change must not quietly turn Dekito's own buyers English.
for (const event of EVENTS) {
  const message = buildNotificationMessage(idOrder, event);
  assert.ok(/\b(kamu|kami|sudah|Terima kasih)\b/i.test(message), `${event} stopped speaking Indonesian to an Indonesian buyer:\n${message}`);
}

// --- 3. Anything that is not the English shop is Indonesian -------------------------------------------
// Orders placed before the field existed carry no clientContext at all, and they were all Indonesian.
for (const order of [base, { ...base, clientContext: {} }, { ...base, clientContext: { shop: 'fr' } }, {}]) {
  const message = buildNotificationMessage({ ...order, orderNumber: 'X' }, 'order_created');
  assert.ok(/\bkamu\b/i.test(message), `an order with no English shop recorded was sent English anyway:\n${message}`);
}

// --- 4. A link handed to an English buyer keeps the English shop's prefix ------------------------------
// Without it the invoice we just told them to open reloads the whole page in Indonesian.
const enCreated = buildNotificationMessage(enOrder, 'order_created');
const enRejected = buildNotificationMessage(enOrder, 'payment_proof_rejected');
const enPaid = buildNotificationMessage(enOrder, 'paid');
for (const [name, message] of [['invoice', enCreated], ['upload', enRejected], ['dashboard', enPaid]]) {
  const urls = message.match(/https:\/\/www\.solivagantscent\.com\S*/g) || [];
  assert.ok(urls.length, `the English ${name} message carries no link at all`);
  for (const url of urls) {
    assert.ok(new URL(url).pathname.startsWith('/en/'),
      `the English ${name} message links out of the English shop: ${url}`);
  }
}

// And the Indonesian ones must NOT have grown a prefix.
for (const message of [buildNotificationMessage(idOrder, 'order_created'), buildNotificationMessage(idOrder, 'paid')]) {
  for (const url of message.match(/https:\/\/www\.solivagantscent\.com\S*/g) || []) {
    assert.ok(!new URL(url).pathname.startsWith('/en'), `an Indonesian buyer was sent into the English shop: ${url}`);
  }
}

// --- 4b. An order with no customer code still gets a link ---------------------------------------------
//
// Export orders deliberately create no customer record (#217 — the one they used to create was the
// signed-in admin's own), so they have no customer code, and the invoice and dashboard pages are both
// keyed by one. Measured on the first real export order: the message went out with NO LINK AT ALL,
// leaving a buyer abroad holding an order number and nowhere to type it.
const codeless = { ...base, customerCode: '', clientContext: { shop: 'en' } };
for (const event of ['order_created', 'paid', 'processing', 'shipped', 'completed']) {
  const message = buildNotificationMessage(codeless, event);
  const urls = message.match(/https:\/\/www\.solivagantscent\.com\S*/g) || [];
  assert.ok(urls.length, `${event} gives a buyer with no customer code nowhere to look their order up`);
  for (const url of urls) {
    assert.match(new URL(url).pathname, /^\/en\/track\//,
      `${event} points a code-less English buyer at a page that asks for a code they do not have: ${url}`);
  }
}
// And the line is named for what it opens. Calling a tracking page "Invoice" costs the buyer a click to
// find out it is not one.
assert.doesNotMatch(buildNotificationMessage(codeless, 'order_created'), /Invoice:/,
  'a tracking link is still labelled as an invoice');
assert.match(buildNotificationMessage(codeless, 'order_created'), /Track your order: /);
assert.match(buildNotificationMessage({ ...codeless, clientContext: { shop: 'id' } }, 'order_created'), /Lacak pesanan: /);
// An order that DOES have a code keeps the invoice, and keeps the word.
assert.match(buildNotificationMessage(enOrder, 'order_created'), /Invoice: \S*\/mobile\/customer\/invoice\//);

// --- 5. The email subject follows the same order ------------------------------------------------------
assert.match(buildNotificationSubject(enOrder, 'shipped'), /Order shipped/, 'the English buyer gets an Indonesian subject line');
assert.match(buildNotificationSubject(idOrder, 'shipped'), /Order dikirim/, 'the Indonesian subject line changed');
assert.match(buildNotificationSubject(enOrder, 'nonsense'), /Order update/, 'an unknown event has no English fallback subject');

console.log('notificationLanguage selfcheck OK (the shop an order was placed in decides the language of every message about it, links included)');
