// `node src/utils/canonicalTendency.selfcheck.mjs`
//
// deriveTopMiddleBaseTendency decides where a material sits in the pyramid when nobody has said — 223 of
// the studio's 774 — and those placements feed the Top / Middle / Base percentages that Opening, Heart,
// Drydown and Tenacity are built from.
//
// Its thresholds were close to a coin flip. Measured against the 551 materials where Dekito HAS stated an
// answer, which is the only ground truth this catalogue has:
//
//   life <= 8  -> top    139 materials,   1 wrong  (1%)
//   life >= 36 -> base   260 materials, 149 wrong  (57%)
//   distribution         152 materials, 106 wrong  (70%)
//
// and 251 of the 256 errors were one mistake wearing two faces: Dekito says MIDDLE, the code says anything
// else. A 36-hour cutoff calls most hearts a base note; a 20-point lead leaves middle almost no room.
//
// Refitted to 10 / 120 / 60 — 54% agreement to 78% — and checked out of sample rather than trusted:
// splitting those 551 by id, fitting on one half and testing on the other picks these same three numbers
// from either half and scores 77-79% on the half it never saw, against 51-56% for the old ones.
//
// This file holds the SHAPE those measurements imply, not the percentages themselves: a guard cannot reach
// production data, so what it can do is refuse the specific mistakes that were being made.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'canonicalReferenceProfile.js'), 'utf8')
  .replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '');
assert.ok(!/^import\s/m.test(source), 'an import survived the strip');
const mod = await import(
  `data:text/javascript;base64,${Buffer.from(`
const WORKBOOK_ABC_CLASSIFICATIONS = [];
const getWorkbookAbcClassificationByLetter = () => null;
const getWorkbookAbcClassificationByFamilyName = () => null;
const extractWorkbookClassDistribution = () => [];
${source}`, 'utf8').toString('base64')}`
);
const {
  deriveTopMiddleBaseTendency: derive,
  TOP_LIFE_HOURS_CEILING,
  BASE_LIFE_HOURS_FLOOR,
  CLASS_LEAD_MARGIN,
} = mod;

const woody = (share) => [{ letter: 'W', share }];
const citrus = (share) => [{ letter: 'C', share }];
const mixed = (top, base) => [{ letter: 'C', share: top }, { letter: 'W', share: base }];

// --- 1. The mistake that was being made 164 times: a long-lasting heart called a base ----------------
// 36 hours is an ordinary heart material. It must not be forced to base by the life shortcut alone.
for (const hours of [36, 48, 72, 96, 119]) {
  assert.notEqual(
    derive({ lifeHours: hours, distribution: mixed(40, 40) }),
    'base',
    `a material lasting ${hours}h with a balanced class spread must not be forced to base — a 36-hour `
    + 'cutoff was calling most of the studio\'s hearts a base note (149 wrong out of 260)',
  );
}
assert.equal(derive({ lifeHours: 60, distribution: mixed(40, 40) }), 'middle',
  'and with nothing leaning either way it belongs in the middle, which is the answer the old thresholds '
  + 'almost never gave');

// --- 2. The branch that was already right stays right -------------------------------------------------
// 139 materials, 1 wrong. Nothing here was allowed to weaken it.
for (const hours of [0, 1, 4, 8, 10]) {
  assert.equal(derive({ lifeHours: hours, distribution: woody(100) }), 'top',
    `a ${hours}h material is a top note however woody its class spread — this branch was 99% right`);
}
assert.ok(TOP_LIFE_HOURS_CEILING >= 8 && TOP_LIFE_HOURS_CEILING <= 12,
  `the top ceiling is ${TOP_LIFE_HOURS_CEILING}h; the fit put it at 10 and anything far from that was `
  + 'measurably worse');

// --- 3. A genuinely long-lasting material is still a base --------------------------------------------
for (const hours of [120, 240, 500]) {
  assert.equal(derive({ lifeHours: hours, distribution: citrus(100) }), 'base',
    `a ${hours}h material is a base note however fresh its class spread`);
}
assert.ok(BASE_LIFE_HOURS_FLOOR >= 96 && BASE_LIFE_HOURS_FLOOR <= 168,
  `the base floor is ${BASE_LIFE_HOURS_FLOOR}h; the fit put it at 120 and both halves of the holdout `
  + 'agreed on it');

// --- 4. The margin has to leave room for middle ------------------------------------------------------
// This is the other half of the same error: a 20-point lead meant almost nothing ever landed in middle.
assert.equal(derive({ lifeHours: null, distribution: mixed(60, 30) }), 'middle',
  'a 30-point lead is not enough to call a material top — it was, and middle disappeared');
assert.equal(derive({ lifeHours: null, distribution: mixed(80, 10) }), 'top',
  'but a 70-point lead is');
assert.equal(derive({ lifeHours: null, distribution: mixed(10, 80) }), 'base',
  'and the same the other way');
assert.ok(CLASS_LEAD_MARGIN >= 40, `the lead margin is ${CLASS_LEAD_MARGIN}; below 40 middle starts `
  + 'vanishing again, which is what 251 of the 256 errors were');

// --- 5. Nothing stated, nothing known ----------------------------------------------------------------
assert.equal(derive({ lifeHours: null, distribution: [] }), 'middle',
  'with no life hours and no class spread, middle is the honest answer — not a confident base');
assert.equal(derive({ lifeHours: null, distribution: undefined }), 'middle', 'and it must not throw');
assert.equal(derive({ lifeHours: undefined, distribution: [] }), 'middle',
  'undefined life hours must behave like unknown, not like zero — zero would read as a top note');

console.log(`canonicalTendency selfcheck OK (top <= ${TOP_LIFE_HOURS_CEILING}h, base >= `
  + `${BASE_LIFE_HOURS_FLOOR}h, lead margin ${CLASS_LEAD_MARGIN}, and a long-lasting heart stays a heart)`);
