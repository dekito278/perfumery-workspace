// `node src/utils/batchLoadParity.selfcheck.mjs`
//
// The batch page exists twice, desktop and mobile, and both load a formula's batch history into a form
// whose save path then writes back by id. Audit round 8 fixed two things on the desktop copy and neither
// reached the mobile one, where they stayed broken for a year:
//
//   1. no cancellation — switching formulas quickly let the earlier request resolve last, so savedBatch
//      pointed at another formula's batch. deductBatchMaterialStock() acts on that id.
//   2. no restore — the form kept its page defaults (target 'DEFAULT_TARGET_GRAMS', bottle '30'), while
//      buildBatchPayload spreads savedBatch and then overwrites those fields from the form. Opening a
//      formula therefore armed a save that rewrote the last batch's volume, ratio, bottle size, loss and
//      price with values nobody typed.
//
// Whatever one copy learns, the other has to know too.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(srcRoot, rel), 'utf8');

const PAGES = [
  ['pages/BatchProductionPage.jsx', 'desktop'],
  ['pages/mobile/MobileBatchesPage.jsx', 'mobile'],
];

// The batch columns the form owns. Loading a batch without reading these back means the next save
// silently replaces them.
const RESTORED_COLUMNS = [
  'target_quantity',
  'bottle_ml',
  'loss_percent',
  'solvent_id',
  'selling_price',
  'formula_percentage',
];

for (const [file, which] of PAGES) {
  const source = read(file);
  // Bound the slice at the effect's own dependency array — reading to the end of the file would let an
  // `if (cancelled) return;` belonging to some later effect satisfy the check for this one.
  const start = source.indexOf('const loadBatchHistory');
  const end = source.indexOf('}, [selectedFormulaId]);', start);
  assert.ok(start >= 0 && end > start, `${file} no longer has a loadBatchHistory effect; update this guard.`);
  const effect = source.slice(start, end);

  // The awaited fetch must be followed by the check, not merely accompanied by one somewhere.
  assert.match(effect, /await getBatches\([^)]*\);\s*\n\s*if \(cancelled\) return;/,
    `the ${which} batch load must drop an out-of-order response: savedBatch drives writes by id.`);
  assert.match(source, /cancelled = true;/,
    `the ${which} batch load must set the cancelled flag in its cleanup.`);

  for (const column of RESTORED_COLUMNS) {
    assert.match(effect, new RegExp(`latest\\.${column}`),
      `the ${which} batch load must read ${column} back into the form — buildBatchPayload writes that `
      + 'column from form state, so a batch opened but not restored is a batch about to be overwritten.');
  }
}

// --- Nobody may hand the stock flag back to the server ------------------------------------------------
// deduct_batch_material_stock owns is_stock_deducted: it sets the column itself and returns early while
// it is true, and that early return is the only thing stopping a reload from halving the raw materials.
// services/batchesService.js drops the field from its save payload on purpose, because a save built from
// stale React state once carried a false copy of it back and cleared it — the next save then deducted
// every raw material a second time (audit round 7).
//
// The desktop page went on passing `is_stock_deducted: true` into saveBatch anyway, under a comment
// saying it was persisting the flag. It was not: the payload drops it. Two redundant writes, and a
// comment that contradicted the one guarding the payload — which is how somebody eventually "fixes" the
// payload to honour the caller and brings the double deduction back. The phone never did this.
//
// Counted, not listed: the callers are whichever files call saveBatch.
const savers = [];
const handingItBack = [];
const walkSavers = (dir) => {
  for (const entry of readdirSync(join(srcRoot, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walkSavers(rel); continue; }
    if (!/\.jsx?$/.test(entry.name) || entry.name.includes('.selfcheck.')) continue;
    const source = readFileSync(join(srcRoot, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (!/\bsaveBatch\s*\(/.test(source)) continue;
    savers.push(rel);
    if (/saveBatch\(\{[^)]*is_stock_deducted/.test(source)) handingItBack.push(rel);
  }
};
for (const dir of ['pages', 'components']) walkSavers(dir);

assert.ok(savers.length >= 2, `only ${savers.length} screen(s) save a batch — the derivation broke`);
assert.deepEqual(handingItBack, [],
  'these screens send is_stock_deducted back to the server. The payload drops it today, so the write is '
  + 'silent — but it is the shape that cleared the flag once already, and the next deduct then ran twice '
  + `over the same raw materials:\n  ${handingItBack.join('\n  ')}`);

// And the other half of the pair: the payload must go on dropping it.
const batchesService = readFileSync(join(srcRoot, 'services', 'batchesService.js'), 'utf8');
const payload = batchesService.match(/const toBatchPayload[\s\S]*?\n\}\);|usable_quantity: batch\.usable_quantity[\s\S]*?\n\}\);/);
assert.ok(payload, 'the batch save payload could not be found — the derivation broke');
assert.doesNotMatch(payload[0], /is_stock_deducted/,
  'the save payload carries is_stock_deducted again; a stale copy of it clears the flag and the next '
  + 'save deducts every raw material a second time');

console.log(`batchLoadParity selfcheck OK (${PAGES.length} copies, ${RESTORED_COLUMNS.length} columns restored in each)`);
