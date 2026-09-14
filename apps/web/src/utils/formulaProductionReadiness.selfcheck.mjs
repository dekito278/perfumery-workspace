// `node src/utils/formulaProductionReadiness.selfcheck.mjs`
//
// Every costing path here is grams x (cost_per_unit || 0). A material with no purchase price contributes
// exactly Rp 0 and says nothing about it, so the concentrate cost, the cost per ml, the dilution cost and
// every retail scenario built on top come out TOO LOW — in the direction that loses money, silently, on
// the screen products are priced from.
//
// The check has to hold two ways round, and the second is the one that matters most:
//   * a blind cost must be announced, with how much weight it is blind to
//   * a complete formula must stay SILENT. A banner that is always up is furniture, and furniture is
//     read by nobody — which is the same as having no warning at all.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildFormulaProductionReadiness } from './formulaProductionReadiness.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => stripComments(readFileSync(join(srcRoot, ...parts), 'utf8'));

const priced = (name, grams, price) => ({ item_id: `id-${name}`, name, gram_amount: grams, unit_price: price });

// --- 1. A fully priced formula says nothing ----------------------------------------------------------
const healthy = buildFormulaProductionReadiness([priced('Iso E Super', 55, 12000), priced('Ambroxan', 45, 90000)]);
assert.equal(healthy.isReady, true, 'a formula whose materials all have a price must raise nothing');
assert.deepEqual(healthy.issues, [], 'no issues means no list');
assert.equal(healthy.unpricedCount, 0);
assert.equal(healthy.unpricedShare, 0, 'nothing is unaccounted for');
assert.equal(healthy.totalGrams, 100);

// --- 2. An unpriced material is named, and so is how much weight it hides ------------------------------
const blind = buildFormulaProductionReadiness([priced('Iso E Super', 55, 12000), priced('Ambroxan', 45, 0)]);
assert.equal(blind.isReady, false, 'a material with no price makes the cost below it wrong');
assert.equal(blind.unpricedCount, 1);
assert.equal(blind.unpricedGrams, 45);
assert.equal(blind.unpricedShare, 0.45, 'the share of weight the cost is blind to is the honest headline');
assert.match(blind.primaryIssue, /Ambroxan/, 'the issue must name the material, not a row number');
assert.match(blind.primaryIssue, /Rp 0/, 'and must say what the missing price actually does to the number');

// A price of exactly 0 and a missing price are the same failure — `cost_per_unit || 0` cannot tell them
// apart downstream, so neither may pass.
for (const emptyPrice of [0, null, undefined, '', 'abc', -5]) {
  const row = { item_id: 'x', name: 'Hedione', gram_amount: 10, unit_price: emptyPrice };
  assert.equal(buildFormulaProductionReadiness([row]).unpricedCount, 1,
    `unit_price ${JSON.stringify(emptyPrice)} costs Rp 0 downstream and must be reported`);
}

// --- 3. A deleted material is the same failure wearing a different hat ---------------------------------
// resolveFormulaItemReference renders an unresolvable row as "Unknown" and prices it at zero, so its
// weight is missing from the total exactly like an unpriced one.
const dangling = buildFormulaProductionReadiness([priced('Iso E Super', 70, 12000), { item_id: 'gone', name: 'Unknown', gram_amount: 30, unit_price: 0 }]);
assert.equal(dangling.unpricedCount, 1, 'a row whose material no longer exists is also unaccounted weight');
assert.equal(dangling.unpricedShare, 0.3);
assert.match(dangling.issues[0], /daftar bahan/, 'and must be reported as a missing material, not a missing price');
assert.doesNotMatch(dangling.issues[0], /Unknown/, '"Unknown" is a placeholder, not a name to show the owner');

// A row with no item_id at all is the same thing.
assert.equal(buildFormulaProductionReadiness([{ name: 'Sesuatu', gram_amount: 5 }]).unpricedCount, 1,
  'a row with no material reference cannot be costed either');

// --- 4. Degenerate formulas ---------------------------------------------------------------------------
assert.equal(buildFormulaProductionReadiness([]).isReady, false, 'an empty formula is not costable');
assert.match(buildFormulaProductionReadiness([]).primaryIssue, /belum punya baris/);
assert.equal(buildFormulaProductionReadiness([]).unpricedShare, 0, 'no weight means no share, not a divide by zero');
assert.equal(Number.isFinite(buildFormulaProductionReadiness([priced('A', 0, 0)]).unpricedShare), true,
  'a formula weighing nothing must not produce NaN or Infinity');

const zeroGram = buildFormulaProductionReadiness([priced('Iso E Super', 0, 12000)]);
assert.equal(zeroGram.isReady, false, 'a row weighing nothing is a problem worth naming');
assert.ok(zeroGram.issues.some((issue) => /gramnya masih 0/.test(issue)), 'and must be named as a gram problem');

assert.equal(buildFormulaProductionReadiness().isReady, false, 'called with nothing at all, still no crash');
assert.equal(buildFormulaProductionReadiness(null).issueCount, 1, 'null is an empty formula, not an exception');

// --- 5. Computed once, in the hook every costing screen reads ------------------------------------------
const hook = read('hooks', 'useProductionCostPage.js');
assert.match(hook, /readiness: buildFormulaProductionReadiness\(enrichedItems\)/,
  'the readiness must ride on formulaProfile, so all three costing screens get the same answer');

// --- 6. Every screen that shows a cost from that profile must show the notice --------------------------
// Three screens read the same profile, and this repo's most common defect by far is a fix that lands on
// one copy only. A screen that shows the wrong number without the warning is the whole bug, unfixed.
for (const page of [
  'pages/BatchProductionPage.jsx',
  'pages/mobile/MobileProductionCostingPage.jsx',
  'pages/mobile/MobileBatchesPage.jsx',
]) {
  const source = read(...page.split('/'));
  assert.match(source, /<FormulaCostBlindSpotNotice readiness=\{formulaProfile\?\.readiness\}/,
    `${page} presents a cost built from formulaProfile and must say when that cost is blind`);
}

// --- 7. The notice must render nothing when there is nothing to say ------------------------------------
const notice = read('components', 'FormulaCostBlindSpotNotice.jsx');
assert.match(notice, /readiness\.isReady[\s\S]{0,80}?return null;/,
  'a healthy formula must render no banner at all — a permanent banner is furniture nobody reads');

console.log('formulaProductionReadiness selfcheck OK (a blind cost is announced; a complete one stays quiet)');
