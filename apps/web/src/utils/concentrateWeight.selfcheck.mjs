// `node src/utils/concentrateWeight.selfcheck.mjs`
//
// A batch card printed three numbers about two different quantities and let the reader guess which was
// which. Read on Dekito's own Studio, 2026-09-24, on a 100 g batch at 20% dilution:
//
//   Full concentrate | Batch 100 g | COGS Rp 174.627 | Rp 8.731,35 / g
//
// The COGS is the cost of the 20 g of concentrate that batch needs. The "100 g" beside it is the
// FINISHED batch. Divide the two the obvious way and you get Rp 1.746 per gram, five times under the
// figure printed on the same card. They coincide only at 100% dilution, which is why this survived.
//
// The rule: wherever a concentrate cost is shown, the quantity shown with it is the CONCENTRATE weight
// (targetValue x ratio), never the batch. The batch may be named, but never as the thing being priced.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(srcRoot, ...parts), 'utf8'));

// --- 1. The arithmetic the card has to survive --------------------------------------------------------
// Not a source scan: this is the relationship the screen exists to present, and it is worth stating once.
const concentrateWeight = (targetValue, concentrationPercent) => targetValue * (concentrationPercent / 100);
assert.equal(concentrateWeight(100, 20), 20, 'a 100 g batch at 20% needs 20 g of concentrate');
assert.equal(concentrateWeight(1000, 20), 200);
assert.equal(concentrateWeight(100, 100), 100, 'at full strength the two quantities finally coincide');

// A cost divided by the WRONG one of those is wrong by exactly 1/ratio — five times, at the dilution
// this shop actually uses.
const cost = 174627;
assert.equal(Math.round(cost / concentrateWeight(100, 20)), 8731, 'per gram of concentrate');
assert.equal(Math.round(cost / 100), 1746, 'per gram of batch — the number the old card invited');

// --- 2. Both batch screens price the concentrate by its own weight -------------------------------------
// Two screens, one rule. The mobile page and the desktop page had the same defect in different words,
// which is this repo's most common way to half-fix something.
for (const [page, tile] of [
  ['pages/mobile/MobileBatchesPage.jsx', /<MetricTile\s+label="Weigh"[\s\S]{0,200}?\/>/],
  ['pages/BatchProductionPage.jsx', /<MetricCard label="Concentrate COGS"[\s\S]{0,300}?\/>/],
]) {
  const source = read(...page.split('/'));
  const match = source.match(tile);
  assert.ok(match, `${page} must still show the concentrate cost`);
  assert.match(match[0], /concentrateBaseGrams/,
    `${page} must size the concentrate cost by the concentrate weight, not the batch`);
}

// The specific wording that was wrong must not come back: a bare batch figure labelled as concentrate.
const desktop = read('pages', 'BatchProductionPage.jsx');
assert.doesNotMatch(desktop, /\$\{formatNumber\(targetValue, 1\)\} ml full concentrate/,
  'the helper may not call the finished batch "full concentrate" again');
const mobile = read('pages', 'mobile', 'MobileBatchesPage.jsx');
assert.doesNotMatch(mobile, /label="Batch" value=\{formatGramAmount\(targetValue\)\}/,
  'the concentrate card may not headline the finished batch weight again');

// --- 3. The weighing rows were already right, and stay right -------------------------------------------
// The bench sheet is scaled to the concentrate; that was fixed in audit round 8 and is what made the
// card's number correct while its label was not.
assert.match(mobile, /const concentrateBaseGrams = targetValue \* formulaRatio;/,
  'the concentrate weight must stay the batch times the ratio');
assert.match(desktop, /const concentrateBaseGrams = targetValue \* formulaRatio;/);

// And the saved batch name already paired them correctly — it is the sentence the card should have been
// reading all along.
assert.match(mobile, /konsentrat \$\{formatGramAmount\(concentrateBaseGrams\)\} untuk batch \$\{formatGramAmount\(targetValue\)\}/,
  'the saved batch name must keep naming both quantities');

console.log('concentrateWeight selfcheck OK (a concentrate cost is priced by the concentrate, not by the batch)');
