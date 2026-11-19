// `node src/utils/studioReadsFullProducts.selfcheck.mjs`
//
// 19 Nov 2026: Dekito ran the discovery-set SQL and could not find the five drafts in Studio. The product
// screens read storefront_products_public, the BUYERS' view, which (a) leaves drafts out and (b) strips
// the internal tags — batch links, stock corrections, the restock threshold, COGS. So no draft could ever
// be seen or published from Studio, and every product saved from the edit form went back without those
// tags. The Studio product screens read the full table (admin-only by RLS) instead.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const STUDIO_PRODUCT_SCREENS = [
  ['pages', 'ProductListPage.jsx'],
  ['pages', 'mobile', 'MobileProductListPage.jsx'],
  ['pages', 'ProductEditPage.jsx'],
  ['pages', 'mobile', 'MobileProductEditPage.jsx'],
  ['components', 'product', 'ProductForm.jsx'],
  ['components', 'product', 'MobileProductForm.jsx'],
  ['pages', 'ProductInventoryPage.jsx'],
  ['pages', 'ProductCategoriesPage.jsx'],
  ['pages', 'mobile', 'MobileProductCategoriesPage.jsx'],
  ['pages', 'CatalogCurationPage.jsx'],
];
for (const parts of STUDIO_PRODUCT_SCREENS) {
  const text = readFileSync(join(src, ...parts), 'utf8');
  assert.match(text, /useCatalogProducts\(\{ editableOnly: true \}\)/, `${parts.at(-1)} must read the full product table`);
  assert.doesNotMatch(text, /useCatalogProducts\(\)/, `${parts.at(-1)} reads the buyers' view again: no drafts, internal tags stripped`);
}
// What editableOnly means: the base table, which the buyers' view is not.
const hook = readFileSync(join(src, 'hooks', 'useCatalogProducts.js'), 'utf8');
assert.match(hook, /editableOnly\s*\?\s*await getEditableProducts\(\{ useLastValidFallback: false/);
const service = readFileSync(join(src, 'services', 'productCatalogService.js'), 'utf8');
assert.match(service, /export const getEditableProducts = async \(\{ useLastValidFallback = true, timeoutMs = 5000, table = 'storefront_products' \} = \{\}\)/);
console.log(`studioReadsFullProducts selfcheck OK (${STUDIO_PRODUCT_SCREENS.length} Studio product screens read the full table)`);
