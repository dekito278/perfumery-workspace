// Runnable check for duplicate-merge stock arithmetic. `node src/utils/mergeStock.selfcheck.mjs`.
// The duplicate row is deleted right after the merge, so anything not carried over is gone for good.
import assert from 'node:assert/strict';
import { buildMergedRawMaterialData } from '../services/rawMaterialsMergeHelpers.js';

const master = { id: 'a', name: 'Iso E Super', stock_quantity: 120, minimum_stock: 50, cost_per_unit: 500, unit: 'g' };
const dup = { id: 'b', name: 'Iso E super', stock_quantity: 80, minimum_stock: 20, cost_per_unit: 450, unit: 'g' };

const merged = buildMergedRawMaterialData(master, dup);
assert.equal(merged.stock_quantity, 200, 'both shelves must survive the merge');
assert.equal(merged.minimum_stock, 50, 'keep the stricter reorder point');
assert.equal(merged.cost_per_unit, 500, "master's cost wins when it has one");

// Master with no cost inherits the duplicate's
assert.equal(buildMergedRawMaterialData({ ...master, cost_per_unit: 0 }, dup).cost_per_unit, 450);
// Missing/absent stock is treated as zero, never NaN
assert.equal(buildMergedRawMaterialData({ id: 'a' }, { id: 'b', stock_quantity: 30 }).stock_quantity, 30);
assert.equal(buildMergedRawMaterialData({ id: 'a' }, { id: 'b' }).stock_quantity, 0);

console.log('mergeStock selfcheck OK');
