// `node src/utils/productListFilter.selfcheck.mjs`
//
// The Studio dashboard said "8 product hampir habis" and opened a product list that could not show them.
// Its chips are PUBLISH states — Live, Draft, Belum siap, Stok habis — and the nearest one is a different
// set: "Stok habis" is stock 0, which getProductLowStock explicitly excludes (it means still in stock,
// but under the restock threshold). Eight products to find by eye among eighteen.
//
// Low stock is a stock level, not a publish state. That is why it had to be added rather than looked up,
// and why the list now takes its filter from the URL: a card that counts something must be able to open
// the list showing exactly that.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// The filter reaches into the catalog service, which drags Supabase into node. Same shim the other
// service-backed guards use: strip the imports, stub what they provided — and stub them with the REAL
// rules, copied from productCatalogService, so the test is not grading its own homework on a fake.
const filterSource = readFileSync(join(root, 'utils', 'productListFilter.js'), 'utf8')
  .replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '');
const stubs = `
const getProductRestockThreshold = (product) => Number(product?.restockThreshold ?? 5);
const getProductLowStock = (product) => {
  const stock = Number(product?.stock || 0);
  return stock > 0 && stock <= getProductRestockThreshold(product);
};
const getProductPublishStatus = (product) => ({ key: product?.publishStatusKey || 'draft' });
`;
const { PRODUCT_LIST_FILTERS, countProductsByFilter, isProductListFilter, matchesProductFilter } = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + filterSource, 'utf8').toString('base64')}`
);

// --- 1. The two sets the dashboard confused --------------------------------------------------------
const runningLow = { name: 'A', stock: 3, publishStatusKey: 'live' };
const soldOut = { name: 'B', stock: 0, publishStatusKey: 'stockout' };
const plenty = { name: 'C', stock: 50, publishStatusKey: 'live' };

assert.equal(matchesProductFilter(runningLow, 'lowstock'), true, 'three left is running low');
assert.equal(matchesProductFilter(soldOut, 'lowstock'), false,
  'sold out is NOT running low — that is the whole reason "Stok habis" could not stand in for it');
assert.equal(matchesProductFilter(plenty, 'lowstock'), false);
assert.equal(matchesProductFilter(soldOut, 'stockout'), true, 'and the publish-state chips still work');
assert.equal(matchesProductFilter(runningLow, 'live'), true);
assert.equal(matchesProductFilter(runningLow, 'all'), true);
assert.equal(matchesProductFilter(null, 'all'), false, 'nothing matches nothing, and it does not throw');

// --- 2. The chips and their counts agree ---------------------------------------------------------------
assert.ok(PRODUCT_LIST_FILTERS.some((filter) => filter.key === 'lowstock'), 'the chip must exist to be opened');
assert.equal(isProductListFilter('lowstock'), true);
assert.equal(isProductListFilter('nonsense'), false, 'an unknown ?filter= must not become a filter');

const counts = countProductsByFilter([runningLow, soldOut, plenty]);
assert.equal(counts.all, 3);
assert.equal(counts.lowstock, 1, 'the chip count is the same rule as the chip filter');
assert.equal(counts.stockout, 1);

// --- 3. Both lists read the filter from the URL, or the card's link is decorative ----------------------
for (const [name, file] of [
  ['the phone product list', ['pages', 'mobile', 'MobileProductListPage.jsx']],
  ['the desktop product list', ['pages', 'ProductListPage.jsx']],
]) {
  const source = read(...file);
  assert.match(source, /searchParams\.get\('filter'\)/, `${name} must accept the filter the dashboard sends`);
  assert.match(source, /isProductListFilter\(requested\)/, `${name} must refuse a filter it does not have`);
  assert.match(source, /matchesProductFilter\(product, productStatusFilter\)/, `${name} must filter with the shared rule`);
  assert.doesNotMatch(source, /getProductPublishStatus\(product\)\.key === productStatusFilter/,
    `${name} still filters with its own copy of the rule`);
}

// --- 4. And both dashboards point the low-stock card at that filter ------------------------------------
for (const [name, file] of [
  ['the phone dashboard', ['pages', 'mobile', 'MobileDashboardPage.jsx']],
  ['the desktop dashboard', ['pages', 'DashboardPage.jsx']],
]) {
  const source = read(...file);
  assert.match(source, /getProductLowStock/, `${name} must still count what is running low`);
  assert.match(source, /\/studio\/products\?filter=lowstock/,
    `${name} counts low stock and opens a list that cannot show it`);
}

console.log('productListFilter selfcheck OK (the eight products the card counts are one tap away)');
