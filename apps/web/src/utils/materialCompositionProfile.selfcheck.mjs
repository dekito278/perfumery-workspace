// `node src/utils/materialCompositionProfile.selfcheck.mjs`
//
// A material's ROLE in a blend -- fixative, blender, diffuser, support, solvent -- is read out of free
// text here: function_labels, perfume_uses, notes, description. That text describes what a material does,
// so a diluent whose datasheet mentions "fixative" or "used for blending" came back as one.
//
// Measured against the studio's own catalogue: of the 23 rows whose `type` column says 'solvent', only 4
// were classified as solvent. The rest were support (11), fixative (5) and blender (3) -- and three of
// them sit in live formulas: Benzyl Benzoate as a fixative, Triethyl Citrate and Benzyl Alcohol as
// blenders.
//
// That is not a label. primary_function has exactly two readers and both are in the PACE engine:
// FUNCTION_PRIORITY_BY_OBJECTIVE pays a fixative +8 towards longevity and a blender +7 towards balance.
// A diluent was being ranked as the material most worth ADDING to make a perfume last longer, which is
// the opposite of what adding it does.
//
// Both files are loaded as one module so the engine calls the REAL resolver rather than a stand-in: the
// consequence, not just the classification, is what has to stay fixed.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';
import { PACE_TARGETS } from './paceScoreBands.js';

const here = dirname(fileURLToPath(import.meta.url));
const strip = (file) => {
  const source = readFileSync(join(here, file), 'utf8').replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '');
  assert.ok(!/^import\s/m.test(source), `${file}: an import survived the strip`);
  return source;
};

// Stubbed: the guidance snapshot, because the fixtures exist to control a material's text and numbers,
// and the gram formatter, which only appears in helper copy. PACE_TARGETS is the real one. The resolver
// itself is NOT stubbed -- it is the subject.
const stubs = `
const PACE_TARGETS = ${JSON.stringify(PACE_TARGETS)};
const formatGramAmount = (value) => String(Number(value || 0)) + ' g';
const buildGuidanceLimitAdvisories = () => [];
const resolveEffectiveConcentration = (value) => Number(value || 0);
const resolveRawMaterialGuidanceSnapshot = (material) => ({
  referenceProfile: material?.__profile || null,
  family: material?.scent_family || '',
  impact: material?.__impact ?? 100,
  lifeHours: material?.__life ?? 24,
  ifraLimitPercent: null,
  useLevelTypicalPercent: null,
  useLevelMaxPercent: null,
  stageScores: material?.__stages || { top: 1, middle: 2, base: 3 },
  classDistribution: [],
  pyramidPlacement: material?.__placement || 'base',
  descriptorText: material?.notes || '',
});
`;
const mod = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + strip('materialCompositionProfile.js') + strip('formulaPaceRecommendations.js'), 'utf8').toString('base64')}`
);
const { resolveMaterialCompositionProfile, buildPaceRecommendations } = mod;

// --- 1. The row's own column beats its prose ----------------------------------------------------------
// The three real shapes from production, by the words that misled the reader.
const solventProse = [
  ['Benzyl Benzoate (BB)', 'A fixative and solvent for resins; long-lasting.', 'fixative'],
  ['Triethyl Citrate (TEC)', 'Odourless solvent used for blending and smoothing.', 'blender'],
  ['Propylene Glycol (PG)', 'Carrier, support base for dilutions.', 'support'],
];
for (const [name, notes, textRole] of solventProse) {
  // First: the prose really does read as that other role, or the fixture proves nothing.
  const asMaterial = resolveMaterialCompositionProfile({ name, notes, type: 'material' });
  assert.equal(asMaterial.primary_function, textRole,
    `the fixture for ${name} does not read as "${textRole}" from its text, so it cannot show the column winning`);

  const asSolvent = resolveMaterialCompositionProfile({ name, notes, type: 'solvent' });
  assert.equal(asSolvent.primary_function, 'solvent',
    `${name} is declared type 'solvent' and came back as "${asSolvent.primary_function}"`);
  // The reading is not thrown away -- it moves to where it is description, not priority.
  assert.equal(asSolvent.secondary_function, textRole,
    `${name} lost its text-derived role entirely; it belongs in secondary_function`);
}
// item_type is the spelling the formula rows use, and it must count the same.
assert.equal(
  resolveMaterialCompositionProfile({ name: 'DPG', notes: 'fixative', item_type: 'solvent' }).primary_function,
  'solvent',
  "a row carrying item_type 'solvent' is a solvent too — that is the spelling formula items use",
);

// --- 2. Nothing else changes ---------------------------------------------------------------------------
// A material whose prose mentions solvent but which is NOT declared one keeps its odorant role: five of
// the studio's materials are like that, Alpha Terpineol among them, and they are odorants.
assert.equal(
  resolveMaterialCompositionProfile({ name: 'Alpha Terpineol', notes: 'Floral modifier, also used as a solvent.', type: 'material' }).primary_function,
  'modifier',
  'a material that merely mentions solvent in its text is not reclassified — it is an odorant',
);
for (const [notes, expected] of [
  ['Powerful fixative for the drydown.', 'fixative'],
  ['Bridge between the top and the heart.', 'bridge'],
  ['Adds diffusion and sparkle.', 'diffuser'],
  ['The signature hero of the accord.', 'hero'],
]) {
  assert.equal(resolveMaterialCompositionProfile({ name: 'X', notes, type: 'material' }).primary_function, expected,
    `an ordinary material described as "${notes}" must still read as ${expected}`);
}

// --- 3. The consequence: a diluent no longer outranks a fixative ---------------------------------------
// This is why the classification matters. Two base rows, the solvent deliberately the HEAVIER of the two
// (the score starts at odour weight), both described as fixatives. Only the +8 longevity bonus that a
// fixative collects and a solvent does not can decide this, so the plain material must win the pick.
const baseRow = (id, over) => ({
  item_id: id,
  item_type: 'raw_material',
  name: id,
  listedGrams: 1,
  odourWeight: 50,
  effectivePercentage: 4,
  impact: 100,
  impactContribution: 5,
  pyramidPlacement: 'base',
  ...over,
});
const weakPace = {
  openingScore: 99, heartScore: 99, drydownScore: 20, diffusionScore: 99, tenacityScore: 20,
  harmonyScore: 99, smoothnessScore: 99, bridgeQualityScore: 99, balanceScore: 99,
  impactSignal: 60, lifeSignal: 20, topMiddleBridgeScore: 60,
  dominantClass: { familyName: 'Woody', sharePercent: 10 },
};
const rows = [
  baseRow('declared-solvent', {
    odourWeight: 54,
    raw_material: { id: 'declared-solvent', name: 'DPG', notes: 'Fixative for the drydown.', type: 'solvent' },
  }),
  baseRow('plain-fixative', {
    raw_material: { id: 'plain-fixative', name: 'Ambroxan', notes: 'Fixative for the drydown.', type: 'material' },
  }),
];
const picks = buildPaceRecommendations({
  rows,
  pace: weakPace,
  topPercent: 20,
  middlePercent: 20,
  basePercent: 20,
  impactEstimate: 10,
  ifraAdvisories: [],
  maxUseAdvisories: [],
  referenceLinksMap: new Map(),
}, 'longevity');
const longevityPick = picks.find((pick) => ['Drydown', 'Tenacity'].includes(pick.axisLabel));
assert.ok(longevityPick, 'drydown at 20 against a target of 62 must produce a suggestion');
assert.equal(longevityPick.itemId, 'plain-fixative',
  `longevity picked ${longevityPick.itemId}; a declared solvent must not collect a fixative's bonus and `
  + 'outrank a real fixative for making a perfume last');
// --- 4. And when a solvent IS the only candidate, the card names it for what it is -------------------
// It can still be picked -- the guardrails look at impact and use levels, not at role -- so the suggestion
// has to read "diluent" rather than "body support", which is what the placement fallback would have said.
const solventOnly = buildPaceRecommendations({
  rows: [baseRow('only-solvent', {
    raw_material: { id: 'only-solvent', name: 'DPG', notes: 'Carrier for dilutions.', type: 'solvent' },
  })],
  pace: weakPace,
  topPercent: 20,
  middlePercent: 20,
  basePercent: 20,
  impactEstimate: 10,
  ifraAdvisories: [],
  maxUseAdvisories: [],
  referenceLinksMap: new Map(),
}, 'longevity');
const solventPick = solventOnly.find((pick) => ['Drydown', 'Tenacity'].includes(pick.axisLabel));
assert.ok(solventPick, 'with one safe base row and drydown at 20, there must be a suggestion');
assert.equal(solventPick.itemId, 'only-solvent');
assert.equal(solventPick.strategyLabel, 'diluent',
  `the card calls the solvent "${solventPick.strategyLabel}" — a diluent must not be offered as body support`);

// --- 5. Nothing in here is unreachable ----------------------------------------------------------------
// This file was 2120 lines and 15 exports, of which ONE could be called from the app: 1993 lines were a
// recommendation system that was never wired up -- stage scoring, a theme-recipe library, feedback
// contexts, architecture roles -- reachable only through buildComposerItemsFromProjectStageItems in
// formulaPipeline.js, which nothing imported either. Dekito's decision, 11 Oct 2026: delete it; git keeps
// it if it is ever revived.
//
// So the rule is that it cannot grow back unnoticed: every export of these two modules has to be imported
// by something that is not a guard. A symbol only a selfcheck uses is a symbol only a selfcheck needs.
const importedSymbols = (() => {
  const found = new Set();
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!/\.(js|jsx)$/.test(entry.name) || entry.name.includes('.selfcheck.')) return;
    for (const block of readFileSync(full, 'utf8').matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
      block[1].split(',').forEach((symbol) => {
        const name = symbol.trim().split(' as ')[0].trim();
        if (name) found.add(name);
      });
    }
  });
  walk(join(here, '..'));
  return found;
})();
for (const file of ['materialCompositionProfile.js', 'formulaPipeline.js']) {
  const exported = [...readFileSync(join(here, file), 'utf8').matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
  assert.ok(exported.length, `${file} exports nothing — this guard's parse is broken`);
  for (const name of exported) {
    assert.ok(importedSymbols.has(name),
      `${file} exports ${name} and nothing in the app imports it. That is how 1993 lines of this file `
      + 'came to be unreachable — either wire it up or leave it out');
  }
}

console.log('materialCompositionProfile selfcheck OK (a declared solvent stays a solvent through the '
  + 'resolver and through the PACE engine that reads it)');
