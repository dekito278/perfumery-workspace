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
// Fourth audit, 13 Nov 2026: Back from a perfume lost the family, the search and the wear filters. They
// live in the address now.
{
  const catalog = readFileSync(new URL('../pages/CatalogPage.jsx', import.meta.url), 'utf8');
  assert.match(catalog, /const familyParam = searchParams\.get\('family'\) \|\| '';/, 'the family is read from the address');
  for (const key of ['q', 'occasion', 'time', 'weather']) {
    assert.match(catalog, new RegExp(`write\\('${key}', `), `${key} is written back to the address`);
  }
  assert.match(catalog, /\}, \{ replace: true \}\);\s*\}, \[searchTerm, wearSelection, setSearchParams\]\);/, 'without a history entry per keystroke');
}
console.log('catalogSearch selfcheck OK (the shop\'s words and the catalogue\'s words find each other)');
