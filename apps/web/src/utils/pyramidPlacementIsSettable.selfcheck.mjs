// `node src/utils/pyramidPlacementIsSettable.selfcheck.mjs`
//
// raw_materials.pyramid_placement decides a material's share of the Top / Middle / Base balance, and
// therefore the Opening, Heart, Drydown and Tenacity scores built on those percentages. resolvePyramidPlacement
// prefers it over its own inference, and that inference disagrees with Dekito's stated answers on 256 of
// the 551 materials that carry one — 46% (#445).
//
// And until this check existed, nothing in the app could set it. The column was READ by three utils and
// WRITTEN by no screen and no service payload: `pyramid_placement` appeared in zero .jsx files, and
// buildRawMaterialPayload — a hand-written field list — did not mention it. The 551 values came from an
// import; the other 223 had no way to stop being guessed, which made "fill them in" advice nobody could
// act on.
//
// So this holds the whole path open: the form carries the field, the dialog offers it, the payload writes
// it, and the resolver honours it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';
import { pyramidPlacementBlindSpot } from './pyramidPlacementConfidence.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

// The resolver imports three aliased modules, so they are stubbed. The inference itself is NOT under test
// here -- deriveTopMiddleBaseTendency stands in as a fixed answer -- because the rule being pinned is
// which SOURCE wins when more than one has an opinion. Its real accuracy is the subject of #445, measured
// against Dekito's own column: 46% disagreement.
const INFERRED = 'middle';
const resolverSource = read('utils', 'rawMaterialGuidanceResolver.js')
  .replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '');
assert.ok(!/^import\s/m.test(resolverSource), 'an import survived the strip');
const { resolvePyramidPlacement } = await import(
  `data:text/javascript;base64,${Buffer.from(`
const deriveTopMiddleBaseTendency = () => '${INFERRED}';
const buildFallbackReferenceProfileFromRawMaterial = () => null;
const extractWorkbookClassDistribution = () => [];
${resolverSource}`, 'utf8').toString('base64')}`
);

// --- 1. A stated placement beats the inference ---------------------------------------------------------
// The fixture proves itself first: with no stated placement these inputs really do infer something else.
const classDistribution = [{ letter: 'Q', classIndex: 17, share: 100 }];
const inferred = resolvePyramidPlacement({ material: {}, classDistribution, lifeHours: 300 });
assert.equal(inferred, INFERRED,
  `with nothing stated the resolver must fall through to the inference, got ${inferred} — if it does not, `
  + 'the assertions below prove nothing about precedence');
for (const stated of ['top', 'middle', 'base']) {
  assert.equal(
    resolvePyramidPlacement({ material: { pyramid_placement: stated }, classDistribution, lifeHours: 300 }),
    stated,
    `a material stating "${stated}" must be placed there, whatever the class distribution infers`,
  );
}
const contrary = ['top', 'middle', 'base'].find((value) => value !== inferred);
assert.equal(
  resolvePyramidPlacement({ material: { pyramid_placement: contrary }, classDistribution, lifeHours: 300 }),
  contrary,
  `stating "${contrary}" must override an inference of "${inferred}" — otherwise filling the column in `
  + 'changes nothing on screen',
);
// Whatever Dekito types, within reason.
assert.equal(resolvePyramidPlacement({ material: { pyramid_placement: ' Base ' }, classDistribution }), 'base',
  'a stray space or capital must not turn an answer back into a guess');
// Junk is not an answer, and must fall through to the inference rather than placing the material nowhere.
assert.equal(resolvePyramidPlacement({ material: { pyramid_placement: 'heart' }, classDistribution, lifeHours: 300 }), inferred,
  '"heart" is not one of the three — it has to fall through, not blank the placement');

// --- 2. A stated placement stops counting as a blind spot ---------------------------------------------
// The notice from #445 has to go quiet for a material once it is answered, or filling the column in looks
// like it did nothing.
const row = (placement) => ({
  name: 'X', odourWeight: 10, pyramidPlacement: 'base',
  raw_material: { id: 'x', pyramid_placement: placement },
});
assert.equal(pyramidPlacementBlindSpot([row('base')]).isComplete, true,
  'an answered material must leave the blind-spot notice with nothing to say');
assert.equal(pyramidPlacementBlindSpot([row(null)]).guessedCount, 1,
  'and an unanswered one must still be counted');

// --- 3. The whole path from the form to the column -----------------------------------------------------
// Each hop was missing before, and any one of them missing again makes the select a dead control.
const form = read('hooks', 'useRawMaterialForm.js');
assert.match(form, /^\s*pyramid_placement: '',$/m, 'a new material form must carry the field');
assert.match(form, /pyramid_placement: material\.pyramid_placement \|\| '',/,
  'editing a material must load its existing placement, or opening the dialog would silently clear it');

const dialog = read('components', 'RawMaterialFormDialog.jsx');
assert.match(dialog, /handleChange\('pyramid_placement', value\)/,
  'the form dialog must offer a control bound to the field');
for (const option of ['top', 'middle', 'base']) {
  assert.ok(new RegExp(`value: '${option}'`).test(dialog), `the control must offer "${option}"`);
}
assert.match(dialog, /helperText=/, 'and say what the field decides — it is not obvious from its name');

// The phone has its own form, mapper and payload — a hand-written set, so a field added only to the
// desktop dialog would leave the same gap for anyone working on a phone. Both screens or neither.
const phone = read('pages', 'mobile', 'MobileRawMaterialEditorPage.jsx');
assert.match(phone, /^\s*pyramid_placement: '',$/m, 'the phone editor must carry the field on a new material');
assert.match(phone, /pyramid_placement: material\.pyramid_placement \|\| '',/,
  'and must load an existing placement rather than clearing it');
assert.match(phone, /pyramid_placement: formState\.pyramid_placement \|\| null,/,
  'and must send it when saving — its payload is a hand-written list too');
assert.match(phone, /setField\('pyramid_placement', placement === 'auto' \? '' : placement\)/,
  'and must offer a control for it that can also clear it');
// MobileSegmentedControl drops any option whose value is empty, so "Auto" needs a real value or the
// button never renders: the placement becomes unclearable once set, and an unanswered material shows no
// selected segment at all. Asserted against the control's own filter, not just the page.
const segmented = read('components', 'mobile-ui', 'MobileSegmentedControl.jsx');
assert.match(segmented, /filter\(\(option\) => option\.value && option\.label\)/,
  "this rule exists because the control drops empty-valued options — if that changed, re-check the page");
assert.ok(!/\{ value: '', label: 'Auto' \}/.test(phone),
  'an empty-valued Auto option would be filtered out of the control and never shown');
assert.match(phone, /\{ value: 'auto', label: 'Auto' \}/, 'Auto must carry a value the control will render');

const service = read('services', 'rawMaterialsService.js');
assert.match(service, /pyramid_placement: normalizePyramidPlacement\(data\.pyramid_placement\),/,
  'buildRawMaterialPayload must write the field — it is a hand-written list, and the field was absent '
  + 'from it, which is why no screen could save one');
assert.match(service, /PYRAMID_PLACEMENTS\.includes\(normalized\) \? normalized : null/,
  'and must store one of the three or null, not whatever was typed');

console.log('pyramidPlacementIsSettable selfcheck OK (a stated placement overrides the inference, silences '
  + 'the blind-spot notice, and travels from the form through the payload to the column)');
