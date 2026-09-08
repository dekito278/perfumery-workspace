// `node src/utils/notificationMessage.selfcheck.mjs`
//
// Every message a customer receives about their order is assembled here. The templates use '' as a
// paragraph break and used to use '' for an optional line that did not apply — the same value for two
// opposite meanings. The filter dropped both, so every notification arrived as one unbroken block: the
// greeting glued to the order number, the closing sentence glued to the customer code.
//
// This runs the REAL service rather than a copy of it: the file imports through the '@/' alias, so its
// source is loaded with those imports stubbed. A reimplementation here would pass while the shipped code
// broke, which is the whole failure this guards against.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'services', 'notificationTemplateService.js'), 'utf8');

const stubs = `
const getOrderProductItems = (order = {}) => order.items || [];
const getOrderVoucherSnapshot = (order = {}) => order.voucherSnapshot || null;
const normalizeWhatsAppPhoneNumber = (value = '') => String(value).replace(/\\D/g, '');
`;
const runnable = stubs + source.split('\n').filter((line) => !line.startsWith('import ')).join('\n');
const { buildNotificationMessage } = await import(
  `data:text/javascript;base64,${Buffer.from(runnable, 'utf8').toString('base64')}`
);

const order = {
  orderNumber: 'DKT-ABC-123456',
  customerName: 'Ade',
  subtotal: 898000,
  paymentStatus: 'pending',
  customerCode: 'SOLI89523',
  items: [{ name: 'La Rose', size: '30 ml', quantity: 1 }],
};

// --- paragraph breaks survive -----------------------------------------------------------------------
const created = buildNotificationMessage(order, 'order_created');
assert.ok(created.includes('\n\n'), 'the message has no paragraph breaks at all — optional-line filtering ate them');
assert.match(created, /Halo Ade,\n\nOrder Solivagant/, 'the greeting is glued to the first line');
assert.ok(created.includes('DKT-ABC-123456'), 'the order number is missing');

// --- an optional line that does not apply leaves no hole ---------------------------------------------
// `shipped` carries three optional lines; with none of them set the message must still read cleanly
// rather than opening with a run of blank lines.
const shippedBare = buildNotificationMessage({ ...order, courierName: '', trackingNumber: '', trackingUrl: '' }, 'shipped');
assert.ok(!/\n\n\n/.test(shippedBare), `omitted optional lines left a gap:\n${JSON.stringify(shippedBare)}`);
assert.ok(!shippedBare.includes('Kurir:'), 'an empty courier was printed anyway');
assert.ok(shippedBare.startsWith('Halo Ade,\n\n'), 'the greeting lost its break');

// --- an optional line that does apply is printed ------------------------------------------------------
const shippedFull = buildNotificationMessage({ ...order, courierName: 'JNE', trackingNumber: 'JP123' }, 'shipped');
assert.match(shippedFull, /Kurir: JNE\nResi: JP123/, 'courier and tracking should sit together on their own lines');

// --- every event still produces something -------------------------------------------------------------
for (const event of ['order_created', 'paid', 'payment_proof_rejected', 'processing', 'shipped', 'completed']) {
  const message = buildNotificationMessage(order, event);
  assert.ok(message.length > 40, `${event} produced almost nothing`);
  assert.ok(!message.includes('undefined') && !message.includes('[object'), `${event} leaked a raw value:\n${message}`);
}

console.log('notificationMessage selfcheck OK');
