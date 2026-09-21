// `node src/utils/bespokeBriefLanguage.selfcheck.mjs`
//
// Walked the English shop's bespoke flow on production, 2026-09-21, and read the message it was about to
// send:
//
//   Hello SOLIVAGANT, I would like a bespoke perfume.
//   Name: After Rain
//   Scent: clean, woody, a little vanilla, Woody
//   Occasion: Harian          ← the reader picked "Everyday"
//   Bottle: 30 ml / Classic / Basic cap
//
// The option list stores its value in Indonesian, because that is what the order record keeps and what
// Studio reads. The buyer's own brief was built straight from that value, so an English reader sends one
// Indonesian word inside their own sentence — about a perfume they just described in English.
//
// This is the copy that LEAVES the site, which is exactly why no scan of the pages ever saw it.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bespokeOccasionLabel, buildBespokeEnquiryDraft } from './bespokeOrder.js';
import { bespokeOccasionOptions } from '../data/storefront.js';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

const translate = (language) => (key, values = {}) => {
  const text = MESSAGES[language][key] ?? key;
  return Object.entries(values).reduce((line, [name, value]) => line.replaceAll(`{${name}}`, value), text);
};

// --- 1. Every option can be said in both languages ---------------------------------------------------
assert.ok(bespokeOccasionOptions.length >= 4, 'the occasions must still be offered');
for (const option of bespokeOccasionOptions) {
  assert.ok(option.labelKey, `${option.value} has no labelKey, so it can only ever be Indonesian`);
  for (const language of ['id', 'en']) {
    assert.ok(MESSAGES[language][option.labelKey], `${language}.${option.labelKey} is missing`);
  }
  assert.notEqual(MESSAGES.en[option.labelKey], option.value,
    `the English label for ${option.value} is the Indonesian value itself`);
}

// --- 2. The translator, on the exact case that reported this ------------------------------------------
// Against the message file, not against the word I happened to read on screen: pinning "Everyday" here
// turned a legitimate rewording into a failure the first time it was tried.
assert.equal(bespokeOccasionLabel(translate('en'), 'Harian', bespokeOccasionOptions), MESSAGES.en['bsp.occ.harian']);
assert.notEqual(bespokeOccasionLabel(translate('en'), 'Harian', bespokeOccasionOptions), 'Harian',
  'the English reader must not be handed the Indonesian value');
assert.equal(bespokeOccasionLabel(translate('id'), 'Harian', bespokeOccasionOptions), 'Harian',
  'the Indonesian shop still says what it always said');
assert.equal(bespokeOccasionLabel(translate('en'), 'Sesuatu yang tidak ada di daftar', bespokeOccasionOptions),
  'Sesuatu yang tidak ada di daftar', 'a value with no option falls back to itself rather than vanishing');
assert.equal(bespokeOccasionLabel(null, 'Harian', bespokeOccasionOptions), 'Harian', 'never throws without t');
assert.equal(bespokeOccasionLabel(translate('en'), '', bespokeOccasionOptions), '');

// --- 3. The draft an English reader sends carries no Indonesian option --------------------------------
const draft = buildBespokeEnquiryDraft({
  t: translate('en'),
  perfumeName: 'After Rain',
  scent: 'clean, woody',
  occasion: bespokeOccasionLabel(translate('en'), 'Harian', bespokeOccasionOptions),
  bottle: '30 ml / Classic / Basic cap',
});
assert.ok(draft.includes(MESSAGES.en['bsp.occ.harian']),
  'the occasion must reach WhatsApp in the reader\'s language');
for (const option of bespokeOccasionOptions) {
  assert.ok(!draft.includes(option.value) || MESSAGES.en[option.labelKey] === option.value,
    `the English draft still carries the Indonesian value "${option.value}"`);
}

// --- 4. Both bespoke surfaces translate before they send ----------------------------------------------
for (const file of [['pages', 'BespokePage.jsx'], ['pages', 'mobile', 'MobileBespokePage.jsx']]) {
  const source = read(...file);
  assert.match(source, /occasion: bespokeOccasionLabel\(t, form\.occasion, bespokeOccasionOptions\)/,
    `${file.join('/')} sends the raw stored value instead of the label the reader chose`);
}

// --- 5. And the stored value stays Indonesian ---------------------------------------------------------
// Studio reads the brief. Translating the value itself would move the confusion rather than end it.
const data = read('data', 'storefront.js');
assert.match(data, /\{ value: 'Harian', labelKey: 'bsp\.occ\.harian' \}/,
  'the option keeps its Indonesian value — only the sentence that leaves the site is translated');

console.log('bespokeBriefLanguage selfcheck OK (the brief a buyer sends is written in the buyer\'s language)');
