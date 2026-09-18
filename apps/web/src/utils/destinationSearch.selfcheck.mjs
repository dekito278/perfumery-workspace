// `node src/utils/destinationSearch.selfcheck.mjs`
//
// Two hundred countries in a native <select>, which has no search. The text box that filters it has one
// rule that fails silently: a <select> whose value is not among its options renders blank in some
// browsers and jumps to the FIRST option in others. Either way a search typed after choosing the
// country would re-quote the order to somewhere else, and the price would simply change on screen.
import assert from 'node:assert/strict';
import { filterDestinations, countMatches } from './destinationSearch.js';
import { listExportDestinations } from '../data/exportZones.js';

const real = listExportDestinations();
assert.ok(real.length > 100, `the destination list has collapsed to ${real.length} entries`);

// --- 1. The chosen country never leaves the list ------------------------------------------------------
// Run against the REAL list, and against a query that matches nothing at all — the worst case.
for (const query of ['jep', 'zzzzz', 'malaysia', 'x']) {
  const shown = filterDestinations(real, query, 'MY');
  assert.ok(shown.some((item) => item.code === 'MY'),
    `searching "${query}" dropped the selected country out of the options — the select would silently change it`);
}
// And the order is not shuffled: the survivors keep the order they had.
const filtered = filterDestinations(real, 'a', 'MY');
const order = real.filter((item) => filtered.includes(item));
assert.deepEqual(filtered.map((item) => item.code), order.map((item) => item.code));

// --- 2. It actually filters -----------------------------------------------------------------------
const jp = filterDestinations(real, 'jepang', 'MY');
assert.ok(jp.length < real.length, 'the search narrowed nothing');
assert.ok(jp.some((item) => /jepang/i.test(item.name)), 'the search did not find the country it names');
assert.deepEqual(filterDestinations(real, '', 'MY').length, real.length, 'an empty search must show everything');
assert.deepEqual(filterDestinations(real, '   ', 'MY').length, real.length, 'whitespace is an empty search');

// --- 3. Case and accents are not a barrier ------------------------------------------------------------
const sample = [
  { code: 'RE', name: 'Réunion', zone: 8 },
  { code: 'MY', name: 'Malaysia', zone: 2 },
  { code: 'MM', name: 'Myanmar', zone: 2 },
  // Its code shares no letter with its Indonesian name, which is what makes it the only entry able to
  // tell exact-code matching apart from substring-code matching.
  { code: 'DE', name: 'Jerman', zone: 7 },
];
assert.deepEqual(filterDestinations(sample, 'reunion', '').map((item) => item.code), ['RE'],
  'an accented name is unreachable from a plain keyboard');
assert.deepEqual(filterDestinations(sample, 'MALAY', '').map((item) => item.code), ['MY']);

// --- 4. The two-letter code matches exactly, never as a substring -------------------------------------
// "my" as a substring matches Myanmar and Malaysia by accident; as a code it means one country.
assert.deepEqual(filterDestinations(sample, 'MM', '').map((item) => item.code), ['MM']);
assert.deepEqual(filterDestinations(sample, 'm', '').map((item) => item.code), ['MY', 'MM', 'DE'],
  'a single letter should match names, not pick a country by half its code');
// The whole difference between `code === needle` and `code.includes(needle)`: "d" is half of DE and
// appears nowhere in "Jerman". A substring match on a two-letter code turns single keystrokes into
// country hits, which is how a search lands on Germany while you are typing "Denmark".
assert.deepEqual(filterDestinations(sample, 'd', '').map((item) => item.code), [],
  'half a country code was treated as a match');
assert.deepEqual(filterDestinations(sample, 'de', '').map((item) => item.code), ['DE'],
  'the whole code must still find its country');

// --- 5. The count reports what was FOUND, not what is on screen ---------------------------------------
// The selected country is in the list whether it matched or not, so counting the list would say
// "1 negara cocok" for a search that found nothing — and Dekito would go looking for the match.
assert.equal(countMatches(real, 'zzzzz'), 0, 'a search that finds nothing must say so');
assert.equal(filterDestinations(real, 'zzzzz', 'MY').length, 1, 'and the selected country is still shown');
assert.equal(countMatches(real, ''), real.length);
assert.equal(countMatches(sample, 'malaysia'), 1);

console.log('destinationSearch selfcheck OK (a searchable country list that never drops the country already chosen, and never claims a match it did not find)');
