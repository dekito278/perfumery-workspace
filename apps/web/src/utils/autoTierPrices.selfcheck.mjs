// `node src/utils/autoTierPrices.selfcheck.mjs`
//
// Dekito's rule, 2026-09-15: set the website price and the member price follows at 10% off, the export
// price at 3,5x. Typing them by hand is why 17 of 18 products had neither for weeks.
//
// The arithmetic is the easy half. The half that matters is knowing when NOT to write: a price Dekito
// set deliberately must survive a retail edit, and a price this rule produced must follow one. Get the
// first wrong and the automation silently undoes his decisions; get the second wrong and a 10% member
// discount quietly becomes 25% the next time a price goes up.
//
// It writes MONEY on every product save, so every rule here is run.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  AUTO_TIER_RULES,
  autoTierPriceMessage,
  planAutoTierPrices,
  retailByVariant,
  savedTierIndex,
} from './autoTierPrices.js';
import { DEFAULT_MEMBER_DISCOUNT_PERCENT, DEFAULT_OVERSEAS_MULTIPLIER } from './memberPriceFill.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. The two rates are Dekito's, and both are automated ---------------------------------------------
assert.equal(DEFAULT_MEMBER_DISCOUNT_PERCENT, 10, "Dekito's decision, 2026-09-15");
assert.equal(DEFAULT_OVERSEAS_MULTIPLIER, 3.5, "Dekito's decision, 2026-09-15: a flat 3,5x, replacing 2,5x");
assert.deepEqual(AUTO_TIER_RULES.map((rule) => rule.tier), ['member', 'overseas'],
  'both tiers are automatic — automating one and leaving the other by hand is how the other goes stale');

const product = (price, variantId = '30-ml') => ({ id: 'p1', variants: [{ id: variantId, priceNumber: price }] });
const rowsOf = (entries) => entries.map(([variant_id, tier, price_number]) => ({ variant_id, tier, price_number }));

// --- 2. A product with no tier prices gets both ---------------------------------------------------------
{
  const { writes, kept } = planAutoTierPrices({ product: product(300000) });
  assert.deepEqual(writes, [
    { variantId: '30-ml', tier: 'member', priceNumber: 270000 },
    { variantId: '30-ml', tier: 'overseas', priceNumber: 1050000 },
  ]);
  assert.deepEqual(kept, []);
}

// --- 3. A hand-set price SURVIVES a retail edit ----------------------------------------------------------
// This is the rule the automation exists to not break. Dekito prices a bottle deliberately; raising the
// retail price later must not silently overwrite that decision.
{
  const { writes, kept } = planAutoTierPrices({
    product: product(400000),
    previousProduct: product(300000),
    savedRows: rowsOf([['30-ml', 'member', 250000], ['30-ml', 'overseas', 1050000]]),
  });
  // 250000 is not 10% off 300000, so it was typed by hand: left exactly alone.
  assert.deepEqual(kept, [{ variantId: '30-ml', tier: 'member', priceNumber: 250000 }]);
  // 1050000 IS 3,5x the old 300000, so it was this rule's own output: it follows the new price.
  assert.deepEqual(writes, [{ variantId: '30-ml', tier: 'overseas', priceNumber: 1400000 }]);
}

// --- 4. An automatic price FOLLOWS a retail edit ----------------------------------------------------------
{
  const { writes } = planAutoTierPrices({
    product: product(400000),
    previousProduct: product(300000),
    savedRows: rowsOf([['30-ml', 'member', 270000], ['30-ml', 'overseas', 1050000]]),
  });
  assert.deepEqual(writes, [
    { variantId: '30-ml', tier: 'member', priceNumber: 360000 },
    { variantId: '30-ml', tier: 'overseas', priceNumber: 1400000 },
  ], 'both were this rule\'s output against the old price, so both follow the new one');
}

// --- 5. Nothing changed, nothing written ------------------------------------------------------------------
// A product saved for an unrelated reason — a photo, a tag, a stock correction — must not rewrite prices.
{
  const { writes } = planAutoTierPrices({
    product: product(300000),
    previousProduct: product(300000),
    savedRows: rowsOf([['30-ml', 'member', 270000], ['30-ml', 'overseas', 1050000]]),
  });
  assert.deepEqual(writes, [], 'a save that does not move the price writes nothing');
}

// --- 6. Without a previous product, an existing price is left alone ------------------------------------------
// No previous retail price means no way to tell "this rule wrote it" from "Dekito wrote it". The safe
// reading is the second one: never overwrite what you cannot prove you produced.
{
  const { writes, kept } = planAutoTierPrices({
    product: product(400000),
    savedRows: rowsOf([['30-ml', 'member', 270000]]),
  });
  assert.deepEqual(kept, [{ variantId: '30-ml', tier: 'member', priceNumber: 270000 }]);
  assert.deepEqual(writes, [{ variantId: '30-ml', tier: 'overseas', priceNumber: 1400000 }],
    'the tier that had no row at all is still filled');
}

// --- 6b. A size added in this same save is never treated as automatic ------------------------------------
// It has no previous retail price, so nothing proves this rule produced whatever is saved against it.
{
  const before = { id: 'p1', variants: [{ id: '30-ml', priceNumber: 300000 }] };
  const after = { id: 'p1', variants: [{ id: '30-ml', priceNumber: 300000 }, { id: '50-ml', priceNumber: 500000 }] };
  const { writes, kept } = planAutoTierPrices({
    product: after,
    previousProduct: before,
    savedRows: rowsOf([['30-ml', 'member', 270000], ['30-ml', 'overseas', 1050000],
      ['50-ml', 'member', 400000], ['50-ml', 'overseas', 1750000]]),
  });
  assert.deepEqual(writes, [], 'the new size keeps whatever is saved against it');
  assert.deepEqual(kept.map((k) => k.variantId), ['50-ml', '50-ml'],
    'and says so, rather than silently overwriting a price it cannot prove it wrote');
}

// --- 7. Keyed by variant, never shared -----------------------------------------------------------------------
{
  const twoSizes = {
    id: 'p1',
    variants: [{ id: '10-ml', priceNumber: 150000 }, { id: '30-ml', priceNumber: 300000 }],
  };
  const { writes } = planAutoTierPrices({ product: twoSizes });
  assert.deepEqual(writes.filter((w) => w.tier === 'member'), [
    { variantId: '10-ml', tier: 'member', priceNumber: 135000 },
    { variantId: '30-ml', tier: 'member', priceNumber: 270000 },
  ], 'each size gets its own price — one price shared across sizes is the bug the tier table is keyed to avoid');
}
assert.deepEqual(retailByVariant({ priceNumber: 200000, variants: [] }), { '': 200000 },
  'a product with no variants keys on the empty variant, as the tier table does');
assert.deepEqual(retailByVariant({ variants: [{ id: 'a', priceNumber: 0 }] }), {},
  'a variant with no price suggests nothing');
assert.deepEqual(retailByVariant(null), {}, 'no product, no crash');
assert.deepEqual(savedTierIndex(null), {});
assert.deepEqual(savedTierIndex([{ variant_id: null, tier: 'member', price_number: '5' }]), { '|member': 5 },
  'a null variant_id is the empty-variant key, matching the table default');

// --- 8. Never writes zero -------------------------------------------------------------------------------------
// saveTierPrice DELETES a row when handed 0 or less. An automation that deletes a price is not what
// "otomatis 10%" means.
{
  const { writes } = planAutoTierPrices({ product: product(500) });
  assert.deepEqual(writes.filter((w) => w.tier === 'member'), [],
    'too small to discount: skipped, not zeroed');
  for (const write of writes) assert.ok(write.priceNumber > 0, 'no write is ever zero or negative');
}

// --- 9. The message: silent when ordinary, never silent when it failed -------------------------------------------
assert.equal(autoTierPriceMessage(null), null);
assert.equal(autoTierPriceMessage({ written: 0, kept: 0, failures: [], schemaReady: true }), null,
  'nothing changed, nothing said');
assert.equal(autoTierPriceMessage({ written: 2, kept: 0, failures: [], schemaReady: true }).level, 'success');
assert.match(autoTierPriceMessage({ written: 2, kept: 1, failures: [], schemaReady: true }).text,
  /1 harga yang kamu set sendiri dibiarkan/, 'and says what it deliberately did not touch');
{
  const failed = autoTierPriceMessage({ written: 0, kept: 0, failures: ['member: ditolak'], schemaReady: true });
  assert.equal(failed.level, 'error');
  assert.match(failed.text, /Produk tersimpan/, 'the product DID save — saying otherwise sends the admin to fix the wrong thing');
  assert.match(failed.text, /ditolak/, 'and the real reason is passed through, not replaced by "gagal"');
}
assert.match(autoTierPriceMessage({ written: 0, kept: 0, failures: [], schemaReady: false }).text,
  /TIDAK terisi/, 'a missing tier table is a loud failure, not a quiet no-op');

// --- 10. Wired into the one save every screen goes through ---------------------------------------------------------
const service = read('services', 'productCatalogService.js');
assert.match(service, /const savedProduct = fromDatabaseRow\(data\);[\s\S]{0,700}?await applyAutoTierPrices\(\{/,
  'the tier prices are written AFTER the product — a tier price for a product that failed to save is attached to nothing');
assert.match(service, /previousProduct: editableProducts\.find\(\(candidate\) => candidate\.id === savedProduct\.id\) \|\| null/,
  'the PREVIOUS retail price is what tells a hand-set price from an automatic one');
// Never throws: the product is already saved, so a thrown error would report the wrong failure.
assert.match(service, /const applyAutoTierPrices[\s\S]{0,1600}?\} catch \(error\) \{\s*return \{ written: 0/,
  'a tier-price failure is reported, not thrown');

// Four screens call saveCustomProduct — two product forms and two batch pages. The rule lives in the
// service so it cannot hold in three of them.
const callers = ['pages/BatchProductionPage.jsx', 'pages/mobile/MobileBatchesPage.jsx',
  'components/product/ProductForm.jsx', 'components/product/MobileProductForm.jsx'];
for (const caller of callers) {
  const source = read(...caller.split('/'));
  assert.match(source, /saveCustomProduct\(/, `${caller} still saves through the one service`);
  assert.doesNotMatch(source, /planAutoTierPrices|AUTO_TIER_RULES/,
    `${caller} must not carry its own copy of the rule`);
}

// Both product forms report the outcome, through the same message builder.
for (const form of ['components/product/ProductForm.jsx', 'components/product/MobileProductForm.jsx']) {
  const source = read(...form.split('/'));
  assert.match(source, /const tierMessage = autoTierPriceMessage\(saved\.autoTierPrices\);/,
    `${form} reads the outcome`);
  assert.match(source, /if \(tierMessage\) toast\[tierMessage\.level\]\(tierMessage\.text\);/,
    `${form} puts it in front of the one person who can fix it`);
}

console.log('autoTierPrices selfcheck OK (member at 10% and export at 3,5x follow the retail price; a hand-set price never does, and a failure is never silent)');
