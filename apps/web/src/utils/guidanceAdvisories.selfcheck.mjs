// Runnable check for dosing advisories. `node src/utils/guidanceAdvisories.selfcheck.mjs`.
//
// This file used to hold the opposite rule, and the reason it was right is worth keeping: audit round 8
// found that reading an IFRA limit of 0 as "no limit" silenced the one warning that matters most, so it
// made 0 mean PROHIBITED. Correct about IFRA-the-standard. Wrong about this catalogue.
//
// Measured against the studio's own 666 reference profiles: 76 carry ifra_limit_percent = 0, and 66 of
// those CONTRADICT THEMSELVES by carrying a positive use level beside it -- Javanol with a 2% max, Evernyl
// 5.9%, Ethyl linalool 40%, Benzyl Benzoate 80%. The remaining 10 are zero in all three columns and
// include bergamot. Not one is a plausibly banned material, and 22 of them sit in live formulas: the
// workbook printed "Prohibited by IFRA" over bergamot and Javanol, docked smoothness 8 points per row
// (average +22.2 once removed, up on 26 of 27 formulas) and refused to let the PACE engine touch them
// (56 of 81 suggestion runs changed).
//
// Dekito's decision, 11 Oct 2026: in this data 0 means NOT RECORDED.
//
// So round 8's concern is kept, by a different route. An unknown limit must not become silence: the
// simulation counts those rows as unknownIfraLimitCount and both screens that print IFRA numbers show it.
// That is asserted below, and it is the half of this guard that must never be removed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildGuidanceLimitAdvisories, getDilutionFactor, ifraLimitIsRecorded } from './rawMaterialGuidanceAdvisories.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

const at = (profile, pct) => buildGuidanceLimitAdvisories({ referenceProfile: profile, effectivePercentage: pct });

// A zero limit is NOT a limit — it is an empty field, and it must not accuse the material of anything.
// This is the exact shape of 66 of the studio's profiles: a 0 IFRA limit beside a real use level.
const selfContradicting = at({ ifra_limit_percent: 0, use_level_max_percent: 2, use_level_typical_percent: 0.2 }, 0.5);
assert.deepEqual(
  selfContradicting.filter((advisory) => advisory.type === 'ifra'),
  [],
  'a 0 IFRA limit must raise no IFRA advisory — in this catalogue it means the field is empty, and Javanol '
  + 'is not a prohibited material',
);
// Its real max level still does its job in the same breath, so this is not a blanket silencing.
assert.equal(
  at({ ifra_limit_percent: 0, use_level_max_percent: 2 }, 2.5).some((advisory) => advisory.type === 'max'),
  true,
  'the limits that ARE recorded on that profile must still be enforced',
);
// And the zero-in-all-three shape — bergamot's — says nothing at all.
assert.deepEqual(
  at({ ifra_limit_percent: 0, use_level_max_percent: 0, use_level_typical_percent: 0 }, 5),
  [],
  'a profile that is zero in all three columns has recorded nothing, and bergamot is not banned',
);

// ifraLimitIsRecorded is what the simulation counts the gap with, so it has to agree.
assert.equal(ifraLimitIsRecorded({ ifra_limit_percent: 2 }), true, 'a positive limit is recorded');
assert.equal(ifraLimitIsRecorded({ ifra_limit_percent: 0 }), false, 'zero is not a recorded limit');
assert.equal(ifraLimitIsRecorded({ ifra_limit_percent: null }), false);
assert.equal(ifraLimitIsRecorded({ ifra_limit_percent: '' }), false);
assert.equal(ifraLimitIsRecorded({}), false, 'a profile with no such field has not recorded one');
assert.equal(ifraLimitIsRecorded(null), false, 'and no profile at all never throws');

// A normal limit still behaves as before
assert.equal(at({ ifra_limit_percent: 2 }, 1.5).length, 0);
assert.equal(at({ ifra_limit_percent: 2 }, 2.5)[0].type, 'ifra');

// Unknown limits stay silent — null is "we do not know", not "zero"
assert.deepEqual(at({ ifra_limit_percent: null }, 5), []);
assert.deepEqual(at({ ifra_limit_percent: '' }, 5), []);
assert.deepEqual(at({}, 5), []);

// The same reading applies to the sibling columns, and for the same measured reason: 15 profiles carry a
// max of 0 and 15 a typical of 0, and they are the all-zero profiles — bergamot's shape, not a ceiling of
// nothing. A formula was being told it exceeded a 0.00% maximum.
assert.deepEqual(at({ use_level_typical_percent: 0 }, 0.1), [],
  'a typical level of 0 is an empty field, not a ceiling of zero');
assert.deepEqual(at({ use_level_max_percent: 0 }, 0.1), [],
  'and neither is a max level of 0');

// Nothing is reported when the material is not actually in the formula
assert.deepEqual(at({ ifra_limit_percent: 2 }, 0), [], 'a material at 0% is not using anything');

// Dilution factor is unchanged by this fix
assert.equal(getDilutionFactor(10), 0.1);
assert.equal(getDilutionFactor(100), 1);
assert.equal(getDilutionFactor(null), 1);
assert.equal(getDilutionFactor(0), 1);

// --- Round 8's concern, kept: an unknown limit must not become silence -------------------------------
// The advisory list no longer speaks for these rows, so something else has to. If this ever stops being
// true, the fix above has turned into the bug round 8 found.
const simulation = read('utils', 'formulaWorkbookSimulation.js');
assert.match(simulation, /unknownIfraLimitCount = guidanceRows\.filter\(\(row\) => !ifraLimitIsRecorded/,
  'the simulation must count the rows whose IFRA limit is not recorded');
assert.match(simulation, /^\s*unknownIfraLimitCount,$/m,
  'and must hand that count to the screens');
for (const [name, parts] of [
  ['the workbook panel', ['components', 'FormulaWorkbookSimulationPanel.jsx']],
  ['the formula overview', ['components', 'formulas', 'FormulaDetailOverviewTab.jsx']],
]) {
  assert.match(read(...parts), /unknownIfraLimitCount/,
    `${name} prints IFRA numbers and must say how many limits are not recorded — a zero alert count does `
    + 'not mean every material was checked');
}

console.log('guidanceAdvisories selfcheck OK (0 is an empty field, the limits that exist are enforced, '
  + 'and the gap is counted and shown rather than silenced)');

// One effective concentration for every call site
const { resolveEffectiveConcentration } = await import('./rawMaterialGuidanceAdvisories.js');
// Neat: listed percentage is the effective one
assert.equal(resolveEffectiveConcentration({ listedPercentage: 5 }), 5);
// The row's own dilution wins (it is what the perfumer chose for this formula)
assert.equal(resolveEffectiveConcentration({ listedPercentage: 5, item: { dilution_percent: 10 } }), 0.5);
// Falls back to the material's stocked dilution when the row does not carry one
assert.equal(resolveEffectiveConcentration({ listedPercentage: 5, material: { dilution_percentage: 10 } }), 0.5);
// Row wins over material when both are present
assert.equal(resolveEffectiveConcentration({ listedPercentage: 5, item: { dilution_percent: 50 }, material: { dilution_percentage: 10 } }), 2.5);
// Nothing in the formula means nothing to judge
assert.equal(resolveEffectiveConcentration({ listedPercentage: 0, item: { dilution_percent: 10 } }), 0);
assert.equal(resolveEffectiveConcentration({}), 0);
console.log('resolveEffectiveConcentration selfcheck OK');
