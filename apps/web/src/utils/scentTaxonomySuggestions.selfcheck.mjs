// `node src/utils/scentTaxonomySuggestions.selfcheck.mjs`
//
// Raw materials move from the PerfumersWorld A-Z filing system (26 letters) to the Ecofragrantica
// grandfamilies (11). Dekito's decision, 2026-09-14.
//
// 26 -> 11 is LOSSY on purpose, so the things that must hold are mostly about not losing more than was
// agreed, and not sounding confident where the merge destroyed the information:
//   * every letter must land somewhere — a letter with no home silently uncategorises its materials
//   * a value in neither vocabulary must return NOTHING rather than a confident guess
//   * the migration must keep the original value, or the rollback is a lie
//   * the app must read both vocabularies until the SQL is applied
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ECOFRAGRANTICA_SCENT_TAXONOMY, findEcofragranticaGrandfamilyByValue } from './ecofragranticaScentTaxonomy.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));
const readRaw = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// scentTaxonomySuggestions.js imports through the '@/' alias, which node cannot resolve, so the map
// itself is read out of the source and exercised here. That is weaker than importing it, so everything
// that CAN be tested by behaviour is tested against the vocabulary module, which is import-free.
const suggestions = read('utils', 'scentTaxonomySuggestions.js');
const mapBlock = suggestions.slice(
  suggestions.indexOf('const ABC_LETTER_TO_GRANDFAMILY = {'),
  suggestions.indexOf('};', suggestions.indexOf('const ABC_LETTER_TO_GRANDFAMILY = {')),
);
const ABC_MAP = Object.fromEntries([...mapBlock.matchAll(/([A-Z]):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));

// --- 1. The vocabulary ---------------------------------------------------------------------------------
assert.equal(ECOFRAGRANTICA_SCENT_TAXONOMY.length, 11, 'eleven grandfamilies, no more and no fewer');
const labels = ECOFRAGRANTICA_SCENT_TAXONOMY.map((family) => family.label);
assert.deepEqual([...new Set(labels)], labels, 'two families with one label would make filing ambiguous');
for (const family of ECOFRAGRANTICA_SCENT_TAXONOMY) {
  assert.match(family.color, /^#[0-9a-f]{6}$/i, `${family.label} needs a colour for the category row`);
  assert.ok(family.subfamilies.length > 0, `${family.label} needs subfamilies to be worth filing under`);
}

// --- 2. Every one of the 26 letters must land somewhere -------------------------------------------------
// A letter with no entry sends its materials nowhere: the migration leaves them on a legacy label the
// dropdown no longer offers.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
assert.deepEqual(Object.keys(ABC_MAP).sort(), [...ALPHABET].sort(), 'all 26 letters must be mapped');
for (const letter of ALPHABET) {
  assert.ok(findEcofragranticaGrandfamilyByValue(ABC_MAP[letter]),
    `${letter} maps to "${ABC_MAP[letter]}", which is not one of the eleven grandfamilies`);
}

// The six checked against the materials actually sitting under each letter in our own seeded reference
// data. These are the ones an eyeball gets wrong — D reads like Soulful until you notice it is lactones.
assert.equal(ABC_MAP.A, 'Mineral', 'A is aliphatic aldehydes (Lauric Acid, Aldehyde C-11): Aldehydic is Mineral');
assert.equal(ABC_MAP.B, 'Herbal', 'B is Peppermint, Camphor, Borneol, Rosemary: Minty/Camphoraceous is Herbal');
assert.equal(ABC_MAP.D, 'Sweet/Balsamic', 'D is Octalactone, Delta Decalactone, Nonalactone: Lactonic is Sweet/Balsamic');
assert.equal(ABC_MAP.E, 'Soulful', 'E is Coffee, 2-Acetyl Thiazole: roasted and savoury is Soulful');
assert.equal(ABC_MAP.S, 'Woody', 'S is Turmeric, Ginger, Cassia: Spicy is a Woody subfamily');
assert.equal(ABC_MAP.Y, 'Mineral', 'Y is Treemoss, Seaweed, Ozone: Marine/Ozonic is Mineral');

// The agreed merges. If one of these ever stops collapsing, the migration is no longer what was decided.
for (const letter of ['I', 'J', 'L', 'M', 'N', 'O', 'R']) {
  assert.equal(ABC_MAP[letter], 'Floral', `${letter} is one of the seven florals that merge`);
}

// --- 3. Lookup must not be generous --------------------------------------------------------------------
// The first version took the first letter of ANY string, so "qqq" came back as Sweet/Balsamic — a
// free-text category the owner typed would have been shelved somewhere confident and wrong.
assert.equal(findEcofragranticaGrandfamilyByValue('qqq'), null, 'an unknown value has no family');
assert.equal(findEcofragranticaGrandfamilyByValue(''), null);
assert.equal(findEcofragranticaGrandfamilyByValue(null), null);
assert.equal(findEcofragranticaGrandfamilyByValue('k - konifer'), null,
  'a legacy label is not a grandfamily; it must go through the legacy lookup, not a prefix match');
assert.equal(findEcofragranticaGrandfamilyByValue('WOODY').label, 'Woody', 'case must not matter');
assert.equal(findEcofragranticaGrandfamilyByValue('sweet-balsamic').label, 'Sweet/Balsamic', 'the key works too');

assert.match(suggestions, /if \(normalized\.length !== 1\) return null;/,
  'the letter lookup must take a single letter, never the first character of an arbitrary string');
assert.match(suggestions, /findPerfumersWorldCategoryByValue\(category\)[\s\S]{0,200}?grandfamilyForAbcLetter\(legacy\.code\)/,
  'a legacy value must be resolved by matching the whole label, then mapping its code');

// --- 4. Both vocabularies must work until the SQL is applied -------------------------------------------
const service = read('services', 'rawMaterialCategoriesService.js');
assert.match(service, /ECOFRAGRANTICA_CATEGORY_VALUES\.has[\s\S]{0,120}?PERFUMERS_WORLD_CATEGORY_VALUES\.has/,
  'the category list must accept both vocabularies, or an unmigrated material loses its dropdown option');
assert.match(service, /synchronizeScentTaxonomyCategories/, 'the grandfamilies must be seeded like the A-Z rows were');

const meta = read('utils', 'rawMaterialCategoryMeta.js');
assert.match(meta, /findEcofragranticaGrandfamilyByValue\(category\)[\s\S]{0,200}?grandfamily\.label/,
  'a migrated material must still show a scent family, not "Family not set"');
// The type inference is deliberately NOT extended: Z (solvents) and P (phenols) both land in Industrial.
assert.doesNotMatch(meta, /Industrial'[\s\S]{0,120}?'solvent'/,
  'Industrial holds both solvents and phenols, so it must not be read as "solvent"');

// --- 5. The migration must keep the original, or the rollback is a lie ---------------------------------
const migration = readRaw('..', '..', '..', 'supabase', 'migrations', '20260914160000_scent_taxonomy_categories.sql');
assert.match(migration, /add column if not exists legacy_category/, 'the old value must be preserved');
assert.match(migration, /where legacy_category is null/,
  're-running must not overwrite a preserved original with the already-migrated value');
assert.match(migration, /set category = legacy_category/, 'the rollback must restore from the preserved value');
assert.match(migration, /and not exists \(\s*select 1 from public\.raw_materials/,
  'a category row still in use must not be deleted out from under its materials');
assert.match(migration, /VERIFY/);
assert.match(migration, /ROLLBACK/);

// Every letter in the code map must appear in the SQL map too, or the two disagree about the same move.
for (const letter of ALPHABET) {
  const pattern = new RegExp(`\\('${letter.toLowerCase()} - [^']*',\\s*'${ABC_MAP[letter].replace('/', '\\/')}'\\)`);
  assert.match(migration, pattern, `the SQL must move ${letter} to ${ABC_MAP[letter]}, same as the app does`);
}

console.log('scentTaxonomySuggestions selfcheck OK (26 -> 11, nothing stranded, the original kept)');
