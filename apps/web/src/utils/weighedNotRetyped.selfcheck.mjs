// `node src/utils/weighedNotRetyped.selfcheck.mjs`
//
// itemWeight.js holds what a bottle actually weighs, shipped, measured by Dekito on 2026-09-13. Its own
// header says why it is import-free: the browser quotes a courier fee from this table and the order
// endpoint reprices the order from the same one, and a buyer shown one fee and charged another is the
// same class of bug as a price that moves at checkout.
//
// The export quote screen then printed the table underneath its weight box — typed out longhand. "Berat
// per ukuran: 10 ml 100 g, 30 ml 250 g, 50 ml 350 g, 100 ml 650 g." Right, on the day it was written.
// The sentence beside it about unweighed sizes was already read from the module, which is what makes
// this the interesting kind of copy: half of one line derived and half retyped, so it looked maintained.
//
// These numbers change. The table exists because every size used to be assumed 300 g, and it got fixed
// by weighing bottles — an act that can happen again. Put a fifth size in the table, or correct a gram
// figure, and the screen would go on reciting September's numbers while quoting from the new ones.
//
// The rule: a measured figure is shown from the table it was measured into, never restated beside it.
// The patterns below are BUILT from the table, so re-weighing a bottle moves what this guard forbids.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ITEM_WEIGHT_GRAM_BY_ML, itemWeightGram, DEFAULT_ITEM_WEIGHT_GRAM } from './itemWeight.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const root = join(src, '..');

// --- 1. The table is real and still the thing the quote uses --------------------------------------------
const entries = Object.entries(ITEM_WEIGHT_GRAM_BY_ML);
assert.ok(entries.length >= 3,
  `expected the weighed sizes, found ${entries.length} — if the table has been emptied, the sentence on `
  + 'the export screen has nothing to render and this guard has nothing to protect');
for (const [ml, gram] of entries) {
  assert.equal(itemWeightGram(`${ml} ml`), Number(gram),
    `the table says a ${ml} ml is ${gram} g but itemWeightGram disagrees — the screen renders the table `
    + 'and the courier is quoted from the function, so these two parting is a fee that does not match its '
    + 'own explanation');
}
assert.equal(itemWeightGram('7 ml'), DEFAULT_ITEM_WEIGHT_GRAM,
  'an unweighed size must fall back rather than be guessed at');

// --- 2. Nobody restates it ------------------------------------------------------------------------------
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.includes('.selfcheck.')) files.push(full);
  }
};
walk(join(root, 'src'));
walk(join(root, 'api'));

const offenders = [];
for (const file of files) {
  if (file.endsWith(join('utils', 'itemWeight.js'))) continue;
  // Comments included on purpose: a comment that recites the table is documentation that will be wrong,
  // and this screen's neighbouring comments do recite it — they are allowed to say what the table is
  // FOR, not what is in it.
  const text = readFileSync(file, 'utf8');
  for (const [ml, gram] of entries) {
    const pairing = new RegExp(`\\b${ml}\\s*ml\\b[^\\n]{0,16}?\\b${gram}\\s*g\\b`, 'i');
    if (pairing.test(text)) {
      offenders.push(`${file.slice(root.length + 1)} — "${ml} ml … ${gram} g"`);
    }
  }
}
assert.deepEqual(offenders, [],
  'a measured weight is written out beside the table instead of read from it. These numbers change: the '
  + 'table exists because every size used to be assumed 300 g until bottles were put on the scales, and '
  + `that can happen again. Render Object.entries(ITEM_WEIGHT_GRAM_BY_ML) instead:\n  ${offenders.join('\n  ')}`);

// --- 3. And the screen that used to restate it now renders the table -------------------------------------
const page = readFileSync(join(src, 'pages', 'ExportShippingCalculatorPage.jsx'), 'utf8');
assert.match(page, /Object\.entries\(ITEM_WEIGHT_GRAM_BY_ML\)/,
  'the export screen no longer builds its weight line from the table — check it has not simply dropped '
  + 'the line, which would pass section 2 by saying nothing at all');
assert.match(page, /Berat per ukuran: \{/,
  'the line must still be shown: it is what tells Dekito why a six-bottle parcel weighs what it does');

console.log(`weighedNotRetyped selfcheck OK (${entries.length} weighed sizes, shown from the table and `
  + 'restated nowhere)');
