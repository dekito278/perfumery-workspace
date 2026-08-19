// Runnable check for dosing advisories. `node src/utils/guidanceAdvisories.selfcheck.mjs`.
// An IFRA limit of 0 means prohibited. Treating it as "no limit" silenced the one warning that matters most.
import assert from 'node:assert/strict';
import { buildGuidanceLimitAdvisories, getDilutionFactor } from './rawMaterialGuidanceAdvisories.js';

const at = (profile, pct) => buildGuidanceLimitAdvisories({ referenceProfile: profile, effectivePercentage: pct });

// Prohibited material: any use at all is flagged, as danger
const prohibited = at({ ifra_limit_percent: 0 }, 0.5);
assert.equal(prohibited.length, 1);
assert.equal(prohibited[0].type, 'ifra');
assert.equal(prohibited[0].severity, 'danger');
assert.equal(prohibited[0].limit, 0);
assert.match(prohibited[0].label, /Prohibited/);

// A normal limit still behaves as before
assert.equal(at({ ifra_limit_percent: 2 }, 1.5).length, 0);
assert.equal(at({ ifra_limit_percent: 2 }, 2.5)[0].type, 'ifra');

// Unknown limits stay silent — null is "we do not know", not "zero"
assert.deepEqual(at({ ifra_limit_percent: null }, 5), []);
assert.deepEqual(at({ ifra_limit_percent: '' }, 5), []);
assert.deepEqual(at({}, 5), []);

// A typical/max level of 0 is also a real ceiling
assert.equal(at({ use_level_typical_percent: 0 }, 0.1)[0].type, 'typical');
assert.equal(at({ use_level_max_percent: 0 }, 0.1)[0].type, 'max');

// Nothing is reported when the material is not actually in the formula
assert.deepEqual(at({ ifra_limit_percent: 0 }, 0), []);

// Dilution factor is unchanged by this fix
assert.equal(getDilutionFactor(10), 0.1);
assert.equal(getDilutionFactor(100), 1);
assert.equal(getDilutionFactor(null), 1);
assert.equal(getDilutionFactor(0), 1);

console.log('guidanceAdvisories selfcheck OK');
