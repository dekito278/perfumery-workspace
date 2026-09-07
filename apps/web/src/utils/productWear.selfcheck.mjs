// `node src/utils/productWear.selfcheck.mjs`
import assert from 'node:assert/strict';
import { normalizeWear, isWearTagged, toggleWearValue, matchesWear, describeWear, WEAR_KEYS } from './productWear.js';

// Every row written before the column existed holds {}. The studio opens those every day.
assert.deepEqual(normalizeWear({}), { occasions: [], times: [], weather: [] });
assert.deepEqual(normalizeWear(null), { occasions: [], times: [], weather: [] });
assert.deepEqual(normalizeWear('kerja'), { occasions: [], times: [], weather: [] }, 'a string is not a wear object');
assert.deepEqual(normalizeWear({ occasions: 'kerja' }), { occasions: [], times: [], weather: [] }, 'a string is not a list');

// Only the fixed vocabulary survives — a wardrobe filtering on free text filters on nothing.
assert.deepEqual(normalizeWear({ occasions: ['kerja', 'wibu', 'KERJA', ' kerja '] }).occasions, ['kerja'],
  'unknown values dropped, case and padding folded, duplicates collapsed');

assert.equal(isWearTagged({}), false);
assert.equal(isWearTagged({ times: ['pagi'] }), true);

// Toggling is what the form does on every chip tap.
assert.deepEqual(toggleWearValue({}, 'times', 'pagi').times, ['pagi']);
assert.deepEqual(toggleWearValue({ times: ['pagi'] }, 'times', 'pagi').times, [], 'tapping again clears it');
assert.deepEqual(toggleWearValue({}, 'times', 'tengah malam').times, [], 'invalid values never enter');
assert.deepEqual(toggleWearValue({}, 'nonsense', 'x'), normalizeWear({}), 'unknown facet is a no-op');

// Matching: unset facets are ignored, and an untagged product never matches a set one.
const bottle = { occasions: ['kerja'], times: ['pagi'], weather: [] };
assert.equal(matchesWear(bottle, {}), true, 'no filter, everything shows');
assert.equal(matchesWear(bottle, { times: ['pagi'] }), true);
assert.equal(matchesWear(bottle, { times: ['malam'] }), false);
assert.equal(matchesWear(bottle, { times: ['pagi', 'malam'] }), true, 'within a facet, any match counts');
assert.equal(matchesWear(bottle, { times: ['pagi'], occasions: ['perayaan'] }), false, 'across facets, all must match');
assert.equal(matchesWear(bottle, { weather: ['hujan'] }), false, 'silence is not a yes — untagged cannot match');
assert.equal(matchesWear({}, { times: ['pagi'] }), false, 'an untagged product stays out of a filtered view');

assert.deepEqual(describeWear(bottle), ['Kerja', 'Pagi']);
assert.deepEqual(WEAR_KEYS, ['occasions', 'times', 'weather']);


// A single string is a real selection, not an absent one. This is the shape the catalog page sends,
// and treating it as "unset" turned every filter into a silent no-op.
assert.equal(matchesWear({ occasions: ['kerja'] }, { occasions: 'kerja' }), true);
assert.equal(matchesWear({ occasions: ['santai'] }, { occasions: 'kerja' }), false);
assert.equal(matchesWear({}, { occasions: 'kerja' }), false);
assert.equal(matchesWear({ occasions: ['kerja'] }, { occasions: '' }), true);
assert.equal(matchesWear({ occasions: ['kerja'] }, { occasions: '  Kerja ' }), true);

console.log('productWear selfcheck OK');
