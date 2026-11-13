// `node src/utils/catalogSearch.selfcheck.mjs` — "segar" finds FRESH (second visitor audit, 13 Nov 2026).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { catalogSearchTerms, matchesCatalogSearch } from './catalogSearch.js';

assert.ok(matchesCatalogSearch('Wongka! FRESH citrus', 'segar'), 'an Indonesian word finds the English family');
assert.ok(matchesCatalogSearch('Ayang-ayang segar melati', 'fresh'), 'and the other way round');
assert.ok(matchesCatalogSearch('Vetiver Haiti', 'akar wangi'), 'a two-word name translates whole');
assert.ok(!matchesCatalogSearch('La Rose FLORAL', 'segar'), 'a translation, not a guess: floral is not fresh');
assert.ok(matchesCatalogSearch('anything', '  '), 'an empty search matches everything');
assert.deepEqual(catalogSearchTerms('Segar'), ['segar', 'fresh'], 'case does not matter');
assert.deepEqual(catalogSearchTerms('xyz'), ['xyz'], 'an unknown word is searched as typed');
assert.match(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'pages', 'CatalogPage.jsx'), 'utf8'),
  /return matchesCatalogSearch\(searchable, query\);/, 'the catalogue searches through it');
console.log('catalogSearch selfcheck OK (the shop\'s words and the catalogue\'s words find each other)');
