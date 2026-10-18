// `node src/utils/unrecordedIsNotZero.selfcheck.mjs`
//
// A field nobody has filled in is not a measurement of zero.
//
// buildFallbackReferenceProfileFromRawMaterial ran every number through `Number(value)`, and Number(null)
// is 0 while Number.isFinite(0) is true — so a material with no recorded longevity left this function
// carrying life_hours: 0. deriveTopMiddleBaseTendency places anything at or under TOP_LIFE_HOURS_CEILING
// (10 hours) at the TOP of the pyramid, which is where the most volatile thing in a formula goes.
//
// Measured on production before the fix: all 27 materials with no reference profile and no life_hours
// were answered 'top'. Cedarwood texas, sandalwood kupang, malinau resin oud 50%, BENZOIN F-TEC,
// Methyl Cedryl Ketone / Vertofix Coeur — base materials, every one, declared the top note.
//
// Same defect class as ifra_limit_percent = 0 meaning "not recorded yet", one column over.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const src = dirname(fileURLToPath(import.meta.url));

// THE REAL CHAIN, RUN. These three modules import each other through the '@/' alias, which plain node
// cannot resolve, and the thing under test is the value that survives all three: the fallback profile's
// life_hours is `canonicalProfile?.life_hours ?? fallbackProfile.life_hours`, so stubbing the canonical
// half would test a different function than the app calls.
//
// So they are concatenated in dependency order with their import lines stripped and loaded as one
// module. `normalizeText` is declared in two of the three — the only collision — so each file's copy is
// given its own name first; nothing else in these files shares a top-level name.
const moduleSource = ['workbookAbcClassification', 'canonicalReferenceProfile', 'referenceGuidance']
  .map((name, index) => readFileSync(join(src, `${name}.js`), 'utf8')
    .replace(/^import\b[\s\S]*?from '[^']+';\n/gm, '')
    .replace(/\bnormalizeText\b/g, `normalizeText${index}`))
  .join('\n');
const { buildFallbackReferenceProfileFromRawMaterial, deriveTopMiddleBaseTendency, TOP_LIFE_HOURS_CEILING } =
  await import(`data:text/javascript;base64,${Buffer.from(moduleSource, 'utf8').toString('base64')}`);
assert.equal(typeof buildFallbackReferenceProfileFromRawMaterial, 'function',
  'the three modules did not load as one — this guard is testing nothing until they do');
assert.equal(typeof deriveTopMiddleBaseTendency, 'function');
assert.equal(TOP_LIFE_HOURS_CEILING, 10, 'the top ceiling is the number the assertions below lean on');

// --- 1. The gate, on the row production actually holds -----------------------------------------------
// Cedarwood texas, copied field for field from the live table: a name, a family, a note saying the
// guidance is still missing, and not one recorded number.
const unrecordedRow = {
  id: '1b252411-a4fc-4ab5-a137-961b44b8edf3',
  name: 'Cedarwood texas',
  category: 'Woody',
  type: 'material',
  scent_family: 'Woody',
  unit: 'ml',
  cost_per_unit: 0,
  notes: 'Created from formula composition. Guidance still needs CAS, workbook, price, impact, life, reference data.',
  legacy_category: 'W - WOOD',
  reference_impact: null,
  reference_life_hours: null,
  reference_use_level_typical_percent: null,
  reference_use_level_max_percent: null,
  reference_abc_primary_family: null,
  ifra_limit: null,
};
// This is the whole bug in one assertion. hasRawMaterialReferenceGuidance asks every numeric field
// `normalizeNumber(x) !== null`, and Number(null) is 0 — so a row with nothing recorded answered YES,
// a fallback profile was built from its blanks, and life_hours came out 0.
assert.equal(buildFallbackReferenceProfileFromRawMaterial(unrecordedRow), null,
  'a material with nothing recorded has no reference guidance to fall back on — it used to get a profile '
  + 'built out of zeros');

// --- 2. A row that DOES carry guidance still gets one, with its blanks left blank ---------------------
const partialRow = { ...unrecordedRow, reference_abc_primary_family: 'WOOD' };
const partial = buildFallbackReferenceProfileFromRawMaterial(partialRow);
assert.ok(partial, 'a recorded family is guidance, so the fallback profile is still built');
for (const field of ['impact', 'life_hours', 'use_level_typical_percent', 'use_level_max_percent']) {
  assert.equal(partial[field], null,
    `${field} must stay null when nothing was recorded — as 0 it reads as a measurement, and life_hours `
    + 'of 0 means "gone within zero hours"');
}

// A REAL zero must survive, or this fix would hide a genuine measurement.
const measured = buildFallbackReferenceProfileFromRawMaterial({
  ...unrecordedRow, reference_abc_primary_family: 'WOOD', reference_impact: 0, reference_life_hours: '0',
});
assert.equal(measured.impact, 0, 'a recorded 0 is data and must pass through');
assert.equal(measured.life_hours, 0, 'including as a string, which is how a form submits it');

// An empty string is the same story: a cleared Studio field arrives as '' and Number('') is 0 too.
const cleared = buildFallbackReferenceProfileFromRawMaterial({
  ...unrecordedRow, reference_abc_primary_family: 'WOOD', reference_impact: '', reference_life_hours: '  ',
});
assert.equal(cleared.impact, null, 'an empty string is not zero either');
assert.equal(cleared.life_hours, null, 'nor is whitespace');

// --- 2b. The consequence, run --------------------------------------------------------------------------
// The assertion that would have caught it: where a material with nothing recorded ends up.
assert.notEqual(deriveTopMiddleBaseTendency({ lifeHours: null, distribution: [] }), 'top',
  'a material with no recorded longevity must not be placed at the top of the pyramid');
assert.equal(deriveTopMiddleBaseTendency({ lifeHours: null, distribution: [] }), 'middle',
  "with no evidence at all it falls to the neutral middle, which is the function's own tie answer");
// The boundary still works for a material that really is that volatile.
assert.equal(deriveTopMiddleBaseTendency({ lifeHours: TOP_LIFE_HOURS_CEILING, distribution: [] }), 'top',
  'a genuinely short-lived material is still a top note');
assert.equal(deriveTopMiddleBaseTendency({ lifeHours: 0, distribution: [] }), 'top',
  'and a measured zero still means top — the fix is about null, not about the threshold');

// --- 3. No sibling re-introduces it --------------------------------------------------------------------
// The bug was one helper shared by four fields. Any OTHER normaliser in these files that coerces with
// Number() before testing for an absent value has the same hole, so the shape is asserted rather than
// the one line that was fixed.
for (const file of ['referenceGuidance.js', 'canonicalReferenceProfile.js']) {
  const source = readFileSync(join(src, file), 'utf8');
  for (const match of source.matchAll(/const (\w*[Nn]umber\w*) = \(value\) => \{([\s\S]*?)\n\};/g)) {
    const [, name, body] = match;
    if (!/Number\(value\)/.test(body)) continue;
    assert.match(body, /value === null|value == null|Number\.isFinite\(value\)|typeof value === 'number'/,
      `${file}: ${name} runs Number(value) without first asking whether a value was recorded at all — `
      + 'Number(null) and Number(\'\') are both 0, which is how a blank field became a measurement');
  }
}

console.log('unrecordedIsNotZero: ok (not recorded stays null, a real 0 still passes, and nothing with '
  + 'an unrecorded longevity is called a top note)');
