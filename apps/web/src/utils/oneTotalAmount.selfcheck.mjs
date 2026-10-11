// `node src/utils/oneTotalAmount.selfcheck.mjs`
//
// calculateTotalAmount existed TWICE, under one name, with two different return SHAPES:
//
//   utils/calculateTotalAmount.js    sync, returns a NUMBER of grams. Eight files use it, including the
//                                   composer, both formula pages and the formula list.
//   utils/formulaCalculations.js     async, returned { totalGrams, totalActive, totalSolvent, breakdown }.
//                                   Zero importers.
//
// The second one was a trap rather than merely dead. The composer takes the function as an argument:
//
//   const totalGrams = useMemo(() => calculateTotalAmount(activeFormulaItems), [...]);
//   const percentages = totalGrams > 0 ? calculatePercentages(activeFormulaItems, totalGrams) : [];
//
// and it ALREADY imports calculatePercentages from formulaCalculations.js. So adding
// calculateTotalAmount to that same import — the natural move — would have handed the composer a
// Promise. `Promise > 0` is false, so every percentage would silently become [], with no error and no
// warning: a perfumer composing a formula would see no percentages at all and nothing would say why.
//
// Deleted, along with calculateFormulaCost and calculateEffectiveUnitCost (0 importers each) and the two
// imports only they needed — which also takes a services dependency out of a pure-arithmetic module.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { calculateTotalAmount } from './calculateTotalAmount.js';
import { calculatePercentages, calculateTotalGrams } from './formulaCalculations.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry) && !entry.includes('.selfcheck.')) files.push(full);
  }
};
walk(root);
assert.ok(files.length > 100, `only ${files.length} files scanned — the walk is broken, not the code`);

// ── 1. One definition, one shape ─────────────────────────────────────────────────────────────────
const definitions = files.filter((file) => /^export const calculateTotalAmount\b/m.test(stripComments(readFileSync(file, 'utf8'))))
  .map((file) => file.replace(`${root}/`, ''));
assert.deepEqual(definitions, ['utils/calculateTotalAmount.js'],
  `calculateTotalAmount is defined in ${definitions.length} places (${definitions.join(', ')}). One name, `
  + 'two shapes is how the composer gets handed a Promise and shows no percentages at all');

// It returns a NUMBER, and it must stay sync: the composer compares it with > 0 inside a useMemo.
assert.equal(typeof calculateTotalAmount([{ gram_amount: '2.5' }, { gram_amount: '7.5' }]), 'number');
assert.equal(calculateTotalAmount([{ gram_amount: '2.5' }, { gram_amount: '7.5' }]), 10);
assert.equal(calculateTotalAmount([]), 0, 'no items is zero grams, not NaN');
assert.equal(calculateTotalAmount(null), 0);
assert.equal(calculateTotalAmount(undefined), 0);
assert.ok(!(calculateTotalAmount([{ gram_amount: '1' }]) instanceof Promise),
  'it must not become async: `Promise > 0` is false, which empties every percentage silently');
// Both field spellings, because the composer holds gram_amount while the database column is grams.
assert.equal(calculateTotalAmount([{ grams: 4 }, { gram_amount: 6 }]), 10,
  'it must read the database spelling too — an edited formula arrives with `grams`');

// ── 2. The trap it would have sprung ─────────────────────────────────────────────────────────────
// Demonstrated rather than described: this is what the composer did with a Promise.
const asPromise = Promise.resolve(10);
assert.equal(asPromise > 0, false, 'a Promise is not greater than zero');
assert.deepEqual(calculatePercentages([{ gram_amount: '10' }], asPromise > 0 ? asPromise : 0), [],
  'so the percentages come back empty, with nothing to show the perfumer why');
// And with the real number they are not empty, and they sum to exactly 100.
const percentages = calculatePercentages([{ gram_amount: '1' }, { gram_amount: '2' }], 3);
assert.equal(percentages.length, 2);
assert.equal(percentages.reduce((sum, row) => sum + Number(row.percentage), 0), 100,
  'largest-remainder rounding must still land on exactly 100.0');

// ── 3. The three deleted exports stay deleted ────────────────────────────────────────────────────
const DELETED = {
  calculateTotalAmount: 'the async twin that would have emptied every percentage',
  calculateFormulaCost: 'async, 0 importers',
  calculateEffectiveUnitCost: '0 importers',
};
const calculations = readFileSync(join(root, 'utils', 'formulaCalculations.js'), 'utf8');
for (const [name, why] of Object.entries(DELETED)) {
  assert.ok(
    !new RegExp(`export const ${name}\\b`).test(calculations),
    `${name} is back in formulaCalculations.js — it was deleted because ${why}`,
  );
}
// What stays, stays: the three the app actually imports.
for (const name of ['calculateTotalGrams', 'calculatePercentages', 'validateFormulaItems']) {
  assert.match(calculations, new RegExp(`export const ${name}\\b`), `${name} is still used and must not be deleted`);
}
assert.equal(calculateTotalGrams([{ gram_amount: '3' }, { gram_amount: '4' }]), 7);

// And the module stays pure arithmetic: the only imports the deleted functions needed were a service
// and a cost helper, so nothing in it should reach the service layer any more.
assert.ok(
  !/from '@\/services\//.test(calculations),
  'formulaCalculations.js is reaching into the service layer again — it is arithmetic over rows it is given',
);

console.log(`oneTotalAmount: ok — one definition, returning a number, and ${Object.keys(DELETED).length} dead exports staying dead`);
