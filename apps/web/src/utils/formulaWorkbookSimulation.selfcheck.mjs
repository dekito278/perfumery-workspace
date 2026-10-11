// `node src/utils/formulaWorkbookSimulation.selfcheck.mjs`
//
// Every PACE number the workbook prints comes out of this file, and one of them could not vary.
//
// `impactSignal` was `toScore(impactEstimate, 0, 12)`, and impactEstimate is a SUM over every row -- so it
// grew with the number of materials rather than with how impactful the blend is. Measured over the
// studio's 27 formulas it runs 5.8 to 285.8, and 26 of the 27 were already past the ceiling of 12:
// impactSignal read 100 for all of them. Per MATERIAL the same quantity runs 0.29 to 12.42 and fits that
// band almost exactly, so the constant was right and what was fed to it was not.
//
// It mattered twice: impactSignal is 45% of diffusionScore, which is why no formula in the studio could
// score below 45 for diffusion however thin its opening was. After the fix impactSignal takes 26 distinct
// values across those 27 formulas instead of 2, and diffusion's floor drops from 45.3 to 24.8.
//
// So the rule held here is the scale-free one: adding materials at the same per-material impact must not
// raise the signal. A fixture that only checked one formula would have passed the whole time.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'formulaWorkbookSimulation.js'), 'utf8')
  .replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '');
assert.ok(!/^import\s/m.test(source), 'an import survived the strip');

// Stubbed: the guidance snapshot, so a fixture controls each material's impact and life outright, and
// the three advisory/classification helpers, which this rule does not touch. Nothing else.
const stubs = `
const buildGuidanceLimitAdvisories = () => [];
const getDilutionFactor = () => 1;
const resolveEffectiveConcentration = (value) => Number(value || 0);
const extractWorkbookClassDistribution = () => [];
const resolveRawMaterialGuidanceSnapshot = (material) => ({
  referenceProfile: { reference_code: 'TEST' },
  guidanceSource: 'linked_profile',
  family: 'woody',
  impact: material?.__impact ?? null,
  lifeHours: material?.__life ?? 24,
  ifraLimitPercent: null,
  useLevelTypicalPercent: null,
  useLevelMaxPercent: null,
  stageScores: { top: 1, middle: 2, base: 3 },
  classDistribution: [],
  pyramidPlacement: 'middle',
  descriptorText: '',
});
`;
const { buildWorkbookSimulation } = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + source, 'utf8').toString('base64')}`
);

// impactContribution is (percentage / 100) * impact, so a formula of `count` rows that each contribute
// `per` is built by splitting 100% between them and setting the impact to match.
const formulaOf = (count, per) => {
  const percentage = 100 / count;
  const impact = per / (percentage / 100);
  const rawMaterialsById = new Map();
  const items = [];
  for (let index = 0; index < count; index += 1) {
    const id = `m${index}`;
    rawMaterialsById.set(id, { id, name: id, type: 'material', __impact: impact, __life: 24 });
    items.push({ item_id: id, item_type: 'raw_material', percentage, grams: 1 });
  }
  return buildWorkbookSimulation({ items, rawMaterialsById, referenceLinksMap: new Map() });
};

// --- 1. The signal is per material, so it cannot be raised by adding materials -----------------------
// Same per-material impact, three very different formula sizes. These are the real shapes: the studio's
// formulas carry between 9 and 51 contributing materials.
const small = formulaOf(4, 1.5);
const medium = formulaOf(12, 1.5);
const large = formulaOf(40, 1.5);
// Compared within a hair rather than exactly: splitting 100% between 40 rows leaves floating-point dust,
// and a guard that trips on dust gets read as a real failure and then ignored.
const samePerMaterial = (left, right) => Math.abs(left.pace.impactSignal - right.pace.impactSignal) < 0.001;
assert.ok(samePerMaterial(small, medium),
  `4 materials scored ${small.pace.impactSignal} and 12 identical ones scored ${medium.pace.impactSignal} `
  + '— the signal is counting materials, not impact');
assert.ok(samePerMaterial(small, large),
  `and 40 of them scored ${large.pace.impactSignal} — it must still be the same`);
// The fixture proves itself: the SUM really does differ, so the equality above is not vacuous.
assert.ok(medium.impactEstimate > small.impactEstimate * 2.5,
  "the fixtures' totals must differ, or this says nothing about which quantity is being read");

// --- 2. A thin blend does not read full marks ---------------------------------------------------------
// This is the case that was pinned: twelve materials at 1.5 each totals 18, which is past the old ceiling
// of 12, so it used to read exactly 100.
assert.ok(medium.pace.impactSignal < 100,
  `a blend of twelve materials at 1.5 impact each reads ${medium.pace.impactSignal} — it was pinned at 100 `
  + 'because its total, not its per-material impact, was measured against a ceiling of 12');
assert.ok(medium.pace.impactSignal > 0, 'and it is not zero either — the signal still has to say something');
// And a genuinely impactful blend does reach the top.
assert.equal(formulaOf(12, 20).pace.impactSignal, 100, 'a blend well past the band is still full marks');

// --- 3. Two formulas of the same size but different impact are told apart -----------------------------
const weak = formulaOf(12, 0.5);
const strong = formulaOf(12, 9);
assert.ok(strong.pace.impactSignal > weak.pace.impactSignal + 40,
  'the signal must separate a weak blend from a strong one at equal material count');

// --- 4. Diffusion moves with it ------------------------------------------------------------------------
// impactSignal is 45% of diffusionScore. If the signal is pinned, so is diffusion's floor.
assert.ok(strong.pace.diffusionScore > weak.pace.diffusionScore + 15,
  `diffusion reads ${weak.pace.diffusionScore} for a weak blend and ${strong.pace.diffusionScore} for a `
  + 'strong one; it carries the signal at 45% and must move with it');

// --- 5. impactEstimate itself is still the total ------------------------------------------------------
// Four screens print it as a total and every row's impact share is taken against it, so the fix must not
// have quietly redefined it.
assert.ok(Math.abs(medium.impactEstimate - 18) < 0.0001,
  `impactEstimate reads ${medium.impactEstimate} where the twelve rows sum to 18 — it must stay the total`);
const summed = medium.rows.reduce((sum, row) => sum + Number(row.impactContribution || 0), 0);
assert.ok(Math.abs(medium.impactEstimate - summed) < 0.0001,
  'impactEstimate must equal the sum of its rows, which is what the impact shares divide by');

// --- 6. No impact data at all is a zero, not a crash --------------------------------------------------
const blind = buildWorkbookSimulation({
  items: [{ item_id: 'x', item_type: 'raw_material', percentage: 100, grams: 1 }],
  rawMaterialsById: new Map([['x', { id: 'x', name: 'x', type: 'material', __impact: null }]]),
  referenceLinksMap: new Map(),
});
assert.equal(blind.impactEstimate, null, 'a formula with no impact figures has no estimate');
assert.equal(blind.pace.impactSignal, 0, 'and its signal is zero rather than NaN');

console.log(`formulaWorkbookSimulation selfcheck OK (impactSignal is per material: 4, 12 and 40 rows at `
  + `the same impact all read ${Math.round(small.pace.impactSignal * 10) / 10})`);
