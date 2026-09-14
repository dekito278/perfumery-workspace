// `node src/utils/productCopy.selfcheck.mjs`
//
// The interface around a product comes from a message file. The product's own words do not — they are
// Dekito's, written per bottle, and they live in the database beside the Indonesian ones.
//
// Two ways to get this wrong, and both are silent:
//
//   Fall back per PRODUCT and a bottle with an English description but no English notes shows nothing
//   English at all, hiding work already done.
//
//   Fall back nowhere and an untranslated bottle renders blank — worse than a foreign sentence, because
//   the page looks broken rather than unfinished.
//
// So: per field, and every fallback lands on the Indonesian text that was always there.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { englishCopyProgress, productCopyFor } from './productCopy.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

const bottle = {
  description: 'Dari seri Macapat.',
  notes: 'White floral, olibanum, musk',
  topNotes: ['Jasmine Sambac'],
  heartNotes: ['Cempaka', 'Olibanum Boswellia'],
  baseNotes: ['White Musk', 'Deer Musk'],
  descriptionEn: 'From the Macapat series.',
  notesEn: '',
  topNotesEn: ['Jasmine Sambac'],
  heartNotesEn: [],
  baseNotesEn: [],
};

// --- 1. Indonesian is untouched by any of this --------------------------------------------------------
{
  const copy = productCopyFor(bottle, 'id');
  assert.equal(copy.description, bottle.description);
  assert.equal(copy.notes, bottle.notes);
  assert.deepEqual(copy.topNotes, bottle.topNotes, 'even where an English list exists, the Indonesian shop reads Indonesian');
  assert.deepEqual(copy.heartNotes, bottle.heartNotes);
}

// --- 2. Per field, not per product ----------------------------------------------------------------------
{
  const copy = productCopyFor(bottle, 'en');
  assert.equal(copy.description, 'From the Macapat series.', 'the translated description is used');
  assert.deepEqual(copy.topNotes, ['Jasmine Sambac'], 'and the translated list');
  assert.equal(copy.notes, bottle.notes, 'the untranslated field falls back, on its own');
  assert.deepEqual(copy.heartNotes, bottle.heartNotes, 'an empty English list is "not translated", not "no notes"');
  assert.deepEqual(copy.baseNotes, bottle.baseNotes);
}

// --- 3. Nothing can render blank -------------------------------------------------------------------------
// A blank product page reads as broken; an untranslated one reads as unfinished. Only the second is true.
{
  const untranslated = { description: 'Dari seri Macapat.', notes: 'x', topNotes: ['a'], heartNotes: ['b'], baseNotes: ['c'] };
  const copy = productCopyFor(untranslated, 'en');
  assert.equal(copy.description, 'Dari seri Macapat.');
  assert.deepEqual(copy.topNotes, ['a']);
  for (const value of Object.values(copy)) {
    assert.ok(Array.isArray(value) ? value.length : String(value).length, 'no field comes back empty');
  }
}
// Whitespace is not a translation.
assert.equal(productCopyFor({ description: 'asli', descriptionEn: '   ' }, 'en').description, 'asli');
assert.equal(productCopyFor({ description: 'asli', descriptionEn: null }, 'en').description, 'asli');
assert.deepEqual(productCopyFor({ topNotes: ['a'], topNotesEn: 'bukan array' }, 'en').topNotes, ['a']);
assert.deepEqual(productCopyFor({ topNotes: ['a'], topNotesEn: [null, ''] }, 'en').topNotes, ['a'],
  'a list of empty strings is not a translation either');
// No product, no crash.
assert.doesNotThrow(() => productCopyFor(null, 'en'));
assert.doesNotThrow(() => productCopyFor(undefined, 'id'));
// An unknown region is Indonesian, matching resolveRegion's default.
assert.equal(productCopyFor(bottle, 'xx').description, bottle.description);

// --- 4. Progress is counted honestly ----------------------------------------------------------------------
assert.deepEqual(englishCopyProgress(bottle), { filled: 2, total: 5, complete: false });
assert.equal(englishCopyProgress({}).filled, 0);
assert.equal(englishCopyProgress({
  descriptionEn: 'a', notesEn: 'b', topNotesEn: ['c'], heartNotesEn: ['d'], baseNotesEn: ['e'],
}).complete, true);

// --- 5. The English copy survives BOTH hand-written field lists ----------------------------------------------
// fromDatabaseRow and toPublicFragrance each rebuild a product field by field. A field not named in them
// simply does not exist downstream — which is exactly how the member price nudge shipped invisible (#147),
// and it was found in production rather than here.
const service = read('services', 'productCatalogService.js');
const mapper = read('data', 'publicStorefront.js');
for (const [name, source] of [['fromDatabaseRow', service], ['toPublicFragrance', mapper]]) {
  for (const field of ['descriptionEn', 'notesEn', 'topNotesEn', 'heartNotesEn', 'baseNotesEn']) {
    assert.ok(source.includes(field), `${name} must carry ${field} — an unnamed field vanishes`);
  }
}
// And the public mapper must NOT fall back to Indonesian there: that would make "translated" and
// "not translated" indistinguishable by the time productCopyFor sees it.
assert.match(mapper, /descriptionEn: product\.descriptionEn \|\| '',/,
  'the mapper carries the English copy raw; the fallback belongs to productCopyFor alone');

// --- 6. Both product pages read through it ------------------------------------------------------------------
for (const page of [['pages', 'PublicProductDetailPage.jsx'], ['pages', 'mobile', 'MobileProductDetailPage.jsx']]) {
  const source = read(...page);
  assert.match(source, /const copy = productCopyFor\(product, region\);/, `${page.join('/')} resolves the copy`);
  // AFTER `product` is declared. Putting it above threw "Cannot access 'product' before initialization"
  // and killed the entire page — while the build, eslint and every other guard stayed green. Only
  // opening the page in a browser found it, so the ordering is held here explicitly.
  assert.ok(source.indexOf('const product =') < source.indexOf('const copy = productCopyFor'),
    `${page.join('/')} must declare the product before reading its copy`);
  assert.match(source, /text=\{copy\.description\}/, `${page.join('/')} renders the resolved description`);
  assert.doesNotMatch(source, /text=\{product\.story \|\| product\.description\}|text=\{product\.story\}/,
    `${page.join('/')} must not read the raw Indonesian description around productCopyFor`);
}
assert.match(read('pages', 'mobile', 'MobileProductDetailPage.jsx'), /\{copy\.topNotes\.join\(', '\)\}/,
  'the phone pyramid reads the resolved notes');
assert.match(read('pages', 'PublicProductDetailPage.jsx'), /<ScentPyramid product=\{\{ \.\.\.product, \.\.\.copy \}\} \/>/,
  'the desktop pyramid is handed the resolved notes');

// --- 7. The migration exists, is not destructive, and keeps the view in step ------------------------------------
// The public view copies every table column through jsonb_populate_record, but a new column only appears
// once the view is recreated. Adding the columns without that ships a feature that reads nothing.
const migration = stripComments(readFileSync(join(root, '..', '..', '..', 'supabase', 'migrations', '20260916090000_storefront_product_copy_en.sql'), 'utf8'));
assert.match(migration, /add column if not exists description_en text/, 'the columns are added');
assert.match(migration, /create or replace view public\.storefront_products_public/, 'and the view is recreated, or nothing can read them');
assert.match(migration, /grant select on public\.storefront_products_public to anon, authenticated;/, 'and re-granted');
assert.doesNotMatch(migration.split('ROLLBACK')[0], /drop column|delete from|truncate/i,
  'the forward migration destroys nothing — every column is additive and nullable');
assert.doesNotMatch(migration, /^\s*(begin|commit)\s*;/mi,
  "no transaction block: Dekito's SQL editor silently refuses scripts that manage their own");

console.log('productCopy selfcheck OK (a product speaks the shop\'s language per field, never blank, and the English copy survives both hand-written mappers)');
