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
//
// 6 Oct 2026 — the export screen no longer shows this table at all, and that is not the line being
// dropped. Dekito gave the packing: "botol saja sekitar 200g, tetapi ada box dan packing sehingga jika di
// buat untuk 1 box itu bisa muat 2 parfum dengan ukuran 1kg". An export parcel is billed by the BOX, so
// the gram table was the wrong measurement to put on that screen — right for a domestic parcel, and the
// reason the screen asked the carrier about 1,5 kg while the card beside it charged for 3 kg. Section 3
// follows the rule to where the measurement now lives rather than holding the old screen's spelling.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ITEM_WEIGHT_GRAM_BY_ML, itemWeightGram, DEFAULT_ITEM_WEIGHT_GRAM } from './itemWeight.js';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const root = join(src, '..');

// The packing rule's module reads the carrier's zone sheet through the '@/' alias, which node does not
// resolve: lifted with the alias rewritten to a file URL, so the REAL rule is what this guard holds.
const { EXPORT_BOX } = await import(`data:text/javascript;base64,${Buffer.from(
  readFileSync(join(src, 'data', 'internationalShippingRates.js'), 'utf8')
    .replace(/'@\//g, `'${pathToFileURL(src).href}/`), 'utf8').toString('base64')}`);

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

// --- 3. The export screen explains its weight from the rule that decides it ----------------------------
// Same discipline, new measurement. The screen must still say WHY a six-bottle parcel weighs what it
// does — a weight box with no explanation passes section 2 by saying nothing at all — and the sentence
// must be built from EXPORT_BOX rather than typed out, because the packing can be re-measured exactly
// as the bottles were.
const page = readFileSync(join(src, 'pages', 'ExportShippingCalculatorPage.jsx'), 'utf8');
assert.match(page, /\$\{EXPORT_BOX\.bottles\}[^`]*\$\{EXPORT_BOX\.kg\}/,
  'the export screen states its packing rule without reading either number from EXPORT_BOX — re-measure '
  + 'the box and the screen would go on reciting 6 Oct 2026');
assert.match(page, /\{BOX_RULE\}/,
  'the rule must still be SHOWN: it is what tells Dekito why a six-bottle parcel weighs three kilos');
// And the numbers themselves are not restated anywhere, the same way the grams are not.
const boxPairing = new RegExp(`\\b${EXPORT_BOX.bottles}\\s*(botol|bottles?)\\b[^\\n]{0,24}?\\b${EXPORT_BOX.kg}\\s*kg\\b`, 'i');
// Comments included, exactly as section 2 includes them: a comment reciting the packing is documentation
// that goes stale the next time a box is weighed, and it reads as authoritative while it does it.
const boxOffenders = files.filter((file) => !file.endsWith(join('data', 'internationalShippingRates.js'))
  && boxPairing.test(readFileSync(file, 'utf8')))
  .map((file) => file.slice(root.length + 1));
assert.deepEqual(boxOffenders, [],
  `the packing rule is written out in live code instead of read from EXPORT_BOX: ${boxOffenders.join(', ')}`);

console.log(`weighedNotRetyped selfcheck OK (${entries.length} weighed sizes and the `
  + `${EXPORT_BOX.bottles}-bottle/${EXPORT_BOX.kg} kg box, each shown from its own module and restated nowhere)`);
