// `node src/utils/pricingUtils.selfcheck.mjs`
//
// Two buttons on FormulaDetailPage export the same formula's PDF: ExportFormulaButton, and the page's own
// action through useFormulaDetailPage. They computed the money two different ways --
//
//   ExportFormulaButton:   items.reduce((sum, item) => sum + Number(item.ingredient_cost || 0), 0)
//   useFormulaDetailPage:  calculateTotalCost(items)
//
// -- and `calculateTotalCost` has a branch for diluted rows that the per-row ingredient_cost does not.
// 126 of the studio's 680 formula rows are diluted, so that branch is live on real formulas.
//
// They agreed anyway, and the reason is a coincidence worth pinning: calculateDilutionCost's cost is
// amount x (price / 10), calculateIngredientCost's is (amount / 10) x price, and
// DEFAULT_PRICE_BASE_QUANTITY is 10. The dilution PERCENTAGE never reaches the cost at all -- it only
// splits the amount into active and solvent for display.
//
// So nothing was wrong, and nothing was holding it right either. Both buttons now call the same two
// helpers, and the coincidence is asserted here: the moment the dilution percentage starts changing a
// cost, this fails and names the two call sites that would silently disagree.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { calculateDilutionCost } from './calculateDilutionCost.js';
import { calculateIngredientCost, calculateTotalCost } from './pricingUtils.js';
import { calculateTotalAmount } from './calculateTotalAmount.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

// --- 1. The two cost routes are the same arithmetic ---------------------------------------------------
// Checked across a spread of amounts, prices and dilutions rather than one happy pair.
for (const amount of [0.02, 1, 7.5, 250]) {
  for (const price of [0, 1500, 48250]) {
    for (const percent of [1, 5, 10, 20, 50, 100]) {
      const plain = calculateIngredientCost(amount, price);
      const diluted = calculateDilutionCost(amount, price, percent).totalCost;
      assert.ok(
        Math.abs(plain - diluted) < 1e-6,
        `a ${amount} g row at ${price} per 10 costs ${plain} undiluted and ${diluted} at ${percent}% — the `
        + 'two routes must stay the same arithmetic, or the two export buttons on FormulaDetailPage print '
        + 'different money for one formula',
      );
    }
  }
}
// And the percentage is what must not reach the cost: same amount and price, every dilution, one cost.
const costs = new Set([1, 5, 10, 20, 50, 100].map((p) => calculateDilutionCost(10, 3000, p).totalCost));
assert.equal(costs.size, 1,
  `the dilution percentage changed the cost (${[...costs].join(', ')}). It only splits active from `
  + 'solvent; the price already belongs to the diluted mixture');
// The split itself still has to work, or the fixture above proves nothing about a real diluted row.
const split = calculateDilutionCost(10, 3000, 20);
assert.equal(split.activeAmount, 2, '20% of 10 g is 2 g of active material');
assert.equal(split.solventAmount, 8, 'and 8 g of solvent');

// --- 2. A whole formula totals the same either way ----------------------------------------------------
// The shape the detail page really builds: every row carries ingredient_cost, and some carry dilution.
const items = [
  { gram_amount: 4, unit_price: 48250, ingredient_cost: calculateIngredientCost(4, 48250) },
  { gram_amount: 0.21, unit_price: 1500, ingredient_cost: calculateIngredientCost(0.21, 1500), is_diluted: true, dilution_percentage: 10 },
  { grams: 1.5, unit_price: 9000, ingredient_cost: calculateIngredientCost(1.5, 9000), is_diluted: true, dilution_percentage: 50 },
  { gram_amount: 0, unit_price: 0, ingredient_cost: 0 },
];
const summedRows = items.reduce((sum, item) => sum + Number(item.ingredient_cost || 0), 0);
assert.ok(Math.abs(calculateTotalCost(items) - summedRows) < 1e-6,
  `calculateTotalCost says ${calculateTotalCost(items)} while its own rows sum to ${summedRows} — the PDF's `
  + 'TOTAL line would not match the rows above it');
// The fixture must contain a diluted row, or it says nothing about the branch under test.
assert.ok(items.some((item) => item.is_diluted && item.dilution_percentage),
  'this fixture has no diluted row, so it never enters the branch this guard exists for');
// Grams: the inline version this button used read gram_amount only; the helper falls back to `grams`.
assert.equal(calculateTotalAmount(items), 5.71, 'a row stored as `grams` still has to be weighed');
assert.equal(items.reduce((sum, item) => sum + (parseFloat(item.gram_amount) || 0), 0), 4.21,
  'which the old inline sum did not do — kept here as the reason the helper is the one to call');

// --- 3. Both export paths call the helpers, not their own arithmetic ----------------------------------
for (const [name, parts] of [
  ['ExportFormulaButton', ['components', 'ExportFormulaButton.jsx']],
  ['useFormulaDetailPage', ['hooks', 'useFormulaDetailPage.js']],
]) {
  const source = read(...parts);
  assert.match(source, /calculateTotalCost\(/, `${name} must take the formula cost from calculateTotalCost`);
  assert.match(source, /calculateTotalAmount\(/, `${name} must take the formula weight from calculateTotalAmount`);
  assert.ok(!/reduce\(\(sum, item\) => sum \+ Number\(item\.ingredient_cost/.test(source),
    `${name} is summing row costs by hand again — that is how one screen came to hold two answers`);
}

console.log('pricingUtils selfcheck OK (one cost and one weight for both export buttons, and the dilution '
  + 'percentage still never reaches a cost)');
