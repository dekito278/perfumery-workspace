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
// pairing check above cannot see it.
//
// This list was a length heuristic first — "short strings may match" — and a sabotage walked straight
// through it by putting "Stok Habis" into the English sold-out button. Short strings ARE the buttons.
// So the exemption is now a named list: every entry is a word that is genuinely the same in both
// languages, and adding one is a decision somebody has to write down.
const IDENTICAL_ON_PURPOSE = new Set([
  'pdp.rawMaterials', // the perfumery term, printed in English on the Indonesian page already
  'pdp.checkout',     // the word Indonesian buyers use for this button
  'price.memberIs',   // "Member Rp 675.000" — "member" is the loanword in both
]);
for (const key of idKeys) {
  if (IDENTICAL_ON_PURPOSE.has(key)) {
    assert.equal(MESSAGES.en[key], MESSAGES.id[key],
      `${key} is on the identical-on-purpose list but the two no longer match — remove it from the list or fix one side`);
    continue;
  }
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

// --- 9. The product page leaves no Indonesian behind ------------------------------------------------------
// A page that is 90% translated is worse than one that is not: the buyer stops trusting the parts that
// ARE English. Both surfaces are scanned for the literals that used to sit in them.
const LEFTOVERS = [
  'Memuat produk', 'Keranjang sudah diperbarui', 'Lihat cart', 'COCOK DIPAKAI', 'UKURAN',
  'Stok Habis', 'Sudah di Keranjang', 'Tambah ke Keranjang', 'MUNGKIN KAMU SUKA',
  'Signature tenang lainnya', 'Intensitas ', 'Tidak ditemukan -', 'masuk ke keranjang',
  'Masukkan keranjang', 'Stok habis', 'Preview admin', 'PIRAMIDA AROMA', 'Harga member',
  'Masuk dengan Google', 'Tersisa ', 'Pembuka ·', 'Inti ·', 'Dasar ·',
  // catalogue
  'KOLEKSI FRAGRANCE', 'Objek parfum terbatas', 'Cari notes, mood', 'Tidak ada fragrance',
  'Koleksi belum bisa dimuat', 'Katalog belum bisa dimuat', 'sedang habis', 'stok habis',
  'Pakai untuk momen apa', 'Filter berdasarkan', 'Koneksi ke server gagal', 'Coba muat ulang',
  'Ditambahkan', '> Keranjang<', 'kategori',
];
for (const file of [
  ['pages', 'CatalogPage.jsx'],
  ['pages', 'mobile', 'MobileCatalogPage.jsx'],
  ['components', 'storefront', 'WearFilter.jsx'],
  ['components', 'storefront', 'StaleCatalogNotice.jsx'],
  ['pages', 'PublicProductDetailPage.jsx'],
  ['pages', 'mobile', 'MobileProductDetailPage.jsx'],
  ['components', 'storefront', 'ScentPyramid.jsx'],
  ['components', 'storefront', 'PriceNote.jsx'],
  ['components', 'storefront', 'OverseasInquiryButton.jsx'],
  ['utils', 'stockScarcity.js'],
]) {
  const source = read(...file);
  for (const literal of LEFTOVERS) {
    assert.ok(!source.includes(literal),
      `${file.join('/')} still hardcodes "${literal}" — it must come from the message file`);
  }
  assert.match(source, /useTranslate\(\)|\btranslate\b/, `${file.join('/')} reads the message file`);
}

// Scanning for Indonesian LITERALS cannot see this one: `{option.label}` contains no Indonesian text at
// all, and the words arrive from productWear.js at runtime. A sabotage walked straight through the
// literal scan by swapping labelKey back to label in the filter pills.
//
// So the storefront is forbidden from reading the Indonesian `label` at all. Studio reads it; the
// storefront reads `labelKey` and translates.
for (const file of [
  ['components', 'storefront', 'WearFilter.jsx'],
  ['pages', 'CatalogPage.jsx'],
  ['pages', 'mobile', 'MobileCatalogPage.jsx'],
  ['pages', 'PublicProductDetailPage.jsx'],
]) {
  const source = read(...file);
  assert.doesNotMatch(source, /\.label\b(?!Key)/,
    `${file.join('/')} must read labelKey and translate it — reading .label prints Indonesian with no literal to find`);
}
assert.match(read('components', 'product', 'WearPicker.jsx'), /\.label\b(?!Key)/,
  'Studio still reads the Indonesian label, which is the point of keeping both');

// The wear chips take the translator too, and Studio keeps a separate function with the Indonesian
// labels — collapsing the two is how "Malam spesial" ends up in the English shop.
const wear = read('utils', 'productWear.js');
assert.match(wear, /export const describeWear = \(wear, translate\) => \{\s*if \(typeof translate !== 'function'\) return \[\];/,
  'the storefront chips require a translator');
assert.match(wear, /export const describeWearStudio = \(wear\) =>/, 'and Studio has its own');
assert.match(read('components', 'product', 'ProductWearTagger.jsx'), /describeWearStudio\(wear\)/,
  'which is what the Studio tagger uses');

// The scarcity line takes the translator and has NO default. A default would print Indonesian into the
// English shop and nothing would say so.
const scarcity = read('utils', 'stockScarcity.js');
assert.match(scarcity, /export const getScarcityLabel = \(stock, translate\) =>/, 'the translator is required');
assert.match(scarcity, /if \(typeof translate !== 'function'\) return '';/, 'and silence without it');

console.log('storefrontMessages selfcheck OK (two languages out of one object, every key paired, the product page leaving no Indonesian behind, and the English never promising a member price an international order cannot get)');
