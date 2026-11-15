// `node src/utils/internationalBuyerFlow.selfcheck.mjs`
//
// Second visitor audit of /en, 13 Nov 2026 — what a buyer abroad met between the product page and "Place
// order", and what now holds:
//   1. "3 bottles" chosen beside the price, total US$395 shown, and the button added ONE.
//   2. Before a country was picked the cart said both "place the order right here" and "we confirm on
//      WhatsApp… nothing is reserved".
//   3. The order form accepted "call me maybe", "jane@example" and an 800-character address, which only the
//      server refused after "Place order"; a reload lost everything typed.
//   4. The free-vial sheet was a modal a keyboard could not use.
//   5. Story teasers in Indonesian on /en with no word why.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// --- 1 ----------------------------------------------------------------------------------------------------
const pdp = read('pages', 'PublicProductDetailPage.jsx');
// Capped at the stock left since 15 Nov 2026 (fresh buyer audit: the picker offered 4 of 2 bottles).
assert.match(pdp, /const \{ bottles: chosenBottles \} = useShippingDestination\(\);[\s\S]{0,200}const addCount = isInternational\s*\? Math\.min\(Math\.max\(1, Math\.round\(Number\(chosenBottles\) \|\| 1\)\), [^;]*stockOfVariant[^;]*\)\s*: 1;/,
  'the English shop adds the bottle count chosen in its quote block; the Indonesian shop adds one');
assert.match(pdp, /priceNumber: selectedPrice,[\s\S]{0,260}\}, addCount\);/, 'and that count is what goes in the cart');
assert.match(pdp, /addCount > 1 && exportPrice\s*\? t\('pdp\.addManyToCartWithPrice', \{ count: addCount, price: `US\$\$\{usdPriceFor\(exportPrice\) \* addCount\}` \}\)/,
  'the button says how many and what they cost');
for (const language of ['id', 'en']) assert.match(MESSAGES[language]['pdp.addManyToCartWithPrice'], /\{count\}[\s\S]*\{price\}/);

// --- 2 ----------------------------------------------------------------------------------------------------
assert.match(read('pages', 'InternationalCartPage.jsx'), /\{lines\.length && !needsDestination \? <p[^>]*>\{t\(quote\?\.shippingUsd \? 'cart\.intl\.howItWorks' : 'cart\.intl\.howItWorksAsk'\)\}/,
  'how the WhatsApp order works is said once a country is chosen');

// --- 3 ----------------------------------------------------------------------------------------------------
// The address form is gone (Dekito, 14 Nov 2026): the address is settled on WhatsApp. Its file must not
// come back without this guard being rewritten for it.
{
  const { existsSync } = await import('node:fs');
  assert.ok(!existsSync(join(src, 'components', 'storefront', 'InternationalOrderForm.jsx')), 'the international address form is back');
  const { postcodePatternFor } = await import('./internationalAddress.js');
  const zip = new RegExp(`^(?:${postcodePatternFor('US')})$`, 'v');
  assert.ok(zip.test('94105') && !zip.test('ABCDE'), 'the address rules the order server still uses for Studio orders hold');
}
console.log('internationalBuyerFlow selfcheck OK (bottle count reaches the cart; the English cart orders on WhatsApp)');
