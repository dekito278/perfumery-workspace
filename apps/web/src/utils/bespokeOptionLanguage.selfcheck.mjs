// `node src/utils/bespokeOptionLanguage.selfcheck.mjs`
//
// The bespoke options are rows in storefront_bespoke_options, so their words arrive at runtime and NO
// scan for Indonesian literals can see them. Measured on the live English page: "Tulis tangan",
// "Ukuran default bespoke." and a heading reading "UKURAN", in the middle of otherwise English copy.
//
// The risk in fixing it is the opposite one: these same rows are edited and SAVED in Studio, so an
// English label handed to that editor would be written back over the Indonesian one.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

// The REAL service, with its two '@/' imports stubbed — neither is touched by the functions under test,
// and a reimplementation here would pass while the shipped mapper dropped a column.
const stubs = 'const supabase = null;\nconst deleteBespokeImages = async () => {};\n';
const runnable = stubs + read('services', 'bespokeSettingsService.js')
  .split('\n').filter((line) => !line.startsWith('import ')).join('\n');
const { bespokeOptionText, translateBespokeSettings } = await import(
  `data:text/javascript;base64,${Buffer.from(runnable, 'utf8').toString('base64')}`
);

const option = {
  id: 'minimal-label',
  value: 'Tulis tangan',
  label: 'Tulis tangan',
  description: 'Label stiker dengan tulisan tangan saya',
  labelEn: 'Handwritten',
  descriptionEn: 'A sticker label in my own handwriting',
  price: 0,
  enabled: true,
};

// --- 1. Each shop gets its own words ------------------------------------------------------------------
assert.deepEqual(bespokeOptionText(option, true), {
  label: 'Handwritten',
  description: 'A sticker label in my own handwriting',
});
assert.deepEqual(bespokeOptionText(option, false), {
  label: 'Tulis tangan',
  description: 'Label stiker dengan tulisan tangan saya',
});

// --- 2. The fallback is per FIELD, not per option -----------------------------------------------------
// Dekito fills nine rows by hand. A row whose label is translated and whose description is not must show
// the English name with the Indonesian note — throwing the good half away because the other half is
// missing would make a half-finished translation worse than none.
assert.deepEqual(bespokeOptionText({ ...option, descriptionEn: '' }, true), {
  label: 'Handwritten',
  description: 'Label stiker dengan tulisan tangan saya',
});
assert.deepEqual(bespokeOptionText({ ...option, labelEn: '', descriptionEn: '' }, true), {
  label: 'Tulis tangan',
  description: 'Label stiker dengan tulisan tangan saya',
});
// An empty translation is not a translation — a blank button is worse than an Indonesian one.
assert.equal(bespokeOptionText({ ...option, labelEn: '   ' }, true).label, 'Tulis tangan',
  'a stray space counted as a translation, so the button would render blank');

// --- 3. Only the words change. The VALUE is the selection key -----------------------------------------
// form.size holds option.value and every `active` check compares against it. Translating that would
// leave the phone showing nothing selected the moment the shop language changed.
const settings = { bottleSizes: [option], loading: false };
const translated = translateBespokeSettings(settings, true);
assert.equal(translated.bottleSizes[0].value, 'Tulis tangan', 'the selection key was translated; nothing would match');
assert.equal(translated.bottleSizes[0].id, option.id);
assert.equal(translated.bottleSizes[0].price, 0);
assert.equal(translated.bottleSizes[0].enabled, true);
assert.equal(translated.bottleSizes[0].label, 'Handwritten');

// The Indonesian shop gets the object back untouched — not a copy, so nothing downstream can drift.
assert.equal(translateBespokeSettings(settings, false), settings);

// --- 4. The row mapper carries the new columns --------------------------------------------------------
// This repo's most expensive recurring defect is a hand-written field list that quietly drops a column.
// fromDatabaseRow is exactly that shape, so the two new columns are pinned here.
const service = read('services', 'bespokeSettingsService.js');
assert.match(service, /labelEn: row\.label_en/, 'fromDatabaseRow drops label_en, so no translation ever reaches the page');
assert.match(service, /descriptionEn: row\.description_en/, 'fromDatabaseRow drops description_en');
assert.match(service, /label_en: option\.labelEn \|\| null/, 'saving from Studio would wipe the translations');
assert.match(service, /description_en: option\.descriptionEn \|\| null/);

// --- 5. Studio never gets translated rows -------------------------------------------------------------
// It writes them back. This is the one caller that must NOT ask for the shop's language.
const studio = read('pages', 'mobile', 'MobileBespokeSettingsPage.jsx');
assert.match(studio, /useBespokeSettings\(\)/, 'Studio must read the raw rows it is about to save');
assert.doesNotMatch(studio, /useBespokeSettings\(\{[^}]*forShop/,
  'Studio asked for translated rows; the next save would write English over the Indonesian label');

for (const page of [['pages', 'BespokePage.jsx'], ['pages', 'mobile', 'MobileBespokePage.jsx']]) {
  assert.match(read(...page), /useBespokeSettings\(\{ forShop: true \}\)/,
    `${page.join('/')} reads the options without asking for the shop's language`);
}

// --- 6. And no heading beside them is typed in Indonesian ---------------------------------------------
// The options were only half the leak: the group headings above them were literals — 'UKURAN', 'BOTOL'.
const desktop = read('pages', 'BespokePage.jsx');
for (const shouting of ['UKURAN', 'BOTOL', 'AROMA', 'ALAMAT']) {
  assert.ok(!desktop.includes(`eyebrow: '${shouting}'`),
    `the ${shouting} heading is typed in Indonesian, so it shouts it in the English shop too`);
}

console.log('bespokeOptionLanguage selfcheck OK (database-held option names follow the shop, field by field, without ever reaching the editor that saves them)');
