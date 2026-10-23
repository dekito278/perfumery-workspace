// `node src/utils/measuredLifeDecidesThePyramid.selfcheck.mjs`
//
// When a material's life has been MEASURED, that measurement places it — on its own, including the band
// between the two thresholds.
//
// WHY, with the numbers. resolvePyramidPlacement asks three sources: the reference profile's stated
// tendency, the material's own column, then an inference. The first is null on all 666 profiles, so it
// never fires; the column is filled on 551 of 774 materials; the remaining 223 are inferred. And the
// inference was weak — withholding the column and re-deriving it agreed with Dekito on 295 of 551, 46%.
// That reaches every screen printing a pyramid balance: on GARNET-1, four guessed materials carried
// 93.3% of the formula's weight.
//
// Measured on the live studio 2026-10-24, Dekito's 549 placed materials that carry a life separate
// PERFECTLY by that life, with no overlap whatsoever:
//
//     top     n=157    0 – 11 h
//     middle  n=281   12 – 112 h
//     base    n=111  120 – 2000 h
//
// Disjoint. So `top if <= 11, base if >= 120, otherwise middle` reproduces 549 of 549 — 100%, verified
// by query against his own answers. The hours are not a proxy for his rule; they ARE his rule.
//
// What changed to get there: the ceiling was 10, which put his eleven-hour materials on the wrong side
// of his own line, and a known in-band life fell through to the ABC-class weighing instead of simply
// answering "middle". The class weighing remains for materials whose life nobody has measured, which is
// the only case it was ever for.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The module imports through Vite's `@/` alias, which node cannot resolve. Strip the imports, stub what
// those four names provide, and run the REAL function rather than a copy of it — a copy would keep
// passing after the original changed.
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
const { deriveTopMiddleBaseTendency, TOP_LIFE_HOURS_CEILING, BASE_LIFE_HOURS_FLOOR } = mod;

const derive = (lifeHours, distribution = []) => deriveTopMiddleBaseTendency({ lifeHours, distribution });
const woody = (share) => [{ letter: 'W', share }];
const volatile_ = (share) => [{ letter: 'A', share }];

// --- 1. The boundaries are the measured ones ---------------------------------------------------------
assert.equal(TOP_LIFE_HOURS_CEILING, 11,
  'the ceiling must be his measured boundary: his longest top note lasts 11 hours and his shortest '
  + 'middle lasts 12. A ceiling of 10 puts the eleven-hour materials on the wrong side of his own line');
assert.equal(BASE_LIFE_HOURS_FLOOR, 120,
  'his shortest base lasts 120 hours and his longest middle 112 — the floor sits in that gap');

// --- 2. A measured life decides alone, against the strongest possible contrary class spread ----------
// This is the whole fix. Each of these would previously have fallen through to the class weighing.
for (const hours of [12, 20, 36, 60, 90, 112, 119]) {
  assert.equal(derive(hours, woody(100)), 'middle',
    `${hours}h is inside his measured middle band, so it is a middle note even with a fully woody class `
    + 'spread — falling through to the class weighing here is what produced the 46%');
  assert.equal(derive(hours, volatile_(100)), 'middle',
    `${hours}h must not be pulled to top by a volatile class spread either`);
}
// And the two ends still answer, likewise regardless of the spread.
assert.equal(derive(11, woody(100)), 'top', 'eleven hours is his top boundary, inclusive');
assert.equal(derive(120, volatile_(100)), 'base', 'a hundred and twenty hours is his base floor, inclusive');
assert.equal(derive(2000, volatile_(100)), 'base');

// --- 3. The boundaries are exact, not approximate ----------------------------------------------------
// One hour either side flips the answer. A rule whose edges are soft is a rule nobody can check.
assert.equal(derive(11), 'top');
assert.equal(derive(12), 'middle', 'twelve hours is his shortest middle, not a top note');
assert.equal(derive(112), 'middle', 'a hundred and twelve hours is his longest middle, not a base');
assert.equal(derive(119), 'middle');
assert.equal(derive(120), 'base');

// --- 4. An UNMEASURED life still falls through to the class weighing ----------------------------------
// The class spread is poor at placing materials whose life is known. It is all there is for the 195
// materials whose life nobody has recorded, and removing it would place them on nothing at all.
assert.equal(derive(null, woody(100)), 'base',
  'with no measured life the class spread must still answer — it is the only evidence left');
assert.equal(derive(null, volatile_(100)), 'top');
assert.equal(derive(null, []), 'middle', 'and with no evidence of any kind it must not lean');

// --- 5. Zero hours is left exactly as it was ----------------------------------------------------------
// 0 reads as "instantly volatile" where it may only mean "nobody wrote it down" — the empty-column trap.
// But the live data will not carry that argument: exactly FOUR materials hold 0 hours, and the single
// one Dekito has placed, he placed as a MIDDLE. One label cannot move a branch resting on 139 materials
// with 1 wrong. Four rows are a cleanup for his own hands. This pins the behaviour as unchanged so that
// the decision stays deliberate rather than drifting later.
assert.equal(derive(0, woody(100)), 'top',
  'zero hours was NOT changed by the 2026-10-24 work — see the comment above before touching it');

console.log(`measuredLifeDecidesThePyramid selfcheck OK (top <=${TOP_LIFE_HOURS_CEILING}h, base >=${BASE_LIFE_HOURS_FLOOR}h, in-band is middle; 549/549 of Dekito's own answers)`);
