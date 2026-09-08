// `node src/utils/catalogCategory.selfcheck.mjs`
//
// A catalogue card prints product.category; the filter pills are built from publicCategory. Those were
// two different vocabularies on one screen: the cards read "Limited" and "Fresh" while the pills offered
// "Aquatic", which no card ever showed — and ten of eighteen products, the most expensive ones, could not
// be filtered for at all.
//
// They agree because inferPublicCategory returns the owner's own category when there is one, and guesses
// only for a product that has none. This holds that.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

const storefront = strip(readFileSync(join(src, 'data', 'publicStorefront.js'), 'utf8'));
const infer = storefront.slice(storefront.indexOf('const inferPublicCategory'), storefront.indexOf('const inferMaterialHighlights'));

// The explicit category must be consulted before any keyword rule runs.
const explicitAt = infer.indexOf('product.category');
const firstGuessAt = infer.search(/if \(\/[a-z|]+\/\.test\(searchText\)\)/);
assert.ok(explicitAt !== -1, 'inferPublicCategory no longer looks at product.category');
assert.ok(firstGuessAt !== -1, 'the keyword rules are gone — update this guard');
assert.ok(
  explicitAt < firstGuessAt,
  'inferPublicCategory guesses before checking the category the owner set, so the filter pills and the '
  + 'card labels will disagree again',
);
assert.match(infer, /if \(explicit\) return explicit;/, 'the explicit category is read but not returned');

// Both catalogue pages must build their pills from the same field, and the card must print a value that
// can appear as a pill.
for (const page of ['pages/CatalogPage.jsx', 'pages/mobile/MobileCatalogPage.jsx']) {
  const text = strip(readFileSync(join(src, page), 'utf8'));
  assert.match(text, /publicCategory \|\| p(roduct)?\.category/, `${page}: the pill list changed shape`);
}

const desktop = strip(readFileSync(join(src, 'pages', 'CatalogPage.jsx'), 'utf8'));
assert.match(
  desktop,
  /catalog-card__category">\{product\.(public)?[Cc]ategory/,
  'the card label no longer prints a category field — check it still matches what the pills filter on',
);

console.log('catalogCategory selfcheck OK (owner category wins, pills and cards share one vocabulary)');
