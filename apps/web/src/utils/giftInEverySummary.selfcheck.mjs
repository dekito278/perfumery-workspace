// `node src/utils/giftInEverySummary.selfcheck.mjs`
//
// Ninth visitor audit, 13 Nov 2026: in the English cart a buyer picks "La Rose" as the free vial, the
// button says pressed — and the order summary beside it, the box that sums what is coming, never mentions
// a vial at all. The Indonesian checkout has listed it since #619; the English one is the order form too
// (InternationalOrderForm sends quote.gift), so a chosen gift looked forgotten until the parcel arrived.
//
// The rule: every summary of an order that carries the gift names it, by its aroma, as free.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const intl = read('components', 'storefront', 'InternationalShippingQuote.jsx');
assert.match(intl, /\{quote\?\.gift \? \(/, 'the English summary does not look at the chosen gift');
assert.match(intl, /t\('intlQuote\.giftLine', \{ name: quote\.gift\.size \|\| quote\.gift\.name \}\)/,
  'the gift row must name the aroma (the variant), not the product');
assert.match(intl, /\{t\('cart\.giftFree'\)\}/, 'the gift row must say it is free, in the shop language');

// The form sends the same gift the summary shows.
assert.match(read('components', 'storefront', 'InternationalOrderForm.jsx'), /\.\.\.\(quote\.gift \? \[quote\.gift\] : \[\]\)/);
// The quote exposes it.
assert.match(read('hooks', 'useInternationalQuote.js'), /return \{ \.\.\.core, lines, gift,/);

// The Indonesian checkout keeps its row.
assert.match(read('pages', 'CheckoutPage.jsx'), /isFreeVialLine\(item\) \? FREE_VIAL_PRICE_LABEL/);

// Tenth visitor audit, 13 Nov 2026: a buyer who went from the product page straight to checkout never saw
// the cart's picker, so the gift the product page promised ("nanti di keranjang") was lost without a word.
// Checkout offers the same picker while no vial is chosen.
const checkout = read('pages', 'CheckoutPage.jsx');
assert.match(checkout, /const \{ gift: chosenGift \} = splitFreeVialLines\(items\);/);
assert.match(checkout, /\{chosenGift \? null : <FreeVialPicker items=\{items\} products=\{catalogProducts\} onPick=\{setGift\} \/>\}/,
  'checkout no longer offers the free vial to a buyer who skipped the cart');

for (const language of ['id', 'en']) {
  assert.ok(MESSAGES[language]['intlQuote.giftLine']?.includes('{name}'), `${language}.intlQuote.giftLine must name the aroma`);
  assert.ok(MESSAGES[language]['cart.giftFree'], `${language}.cart.giftFree is missing`);
}

console.log('giftInEverySummary selfcheck OK (the chosen vial is named, as free, in both order summaries)');
