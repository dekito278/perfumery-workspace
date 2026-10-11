// `node src/utils/pyramidPlacementConfidence.selfcheck.mjs`
//
// Every screen that prints a top / middle / base balance is printing sums over per-material placements,
// and resolvePyramidPlacement has three sources for a placement: the reference profile's
// top_middle_base_tendency, the material's own pyramid_placement column, then an inference from its ABC
// class distribution and life hours.
//
// Measured against the studio's own data:
//   * top_middle_base_tendency is null on all 666 reference profiles -- the first source never fires;
//   * pyramid_placement is filled on 551 of 774 materials;
//   * the other 223 are inferred, and the inference is wrong where it can be checked. Withholding the
//     column and comparing the guess to Dekito's own answer on those 551: agrees on 295, DISAGREES on
//     256 -- 46%.
//
// So 144 of 680 formula rows are placed by a coin-flip-grade guess, all 27 formulas contain at least one,
// and the percentages that opening / heart / drydown / tenacity are built from inherit it. The repo
// already announces its other blind spot -- unpriced materials, FormulaCostBlindSpotNotice, since audit
// round 9 -- and this is the same shape for the same reason.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pyramidPlacementBlindSpot } from './pyramidPlacementConfidence.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

const stated = (name, placement, weight) => ({
  name, odourWeight: weight, pyramidPlacement: placement,
  raw_material: { id: name, pyramid_placement: placement },
});
const guessed = (name, placement, weight) => ({
  name, odourWeight: weight, pyramidPlacement: placement,
  raw_material: { id: name, pyramid_placement: null },
});

// --- 1. A formula whose every placement is stated says nothing ----------------------------------------
const allStated = pyramidPlacementBlindSpot([stated('Iso E', 'base', 40), stated('Hedione', 'middle', 60)]);
assert.equal(allStated.isComplete, true, 'nothing to announce when every placement is stated');
assert.equal(allStated.guessedCount, 0);
assert.equal(allStated.guessedShare, 0);

// --- 2. A guessed placement is counted, by rows AND by odour weight -----------------------------------
// The weight matters more than the count: on tlw1, four of twenty-one materials carry 46% of the formula.
const mixed = pyramidPlacementBlindSpot([
  stated('Iso E', 'base', 10),
  guessed('bergamot', 'top', 30),
  stated('Hedione', 'middle', 10),
]);
assert.equal(mixed.isComplete, false, 'a formula holding a guessed placement is not complete');
assert.equal(mixed.guessedCount, 1, 'the row with no stated placement must be counted as a guess');
assert.equal(mixed.placedCount, 3, 'and all three placed rows are the denominator');
assert.equal(Math.round(mixed.guessedShare * 100), 60, 'one row out of three, but 60% of the odour weight');
assert.deepEqual(mixed.guessedNames, ['bergamot'], 'the notice names what to go and fill in');

// --- 3. The reference tendency counts as stated, when it ever arrives ---------------------------------
// Null on all 666 profiles today, so this branch is dormant — but it is the FIRST source the resolver
// asks, and if that data ever lands those rows stop being guesses. A guard that only knew about the
// column would start crying about materials that had just been answered.
const byTendency = pyramidPlacementBlindSpot([{
  name: 'Ambroxan', odourWeight: 50, pyramidPlacement: 'base',
  raw_material: { id: 'ambroxan', pyramid_placement: null },
  reference_profile: { top_middle_base_tendency: 'base' },
}]);
assert.equal(byTendency.isComplete, true, "a placement from the reference profile's tendency is stated, not guessed");
const byCanonical = pyramidPlacementBlindSpot([{
  name: 'Ambroxan', odourWeight: 50, pyramidPlacement: 'base',
  raw_material: { id: 'ambroxan', pyramid_placement: null },
  reference_profile: { canonical_profile: { top_middle_base_tendency: 'base' } },
}]);
assert.equal(byCanonical.isComplete, true, 'and the resolver reads the canonical profile too, so this must');
// Junk in that field is not an answer.
const junkTendency = pyramidPlacementBlindSpot([{
  name: 'X', odourWeight: 1, pyramidPlacement: 'top',
  raw_material: { id: 'x', pyramid_placement: null },
  reference_profile: { top_middle_base_tendency: 'fresh' },
}]);
assert.equal(junkTendency.guessedCount, 1, '"fresh" is not a pyramid position');

// --- 4. A row with no placement at all is absent, not guessed -----------------------------------------
// It contributes to none of the three percentages, so counting it would overstate the blind spot.
const unplaced = pyramidPlacementBlindSpot([
  stated('Iso E', 'base', 10),
  { name: 'Mystery', odourWeight: 90, pyramidPlacement: null, raw_material: { id: 'm', pyramid_placement: null } },
]);
assert.equal(unplaced.isComplete, true, 'an unplaced row is not a guessed placement');
assert.equal(unplaced.placedCount, 1, 'and it is not counted among the placed rows either');

// --- 5. Never throws on what a half-built formula really holds -----------------------------------------
assert.equal(pyramidPlacementBlindSpot().isComplete, true, 'called with nothing');
assert.equal(pyramidPlacementBlindSpot(null).guessedCount, 0);
assert.equal(pyramidPlacementBlindSpot([{}]).placedCount, 0, 'an empty row has no placement');
assert.equal(
  pyramidPlacementBlindSpot([{ name: 'X', pyramidPlacement: 'top', raw_material: null }]).guessedCount,
  1,
  'a row whose material did not load is a guess, and must not throw',
);
assert.equal(
  pyramidPlacementBlindSpot([{ name: 'X', pyramidPlacement: 'top', odourWeight: 0, raw_material: null }]).guessedShare,
  0,
  'zero weight everywhere divides by nothing',
);

// --- 6. Both screens that print the balance say it ----------------------------------------------------
// The cost notice reaches four screens because four screens print a cost. Two print a pyramid balance.
for (const [file, parts] of [
  ['FormulaWorkbookSimulationPanel.jsx', ['components', 'FormulaWorkbookSimulationPanel.jsx']],
  ['MobileFormulaComposerWorkspace.jsx', ['components', 'mobile', 'MobileFormulaComposerWorkspace.jsx']],
]) {
  const source = read(...parts);
  assert.match(source, /pyramidPlacementBlindSpot\(/, `${file} prints a pyramid balance without measuring the blind spot`);
  assert.match(source, /<FormulaPlacementBlindSpotNotice/, `${file} measures the blind spot and never shows it`);
}
// And the notice itself stays silent when there is nothing to say — the property that keeps it readable.
const notice = read('components', 'FormulaPlacementBlindSpotNotice.jsx');
assert.match(notice, /blindSpot\.isComplete[\s\S]{0,60}return null;/,
  'the notice must render nothing for a formula whose placements are all stated');

console.log('pyramidPlacementConfidence selfcheck OK (a guessed placement is counted by weight, a stated '
  + 'one is not, and both screens that print the balance announce it)');
