// Labels that read in one language per shop (audit 2026-11-07).
//
// Measured on the live shop before this: the English scent pyramid printed "HEART · HEART · THE CHARACTER"
// and "BASE · BASE", the English product page listed the mood "TENANG", and the Indonesian journal and
// home page called every note "MATERIAL NOTE" under a heading saying "CATATAN BAHAN".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');
const { MESSAGES } = await import(pathToFileURL(join(src, 'i18n', 'messages.js')).href);
const { DEFAULT_JOURNAL_CATEGORIES } = await import(pathToFileURL(join(src, 'data', 'siteFacts.js')).href);

// --- 1. A pyramid caption never repeats the tier name printed before it --------------------------------
const pyramid = read('components', 'storefront', 'ScentPyramid.jsx');
const tiers = [...pyramid.matchAll(/label: '(\w+)', caption: '([\w.]+)'/g)].map(([, label, caption]) => ({ label, caption }));
assert.equal(tiers.length, 3, 'ScentPyramid no longer lists three tiers — the derivation broke');
for (const region of ['id', 'en']) {
  for (const { label, caption } of tiers) {
    const first = String(MESSAGES[region][caption] || '').split('·')[0].trim().toLowerCase();
    assert.ok(first, `${region} ${caption} is empty`);
    assert.notEqual(first, label.toLowerCase(), `${region} prints "${label.toUpperCase()} · ${MESSAGES[region][caption].toUpperCase()}"`);
  }
}

// --- 2. The shop names the shipped journal categories in its own language ------------------------------
// The REAL service, its imports replaced by the two it needs and stubs for the rest.
const service = read('services', 'journalPostsSupabaseService.js').split('\n').filter((line) => !line.startsWith('import ')).join('\n');
const facts = pathToFileURL(join(src, 'data', 'siteFacts.js')).href;
const runnable = `import { DEFAULT_JOURNAL_CATEGORIES, journalCategoryLabelIn } from '${facts}';
let categoriesInStudio = DEFAULT_JOURNAL_CATEGORIES;
const getSiteFacts = () => ({ journalCategories: categoriesInStudio });
const subscribeSiteFacts = () => {};
const supabase = null; const getCurrentUserId = async () => null; const toAppRecord = (row) => row;
export const setStudioCategories = (list) => { categoriesInStudio = list; JOURNAL_CATEGORIES = list; };
${service}`;
const { getJournalCategoryShopLabel, setStudioCategories } = await import(`data:text/javascript;base64,${Buffer.from(runnable).toString('base64')}`);
const tFor = (region) => (key) => MESSAGES[region][key] ?? key;
for (const { value } of DEFAULT_JOURNAL_CATEGORIES) {
  for (const region of ['id', 'en']) {
    assert.ok(MESSAGES[region][`journal.cat.${value}`], `${region} has no shop name for the category "${value}"`);
  }
}
assert.equal(getJournalCategoryShopLabel('material_note', tFor('id')), 'Catatan bahan');
assert.equal(getJournalCategoryShopLabel('material_note', tFor('en')), 'Material note');
// A label Dekito renamed in Studio, and a category Dekito added, are Dekito's own words in both shops.
setStudioCategories([{ value: 'material_note', label: 'Bahan Baku' }, { value: 'tur_atelier', label: 'Tur Atelier' }]);
assert.equal(getJournalCategoryShopLabel('material_note', tFor('en')), 'Bahan Baku', 'a renamed category must keep the name typed in Studio');
assert.equal(getJournalCategoryShopLabel('tur_atelier', tFor('id')), 'Tur Atelier');
setStudioCategories(DEFAULT_JOURNAL_CATEGORIES);
// Every place the shop prints a category asks the shop label, not the Studio one.
for (const page of ['HomePage.jsx', 'PublicJournalPage.jsx', 'PublicJournalArticlePage.jsx']) {
  const body = read('pages', page).replace(/<meta[^>]*\/>/g, '');
  assert.doesNotMatch(body, />\{getJournalCategoryLabel\(|\{getJournalCategoryLabel\([^)]*\)\} ·/, `${page} prints the Studio label`);
  assert.match(body, /getJournalCategoryShopLabel\(/, `${page} no longer names categories for the shop`);
}

// --- 3. Indonesian free text stays out of the English product page -------------------------------------
const pdp = read('pages', 'PublicProductDetailPage.jsx');
assert.match(pdp, /isPlaceholderMood\(product\.mood\) \|\| isInternational \? null : <li>\{product\.mood\}<\/li>/,
  'the English product page lists the mood typed in Indonesian');

// --- 4. The English home page and article say the notes are Indonesian, as the journal does ------------
assert.match(read('pages', 'HomePage.jsx'), /isInternational \? <p[^>]*>\{t\('journal\.indonesianOnly'\)\}/, 'the English home page links to Indonesian notes without saying so');
assert.match(read('pages', 'PublicJournalArticlePage.jsx'), /isInternational \? <p lang="en"[^>]*>\{t\('journal\.articleIndonesian'\)\}/, 'the English article does not say it is in Indonesian');

console.log('shopLanguageLabels selfcheck OK (pyramid captions, journal category names, mood, Indonesian notes)');
