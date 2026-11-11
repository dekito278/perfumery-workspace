// `node src/utils/dokuCheckoutAccepts.selfcheck.mjs`
//
// Production smoke, 2026-11-11 (test order DKT-MWB4N1G8-9QEVMX, allowed by Dekito): choosing DOKU Checkout for
// HUG N°1 never opened a payment panel. DOKU answered 400 "Invalid character, allowed only a-z A-Z 0-9 . - / + ,
// = _ : ' @ % ( )" — for the ° in the product name — and refused the whole checkout. Six of the 20 product
// names held such a character (°, ’, !, Javanese script). The payment page's retry then failed a second way,
// "phone number must be 1-20 digits": it sends contact '-' (normalizeOrder's default), which became phone ''.
// The buyer was shown "your payment is being processed" for an order nobody could pay.
// Both were reproduced against the live endpoint, and both disappeared with the plain name / no contact.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { contactToCustomer, dokuText } from '../../api/doku/checkout.js';

const here = dirname(fileURLToPath(import.meta.url));
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (path) => strip(readFileSync(join(here, path), 'utf8'));

// DOKU's own list, copied from its error message — not from dokuText, so the two can disagree.
const DOKU_ALLOWS = /^[a-zA-Z0-9 .\-/+,=_:'@%()]+$/;

// --- 1. Every name that broke production now goes through, and still reads as itself -------------------------
const seen = {
  'HUG N°1': 'HUG No1',
  'J’adore la Vanille': "J'adore la Vanille",
  'J’adore La Vetiver': "J'adore La Vetiver",
  'L’iris': "L'iris",
  'Wongka!': 'Wongka',
  'Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀)': 'Ayang-ayang',
  'Crème Brûlée': 'Creme Brulee',
  '.Wayback': '.Wayback',
};
for (const [name, expected] of Object.entries(seen)) {
  const sent = dokuText(name, 'Solivagant item');
  assert.match(sent, DOKU_ALLOWS, `${name} → "${sent}" still holds a character DOKU refuses`);
  assert.equal(sent, expected, `${name} should reach DOKU as "${expected}"`);
}
// A name made only of refused characters must not reach DOKU as an empty string.
assert.equal(dokuText('ꦲꦪꦤ꧀ 🌸', 'Solivagant Customer'), 'Solivagant Customer');
assert.equal(dokuText('', 'Solivagant item'), 'Solivagant item');

// --- 2. A contact with no digits sends no phone, instead of an empty one DOKU refuses -------------------------
assert.deepEqual(contactToCustomer('-'), {}, "contact '-' (the payment page's retry) must send no phone");
assert.deepEqual(contactToCustomer('081234567890'), { phone: '6281234567890' });
assert.deepEqual(contactToCustomer('+44 20 7946 0958'), { phone: '442079460958' });
assert.deepEqual(contactToCustomer('buyer@example.com'), { email: 'buyer@example.com' });
assert.deepEqual(contactToCustomer('1'.repeat(21)), {}, 'over 20 digits is refused by DOKU, so it is left out');

// --- 3. Every name DOKU sees goes through dokuText, and the buyer comes from the order row first ---------------
const api = read('../../api/doku/checkout.js');
assert.match(api, /name: dokuText\(item\.name \|\| item\.slug, 'Solivagant item'\)/, 'line item names must be cleaned');
assert.match(api, /name: dokuText\(order\.customer_name \|\| input\.customerName,/, 'the buyer name: order row first, cleaned');
assert.match(api, /contactToCustomer\(order\.contact \|\| input\.contact\)/, 'the contact: order row first');
const names = [...api.matchAll(/^\s*name: (.+)$/gm)].map((match) => match[1]);
for (const value of names) {
  assert.ok(/^dokuText\(|^'[a-zA-Z0-9 ]+',?$/.test(value), `a name sent to DOKU skips dokuText: ${value}`);
}

// --- 4. When DOKU still will not open, the page says so instead of "being processed" --------------------------
const page = read('../pages/PaymentPage.jsx');
assert.match(page, /setOrderFound\('notReady'\)/, 'a failed DOKU recovery must mark the order not ready');
assert.match(page, /state === 'notReady' \? t\("pay\.notReady"\)/);
// While looking up, the loading copy, from the very first paint; never "being processed" (12 Nov 2026).
assert.match(page, /const state = loading \? 'loading' : orderFound === null \? 'notReady' : orderFound;/);
assert.match(page, /state === 'loading' \? t\("pay\.loadingPanel"\)/);
assert.match(page, /useState\(\(\) => typeof window !== 'undefined' && new URLSearchParams\(window\.location\.search\)\.has\('order'\)\)/,
  'loadingOrder must start true when there is an order, or the first frame flashes the result copy');
assert.match(page, /t\("pay\.notReadyBody", \{ order: orderNumber \}\)/);
for (const lang of ['id', 'en']) {
  for (const key of ['pay.notReady', 'pay.notReadyBody']) assert.ok(MESSAGES[lang][key], `${lang} ${key}`);
  assert.match(MESSAGES[lang]['pay.notReadyBody'], /\{order\}/);
}

console.log(`dokuCheckoutAccepts: ${Object.keys(seen).length} names + 5 contacts + ${names.length} DOKU name fields + not-ready page OK`);
