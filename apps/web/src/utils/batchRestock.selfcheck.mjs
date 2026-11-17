// `node src/utils/batchRestock.selfcheck.mjs`
//
// A finished batch can add its bottles to a product that already exists (17 Nov 2026) instead of always
// minting a new draft. The one thing this must never do is touch a price (Dekito's standing rule), so
// the write goes around saveCustomProduct, which also fills in missing member and export prices.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { matchingVariantId, planBatchRestock, restockCandidates } from './batchRestock.js';

const row = {
  id: 'p1', name: 'Samhain', stock: 5,
  variants: [
    { id: '30-ml', size: '30 ml', priceNumber: 350000, compareAtPriceNumber: 0, stock: 3 },
    { id: '50-ml', size: '50ml', priceNumber: 520000, compareAtPriceNumber: 0, stock: 2 },
  ],
};
const plan = planBatchRestock({ row, variantId: '30-ml', bottles: 12, note: 'Batch B-1: +12 botol', now: '2026-11-17T10:00:00.000Z' });
assert.equal(plan.stock, 17);
assert.deepEqual(plan.variants[0], { ...row.variants[0], stock: 15 }, 'only the stock of the chosen size moves');
assert.deepEqual(plan.variants[1], row.variants[1], 'the other size is untouched');
assert.deepEqual(plan.variants.map((v) => v.priceNumber), [350000, 520000], 'prices are never touched');
assert.deepEqual(plan.correction.variants, [{ id: '30-ml', size: '30 ml', before: 3, after: 15 }]);
assert.equal(plan.correction.previousStock, 5);
assert.equal(plan.correction.note, 'Batch B-1: +12 botol');
assert.equal(row.variants[0].stock, 3, 'the stored row is not mutated');

assert.throws(() => planBatchRestock({ row, variantId: 'nope', bottles: 1 }), /Pilih ukuran/);
assert.throws(() => planBatchRestock({ row, variantId: '30-ml', bottles: 0 }), /masih 0/);
assert.throws(() => planBatchRestock({ row: { name: 'Lama', variants: ['30 ml'] }, variantId: '30 ml', bottles: 1 }), /format ukuran lama/);
assert.throws(() => planBatchRestock({ row: null, variantId: 'x', bottles: 1 }), /tidak ditemukan/);

assert.equal(matchingVariantId(row.variants, 30), '30-ml');
assert.equal(matchingVariantId(row.variants, 50), '50-ml', '"50ml" with no space still matches');
assert.equal(matchingVariantId(row.variants, 10), '');

const products = [
  { id: 'b', name: 'Bloody Luwak', formula: 'f2' },
  { id: 'custom-x', name: 'Local only' },
  { id: 'v', name: 'Vial', gift: true },
  { id: 'a', name: 'Ambar Segara', formula: 'f1' },
  { id: 's', name: 'Samhain', formula: 'f9' },
];
const order = restockCandidates(products, { formulaId: 'f9', formulaIdOf: (p) => p.formula, isGift: (p) => p.gift }).map((p) => p.id);
assert.deepEqual(order, ['s', 'a', 'b'], 'the product of this formula first, then by name; no local-only rows or gift vials');

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');
const service = read('services', 'productCatalogService.js');
const fn = service.slice(service.indexOf('export const restockProductFromBatch'), service.indexOf('// Tagging writes one column'));
assert.ok(fn.length > 200, 'restockProductFromBatch not found');
assert.match(fn, /\.update\(\{ variants: plan\.variants, stock: plan\.stock, tags \}\)/, 'the restock writes stock columns only');
assert.match(fn, /\.eq\('updated_at', row\.updated_at\)/, 'an order that cut stock in between must not be written over');
assert.match(fn, /if \(!data\) \{/, 'zero rows back is a failure, not a success');
assert.doesNotMatch(fn, /saveCustomProduct|applyAutoTierPrices|price/i, 'the restock path must not reach any price');

for (const page of [['pages', 'BatchProductionPage.jsx'], ['pages', 'mobile', 'MobileBatchesPage.jsx']]) {
  const text = read(...page);
  const name = page.at(-1);
  assert.match(text, /<BatchStockTarget/, `${name} offers the new-or-existing choice`);
  assert.match(text, /await restockProductFromBatch\(\{/, `${name} restocks through the stock-only service`);
  assert.match(text, /stockTarget\.mode === RESTOCK \? restockFromBatch/, `${name} button follows the choice`);
  assert.match(text, /publishedProduct \|\| stockTarget\.mode === NEW_PRODUCT \? <(div|label)/, `${name} hides the price field when restocking`);
  assert.match(text, /const restockFromBatch = async \(\) => \{[\s\S]{0,700}qcStatus !== 'passed'[\s\S]{0,1400}confirmAction\(/, `${name} asks QC first, then confirms`);
}
console.log('batchRestock selfcheck OK (stock only, one size, price untouched, locked write, both batch screens)');
