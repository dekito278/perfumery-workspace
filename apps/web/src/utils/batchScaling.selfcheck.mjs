// Runnable check for batch concentrate scaling. `node src/utils/batchScaling.selfcheck.mjs`.
// The weighing sheet has to agree with what deduct_batch_material_stock actually consumes, or the
// perfumer weighs one thing and the ledger records another.
import assert from 'node:assert/strict';

// Mirrors BatchProductionPage / MobileBatchesPage after the fix.
const scaleRows = (items, targetValue, formulaRatio) => {
  const totalFormulaGrams = items.reduce((sum, i) => sum + i.grams, 0);
  const concentrateBaseGrams = targetValue * formulaRatio;
  return items.map((i) => {
    const percentage = (i.grams / totalFormulaGrams) * 100;
    return { name: i.name, batchGram: (concentrateBaseGrams * percentage) / 100 };
  });
};

// What the DB does: formula_quantity_needed * grams / formula_total, where
// formula_quantity_needed = targetValue * formulaRatio (BatchProductionPage saves formulaMl).
const dbUsage = (items, targetValue, formulaRatio) => {
  const total = items.reduce((sum, i) => sum + i.grams, 0);
  const formulaQuantityNeeded = targetValue * formulaRatio;
  return items.map((i) => ({ name: i.name, usage: (formulaQuantityNeeded * i.grams) / total }));
};

const formula = [
  { name: 'Iso E Super', grams: 20 },
  { name: 'Vetiver', grams: 30 },
  { name: 'Bergamot', grams: 50 },
];

// The default bench case: 100 ml batch at 20% concentrate
const rows = scaleRows(formula, 100, 0.2);
const usage = dbUsage(formula, 100, 0.2);

// The sheet totals the concentrate, not the finished batch
assert.equal(rows.reduce((s, r) => s + r.batchGram, 0), 20);
// ...and every line matches what the RPC will deduct
rows.forEach((r, i) => assert.equal(r.batchGram, usage[i].usage, `${r.name} sheet vs ledger`));
assert.deepEqual(rows.map((r) => r.batchGram), [4, 6, 10]);

// A neat batch (100% concentrate) is unchanged by the fix
const neat = scaleRows(formula, 100, 1);
assert.deepEqual(neat.map((r) => r.batchGram), [20, 30, 50]);
neat.forEach((r, i) => assert.equal(r.batchGram, dbUsage(formula, 100, 1)[i].usage));

// Cost per unit of concentrate is unaffected: scaling rows and the divisor by the same factor cancels
const unitPrices = { 'Iso E Super': 500, Vetiver: 900, Bergamot: 300 };
const costPer = (target, ratio) => {
  const r = scaleRows(formula, target, ratio);
  const cost = r.reduce((s, x) => s + x.batchGram * unitPrices[x.name], 0);
  return cost / (target * ratio);
};
assert.equal(costPer(100, 0.2).toFixed(6), costPer(100, 1).toFixed(6));
assert.equal(costPer(100, 0.2).toFixed(6), costPer(500, 0.2).toFixed(6));

console.log('batchScaling selfcheck OK');
