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
import { readFileSync } from 'node:fs';
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

console.log(`batchLoadParity selfcheck OK (${PAGES.length} copies, ${RESTORED_COLUMNS.length} columns restored in each)`);
