// `node src/utils/discoverySet.selfcheck.mjs`
//
// Dekito's discovery sets (18 Nov 2026): Indonesian shop only, no free vial, and the price he set — no
// automatic member or export price. Told apart by category, which every cart and order line carries.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DISCOVERY_SET_CATEGORY, isDiscoverySet, shownInThisShop } from './discoverySet.js';
import { bottleCount, freeVialAllowance } from './freeVial.js';
import { planAutoTierPrices } from './autoTierPrices.js';

const here = dirname(fileURLToPath(import.meta.url));
const set = { slug: 'set-i-floral', category: DISCOVERY_SET_CATEGORY, priceNumber: 199000, variants: [{ id: 'set', size: '5 vial', priceNumber: 199000, stock: 5 }] };
const bottle = { slug: 'hug-n-1', category: 'Limited', variants: [{ id: '30-ml', size: '30 ml', priceNumber: 479000, stock: 5 }] };

assert.equal(isDiscoverySet(set), true);
assert.equal(isDiscoverySet({ category: 'discovery set ' }), true, 'case and spaces do not matter');
assert.equal(isDiscoverySet(bottle), false);
assert.equal(isDiscoverySet({}), false);
// 1. Indonesian shop only.
assert.equal(shownInThisShop(set, { english: true }), false);
assert.equal(shownInThisShop(set, { english: false }), true);
assert.equal(shownInThisShop(bottle, { english: true }), true);
// 2. Not a bottle: no vial.
assert.equal(bottleCount([{ ...set, quantity: 2 }]), 0);
assert.equal(freeVialAllowance(bottleCount([{ ...set, quantity: 1 }, { ...bottle, quantity: 1 }])), 1, 'only the bottle earns a vial');
// 3. Exactly his price.
assert.deepEqual(planAutoTierPrices({ product: set, previousProduct: null, savedRows: [] }), { writes: [], kept: [] });

// Wiring.
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');
assert.match(read('services', 'productCatalogService.js'), /!isProductDraft\(product\) && !isFreeVialProduct\(product\) && shownInThisShop\(product\)/);
assert.match(read('..', 'api', 'orders', 'create.js'), /\} else if \(!isDiscoverySet\(product\)\) \{\s*\/\/[^\n]*\n\s*bottles \+= qty;/, 'the server does not count a set as a bottle either');
const seo = read('..', 'tools', 'seo-artifacts.mjs');
assert.match(seo, /if \(english && isDiscoverySet\(product\)\) continue;/, 'no English page is prerendered for a set');
assert.match(seo, /products\.filter\(\(p\) => !isDiscoverySet\(p\)\)\.map\(\(p\) => \(\{ route: `\/catalog\/\$\{p\.slug\}`/, 'and no English twin in the sitemap');
// The box images the SQL points at ship with the site.
for (const name of ['set-i-floral', 'set-ii-hangat-manis', 'set-iii-jalan-pulang', 'set-iv-limited', 'set-lengkap']) {
  assert.ok(existsSync(join(here, '..', '..', 'public', 'brand', 'sets', `${name}.jpg`)), `${name}.jpg is missing`);
}
console.log('discoverySet selfcheck OK (Indonesian shop only, no free vial, Dekito\'s price, images shipped)');
