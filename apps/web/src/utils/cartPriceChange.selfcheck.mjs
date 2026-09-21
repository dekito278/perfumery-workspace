// `node src/utils/cartPriceChange.selfcheck.mjs`
//
// The cart reprices every line against the live catalogue when it is read, and it has always said so —
// with one sentence, at the top, about "some items". A buyer came back to a total that disagreed with the
// one they remembered and could not see which bottle moved, in which direction, or by how much.
//
// When the price has gone UP, that sentence is the only warning before they pay more than the page quoted
// them. reconcileCartLines has written previousPriceNumber on every line since audit round 7, and nothing
// read it.
//
// The rule: wherever the shop admits prices changed, it must show what they changed FROM.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { reconcileCartLines } from './cartReconcile.js';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. The old number survives reconciliation ----------------------------------------------------------
const line = { slug: 'hug-n-1-30-ml', productSlug: 'hug-n-1', variantId: '30-ml', size: '30 ml', priceNumber: 240000, quantity: 1 };
const catalogue = (price) => ([{ slug: 'hug-n-1', id: 'p1', priceNumber: price, stock: 5, variants: [{ id: '30-ml', size: '30 ml', priceNumber: price, stock: 5 }] }]);

const raised = reconcileCartLines([line], catalogue(289000))[0];
assert.equal(raised.priceChanged, true, 'a price that moved must be flagged');
assert.equal(raised.previousPriceNumber, 240000, 'and the buyer must still be able to learn what it was');
assert.equal(raised.priceNumber, 289000, 'while the line itself charges the live price');

const unchanged = reconcileCartLines([line], catalogue(240000))[0];
assert.equal(unchanged.priceChanged, false, 'an unchanged price must not raise a notice about nothing');

// --- 2. Every surface that admits the change also shows what it was --------------------------------------
// Derived from the admission itself: find the pages that render the banner, not a list kept by hand. A
// fifth surface that starts saying "some prices were updated" inherits the rule.
const surfaces = [
  ['pages', 'CartPage.jsx'],
  ['pages', 'CheckoutPage.jsx'],
  ['pages', 'mobile', 'MobileCartPage.jsx'],
  ['pages', 'mobile', 'MobileCheckoutPage.jsx'],
  ['pages', 'mobile', 'MobileProductDetailPage.jsx'],
  ['pages', 'PublicProductDetailPage.jsx'],
];
let admitting = 0;
for (const parts of surfaces) {
  const source = read(...parts);
  if (!source.includes("t('checkout.pricesUpdated')")) continue;
  admitting += 1;
  assert.match(source, /<CartPriceChange\s+item=\{item\}/,
    `${parts.join('/')}: it tells the buyer prices changed and never shows what they changed from`);
}
assert.equal(admitting, 4, `expected the cart and checkout on both surfaces to carry the notice, found ${admitting}`);

// --- 3. The line says the direction, from the stored number ----------------------------------------------
const mark = read('components', 'storefront', 'CartPriceChange.jsx');
assert.match(mark, /item\?\.previousPriceNumber/, 'it reads the price the buyer last saw');
assert.match(mark, /current > previous \? 'cart\.priceUpFrom' : 'cart\.priceDownFrom'/,
  'and says which way it went — "updated" hides a rise inside a neutral word');
assert.match(mark, /formatRupiah\(previous\)/, 'the number shown is the OLD one; the new one is already on the line');
assert.match(mark, /if \(!item\?\.priceChanged \|\| previous <= 0 \|\| current <= 0 \|\| previous === current\) return null;/,
  'and nothing at all is said when nothing changed');

for (const language of ['id', 'en']) {
  for (const key of ['cart.priceUpFrom', 'cart.priceDownFrom']) {
    assert.match(MESSAGES[language][key], /\{price\}/, `${language}.${key} must carry the old price`);
  }
  assert.notEqual(MESSAGES[language]['cart.priceUpFrom'], MESSAGES[language]['cart.priceDownFrom'],
    `${language}: a rise and a fall must not read the same`);
}

console.log('cartPriceChange selfcheck OK (a price that moved says where it moved from, and which way)');
