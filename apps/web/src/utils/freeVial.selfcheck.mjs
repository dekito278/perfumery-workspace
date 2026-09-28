// `node src/utils/freeVial.selfcheck.mjs`
//
// The free gift vial is stock that is NOT for sale, living in the table where every other row is. That is
// a deliberate trade (see utils/freeVial.js) and it has a price: the row breaks two things the catalogue
// assumes about its contents — a product costs more than nothing, and a variant is a size you can buy.
//
// So the row has to stay out of exactly three places, and this guard checks all three at their source
// rather than trusting the comment that names them. It also checks the weight, which is the one number
// here that costs real money when it is wrong.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { FREE_VIAL_SIZE, FREE_VIAL_TAG, FREE_VIAL_WEIGHT_GRAM, FREE_VIALS_PER_ORDER, isFreeVialProduct } from './freeVial.js';
import { DEFAULT_ITEM_WEIGHT_GRAM, isWeighedSize, itemWeightGram } from './itemWeight.js';
import { planAutoTierPrices } from './autoTierPrices.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// productCatalogService speaks '@/...' and reaches Supabase, so the four small pieces that decide
// visibility are lifted out of it and RUN — asserting that the FILE mentions the vial rule would pass
// while the one expression that matters had stopped calling it.
const service = read('services', 'productCatalogService.js');
const lift = (pattern, what) => {
  const found = service.match(pattern);
  assert.ok(found, `could not lift ${what} out of productCatalogService — update this guard, not the app`);
  return found[0];
};
const visibility = await import(`data:text/javascript;base64,${Buffer.from([
  "import { isFreeVialProduct } from 'file://" + join(root, 'utils', 'freeVial.js') + "';",
  lift(/const PRODUCT_DRAFT_TAG = '[^']*';/, 'the draft tag'),
  lift(/const splitList = [\s\S]*?\n\};/, 'splitList'),
  lift(/export const isProductDraft = [\s\S]*?\n\);/, 'isProductDraft'),
  lift(/export const isProductVisibleInStorefront = [\s\S]*?\n\);/, 'isProductVisibleInStorefront'),
].join('\n').replace(/^export /gm, 'export '), 'utf8').toString('base64')}`);
const { isProductVisibleInStorefront } = visibility;

const vial = { name: 'Vial hadiah', tags: [FREE_VIAL_TAG], variants: [{ id: 'hug-n-1', size: 'HUG N°1', priceNumber: 0, stock: 40 }] };
const bottle = { name: 'HUG N°1', tags: ['Limited'], variants: [{ id: '30-ml', size: '30 ml', priceNumber: 359000, stock: 5 }] };

// --- 1. Reading the tag, in both shapes it arrives in --------------------------------------------------
// The database hands back an array; older rows and the product form hand back a comma-separated string.
assert.equal(isFreeVialProduct(vial), true);
assert.equal(isFreeVialProduct({ tags: `Limited, ${FREE_VIAL_TAG}` }), true, 'a comma-separated tag string counts');
assert.equal(isFreeVialProduct({ tags: ['vial HADIAH'] }), true, 'the tag is matched without regard to case');
assert.equal(isFreeVialProduct(bottle), false);
assert.equal(isFreeVialProduct({}), false, 'a product with no tags at all is not a vial');
assert.equal(isFreeVialProduct(), false, 'called with nothing, no crash');

// --- 2. It is one per ORDER, and that is a decision, not a default -------------------------------------
assert.equal(FREE_VIALS_PER_ORDER, 1, "Dekito's decision, 2026-09-29: per order, not per bottle");

// --- 3. The weight, which is where this costs money ----------------------------------------------------
// Unmeasured, a 2 ml vial falls to the 300 g default — heavier than a 30 ml bottle — and every order
// carrying a gift is quoted freight for 300 g that is not in the box.
assert.equal(FREE_VIAL_WEIGHT_GRAM, 10, "Dekito's figure, 2026-09-29");
assert.ok(FREE_VIAL_WEIGHT_GRAM < DEFAULT_ITEM_WEIGHT_GRAM,
  `a vial weighing ${FREE_VIAL_WEIGHT_GRAM} g must not be heavier than the ${DEFAULT_ITEM_WEIGHT_GRAM} g fallback it exists to avoid`);
assert.equal(itemWeightGram(FREE_VIAL_SIZE), FREE_VIAL_WEIGHT_GRAM,
  'the vial weight must come from the one weight table, not from a second copy of the number');
assert.equal(isWeighedSize(FREE_VIAL_SIZE), true, 'so Studio stops warning that this size was never weighed');
// The bottles Dekito measured on 2026-09-13 are untouched by the new entry.
assert.deepEqual(
  [10, 30, 50, 100].map((ml) => itemWeightGram(`${ml} ml`)),
  [100, 250, 350, 650],
  'adding the vial must not move a bottle weight',
);
assert.equal(itemWeightGram('7 ml'), DEFAULT_ITEM_WEIGHT_GRAM, 'and an unweighed size still falls back');

// --- 4. Out of the storefront listings -----------------------------------------------------------------
assert.equal(isProductVisibleInStorefront(bottle), true);
assert.equal(isProductVisibleInStorefront(vial), false, 'the vial row is stock, not something to sell');

// Every page that lists products asks that one helper. The subject is derived: a page rendering a product
// list has no business writing its own idea of what belongs in the catalogue.
const pages = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel);
    else if (entry.name.endsWith('.jsx')) pages.push(rel);
  }
};
walk('pages');
let listings = 0;
for (const page of pages) {
  const source = read(...page.split('/'));
  if (!/isProductVisibleInStorefront/.test(source)) continue;
  listings += 1;
  assert.match(source, /\.filter\(isProductVisibleInStorefront\)|filter\(\(?\w+\)? => isProductVisibleInStorefront/,
    `${page} imports the visibility helper but does not filter with it`);
}
assert.ok(listings >= 8, `only ${listings} product listings found — the walk lost them`);

// --- 5. Out of the automatic member/export pricing -----------------------------------------------------
// The obvious fixture does NOT test this. A vial variant priced at Rp 0 is dropped by retailByVariant
// before the rule ever runs, so removing the exclusion changes nothing and the sabotage passes — which
// is what happened the first time this was written. The branch is only reached once a vial variant
// carries a number, which is exactly what happens the day Dekito records what a vial is worth.
const pricedVial = { ...vial, variants: [{ id: 'hug-n-1', size: 'HUG N°1', priceNumber: 25000, stock: 40 }] };
assert.deepEqual(planAutoTierPrices({ product: pricedVial }), { writes: [], kept: [] },
  'a gift has no member price and no export price, even once its worth is written down');
assert.deepEqual(planAutoTierPrices({ product: vial }), { writes: [], kept: [] },
  'and a vial with no value at all is priced no differently');
assert.ok(planAutoTierPrices({ product: bottle }).writes.length === 2,
  'and an ordinary product still gets both — the exclusion must not be a blanket off switch');

// --- 6. Out of the build's product fetch ---------------------------------------------------------------
// Prerendering /catalog/<vial> and listing it in the sitemap would advertise a page selling nothing for
// Rp 0. Checked in the build's own source, which is plain node and cannot be imported here without
// reaching Supabase.
const artifacts = readFileSync(join(root, '..', 'tools', 'seo-artifacts.mjs'), 'utf8');
assert.match(artifacts, /import \{ isFreeVialProduct \} from '\.\.\/src\/utils\/freeVial\.js';/,
  'the build must read the same rule rather than a copy of the tag');
assert.match(artifacts, /\.filter\(\(row\) => !isFreeVialProduct\(\{ tags: row\.tags \}\)\)/,
  'the build must drop the vial rows before prerendering and sitemapping them');

console.log(`freeVial selfcheck OK (one ${FREE_VIAL_SIZE} vial per order at ${FREE_VIAL_WEIGHT_GRAM} g, kept out of ${listings} listings, out of the automatic pricing, and out of the sitemap)`);
