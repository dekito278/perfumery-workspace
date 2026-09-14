// `node src/utils/storefrontMessages.selfcheck.mjs`
//
// The storefront speaks two languages out of one object, with no i18n library. That is the right size for
// two languages and ~200 strings — but the thing a library would have given for free is the thing that
// breaks silently here: a key added to Indonesian and forgotten in English renders an Indonesian sentence
// in the middle of the English shop, and nothing errors.
//
// So the pairing IS the guard. At runtime the lookup falls back to Indonesian on purpose — a blank button
// is worse than a foreign one — which is exactly why the build has to refuse what the runtime forgives.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES, MESSAGE_KEYS, translate } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. Exactly two languages, and every key in both ------------------------------------------------------
assert.deepEqual(Object.keys(MESSAGES).sort(), ['en', 'id']);
const idKeys = Object.keys(MESSAGES.id).sort();
const enKeys = Object.keys(MESSAGES.en).sort();
assert.deepEqual(enKeys, idKeys,
  `every key must exist in both languages — missing in en: ${idKeys.filter((k) => !enKeys.includes(k))}; extra in en: ${enKeys.filter((k) => !idKeys.includes(k))}`);
assert.ok(idKeys.length, 'there are strings to translate');
assert.deepEqual(MESSAGE_KEYS.sort(), idKeys);

// --- 2. No empty or placeholder translations ---------------------------------------------------------------
// An empty English string renders a blank button and passes the pairing check above.
for (const language of ['id', 'en']) {
  for (const [key, value] of Object.entries(MESSAGES[language])) {
    assert.equal(typeof value, 'string', `${language}.${key} is a string`);
    assert.ok(value.trim().length > 0, `${language}.${key} is not empty`);
    assert.ok(!/^TODO|^FIXME|^\?+$/.test(value.trim()), `${language}.${key} is not a placeholder`);
  }
}

// --- 3. The English is not a copy of the Indonesian ----------------------------------------------------------
// A key "translated" by pasting the Indonesian is the same silent failure as a missing one, and the
// pairing check cannot see it. Short shared strings are exempt: some are deliberately bilingual.
for (const key of idKeys) {
  if (MESSAGES.id[key].length < 25) continue;
  assert.notEqual(MESSAGES.en[key], MESSAGES.id[key], `${key} still holds the Indonesian text in en`);
}

// --- 4. Placeholders must survive translation ------------------------------------------------------------------
// {name} dropped from one language is a sentence with a hole in it, in that language only.
for (const key of idKeys) {
  const holes = (text) => (String(text).match(/\{(\w+)\}/g) || []).sort();
  assert.deepEqual(holes(MESSAGES.en[key]), holes(MESSAGES.id[key]), `${key} carries the same placeholders in both`);
}
assert.equal(translate('en', 'welcome.heading'), MESSAGES.en['welcome.heading']);
assert.equal(translate('id', 'welcome.heading'), MESSAGES.id['welcome.heading']);
// The runtime forgives what the build refuses.
assert.equal(translate('en', 'tidak.ada'), 'tidak.ada', 'an unknown key renders as itself, never as blank');
assert.equal(translate('xx', 'welcome.heading'), MESSAGES.id['welcome.heading'], 'an unknown region falls back to Indonesian');
assert.equal(translate('en', 'welcome.heading', { unused: 1 }), MESSAGES.en['welcome.heading']);

// --- 5. The English welcome page must NOT offer a member discount ------------------------------------------------
// An international buyer pays the export price, and signing in does not lower it — the member discount is
// an Indonesian-order thing. Offering one here is the same bait-and-switch the export panel exists to
// prevent, wearing a friendlier face. This is a promise about money, so it is asserted rather than trusted.
assert.doesNotMatch(MESSAGES.en['welcome.lead'], /member|discount|\b10%/i,
  'the English lead must not promise a member price an international order cannot get');
assert.doesNotMatch(MESSAGES.en['welcome.signIn'], /member|discount/i,
  'nor may the English sign-in button');
assert.match(MESSAGES.id['welcome.lead'], /member/i, 'the Indonesian one still does, because there it is true');

// --- 6. The language comes from the region, never from a second guess ---------------------------------------------
const hook = read('hooks', 'useTranslate.js');
assert.match(hook, /const \{ region, isInternational \} = useStorefrontRegion\(\);/,
  'strings follow the chosen shop');
assert.doesNotMatch(hook, /detectOverseasVisitor|navigator\.language|Intl\./,
  'and never detect for themselves — one paragraph English and the button under it Indonesian is the failure');

// --- 7. Studio stays out of it -------------------------------------------------------------------------------------
// Translating admin screens is work with one reader, and he speaks Indonesian. Worse, a Studio screen
// pulled into the storefront's message file starts flipping language with the buyer's switch.
const studioPages = readdirSync(join(root, 'pages'))
  .filter((name) => /^(Studio|Product(List|Create|Edit)|CatalogCuration|Batch|Order|Formula|RawMaterial)/.test(name) && name.endsWith('.jsx'));
assert.ok(studioPages.length, 'there are Studio pages to check');
for (const page of studioPages) {
  assert.doesNotMatch(read('pages', page), /useTranslate|@\/i18n\/messages/,
    `${page} is a Studio screen and must not read the storefront's messages`);
}

// --- 8. The page that proves the mechanism actually uses it ------------------------------------------------------------
const welcome = read('pages', 'WelcomePage.jsx');
assert.match(welcome, /const \{ t \} = useTranslate\(\);/, 'WelcomePage translates');
for (const literal of ['DARI KARTU DI PAKETMU', 'Terima kasih sudah memilih Solivagant', 'Lihat koleksi dulu']) {
  assert.ok(!welcome.includes(`>${literal}`) && !welcome.includes(`"${literal}"`),
    `"${literal}" must come from the message file, not sit hardcoded in the page`);
}
assert.equal((welcome.match(/t\('welcome\./g) || []).length, 8,
  'every string on the page goes through t() — a missed one is the sentence that stays Indonesian');

console.log('storefrontMessages selfcheck OK (two languages out of one object, every key paired, and the English never promising a member price an international order cannot get)');
