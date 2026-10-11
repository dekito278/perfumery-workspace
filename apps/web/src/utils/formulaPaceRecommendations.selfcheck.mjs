// `node src/utils/formulaPaceRecommendations.selfcheck.mjs`
//
// "Revision suggestions" on the workbook panel is not advice a perfumer weighs and discards. The button
// beside it, "Create PACED revision", feeds the same list to buildPacedRevisionItems and writes a new
// formula from it. Whatever this engine returns becomes rows in the database.
//
// Two defects were living in it, and both were invisible because the engine sat inside a 1346-line .jsx
// where nothing could call it:
//
//   1. The candidate picker scored its candidates and then ranked only the first FOUR of them -- sliced
//      off before the sort, out of a list ordered by odour weight rather than by score. The penalties in
//      that score reach -20, so a lighter row could easily deserve the pick and never be reachable. In
//      the diffusion pick, whose pool is three top rows followed by three middle rows, it meant the
//      middle half was discarded whenever four top rows passed the guardrails.
//   2. Recommendations were deduped by material AND action, so one material could collect an "increase"
//      and a "decrease" in the same pair of suggestions -- two opposite instructions about one bottle.
//      buildPacedRevisionItems then maps the list by itemId, so the second silently replaced the first:
//      only one of the two was applied, while the revision note said both were.
//
// The engine takes a simulation object, so the fixtures below are simulations. Their field names are the
// ones buildWorkbookSimulation really produces (odourWeight, effectivePercentage, impactContribution,
// pyramidPlacement, listedGrams) -- a fixture with invented keys would pass while the shipped screen
// did nothing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';
import { PACE_TARGETS } from './paceScoreBands.js';
import { calculatePercentages } from './formulaCalculations.js';

const here = dirname(fileURLToPath(import.meta.url));
const loadWithoutAliases = async (file, stubs) => {
  const source = readFileSync(join(here, file), 'utf8').replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '');
  assert.ok(!/^import\s/m.test(source), `${file}: an import survived the strip, so node would resolve '@/' and fail`);
  return import(`data:text/javascript;base64,${Buffer.from(stubs + source, 'utf8').toString('base64')}`);
};

// PACE_TARGETS and calculatePercentages are the real ones. Two things are stubbed: the profile resolver,
// because a row's profile is what the fixtures exist to control, and the gram formatter, which only
// appears in the helper sentence and pulls in the rest of formatting.js if taken whole.
const engine = await loadWithoutAliases('formulaPaceRecommendations.js', `
const PACE_TARGETS = ${JSON.stringify(PACE_TARGETS)};
const formatGramAmount = (value) => String(Number(value || 0)) + ' g';
const resolveMaterialCompositionProfile = (material) => material?.__profile || null;
`);
const revision = await loadWithoutAliases('formulaDetail.js', `
const calculatePercentages = ${calculatePercentages.toString()};
`);

const { buildPaceRecommendations } = engine;
const { buildPacedRevisionItems } = revision;

const row = (id, over = {}) => ({
  item_id: id,
  item_type: 'raw_material',
  name: `Material ${id}`,
  listedGrams: 1,
  odourWeight: 10,
  effectivePercentage: 4,
  impact: 100,
  impactContribution: 10,
  pyramidPlacement: 'middle',
  raw_material: { id, __profile: { primary_function: 'support' } },
  ...over,
});

// Everything under target, so every branch of the engine is live.
const weakPace = {
  openingScore: 20, heartScore: 20, drydownScore: 20, diffusionScore: 20,
  tenacityScore: 20, harmonyScore: 20, smoothnessScore: 20, bridgeQualityScore: 20,
  balanceScore: 20, impactSignal: 20, lifeSignal: 20, topMiddleBridgeScore: 20,
  dominantClass: { familyName: 'Woody', sharePercent: 10 },
};
const simulation = (rows, over = {}) => ({
  rows,
  pace: { ...weakPace, ...(over.pace || {}) },
  topPercent: 20, middlePercent: 20, basePercent: 20,
  impactEstimate: rows.reduce((sum, item) => sum + Number(item.impactContribution || 0), 0),
  ifraAdvisories: [], maxUseAdvisories: [],
  referenceLinksMap: new Map(),
  ...over,
});

// --- 1. One material never gets two opposite instructions ---------------------------------------------
// Finding the reachable shape took some doing, and the dead ends matter: canSafelyReduceDominantRow
// refuses to trim a MIDDLE row while the heart is weak and a BASE row while longevity is weak, and those
// are exactly the axes that would want to lift them. A TOP row has no such block.
//
// So: the heaviest material is a top note at 20% of the formula (the 18% trigger for "this one dominates"),
// ordinary impact, nowhere near its use ceiling -- safe to lift. The middle rows are all pinned at their
// use ceiling, so no safe middle candidate exists, which sends the Heart branch into its else and asks to
// trim the dominant row instead. Opening asks to lift the same top note. Two opposite instructions, one
// material, both inside the pair of suggestions the panel prints.
//
// None of the 27 formulas in the studio hits this today -- checked, 0 of 81 runs across the three priority
// modes -- because none of them has a dominant top note that heavy with no liftable middle. It is one
// composition away, and "Create PACED revision" applies whichever of the two it sees last.
const atCeiling = (id) => row(id, {
  odourWeight: 30,
  effectivePercentage: 6,
  raw_material: { id, __profile: { primary_function: 'support', use_level_typical_percent: 6, use_level_max_percent: 6 } },
});
const dominantTop = row('top-dominant', {
  pyramidPlacement: 'top', odourWeight: 90, effectivePercentage: 20, listedGrams: 4, impact: 120, impactContribution: 8,
});
const contradictory = simulation([dominantTop, atCeiling('mid-1'), atCeiling('mid-2')]);
const picks = buildPaceRecommendations(contradictory, 'balance');
assert.ok(picks.length >= 1, 'a formula this far under target must produce at least one suggestion');
const byItem = new Map();
for (const pick of picks) {
  assert.ok(!byItem.has(pick.itemId),
    `${pick.itemId} appears twice in one suggestion pair (${byItem.get(pick.itemId)} and ${pick.action}). `
    + 'The perfumer is being told to move one material in two directions, and only one of the two '
    + 'survives buildPacedRevisionItems');
  byItem.set(pick.itemId, pick.action);
}

// --- 2. Every suggestion returned is a suggestion actually applied -------------------------------------
// This is the claim the revision note makes: "Applied N PACE adjustments". buildPacedRevisionItems maps
// the list by item_id, so two moves on one material would silently become one while the note still said
// two. Run for both directions: the pair on the fixture above collapses to a DECREASE (a cleanup aimed at
// the mode's own objective outranks the opening lift), and the diffusion fixture below produces an
// INCREASE. A check that only saw one of the two would miss half of buildPacedRevisionItems.
const assertEveryMoveApplies = (rows, recommendations) => {
  const items = rows.map((item) => ({
    item_type: 'raw_material', item_id: item.item_id, grams: item.listedGrams, gram_amount: item.listedGrams,
  }));
  const applied = buildPacedRevisionItems(items, recommendations);
  const changed = applied.filter((item) => {
    const before = items.find((original) => original.item_id === item.item_id);
    return !before || Number(item.grams) !== Number(before.grams);
  });
  assert.equal(changed.length, recommendations.length,
    `the revision note claims ${recommendations.length} adjustment(s) but ${changed.length} material(s) `
    + `actually moved (${recommendations.map((pick) => pick.action).join(', ')})`);
};
assertEveryMoveApplies(contradictory.rows, picks);
assert.ok(picks.some((pick) => pick.action === 'decrease'), 'fixture 1 is the decrease side of that check');

// --- 3. The best-scoring safe candidate wins, wherever it sits in the weight order ---------------------
// Five top rows. The four heaviest each carry a penalty the scorer is built to apply (impact >= 900, or a
// share over 30%, or sitting at the use ceiling); the fifth and lightest is clean. Ranking only the first
// four by weight could never reach it.
const penalised = (id, weight, placement = 'top') => row(id, {
  pyramidPlacement: placement, odourWeight: weight, impact: 700, impactContribution: 60, effectivePercentage: 4,
  raw_material: { id, __profile: { primary_function: 'support', use_level_typical_percent: 5, use_level_max_percent: 6 } },
});
// The score STARTS at odour weight and the penalties reach about -16, so the clean row has to be within
// that distance to deserve the pick -- 80 against 92. It is still fifth in the weight order, which is the
// only thing the old truncation looked at.
const cleanLight = row('top-clean', { pyramidPlacement: 'top', odourWeight: 80, impact: 50, impactContribution: 1 });
const fivePick = buildPaceRecommendations(simulation([
  penalised('top-a', 95), penalised('top-b', 94), penalised('top-c', 93), penalised('top-d', 92), cleanLight,
]), 'projection');
const opening = fivePick.find((pick) => pick.axisLabel === 'Opening');
assert.ok(opening, 'an opening score of 20 against a target of 60 must produce an Opening suggestion');
assert.equal(opening.itemId, 'top-clean',
  `Opening picked ${opening.itemId}; the clean light row scores highest and was unreachable while the `
  + 'candidate list was cut to the four heaviest before being scored');

// --- 4. The diffusion pick can still land on the middle row that deserves it ------------------------
// Its pool is three top rows followed by the middle rows, each group in weight order, and the old cut
// kept the first four -- so the LAST middle row was the one thrown away. Here that discarded row is the
// one that scores highest: lighter than the heavy middle row, but carrying none of its penalties.
const diffusion = buildPaceRecommendations(simulation([
  penalised('top-a', 70), penalised('top-b', 69), penalised('top-c', 68),
  penalised('mid-heavy', 90, 'middle'),
  row('mid-light', { odourWeight: 80, impact: 50, impactContribution: 1 }),
], {
  pace: {
    ...weakPace,
    openingScore: 99, heartScore: 99, drydownScore: 99, tenacityScore: 99,
    bridgeQualityScore: 99, harmonyScore: 99, smoothnessScore: 99,
  },
}), 'projection');
const diffusionPick = diffusion.find((pick) => pick.axisLabel === 'Diffusion');
assert.ok(diffusionPick, 'diffusion is 20 against a target of 58 and safe candidates exist');
assert.equal(diffusionPick.itemId, 'mid-light',
  `diffusion picked ${diffusionPick.itemId}; mid-light scores highest and was the row the truncation `
  + 'dropped, because it sits last in a pool ordered by weight rather than by score');

// --- 5. No suggestion is made about an axis that is already on target ---------------------------------
// The early return for a wholly healthy formula cannot be tested on its own: every branch below it is
// gated on some score being under target, so a healthy formula returns nothing by two routes and removing
// the shortcut changes no answer. What can break is a single branch firing on an axis that is fine, so
// that is what this asserts -- one axis under target, and every suggestion must be about that axis.
const onlyDiffusionWeak = simulation([
  row('mid-1', { odourWeight: 40 }), row('top-1', { pyramidPlacement: 'top', odourWeight: 30 }),
  row('base-1', { pyramidPlacement: 'base', odourWeight: 30 }),
], {
  pace: {
    ...weakPace,
    openingScore: 80, heartScore: 80, drydownScore: 80, diffusionScore: 20, tenacityScore: 80,
    harmonyScore: 80, smoothnessScore: 80, bridgeQualityScore: 80, balanceScore: 80,
    impactSignal: 60, lifeSignal: 60, topMiddleBridgeScore: 60,
  },
});
const focused = buildPaceRecommendations(onlyDiffusionWeak, 'balance');
assert.ok(focused.length >= 1, 'diffusion at 20 against a target of 58 must produce a suggestion');
for (const pick of focused) {
  assert.equal(pick.axisLabel, 'Diffusion',
    `a ${pick.axisLabel} suggestion was made while ${pick.axisLabel} is already on target`);
}
assert.ok(focused.some((pick) => pick.action === 'increase'), 'and this is the increase side');
assertEveryMoveApplies(onlyDiffusionWeak.rows, focused);
assert.deepEqual(buildPaceRecommendations(simulation([]), 'balance'), [],
  'a formula with no rows has nothing to suggest');

// --- 6. The engine has one home ------------------------------------------------------------------------
// It was lifted out of the panel so this file could run it. If the panel grows its own copy, this guard
// is testing something the screen no longer uses -- the trap paceScoreBands.js was extracted to avoid.
const panel = readFileSync(join(here, '..', 'components', 'FormulaWorkbookSimulationPanel.jsx'), 'utf8');
assert.ok(panel.includes("from '@/utils/formulaPaceRecommendations.js'"),
  'the workbook panel no longer imports the engine this guard tests');
assert.ok(!/const buildPaceRecommendations\s*=/.test(panel),
  'the panel has its own buildPaceRecommendations again, and this guard is testing the other one');

console.log(`formulaPaceRecommendations selfcheck OK (${picks.length} suggestion(s) on the contradictory `
  + 'fixture, each on a different material and each one actually applied by buildPacedRevisionItems)');
