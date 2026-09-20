// `node src/utils/productBadge.selfcheck.mjs`
//
// "Limited" was sitting in the scent-family seat.
//
// storefront_products.category did two jobs: the catalogue card printed it AND the filter pills were
// built from it, so it had to answer "what does this smell like". Ten of nineteen perfumes answered
// "Limited", which is how RARE something is.
//
// Measured on the live shop: filtering FLORAL returned four perfumes. Maskumambang — "White floral,
// olibanum, musk" by its own notes — was not one of them, and neither was Aquilaria tuberosa
// (Tuberose, oud Malinau). The two most expensive florals were invisible to a buyer looking for florals.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cardLabels, familyLabel, isLimitedProduct } from './productBadge.js';

const here = dirname(fileURLToPath(import.meta.url));
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => strip(readFileSync(join(here, '..', ...parts), 'utf8'));

// --- 1. Today's screen must not change ---------------------------------------------------------------
// Nothing is re-filed yet, so a perfume still carrying category 'Limited' must read exactly as it does
// now: one word. A migration that changed what buyers see on the day it ran would be a surprise.
assert.deepEqual(cardLabels({ category: 'Limited' }), ['Limited']);
assert.deepEqual(cardLabels({ category: 'limited' }), ['Limited'], 'case is not a different category');
assert.deepEqual(cardLabels({ category: '  Limited  ' }), ['Limited']);

// --- 2. After re-filing, the badge SURVIVES the category change ---------------------------------------
// This is the whole point: Maskumambang becomes findable under FLORAL and keeps saying LIMITED.
assert.deepEqual(cardLabels({ category: 'Floral', limited: true }), ['Floral', 'Limited']);
assert.equal(familyLabel({ category: 'Floral', limited: true }), 'Floral');
assert.equal(isLimitedProduct({ category: 'Floral', limited: true }), true);

// --- 3. An ordinary perfume gains nothing -------------------------------------------------------------
assert.deepEqual(cardLabels({ category: 'Gourmand' }), ['Gourmand']);
assert.equal(isLimitedProduct({ category: 'Gourmand' }), false);

// --- 4. No family yet is EMPTY, never an invented word -----------------------------------------------
// 'Atelier' as a fallback here would be a family nobody chose, printed beside a badge that already says
// the only true thing.
assert.equal(familyLabel({ category: 'Limited' }), '');
assert.equal(familyLabel({}), '');
assert.equal(familyLabel(null), '');
assert.deepEqual(cardLabels({}), []);
assert.deepEqual(cardLabels(null), []);

// --- 5. The field must survive all three hand-written mappers ----------------------------------------
// A field not named in every mapper simply does not exist downstream — that is how the member price
// nudge shipped invisible in #147, and how the English copy vanished in #181.
{
  const service = read('services', 'productCatalogService.js');
  const named = (service.match(/limited: Boolean\(/g) || []).length;
  assert.equal(named, 3,
    `limited is named in ${named} of the 3 mappers (normalizeProduct, toDatabasePayload, fromDatabaseRow)`);
}

// --- 5b. And the FOURTH mapper, the public one --------------------------------------------------------
// deadProductInputs caught this one: a field typed into the Studio form that never reaches the buyer.
// toPublicFragrance is a separate hand-written list in data/publicStorefront.js, and three mappers
// agreeing is not four.
{
  const publicShape = read('data', 'publicStorefront.js');
  assert.match(publicShape, /limited: Boolean\(product\.limited\)/,
    'toPublicFragrance drops the badge, so nothing a buyer sees can read it');
  assert.match(publicShape, /'limited'/,
    'the public mapper must also keep honouring a product still FILED as Limited, or the badge vanishes '
    + 'from ten perfumes the moment this ships and before anything is re-filed');
}

// --- 6. Both product forms can set it, or the flag is unreachable ------------------------------------
for (const [name, file] of [
  ['desktop', ['components', 'product', 'ProductForm.jsx']],
  ['phone', ['components', 'product', 'MobileProductForm.jsx']],
]) {
  const source = read(...file);
  assert.match(source, /checked=\{Boolean\(form\.limited\)\}/, `${name} form cannot set the badge`);
  assert.match(source, /limited: Boolean\(product\.limited\)/, `${name} form does not load it from the product`);
}

// --- 7. Every surface that printed the raw category now composes both --------------------------------
// Five of them, and they have drifted apart before.
for (const [name, file] of [
  ['catalogue (phone)', ['pages', 'mobile', 'MobileCatalogPage.jsx']],
  ['catalogue (desktop)', ['pages', 'CatalogPage.jsx']],
  ['home (phone)', ['pages', 'mobile', 'MobileStorefrontPage.jsx']],
  ['product (phone)', ['pages', 'mobile', 'MobileProductDetailPage.jsx']],
  ['product (desktop)', ['pages', 'PublicProductDetailPage.jsx']],
]) {
  const source = read(...file);
  assert.match(source, /cardLabels\(product\)/, `${name} still prints the raw category`);
}

console.log('productBadge selfcheck OK (limited is a badge, the category is free to say the family, and today\'s screen is unchanged)');
