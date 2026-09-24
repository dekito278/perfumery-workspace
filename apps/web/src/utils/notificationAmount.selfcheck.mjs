// `node src/utils/notificationAmount.selfcheck.mjs`
//
// The messages are the only part of this shop the buyer keeps. They sit in a phone, are read twice, and
// are what someone compares against their bank app at the moment of transferring.
//
// Every one of them quoted rupiah. Including the English ones — "Total: Rp 1.260.000" to a buyer who had
// just been told, on three screens, to send US$80 to a dollar account. The screens had been taught which
// currency this order is in and the messages had not: the same half-taught shape as everything else in
// this audit, except that this half is the copy that leaves the building.
//
// And there was no message at all for the one moment the European route turns on. The buyer is told at
// checkout that the freight is worked out by hand and sent to them before anything is charged; Studio
// could write that figure onto the order and had no way to say so. The only way to find out was to keep
// reloading a page that had been saying "wait".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// The templates run, rather than being read. A message is prose with data in it, and the failure mode is
// a sentence that is grammatical, plausible, and quoting the wrong number.
const STUBS = `
const getOrderProductItems = (order) => (Array.isArray(order?.items) ? order.items : []);
const getOrderVoucherSnapshot = () => null;
const normalizeWhatsAppPhoneNumber = (value) => String(value || '');
const internationalOrderSummary = (order) => {
  const r = order?.paymentResponse || {};
  if (r.currency !== 'USD') return null;
  const amount = Number(r.amountUsd) || 0;
  return { country: String(r.destinationCountry || '').toUpperCase(), amountUsd: amount,
    amountLabel: amount ? 'US$' + amount : '', bankName: '', awaitingQuote: Boolean(r.shippingQuotePending) };
};
const isAwaitingShippingQuote = (order) => Boolean((order?.paymentResponse || {}).shippingQuotePending);
// The link builders return '' when there is no window, so without this the messages come out linkless
// and a check for the link would pass on an artefact of running in node rather than on the real text.
const window = { location: { origin: 'https://solivagantscent.com' } };
`;
const source = STUBS + read('services', 'notificationTemplateService.js')
  .replace(/^import\b[^\n]*from '[^']+';\n/gm, '');
const { buildNotificationMessage, getNotificationEventLabels } = await import(
  `data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`
);

const berlin = {
  orderNumber: 'DKT-TEST', customerName: 'Anna', subtotal: 1260000, clientContext: { shop: 'en' },
  paymentResponse: { currency: 'USD', amountUsd: 80, destinationCountry: 'DE', usdRate: 16500 },
};
const jakarta = { orderNumber: 'DKT-LOCAL', customerName: 'Budi', subtotal: 359000, clientContext: { shop: 'id' } };

// --- 1. Whatever a message says the total is, it says it in the buyer's currency ------------------------
// Every event, not a chosen few: the rule is about the number, and any template that prints one is
// making the same promise. A message that names a total must name the dollars when there are dollars.
const events = Object.keys(getNotificationEventLabels());
assert.ok(events.length >= 6, `expected the event catalogue to still be readable, found ${events.length}`);
let quotedTotals = 0;
for (const event of events) {
  const message = buildNotificationMessage(berlin, event);
  if (!message || !/\bRp\s?[\d.]/.test(message)) continue;
  quotedTotals += 1;
  assert.match(message, /US\$\d/,
    `the "${event}" message quotes rupiah to a buyer who was asked for dollars:\n${message}`);
}
assert.ok(quotedTotals >= 2,
  `expected several messages to name a total, found ${quotedTotals} — if they stopped naming one, this `
  + 'rule has nothing left to hold and should be rewritten rather than left passing');

// A domestic order must not sprout dollars from the same code path.
for (const event of events) {
  const message = buildNotificationMessage(jakarta, event) || '';
  assert.doesNotMatch(message, /US\$/,
    `the "${event}" message offers dollars to an Indonesian buyer:\n${message}`);
}

// --- 2. An order still waiting on freight is never given a total ---------------------------------------
// The payment page withholds one and the invoice withholds one. A message naming one would be the only
// document of the three that contradicts the other two — and the most believable, because it arrives.
const waiting = { ...berlin, paymentResponse: { ...berlin.paymentResponse, shippingQuotePending: true } };
for (const event of events) {
  const message = buildNotificationMessage(waiting, event) || '';
  const totalLine = message.split('\n').find((line) => /^(Total|Amount to transfer|Order total)/i.test(line));
  if (!totalLine) continue;
  assert.doesNotMatch(totalLine, /Rp\s?[\d.]|US\$\d/,
    `the "${event}" message names a total for an order whose shipping has not been worked out: ${totalLine}`);
}

// --- 3. The moment the European route turns on has a message ------------------------------------------
assert.ok(getNotificationEventLabels().shipping_quoted,
  'there is no event for "the freight figure has been sent" — the buyer was promised that figure at '
  + 'checkout and has no way to learn it arrived');
for (const order of [berlin, jakarta]) {
  const message = buildNotificationMessage(order, 'shipping_quoted');
  assert.ok(message, `shipping_quoted has no template in the ${order.clientContext.shop} shop`);
  assert.match(message, /\/(bayar|payment|pay)|http/i,
    'the message must carry the link to the page holding the account details, or the buyer has a figure '
    + 'and nowhere to send it');
}
assert.match(buildNotificationMessage(berlin, 'shipping_quoted'), /repl(y|ied)|cancel/i,
  'the English message must offer a way out: the buyer agreed to a price without knowing the freight, and '
  + 'was told nothing is charged until they agree');

// --- 4. Both screens that can send the quote also send the message -------------------------------------
for (const page of [['pages', 'OrderDetailPage.jsx'], ['pages', 'mobile', 'MobileOrderDetailPage.jsx']]) {
  const page_source = read(...page);
  const quote = page_source.indexOf('sendInternationalShippingQuote(');
  assert.ok(quote > 0, `${page.join('/')} can no longer send the quote`);
  assert.match(page_source.slice(quote, quote + 1200), /shipping_quoted/,
    `${page.join('/')} writes the freight figure onto the order and never tells the buyer it is there`);
}

console.log(`notificationAmount selfcheck OK (${events.length} events, ${quotedTotals} of them naming a `
  + 'total, each in the buyer\'s own currency, none of them naming one before the freight is known)');
