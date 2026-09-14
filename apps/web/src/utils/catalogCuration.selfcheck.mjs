// `node src/utils/catalogCuration.selfcheck.mjs`
//
// Member prices and the featured flag both already existed — inside the product form, one product at a
// time. Both went unused: 17 of 18 products still had no member price weeks after the storefront was
// built to display them, and all 18 carried the featured flag, so "Fragrance pilihan" was not a choice.
// This is the bulk screen's arithmetic and its save rules.
//
// It writes MONEY, so every rule here is run rather than read.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DEFAULT_MEMBER_DISCOUNT_PERCENT,
  DEFAULT_OVERSEAS_MULTIPLIER,
  buildCurationRows,
  collectCurationChanges,
  memberPriceFromRetail,
  memberSaving,
  overseasPriceFromRetail,
} from './memberPriceFill.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. The arithmetic, on the shop's real prices --------------------------------------------------------
assert.equal(DEFAULT_MEMBER_DISCOUNT_PERCENT, 10, "Dekito's decision, 2026-09-15");
assert.equal(memberPriceFromRetail(329000), 296000, 'lintang-asmoro at 10% lands on a price you can print');
assert.equal(memberPriceFromRetail(289000), 260000);
assert.equal(memberPriceFromRetail(750000), 675000, 'already round stays exactly round');
assert.equal(memberPriceFromRetail(129000), 116000);

// Rounding is DOWN, always: it may only ever favour the buyer. Charging a member more than the stated cut
// would be a broken promise; charging slightly less is a rounding choice.
for (const retail of [329000, 289000, 750000, 129000, 297000, 5000, 1001]) {
  const member = memberPriceFromRetail(retail);
  if (member === null) continue;
  const exact = retail * 0.9;
  assert.ok(member <= exact, `${retail}: rounding must never land above the exact discount`);
  assert.ok(exact - member < 1000, `${retail}: and never lose more than a thousand to rounding`);
  assert.ok(member < retail, `${retail}: a member price must actually be below retail`);
  assert.equal(member % 1000, 0, `${retail}: prices land on whole thousands`);
}

// --- 2. Null means "leave it alone", never "delete it" ----------------------------------------------------
// saveTierPrice DELETES the row when given 0 or less. A fill button that returns 0 for an odd product
// would quietly wipe a price the owner set by hand.
for (const bad of [0, -1, null, undefined, '', 'abc', NaN]) {
  assert.equal(memberPriceFromRetail(bad), null, `retail ${JSON.stringify(bad)} suggests nothing`);
}
for (const bad of [0, -5, 91, 100, 'x', null]) {
  assert.equal(memberPriceFromRetail(329000, bad), null, `a ${JSON.stringify(bad)}% cut is not a suggestion`);
}
assert.equal(memberPriceFromRetail(900), null, 'below a thousand, flooring would land on zero — which deletes');
assert.equal(memberPriceFromRetail(329000, 90), 32000, 'the far edge of the allowed range still works');

// --- 3. Saving -------------------------------------------------------------------------------------------
assert.equal(memberSaving(329000, 296000), 33000);
assert.equal(memberSaving(329000, 329000), 0, 'the same price saves nothing');
assert.equal(memberSaving(329000, 400000), 0, 'a higher "member" price saves nothing, and must not read as negative');
assert.equal(memberSaving(0, 100), 0);

// --- 3b. The overseas price is a MARKUP, and rounds the other way ------------------------------------------
// The member price rounds down so it can only favour the buyer. An export price rounds UP: rounding it
// down eats the margin that covers customs and handling, on the order that is most expensive to get
// wrong. Two rules pulling in opposite directions in one file is exactly the pair that gets swapped by
// a careless edit, so both directions are run here.
assert.equal(DEFAULT_OVERSEAS_MULTIPLIER, 3.5, "Dekito's decision, 2026-09-15: a flat 3,5x for every product");
assert.equal(overseasPriceFromRetail(750000), 2630000, 'maskumambang at 3,5x');
assert.equal(overseasPriceFromRetail(289000), 1020000);
assert.equal(overseasPriceFromRetail(200000, 2), 400000, 'an already-round result stays exactly round');

for (const retail of [550000, 289000, 329000, 251000, 267000, 1400000]) {
  const overseas = overseasPriceFromRetail(retail);
  const exact = retail * DEFAULT_OVERSEAS_MULTIPLIER;
  assert.ok(overseas >= exact, `${retail}: rounding must never land BELOW the exact markup`);
  assert.ok(overseas - exact < 10000, `${retail}: and never add more than ten thousand`);
  // Holds for every allowed multiplier, not just the default — which is why the function needs no
  // explicit check for it.
  assert.ok(overseas > retail, `${retail}: an export price at or below retail undercuts the domestic shop`);
  for (const factor of [1.01, 1.5, 2, 3.75, 10]) {
    assert.ok(overseasPriceFromRetail(retail, factor) > retail, `${retail} x ${factor}: still above retail`);
  }
  assert.equal(overseas % 10000, 0, `${retail}: export prices land on whole ten-thousands`);
}

// Same null contract as the member price: null means "leave this row alone", never zero — zero deletes.
for (const bad of [0, -1, null, undefined, '', 'abc', NaN]) {
  assert.equal(overseasPriceFromRetail(bad), null, `retail ${JSON.stringify(bad)} suggests nothing`);
}
for (const bad of [0, 1, 0.5, -2, 10.1, 'x', null]) {
  assert.equal(overseasPriceFromRetail(550000, bad), null, `a ${JSON.stringify(bad)}x multiplier is not a suggestion`);
}
assert.equal(overseasPriceFromRetail(550000, 10), 5500000, 'the far edge of the allowed range still works');

// --- 4. Rows are keyed by variant, not by slug ------------------------------------------------------------
const products = [
  { id: 'p1', slug: 'lintang', name: 'Lintang', featured: true, priceNumber: 329000, variants: [{ id: '30-ml', size: '30 ml', priceNumber: 329000 }] },
  { id: 'p2', slug: 'dua', name: 'Dua', featured: false, priceNumber: 200000, variants: [{ id: 'a', size: '10 ml', priceNumber: 120000 }, { id: 'b', size: '30 ml', priceNumber: 200000 }] },
  { id: 'p3', slug: 'tanpa-varian', name: 'Tanpa varian', featured: false, priceNumber: 150000, variants: [] },
];
const rows = buildCurationRows(products, { 'p1|30-ml': 296000 }, { 'p1|30-ml': 1380000 });
assert.equal(rows.length, 4, 'one row per variant, and one for a product that has none');
assert.equal(rows[0].savedMember, 296000, 'an existing member price shows up against its own variant');
assert.equal(rows[1].savedMember, null, 'and does not leak onto another product');
assert.equal(rows[0].savedOverseas, 1380000, 'the export price rides on the same row as its member price');
assert.equal(rows[1].savedOverseas, null, 'and does not leak either');
// The two indexes must never be read from each other: a member column showing Rp 1.380.000 would be a
// price rise the buyer is invited to sign in for.
const swapped = buildCurationRows(products, { 'p1|30-ml': 1380000 }, { 'p1|30-ml': 296000 });
assert.equal(swapped[0].savedMember, 1380000, 'each index fills its own column and only its own');
assert.equal(swapped[0].savedOverseas, 296000);
assert.deepEqual(rows.map((r) => r.retail), [329000, 120000, 200000, 150000], 'each variant carries its own retail price');
assert.equal(rows[2].featured, false);
assert.equal(rows[3].variantId, '', 'a product with no variants keys on the empty variant, as the tier table does');
assert.deepEqual(buildCurationRows(null, {}), [], 'no products, no rows, no crash');
assert.equal(buildCurationRows(products, {})[0].savedOverseas, null, 'the third argument is optional');
assert.deepEqual(buildCurationRows([{ slug: 'no-id' }], {}), [], 'a row with no product id cannot be saved against anything');

// --- 5. Only what changed is written ----------------------------------------------------------------------
assert.deepEqual(collectCurationChanges(rows, {}), { priceChanges: [], featuredChanges: [] },
  'an untouched table writes nothing at all');
const unchanged = collectCurationChanges(rows, { 'p1|30-ml': { member: 296000, featured: true } });
assert.deepEqual(unchanged.priceChanges, [], 'typing the value that is already saved is not a change');
assert.deepEqual(unchanged.featuredChanges, [], 'nor is ticking a box that was already ticked');

const changed = collectCurationChanges(rows, { 'p1|30-ml': { member: 290000 }, 'p2|a': { featured: true } });
assert.equal(changed.priceChanges.length, 1);
assert.equal(changed.priceChanges[0].priceNumber, 290000);
assert.equal(changed.priceChanges[0].variantId, '30-ml', 'the write is aimed at the variant the row belongs to');
assert.equal(changed.priceChanges[0].tier, 'member', 'and carries the tier it belongs to — the save loop writes whatever this says');
assert.equal(changed.featuredChanges.length, 1);
assert.equal(changed.featuredChanges[0].productId, 'p2');

// Clearing a price is a real change, and reaches the service as null so it deletes the tier row.
const cleared = collectCurationChanges(rows, { 'p1|30-ml': { member: '' } });
assert.equal(cleared.priceChanges.length, 1);
assert.equal(cleared.priceChanges[0].priceNumber, null, 'an emptied field clears the member price');

// Both columns in one draft: each must reach the service under its OWN tier. Without the tier travelling
// with the change, one save loop writing a hardcoded 'member' would file an export price as a member
// discount — a Rp 1.380.000 "member price" on a Rp 550.000 bottle.
const bothTiers = collectCurationChanges(rows, { 'p1|30-ml': { member: 290000, overseas: 1500000 } });
assert.equal(bothTiers.priceChanges.length, 2);
assert.deepEqual(
  bothTiers.priceChanges.map((c) => [c.tier, c.priceNumber]).sort(),
  [['member', 290000], ['overseas', 1500000]],
  'each tier is written with its own number',
);
const overseasUnchanged = collectCurationChanges(rows, { 'p1|30-ml': { overseas: 1380000 } });
assert.deepEqual(overseasUnchanged.priceChanges, [], 'retyping the saved export price is not a change');
const overseasCleared = collectCurationChanges(rows, { 'p1|30-ml': { overseas: '' } });
assert.equal(overseasCleared.priceChanges[0].tier, 'overseas');
assert.equal(overseasCleared.priceChanges[0].priceNumber, null, 'an emptied export field clears that row, not the member one');

// Two variants of one product share a featured flag: queueing two writes lets them disagree.
const twoVariants = collectCurationChanges(rows, { 'p2|a': { featured: true }, 'p2|b': { featured: true } });
assert.equal(twoVariants.featuredChanges.length, 1, 'one product, one featured write');

// --- 6. The screen previews, and never saves behind the owner's back ---------------------------------------
const page = read('pages', 'CatalogCurationPage.jsx');
assert.match(page, /const fillAll = \(field\) => \{/, 'there is a fill button, and it is told which column to fill');
assert.match(page, /onClick=\{\(\) => fillAll\('member'\)\}/, 'one for member prices');
assert.match(page, /onClick=\{\(\) => fillAll\('overseas'\)\}/, 'and one for export prices');
assert.doesNotMatch(page, /const fillAll[\s\S]{0,900}?await save\(/, 'and it must not save — filling only drafts');
assert.match(page, /Belum tersimpan/, 'the fill result must say plainly that nothing is saved yet');
assert.match(page, /if \(draft\[row\.key\] && Object\.prototype\.hasOwnProperty\.call\(draft\[row\.key\], field\)\) \{ skipped \+= 1; continue; \}/,
  'a bulk fill must not overwrite a number the owner typed deliberately');
// The tier reaches the write from the change, never from a constant: hardcoding it here is precisely how
// an export price gets filed as a member discount.
assert.match(page, /saveTierPrice\(\{[^}]*tier: change\.tier/, 'the save writes each change under its own tier');
assert.doesNotMatch(page, /saveTierPrice\(\{[^}]*tier: '(member|overseas)'/, 'and never under a hardcoded one');
assert.match(page, /disabled=\{!changeCount \|\| saving\}/, 'Save is dead when nothing changed');
// BOTH save loops — prices and the featured flag. Requiring merely "one of them names the row" passed
// while the price loop had been reduced to a counter; a sabotage caught that, not I.
assert.equal((page.match(/failures\.push\(`\$\{change\.row\.name\}/g) || []).length, 2,
  'every failed row must be named, not counted — in both save loops');

// The gate, not the word. `schemaReady` also appears in useState and the destructure, so matching the
// identifier alone passed with the warning permanently switched off.
assert.match(page, /\{!schemaReady \? \(/, 'the missing-table warning must actually be gated on schemaReady');
assert.match(page, /\{!schemaReady \? \([\s\S]{0,600}?Tabel harga bertingkat belum ada/,
  'and that gate must be the one wrapping the warning, or prices are typed into nothing in silence');

// --- 7. The writes fail loudly when RLS refuses silently -----------------------------------------------------
const catalogService = read('services', 'productCatalogService.js');
assert.match(catalogService, /saveProductFeatured[\s\S]{0,700}?if \(!data\) \{/,
  'zero rows back from an update is an RLS refusal answering 200, not a saved change');
const tierService = read('services', 'tierPricingService.js');
// The bulk read is now shared by both columns, so the tier must be required and must reach the query.
// Dropping the filter would hand the member column the export prices.
assert.match(tierService, /listTierPriceIndex = async \(tier\)[\s\S]{0,300}?if \(!tier\) throw/, 'the bulk read refuses to run without a tier');
assert.match(tierService, /listTierPriceIndex[\s\S]{0,600}?\.eq\('tier', tier\)/, 'and filters to that tier in the query, not afterwards');
assert.match(tierService, /index\[`\$\{row\.product_id\}\|\$\{row\.variant_id \|\| ''\}`\]/,
  'keyed by product and variant, as the tier table is — a slug key would break the day a product is renamed');

// --- 8. Reachable ---------------------------------------------------------------------------------------------
assert.match(read('App.jsx'), /<Route path="\/studio\/products\/curation" element=\{\s*<ProtectedRoute>/, 'routed, behind the admin gate');
assert.match(read('pages', 'ProductListPage.jsx'), /navigate\('\/studio\/products\/curation'\)/, 'and reachable from the product list');

// The export column is only worth filling if something shows it. Guarded here so removing the storefront
// panel cannot quietly turn this screen into data entry for nothing.
assert.match(page, /Harga luar negeri/, 'the screen says what the export column is for');

console.log('catalogCuration selfcheck OK (bulk member + export prices that preview first, round in opposite directions on purpose, and write only what moved under its own tier)');
