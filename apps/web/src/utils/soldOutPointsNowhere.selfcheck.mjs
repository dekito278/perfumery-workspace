// `node src/utils/soldOutPointsNowhere.selfcheck.mjs`
//
// Live buyer audit, 17 Nov 2026. Two small things a reader acts on:
// - A sold-out perfume in the English shop said "Shipping to your country is added in the cart — choose it
//   below", and below there was no country picker (it is hidden when nothing can be ordered).
// - "Bespoke ritual →" on the Help page stands on its own line, so it is a button to the thumb; it was 20 px.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const price = read('components', 'storefront', 'InternationalPrice.jsx');
assert.match(price, /canOrder = true/);
assert.match(price, /\{canOrder \? \(\s*<p[\s\S]{0,300}t\('intl\.priceNote'\)/, 'the "choose it below" line only shows when the picker does');
const pdp = read('pages', 'PublicProductDetailPage.jsx');
assert.match(pdp, /<InternationalPrice price=\{exportPrice\} canOrder=\{!soldOut\} \/>/);
assert.match(pdp, /\{exportPrice && !soldOut \? \(\s*<InternationalShippingQuote/, 'the picker the sentence points to is hidden when sold out');

assert.match(read('pages', 'HelpPage.jsx'), /<Link to="\/bespoke" className="inline-flex min-h-11 items-center/);
console.log('soldOutPointsNowhere selfcheck OK (no pointer to a hidden picker; help link is thumb-sized)');
