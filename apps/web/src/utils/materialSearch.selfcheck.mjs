// `node src/utils/materialSearch.selfcheck.mjs`
//
// "Find me a material" was answered twice, and the two answers disagreed. The raw-materials list asks the
// database across six columns; the composer's material library -- the screen a perfumer uses while
// actually building a formula -- filtered by NAME alone. Of the studio's 774 materials, 578 carry a
// workbook code, 656 a CAS number and 757 a scent family: every one of those found a material on the
// list and nothing at all in the composer.
//
// This holds the two sides to one field list. The composer side is tested as behaviour; the service side
// builds its PostgREST `or()` from the same constant, and that is checked in the source because the
// clause only exists inside a Supabase call.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MATERIAL_SEARCH_FIELDS, materialMatchesQuery, searchMaterials } from './materialSearch.js';

const root = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(root, '..', ...parts), 'utf8');

// --- 1. Every searchable field really finds a material -------------------------------------------------
// One material, one distinctive value per field, and each value looked up on its own. A field quietly
// dropped from the list fails here rather than in the library's empty state.
const material = {
  id: 'rm-1',
  name: 'Iso E Super',
  category: 'Woody',
  vendor: 'Perfumers Apprentice',
  cas_number: '54464-57-2',
  workbook_code: 'W-0412',
  scent_family: 'Ambery Woody',
};
for (const field of MATERIAL_SEARCH_FIELDS) {
  assert.ok(material[field], `the fixture has no ${field} to search for — the test would pass vacuously`);
  assert.equal(materialMatchesQuery(material, material[field]), true,
    `searching for a material by its ${field} finds nothing`);
}
assert.equal(MATERIAL_SEARCH_FIELDS.length, 6, 'six fields, as the raw-materials list has always searched');

// --- 2. The parts that make a search usable -----------------------------------------------------------
assert.equal(materialMatchesQuery(material, 'iso e'), true, 'a partial name matches');
assert.equal(materialMatchesQuery(material, 'ISO E SUPER'), true, 'case does not matter');
assert.equal(materialMatchesQuery(material, '  w-0412  '), true, 'a pasted code carries whitespace');
assert.equal(materialMatchesQuery(material, '54464'), true, 'part of a CAS number is how one is typed');
assert.equal(materialMatchesQuery(material, 'hedione'), false, 'and an unrelated query matches nothing');
assert.equal(materialMatchesQuery(material, ''), true, 'an empty query shows the whole library');
assert.equal(materialMatchesQuery(material, '   '), true, 'and so does whitespace');
assert.equal(materialMatchesQuery(null, 'iso'), false, 'a missing material never matches, and never throws');
// Sparse rows are the normal case here: a quarter of the studio's materials have no workbook code.
assert.equal(materialMatchesQuery({ name: 'Linalool' }, 'linalool'), true,
  'a material with only a name is still findable');
assert.equal(materialMatchesQuery({ name: null, cas_number: '78-70-6' }, '78-70'), true,
  'and a null field is skipped rather than thrown on');

// --- 3. The library keeps its order --------------------------------------------------------------------
const library = [{ name: 'Zingerone' }, { name: 'Ambroxan' }, { name: 'Muscone' }];
assert.deepEqual(searchMaterials(library, '').map((entry) => entry.name), ['Ambroxan', 'Muscone', 'Zingerone'],
  'the library is sorted by name whether or not anything is typed');
assert.deepEqual(searchMaterials(library, 'mus').map((entry) => entry.name), ['Muscone']);
assert.deepEqual(searchMaterials(undefined, 'x'), [], 'no materials, no crash');
assert.deepEqual(searchMaterials([{ name: null }, { name: 'A' }], '').map((entry) => entry.name), [null, 'A'],
  'a nameless row does not take the sort down with it');

// --- 4. Both screens read the one list -----------------------------------------------------------------
// The composer is the side that was wrong, and it was wrong by building its own filter inline.
const composer = read('hooks', 'useFormulaComposer.js');
assert.match(composer, /searchMaterials\(rawMaterials, materialLibraryQuery\)/,
  "the composer's library is filtering by itself again");
assert.ok(!/material\.name\.toLowerCase\(\)\.includes/.test(composer),
  'the name-only filter is back in the composer');

// The service's clause lives inside a Supabase call, so the source is where it can be checked: it must be
// BUILT from the shared list, not retyped beside it.
const service = read('services', 'rawMaterialsService.js');
assert.match(service, /MATERIAL_SEARCH_FIELDS\.map\(\(field\) => `\$\{field\}\.ilike/,
  'the raw-materials search must build its or() from the shared field list');
for (const field of MATERIAL_SEARCH_FIELDS) {
  assert.ok(!new RegExp(`\`${field}\\.ilike`).test(service),
    `${field}.ilike is hand-written in the service again, so the two screens can drift apart`);
}

console.log(`materialSearch selfcheck OK (${MATERIAL_SEARCH_FIELDS.length} fields, one list, read by the `
  + "raw-materials search and the composer's library)");
