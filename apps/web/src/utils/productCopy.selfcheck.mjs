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

// --- 5. The English copy survives ALL THREE hand-written field lists ------------------------------------------
// fromDatabaseRow, normalizeProduct and toPublicFragrance each rebuild a product field by field. A field
// not named in them simply does not exist downstream — which is exactly how the member price nudge
// shipped invisible (#147), and it was found in production rather than here.
//
// This checks each FUNCTION, not each file. The first version of this guard asked whether the file
// contained the word, and productCatalogService.js did: fromDatabaseRow named all five and handed them
// straight to normalizeProduct, which is a second field list in the same file and named none of them.
// The five columns were filled in the database, readable anonymously, and the page still showed
// Indonesian — with every guard here green.
const service = read('services', 'productCatalogService.js');
const mapper = read('data', 'publicStorefront.js');
const bodyOf = (source, declaration, file) => {
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${file} no longer declares ${declaration} — this guard is reading nothing`);
  const next = source.indexOf('\nconst ', start + declaration.length);
  const end = source.indexOf('\nexport const ', start + declaration.length);
  const stop = [next, end].filter((at) => at > 0).sort((a, b) => a - b)[0] ?? source.length;
  return source.slice(start, stop);
};
for (const [name, body] of [
  ['fromDatabaseRow', bodyOf(service, 'const fromDatabaseRow = (row) =>', 'productCatalogService.js')],
  ['normalizeProduct', bodyOf(service, 'export const normalizeProduct = ', 'productCatalogService.js')],
  ['toPublicFragrance', bodyOf(mapper, 'descriptionEn: product.descriptionEn', 'publicStorefront.js')],
]) {
  for (const field of ['descriptionEn', 'notesEn', 'topNotesEn', 'heartNotesEn', 'baseNotesEn']) {
    assert.ok(body.includes(field),
      `${name} must carry ${field} — an unnamed field vanishes at that line, however many mappers above it named the field`);
  }
}
// normalizeProduct must not invent an Indonesian fallback either: '' means "not translated yet", and a
// fallback here would make the two states indistinguishable before productCopyFor ever runs.
assert.match(service, /descriptionEn: typeof input\.descriptionEn === 'string' \? input\.descriptionEn : '',/,
  'normalizeProduct carries the English description raw, with no Indonesian fallback');
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

// --- 6b. The immersive story never reaches the English shop -------------------------------------------------
// One product has a hand-written editorial story — a letter in Indonesian, with no English version — and
// the product page returns a completely different component for it, above every line that resolves the
// English copy. An English reader got the whole page in Indonesian with all five columns filled and
// every other guard green.
// Held as the RULE now — the English shop is never shown an Indonesian story — rather than as the one
// expression that used to enforce it. Ayang-ayang has an English letter of its own; pinning the old
// `isInternational ? null` shape made writing one look like a regression.
{
  const page = read('pages', 'PublicProductDetailPage.jsx');
  const { getProductStory } = await import('../data/stories/index.js');
  const { REGION_EN, REGION_ID } = await import('./storefrontRegion.js');

  // A product with no story has none in either shop.
  assert.equal(getProductStory('pantura', REGION_ID), null);
  assert.equal(getProductStory('pantura', REGION_EN), null);

  const idStory = getProductStory('ayang-ayang', REGION_ID);
  const enStory = getProductStory('ayang-ayang', REGION_EN);
  assert.ok(idStory && enStory, 'Ayang-ayang has a letter in both shops');
  assert.notEqual(enStory.hero.eyebrow, idStory.hero.eyebrow, 'and they are not the same words');
  assert.notEqual(enStory.hero.subtitle, idStory.hero.subtitle);
  assert.equal(enStory.sections.length, idStory.sections.length, 'the same page, told twice');
  // Everything that is not words is shared, so an image added to one cannot be missing from the other.
  assert.deepEqual(enStory.colors, idStory.colors);
  assert.equal(enStory.hero.headlineScript, idStory.hero.headlineScript, 'the Javanese script is not translated');
  for (const [i, section] of enStory.sections.entries()) {
    assert.equal(section.type, idStory.sections[i].type, `section ${i} keeps its type`);
    if ('layout' in idStory.sections[i]) assert.equal(section.layout, idStory.sections[i].layout);
  }
  // No Indonesian left in the English letter. These are the words this story actually uses.
  const enWords = JSON.stringify([enStory.hero, enStory.music, enStory.sections]);
  for (const leftover of ['yang', 'tidak', 'dengan', 'untuk', 'Tentang', 'kenangan', 'parfum']) {
    assert.ok(!new RegExp(`\\b${leftover}\\b`).test(enWords),
      `the English letter still says "${leftover}"`);
  }

  // And it is still a letter, not a brochure aimed at the reader. The Indonesian says "kita" three times
  // and "kamu" not once: the writer is inside the feeling, describing what happens to US. The first
  // English draft rendered every one of those as "you", which reads as a diagnosis of the person holding
  // the bottle. Held as the rule — first person present, second person absent — because a later rewrite
  // reaching for "you were never going to reach him" breaks nothing a structural check can see.
  const idWords = JSON.stringify([idStory.hero, idStory.sections]);
  assert.ok(/\bkita\b/.test(idWords) && !/\b(kamu|Anda|kau)\b/.test(idWords),
    'the Indonesian letter stopped speaking as "kita", so the English rule below no longer follows from it');
  assert.ok(!/\b(you|your|yours|you're)\b/i.test(enWords),
    'the English letter addresses the reader as "you" — the Indonesian never does, and it turns the confession into an accusation');
  assert.ok(/\b(we|us|our)\b/i.test(enWords),
    'the English letter no longer says "we" anywhere — the voice standing inside the feeling is gone');

  // The page must never hand the Studio story — which has one set of fields, and those are Indonesian —
  // to the English shop.
  const gate = page.slice(page.indexOf('const productStory = isInternational'), page.indexOf('if (storyLoading)'));
  assert.ok(gate.length > 40 && gate.length < 400, 'the story gate is still one small expression');
  const [international] = gate.split(':');
  assert.ok(!international.includes('supabaseStory'),
    'the English shop must not be offered the Studio story, which is Indonesian by construction');
  assert.match(gate, /getProductStory\(slug, region\)/, 'and it asks for the story in the shop\'s own language');
  // And the gate has to sit BEFORE the branch that returns the immersive page, or it gates nothing.
  assert.ok(page.indexOf('const productStory = isInternational') < page.indexOf('return <ImmersiveProductPage'),
    'the region gate must be resolved before the immersive page is returned');
}

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

console.log('productCopy selfcheck OK (a product speaks the shop\'s language per field, never blank, and the English copy survives all three hand-written mappers)');
