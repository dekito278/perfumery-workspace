// `node src/utils/primaryVariant.selfcheck.mjs`
//
// One product, many sizes, and several places where a single number has to stand for all of them: the
// catalog card, the saved price_number column, the JSON-LD Offer, the og:price meta, the detail
// headline. They were not asking the same question.
//
// The forms saved variants[0]'s price; the storefront rendered getProductPriceRange, a MINIMUM. Those
// agree only while the first variant happens to be the cheapest — true for all 18 live products today,
// which is exactly why nobody noticed. Add a 5 ml at the end of the list and Google, Facebook and the
// card each quote a different number from the page they link to.
//
// Worse than the price alone: the price came from the cheapest variant while the SIZE came from the
// first, so a card could read "30 ml — Rp 129.000" where Rp 129.000 is the 10 ml price.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => strip(readFileSync(join(src, ...parts), 'utf8'));

// The helper is tiny and pure; re-implement its contract here rather than importing a module that pulls
// in Supabase, and hold the source to the same rule.
const service = read('services', 'productCatalogService.js');
const body = service.slice(service.indexOf('export const getPrimaryVariant'), service.indexOf('export const getProductStockTotal'));
assert.match(body, /Number\(variant\.priceNumber\) < Number\(cheapest\.priceNumber\)/,
  'the representative variant must be the cheapest — that is what getProductPriceRange has always shown');
assert.match(body, /return variants\[0\] \|\| null/, 'a product with no priced variant still needs an answer');

// getProductPriceRange must stay a minimum, or the two drift apart again from the other side.
const range = service.slice(service.indexOf('export const getProductPriceRange'), service.indexOf('export const getPrimaryVariant'));
assert.match(range, /Math\.min\(\.\.\.prices\)/, 'the displayed price is a minimum; the helper above assumes it');

// --- one bottle, one headline -----------------------------------------------------------------------
// Price, compare-at and size must all come from the same variant in every place that picks one.
for (const file of [['components', 'product', 'ProductForm.jsx'], ['components', 'product', 'MobileProductForm.jsx']]) {
  const source = read(...file);
  assert.doesNotMatch(source, /variants\?\.\[0\]\?\.(priceNumber|compareAtPriceNumber|size)/,
    `${file.join('/')} must not save the first variant's price, compare-at or size — use getPrimaryVariant`);
  for (const field of ['priceNumber', 'compareAtPriceNumber', 'size']) {
    assert.match(source, new RegExp(`getPrimaryVariant\\(form\\.variants \\|\\| \\[\\]\\)\\?\\.${field}`),
      `${file.join('/')} must take ${field} from the representative variant`);
  }
}

const mapper = read('data', 'publicStorefront.js');
assert.match(mapper, /size: getPrimaryVariant\(variants\)\?\.size/,
  'the public shape must label its price with the size that price belongs to');
assert.match(mapper, /compareAtPriceNumber: Number\(getPrimaryVariant\(variants\)\?\.compareAtPriceNumber/,
  'the strikethrough must belong to the same bottle as the price');

// --- the detail pages must open on that same bottle --------------------------------------------------
// Otherwise the page can render a headline of Rp 129.000 above a button that charges Rp 310.000.
for (const file of [['pages', 'PublicProductDetailPage.jsx'], ['pages', 'mobile', 'MobileProductDetailPage.jsx']]) {
  const source = read(...file);
  assert.match(source, /=== selectedVariantId\) \|\| getPrimaryVariant\(variants\)/,
    `${file.join('/')} must default to the variant the headline price belongs to`);
}

// --- and the prerender must read the column the forms now write ---------------------------------------
const seo = strip(readFileSync(join(src, '..', 'tools', 'seo-artifacts.mjs'), 'utf8'));
assert.match(seo, /priceNumber: Number\(row\.price_number \|\| 0\)/,
  'the JSON-LD Offer and og:price come from price_number; the forms must keep writing the displayed price there');

console.log('primaryVariant selfcheck OK (one bottle behind the headline price, everywhere)');
