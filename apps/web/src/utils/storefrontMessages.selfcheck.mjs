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
  'nav.bespokeShort', // "Bespoke" is the word used in both, and the tab has room for one
  'nav.info',         // same word, same meaning
  'why.atelier.cta',  // "Bespoke ritual" is the name of the service, not a description of it
  'region.enTitle',   // the international option is named in English on BOTH sides on purpose: it is
                      // what an Indonesian reader is switching TO, so translating it hides the switch
  'home.tab',         // the browser tab is the shop's name, already in English on the Indonesian site
  'home.tabMobile',   // same
  'home.atelier',     // "atelier" is the word used in both, and it is the section's name
  'mood.woody.short', // Cedar · Vetiver · Mineral — three material names, identical in both
  'cart.voucher',     // the loanword, used on Indonesian receipts already
  'bsp.voucher',      // same word on the bespoke summary
  'cart.brief',       // "Brief" is the word used for a bespoke brief in both
  'cart.subtotal',    // Subtotal is Subtotal
  // Checkout: the same word is already used on Indonesian receipts and in Indonesian banking.
  'checkout.tab', 'checkout.eyebrow', 'checkout.title', 'checkout.whatsapp',
  'checkout.subtotal', 'checkout.total', 'mcheckout.auto', 'mcheckout.stepArea',
  'pay.tab', // the payment tab title is already English on the Indonesian site
  // The journal is titled in English on the Indonesian site already — it is the section's name.
  'journal.tab', 'journal.meta', 'journal.eyebrow',
  'pay.refresh', // the same word in both
  'pay.status',  // Status is Status
  // Payment providers are named, not translated: DOKU is DOKU and QRIS is QRIS on both sides.
  'paymethod.doku', 'paymethod.qris',
  'checkout.sizeQty', // "30ml · Qty 2" — two numbers and an abbreviation used in both
  // Bespoke: perfumery and commerce terms that are the same word on an Indonesian bottle.
  'bsp.contact', 'bsp.label', 'bsp.material', 'bsp.addonMaterial', 'bsp.optionGroups', 'bsp.cap',
  'bsp.preorder', 'bsp.studioOrder', 'bsp.materialLabel', 'bsp.budgetLabel', 'bsp.preorderLabel',
  // The member account page: commerce and perfumery words an Indonesian receipt already prints in
  // English, plus the three bespoke production stages named the same way on both sides of the shop.
  'cust.voucherCode', 'cust.bp.formula', 'cust.bp.sample', 'cust.bp.approval', 'cust.cap',
  'cust.selfService', 'cust.label', 'cust.material', 'cust.order',
  'cust.bespokeDetail', 'cust.bespokeProduction',
  // The invoice: an Indonesian invoice already prints these words in English, and the tab carries the
  // order number rather than a sentence.
  'inv.tab', 'inv.invoice', 'inv.customer', 'inv.item', 'inv.qty', 'inv.total', 'inv.voucherCode',
  'inv.dashboard', 'inv.print',
  'bsp.contactCopied',
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
  // shell
  'Semua Fragrance', 'Bespoke Ritual', 'Berdasarkan Family', 'Lainnya', 'Akun member',
  'Lacak Pesanan', 'Masuk untuk harga member', 'Tutup menu', 'Buka menu', 'Beranda',
  'Atelier Parfum Artisan', 'WhatsApp atelier', 'Tetap terhubung', 'Email kamu', 'Langganan',
  'Menyiapkan Solivagant', 'Sebentar, halaman', 'KENAPA BELI LANGSUNG', 'Yang tidak kamu dapat',
  'Halo Solivagant', 'Navigasi', 'Artikel',
  // home
  'ATELIER PARFUM ARTISAN', 'Karya olfaktori', 'Harga member, langsung', 'KOLEKSI SAAT INI',
  'Fragrance pilihan', 'Lihat Koleksi', 'Lihat semua', 'Geser kiri', 'Geser kanan',
  'Koleksi baru sedang disiapkan', 'JELAJAHI', 'Temukan arah', 'Baca Selengkapnya', 'Baca jurnal',
  'Lihat koleksi', 'Lihat Koleksi',
  // payment + tracking
  'Lacak pesanan', 'Buka katalog', 'Total bayar', 'Bukti transfer', 'Rekening tujuan',
  'Menunggu pembayaran', 'Belum ada sesi', 'Mulai dari cart', 'Nomor resi', 'Progres pesanan',
  'Masukkan nomor order', 'Gunakan nomor order', 'Halaman tidak ditemukan', 'Kembali ke Beranda',
  // cart
  'Tinjau fragrance', 'Keranjang masih kosong', 'RINGKASAN', 'Ringkasan pesanan', 'Punya kode voucher',
  'Setelah voucher', 'Ongkir dihitung', 'Lanjut ke Checkout', 'Tambah Produk Dulu', 'Lanjut Belanja',
  'LENGKAPI RITUALMU', 'Mungkin kamu suka', 'Mulai belanja', 'Kode voucher', 'Hapus voucher',
  'Kurangi jumlah', 'Tambah jumlah', 'Keranjang kosong', 'Rekomendasi', 'Ready stock', 'Tambah aroma',
  'Aroma bespoke', 'Aksi keranjang', 'Pengiriman ke luar negeri tidak',
  // checkout
  'INFORMASI PEMBELI', 'Kode customer', 'Nama lengkap', 'Alamat pengiriman', 'Pilih kurir',
  'Area tujuan', 'Mencari ongkir', 'Metode pembayaran', 'Catatan pengiriman', 'RINGKASAN PESANAN',
  'Kembali ke Cart', 'Buat Pesanan', 'Produk yang dipilih', 'Belum ada produk', 'Jawaban keamanan',
  'Nama pembeli', 'wajib diisi', 'belum valid', 'Masuk dengan Google', 'Memproses', 'Lengkapi',
  'Total bayar', 'Edit keranjang', 'Pakai alamat terakhir', 'Kirim ke alamat baru', 'Pilih area lain',
  'Ongkir dipakai', 'Dipakai sebelum', 'Subtotal setelah', 'Hapus item tidak', 'Bayar sekarang',
  'Cek kode', 'Estimasi mengikuti', 'Buka katalog', 'Masih perlu', 'Langkah ',
  'Tenang & Minimal', 'Hangat & Nostalgia', 'Gelap & Moody', 'Lembut & Romantis',
  'Aroma sebagai', 'Konsultasi bespoke', 'Catatan lapangan', 'Parfum artisan yang',
  'Rasa di Atas Formula', 'Kami tidak mengejar', 'Konsultasi Bespoke', 'KOLABORASI',
  'Mari berkolaborasi', 'Untuk kolaborasi', 'Hubungi WhatsApp', 'Halo Dekito',
  'Perfumer bekerja', 'Atelier Solivagant',
];
for (const file of [
  ['pages', 'PaymentPage.jsx'],
  ['pages', 'PublicTrackingPage.jsx'],
  ['pages', 'CustomerPortalPage.jsx'],
  ['pages', 'NotFoundPage.jsx'],
  ['pages', 'PublicJournalPage.jsx'],
  ['pages', 'PublicJournalArticlePage.jsx'],
  ['pages', 'mobile', 'MobileArticlesPage.jsx'],
  ['pages', 'CheckoutPage.jsx'],
  ['pages', 'mobile', 'MobileCheckoutPage.jsx'],
  ['pages', 'CartPage.jsx'],
  ['pages', 'mobile', 'MobileCartPage.jsx'],
  ['components', 'storefront', 'InternationalCheckoutNotice.jsx'],
  ['pages', 'HomePage.jsx'],
  ['pages', 'mobile', 'MobileStorefrontPage.jsx'],
  ['components', 'storefront', 'PublicHeader.jsx'],
  ['components', 'storefront', 'StorefrontFooter.jsx'],
  ['components', 'storefront', 'StorefrontHeader.jsx'],
  ['components', 'storefront', 'StorefrontLoadingState.jsx'],
  ['components', 'storefront', 'WhyBuyDirect.jsx'],
  ['components', 'storefront', 'RegionSwitch.jsx'],
  ['layouts', 'MobileCommerceLayout.jsx'],
  ['pages', 'CatalogPage.jsx'],
  ['pages', 'mobile', 'MobileCatalogPage.jsx'],
  ['components', 'storefront', 'WearFilter.jsx'],
  ['components', 'storefront', 'StaleCatalogNotice.jsx'],
  ['pages', 'PublicProductDetailPage.jsx'],
  ['pages', 'mobile', 'MobileProductDetailPage.jsx'],
  ['components', 'storefront', 'ScentPyramid.jsx'],
  ['components', 'storefront', 'PriceNote.jsx'],
  ['components', 'storefront', 'OverseasInquiryButton.jsx'],
  ['pages', 'ImmersiveProductPage.jsx'],
  ['utils', 'stockScarcity.js'],
]) {
  const source = read(...file);
  for (const literal of LEFTOVERS) {
    assert.ok(!source.includes(literal),
      `${file.join('/')} still hardcodes "${literal}" — it must come from the message file`);
  }
  assert.match(source, /useTranslate\(\)|\btranslate\b/, `${file.join('/')} reads the message file`);
}

const PAGES_FULLY_TRANSLATED = [
  ['pages', 'PaymentPage.jsx'], ['pages', 'PublicTrackingPage.jsx'], ['pages', 'NotFoundPage.jsx'],
  ['pages', 'PublicJournalPage.jsx'],
  ['pages', 'PublicJournalArticlePage.jsx'],
  ['pages', 'mobile', 'MobileArticlesPage.jsx'],
  ['pages', 'CheckoutPage.jsx'], ['pages', 'mobile', 'MobileCheckoutPage.jsx'],
  ['pages', 'CartPage.jsx'], ['pages', 'mobile', 'MobileCartPage.jsx'],
  ['pages', 'CatalogPage.jsx'], ['pages', 'mobile', 'MobileCatalogPage.jsx'],
  ['pages', 'PublicProductDetailPage.jsx'], ['pages', 'mobile', 'MobileProductDetailPage.jsx'],
  // Replaces the product page entirely for a product with a story, so none of the checks aimed at
  // PublicProductDetailPage ever looked at it. It reached the English shop the day Ayang-ayang got an
  // English letter, still saying "Tambah ke Keranjang".
  ['pages', 'ImmersiveProductPage.jsx'],
  ['pages', 'HomePage.jsx'], ['pages', 'mobile', 'MobileStorefrontPage.jsx'],
  ['pages', 'WelcomePage.jsx'],
  ['pages', 'BespokePage.jsx'],
  ['pages', 'mobile', 'MobileBespokePage.jsx'],
  ['pages', 'CustomerPortalPage.jsx'],
  ['pages', 'CustomerInvoicePage.jsx'],
  // No copy of its own — three already-translated tabs in one keep-alive shell. Listed so the App.jsx
  // guard below can see it, and so it stays covered if copy ever lands in it.
  ['pages', 'mobile', 'MobileCommerceTabsPage.jsx'],
];

// A third way to leak, invisible to both checks above: rendering the KEY instead of translating it.
// `{item.labelKey}` puts the literal text "nav.home" on the screen — no Indonesian, no missing key, and
// the page still looks structurally fine. A sabotage did exactly that to the phone's bottom tabs.
// The page list is PAGES_FULLY_TRANSLATED itself: a hand-kept second list is a list that falls behind,
// and it did — the account page's timeline printed `{step.labelKey}` past a sabotage because this loop
// had never heard of it.
for (const file of [
  ...PAGES_FULLY_TRANSLATED,
  ['components', 'storefront', 'WhyBuyDirect.jsx'],
  ['components', 'storefront', 'PublicHeader.jsx'],
  ['components', 'storefront', 'StorefrontFooter.jsx'],
  ['components', 'storefront', 'StorefrontHeader.jsx'],
  ['components', 'storefront', 'WearFilter.jsx'],
  ['layouts', 'MobileCommerceLayout.jsx'],
]) {
  // React `key=` props legitimately use the message key as an identity — it is never shown — so they are
  // removed before the scan. What is left is text the browser would print.
  const source = read(...file).replace(/\bkey=\{[^}]*\}/g, '');
  // Named suffixes, not "anything ending in Key": `{selectedVariantKey}` is a variant id, not a message
  // key, and a regex broad enough to catch it would cry wolf until someone deletes this check.
  const rendered = source.match(/\{\s*\w+\.(?:label|title|body|cta|name|notes|caption)Key\s*\}/g) || [];
  assert.deepEqual(rendered, [],
    `${file.join('/')} renders a message KEY instead of translating it: ${rendered.join(', ')}`);
}

// The strongest rule of the three, and the one that needs no list at all: on a fully translated page,
// any run of TEXT between tags that is not an expression is untranslated copy — in whichever language it
// happens to be. 20 characters is the floor; below that it is usually punctuation or a unit.
//
// A sabotage put the whole 404 body back as plain text and walked past the phrase list, because no list
// of Indonesian sentences can contain every sentence Dekito might write.
const PROSE_ALLOWED = new Set([
  'RAW MATERIAL HIGHLIGHTS', // a perfumery heading, printed in English on the Indonesian page already
  // Words that are the same in both shops. The floor below is 4 characters, not 20, because "Cari",
  // "Buka", "Terbit" and "Tampilkan lagi" were all sitting on live pages under the old floor — so short
  // English words now have to be named here instead of being waved through by their length.
  'Total', 'Bank', 'Item', 'Journal', 'Voucher', 'VOUCHER', 'Checkout', 'CHECKOUT', 'SOLIVAGANT',
  'Top', 'Heart', 'Base', // the perfumery pyramid, English on the Indonesian page already
  '- SOLIVAGANT',         // the brand suffix on a <title>, the same in both shops
]);
// The buyer-facing pages that are fully translated. Every structural check below runs across all of
// them, so a page added to this list is a page that can no longer leak quietly — and a page left OFF
// it is the gap to look for first when something Indonesian turns up in the English shop.

for (const file of PAGES_FULLY_TRANSLATED) {
  const source = read(...file);
  // Newlines are allowed INSIDE the run: JSX puts long sentences on their own line between the tags, and
  // a regex that stopped at \n missed every one of them — including a whole mobile journal lead that the
  // browser then showed in Indonesian. Only < > { } end a run of text.
  // `{` and `}` bound a run of text as well as `<` and `>`: "Masuk sebagai {email} — data terisi
  // otomatis" never touches a tag on either side of its words, and a regex that only looked between tags
  // saw none of it. That is how the payment page's whole thank-you sentence stayed Indonesian.
  const prose = (source.match(/[>}][^<>{}]{4,}?[<{]/g) || [])
    .map((hit) => hit.slice(1, -1).replace(/\s+/g, ' ').trim())
    // The floor applies to the TEXT, not to the indentation around it: a lone "(" padded by a newline
    // and twenty spaces is JSX code, not a sentence a browser prints. Four characters, because a 20-char
    // floor let "Cari", "Buka", "Terbit", "Wajib", "Belanja" and "Tampilkan lagi" ship to production.
    .filter((hit) => hit.length >= 4 && /[A-Za-zÀ-ÿ]{3}/.test(hit))
    // A `>` or `}` inside JS — `x > 0; return (`, `} catch (error) {` — is not markup. Text a browser
    // prints carries none of ; = ( ) ` $.
    .filter((hit) => !/[;=()`$]/.test(hit))
    // Fragments of a ternary that happen to span a `>` are code, not text: they carry ?, : or an
    // identifier path. Text a browser prints never does.
    .filter((hit) => hit && !/^[\s&;a-z:?.]*$/.test(hit) && !/[?:]|\w\?\.|\w\.\w/.test(hit) && !PROSE_ALLOWED.has(hit));
  assert.deepEqual(prose, [],
    `${file.join('/')} renders untranslated prose: ${prose.join(' | ')}`);
}

// A list of Indonesian phrases can never be complete — a sabotage put `label: 'Nama'` back into the
// checkout steps and walked past it, because no list contains every word Dekito might have written.
//
// So this is structural instead: on a buyer-facing page, a prop that carries COPY — label, title,
// description, action, placeholder, aria-label — must never be a bare capitalised string literal. Those
// are always untranslated text, whatever language they happen to be in.
for (const file of [
  ['pages', 'CheckoutPage.jsx'],
  ['pages', 'mobile', 'MobileCheckoutPage.jsx'],
  ['pages', 'CartPage.jsx'],
  ['pages', 'mobile', 'MobileCartPage.jsx'],
  ['pages', 'PaymentPage.jsx'],
  ['pages', 'PublicTrackingPage.jsx'],
  ['pages', 'NotFoundPage.jsx'],
]) {
  const source = read(...file);
  const literals = source.match(/(?:label|title|description|action|placeholder|aria-label)\s*[:=]\s*["'][A-ZÀ-ÿ][^"']{1,60}["']/g) || [];
  assert.deepEqual(literals, [],
    `${file.join('/')} passes copy as a bare string literal: ${literals.join(' | ')}`);
}

// Scanning for Indonesian LITERALS cannot see this one: `{option.label}` contains no Indonesian text at
// all, and the words arrive from productWear.js at runtime. A sabotage walked straight through the
// literal scan by swapping labelKey back to label in the filter pills.
//
// So the storefront is forbidden from reading the Indonesian `label` at all. Studio reads it; the
// storefront reads `labelKey` and translates.
for (const file of [
  ['pages', 'HomePage.jsx'],
  ['pages', 'mobile', 'MobileStorefrontPage.jsx'],
  ['components', 'storefront', 'WhyBuyDirect.jsx'],
  ['components', 'storefront', 'StorefrontFooter.jsx'],
  ['layouts', 'MobileCommerceLayout.jsx'],
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

// The payment methods are the same trap one module over: cartService exports label/description in
// Indonesian, Studio and the order records need them that way, and four storefront pages were rendering
// them raw — "Transfer sesuai total bayar" was live on the English phone checkout. The storefront reads
// labelKey/descriptionKey; the Indonesian strings stay for everything that is not a buyer's screen.
for (const file of [
  ['pages', 'CheckoutPage.jsx'],
  ['pages', 'mobile', 'MobileCheckoutPage.jsx'],
  ['pages', 'BespokePage.jsx'],
  ['pages', 'mobile', 'MobileBespokePage.jsx'],
]) {
  const source = read(...file);
  const raw = source.match(/\bmethod\.(?:label|description)\b(?!Key)/g) || [];
  assert.deepEqual(raw, [],
    `${file.join('/')} renders a payment method's Indonesian text: ${raw.join(' | ')} — read labelKey/descriptionKey`);
}
const cart = read('services', 'cartService.js');
for (const key of ['paymethod.manual', 'paymethod.manualBody', 'paymethod.doku', 'paymethod.dokuBody', 'paymethod.qris', 'paymethod.qrisBody']) {
  assert.ok(cart.includes(`'${key}'`), `cartService must point a payment method at ${key}`);
  assert.ok(MESSAGES.id[key] && MESSAGES.en[key], `${key} exists in both languages`);
}

// The wear chips take the translator too, and Studio keeps a separate function with the Indonesian
// labels — collapsing the two is how "Malam spesial" ends up in the English shop.
const wear = read('utils', 'productWear.js');
assert.match(wear, /export const describeWear = \(wear, translate\) => \{\s*if \(typeof translate !== 'function'\) return \[\];/,
  'the storefront chips require a translator');
assert.match(wear, /export const describeWearStudio = \(wear\) =>/, 'and Studio has its own');
assert.match(read('components', 'product', 'ProductWearTagger.jsx'), /describeWearStudio\(wear\)/,
  'which is what the Studio tagger uses');

// A JSX expression whose whole content is a long string literal is copy too — `{"Tentang memori..."}`
// renders exactly like text between tags, but the prose check above never sees it, because the browser's
// text is inside braces. A sabotage swapped a t() call for one and walked straight past.
for (const file of PAGES_FULLY_TRANSLATED) {
  const source = read(...file);
  const literals = source.match(/\{\s*["'][^"']{20,}["']\s*\}/g) || [];
  assert.deepEqual(literals, [],
    `${file.join('/')} renders a bare string literal as copy: ${literals.join(' | ')}`);
}

// Every *Key value must be a key that EXISTS. `labelKey: 'Harian'` looks right, passes the raw-key check
// (it is not rendered bare), and renders the Indonesian word itself — because translate() falls back to
// the key when it finds nothing. A sabotage did exactly that to the bespoke occasion list.
{
  const keyed = [
    ...PAGES_FULLY_TRANSLATED,
    ['data', 'storefront.js'],
    ['data', 'whyDirect.js'],
    ['utils', 'productWear.js'],
    ['components', 'storefront', 'PublicHeader.jsx'],
    ['components', 'storefront', 'StorefrontFooter.jsx'],
    ['components', 'storefront', 'ScentPyramid.jsx'],
    ['layouts', 'MobileCommerceLayout.jsx'],
  ];
  for (const file of keyed) {
    const source = read(...file);
    const used = [...source.matchAll(/\b\w*(?:label|title|body|cta|name|notes|caption|step)Key\s*:\s*'([^']+)'/gi)]
      .map((match) => match[1]);
    const unknown = used.filter((key) => !Object.prototype.hasOwnProperty.call(MESSAGES.id, key));
    assert.deepEqual(unknown, [],
      `${file.join('/')} points a *Key at something that is not a message key: ${unknown.join(', ')} — translate() falls back to the key itself, so it would render as that text`);
  }
}

// The *Key check above reads the PROPERTY name, so it never looks inside `const orderStatusKeys = {
// processing: 'cust.st.processing' }` — the property there is the status, not a *Key. A sabotage put the
// Indonesian word back as the value and walked past, because translate() renders an unknown key as itself.
//
// So a map NAMED for keys must hold nothing but keys.
for (const file of PAGES_FULLY_TRANSLATED) {
  const source = read(...file);
  for (const map of source.matchAll(/const \w*Keys\s*=\s*\{([^}]*)\}/g)) {
    const values = [...map[1].matchAll(/:\s*'([^']+)'/g)].map((hit) => hit[1]);
    const unknown = values.filter((key) => !Object.prototype.hasOwnProperty.call(MESSAGES.id, key));
    assert.deepEqual(unknown, [],
      `${file.join('/')} has a *Keys map holding something that is not a message key: ${unknown.join(', ')}`);
  }
}

// A translator parameter must never carry a DEFAULT. Three helpers now take `t` because they run outside
// a component — getScarcityLabel, describeWear, formatDate — and each time, a default that quietly
// returns Indonesian would print it into the English shop with nothing to flag it. A sabotage did exactly
// that to the journal's date helper and walked past every other check here, because the Indonesian never
// appears as rendered text: it hides in a parameter list.
for (const file of [
  ['utils', 'stockScarcity.js'],
  ['utils', 'productWear.js'],
  ['pages', 'mobile', 'MobileArticlesPage.jsx'],
  ['pages', 'PublicTrackingPage.jsx'],
  ['pages', 'PaymentPage.jsx'],
]) {
  const source = read(...file);
  const defaults = source.match(/[,(]\s*t\s*=\s*[^,)]+/g) || [];
  assert.deepEqual(defaults, [],
    `${file.join('/')} gives the translator a default: ${defaults.join(' | ')} — silence is the only safe fallback`);
}

// getFriendlyShippingErrorKey returns a KEY and takes no translator. Adding a `t` parameter in front of
// its fallback silently shifts every caller's argument by one, so the specific fallback key becomes the
// translator and the generic default is used instead — a wrong message, in the right language.
for (const file of [['pages', 'BespokePage.jsx'], ['pages', 'mobile', 'MobileBespokePage.jsx']]) {
  assert.match(read(...file), /const getFriendlyShippingErrorKey = \(error, fallbackKey = 'bsp\.areaSearchFailed'\) =>/,
    `${file.join('/')}: the shipping-error helper returns a key and takes no translator`);
}

// The scarcity line takes the translator and has NO default. A default would print Indonesian into the
// English shop and nothing would say so.
const scarcity = read('utils', 'stockScarcity.js');
assert.match(scarcity, /export const getScarcityLabel = \(stock, translate\) =>/, 'the translator is required');
assert.match(scarcity, /if \(typeof translate !== 'function'\) return '';/, 'and silence without it');

// A label paired with a runtime value is copy, and it hides from every check above: `['Aroma', item?.notes]`
// has no JSX tags around it, sits in no label= prop, and is short enough to duck the 20-character prose
// floor. The account page builds its bespoke rows exactly that way, and a sabotage put 'Aroma' back.
//
// The shape is specific on purpose: a capitalised literal followed by an EXPRESSION. `['Woody', 'Citrus']`
// and `['GoPay', 'OVO']` are lists of values, not label/value pairs, and stay legal.
for (const file of PAGES_FULLY_TRANSLATED) {
  const pairs = read(...file).match(/\[\s*'[A-ZÀ-ÿ][^']{2,40}'\s*,\s*[A-Za-z_$][\w$]*[.?[]/g) || [];
  assert.deepEqual(pairs, [],
    `${file.join('/')} labels a value with a bare string literal: ${pairs.join(' | ')}`);
}

// Dates are text too. `Intl.DateTimeFormat('id-ID')` prints "15 Agu 2026" — Agu, Okt, Des and Mei are
// Indonesian words, on an English page, with no string literal anywhere to find them by. The locale
// belongs in the message file like every other word, so the page reads it through the translator.
// (NumberFormat('id-ID') stays: the price is in rupiah in both shops, and 1.400.000 is the right shape.)
for (const file of PAGES_FULLY_TRANSLATED) {
  const pinned = read(...file).match(/Intl\.DateTimeFormat\('id-ID'/g) || [];
  assert.deepEqual(pinned, [],
    `${file.join('/')} pins the date format to Indonesian — read t('fmt.dateLocale') instead`);
}
assert.equal(MESSAGES.id['fmt.dateLocale'], 'id-ID', 'the Indonesian shop formats dates in Indonesian');
assert.equal(MESSAGES.en['fmt.dateLocale'], 'en-GB', 'the English shop does not');

// A template literal is the fourth way copy hides. `${code} disalin` has no tags around it, no quotes the
// literal scan matches, and each Indonesian word is too short for the prose floor — and six of them were
// sitting on the payment page, live, after that page was declared fully translated.
//
// Strip the ${...} holes, then look at what the author actually typed. Tailwind class lists, paths,
// selectors and template-built ids all carry - / [ ] # ? = _ { } < >, and a bare identifier like
// `product` carries no space. A sentence carries letters AND a space and none of that punctuation.
const TEMPLATE_COPY_ALLOWED = new Set([
  'ETA ',              // the courier's own abbreviation, printed the same way in both shops
  'Bespoke perfume: ', // the order ITEM NAME written into the database, not text on a screen
  ' bottle',           // same — part of the stored bespoke item name
]);
for (const file of PAGES_FULLY_TRANSLATED) {
  const sentences = (read(...file).match(/`[^`]*`/g) || [])
    .map((hit) => hit.slice(1, -1).replace(/\$\{[^{}]*\}/g, ''))
    .filter((hit) => !/[/\[\]#?={}<>_-]|\n/.test(hit))
    .filter((hit) => /[A-Za-zÀ-ÿ]{3,}/.test(hit) && /\s/.test(hit))
    .filter((hit) => !TEMPLATE_COPY_ALLOWED.has(hit));
  assert.deepEqual(sentences, [],
    `${file.join('/')} builds copy in a template literal: ${sentences.map((hit) => JSON.stringify(hit)).join(' | ')}`);
}

// The list above is only as good as the day somebody last edited it. A new buyer route added to App.jsx
// gets none of the checks in this file and nothing says so — the account page sat unlisted for weeks and
// its timeline printed a raw key past a sabotage because of it.
//
// So the router is the source of truth: every route that a BUYER can open — not under /studio, not behind
// ProtectedRoute, not a bare redirect — must name a component that appears in PAGES_FULLY_TRANSLATED.
{
  const app = read('App.jsx');
  // Studio's own sign-in and password-reset screens. They are the door into the admin app, which stays
  // Indonesian on purpose — no buyer is ever sent to them.
  const STUDIO_AUTH = new Set(['LoginPage', 'MobileLoginPage', 'ResetPasswordPage']);
  // A component that renders nothing but a <Navigate>. It has no copy to translate.
  const REDIRECT_ONLY = new Set(['RootRedirect']);

  const translated = new Set(PAGES_FULLY_TRANSLATED.map((file) => file[file.length - 1].replace('.jsx', '')));
  const unguarded = [];
  for (const route of app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g)) {
    const [, path, element] = route;
    if (/ProtectedRoute|RequireAuth/.test(element)) continue;
    if (path.startsWith('/studio') || path.startsWith('/mobile/studio')) continue;
    const component = (element.match(/<(\w+)/) || [])[1];
    if (!component || component === 'Navigate') continue;
    if (STUDIO_AUTH.has(component) || REDIRECT_ONLY.has(component)) continue;
    if (!translated.has(component)) unguarded.push(`${path} -> ${component}`);
  }
  assert.deepEqual(unguarded, [],
    `these buyer routes render a page that is not in PAGES_FULLY_TRANSLATED, so none of the checks in this file ever look at it: ${unguarded.join(' | ')}`);
  // And the parse has to actually find routes: a regex that silently matched nothing would pass forever.
  assert.ok((app.match(/<Route\s+path="/g) || []).length > 30, 'the App.jsx route scan must actually find the routes');
}

// --- Copy that LEAVES the page ------------------------------------------------------------------------
// The WhatsApp draft is the one piece of copy a buyer is expected to SEND, and the one piece every check
// above is blind to: it never renders, so no scan for leftover Indonesian on screen can see it. The
// product page shipped an Indonesian draft to the English shop for exactly that reason — the language
// came from a prop only one of the three callers passed, and nothing failed.
//
// The rule is that no draft is written in a component at all. Both languages live in the message file,
// like every other string, and the shop's own region picks between them.
{
  const walk = (dir, out = []) => {
    for (const entry of readdirSync(join(root, ...dir), { withFileTypes: true })) {
      if (entry.isDirectory()) walk([...dir, entry.name], out);
      else if (/\.(jsx?|mjs)$/.test(entry.name) && !entry.name.includes('selfcheck')) out.push([...dir, entry.name]);
    }
    return out;
  };

  // Studio's own notification templates are excluded: those are Dekito writing TO a buyer from the admin
  // app, not the shop speaking to a visitor, and they are composed from order data rather than UI copy.
  const SENDER_SIDE = 'services/notificationTemplateService.js';
  const offenders = [];
  let seen = 0;
  for (const file of walk(['components']).concat(walk(['pages']), walk(['layouts']), walk(['services']))) {
    const rel = file.join('/');
    if (rel === SENDER_SIDE) continue;
    const source = read(...file);
    // Only the message ARGUMENT: encodeURIComponent is also how order codes and ids reach a URL, and
    // those are data, not copy. `t(` first in the alternation, or the identifier branch swallows the t.
    // Whatever is actually passed, not only the shapes we expect: a check that captures `t(` or an
    // identifier and nothing else simply does not see a backtick draft written inline at the call, which
    // is the laziest way to reintroduce exactly this bug.
    const calls = [
      ...source.matchAll(/buildWhatsAppCheckoutUrl\(\s*([^,)]{0,60})/g),
      ...source.matchAll(/\?text=\$\{encodeURIComponent\(\s*([^)]{0,60})/g),
    ];
    seen += calls.length;
    for (const call of calls) {
      const argument = call[1].trim();
      if (argument.startsWith('t(')) continue;
      // A named variable is fine only if this file builds it from the message file.
      if (/^[A-Za-z_$][\w$]*$/.test(argument)) {
        const assigned = source.match(new RegExp(`const ${argument} = ([\\s\\S]{0,40})`));
        if (assigned && /^t\(/.test(assigned[1].trim())) continue;
      }
      offenders.push(`${rel}: sends \`${argument}\`, which is not built from the message file`);
    }
  }
  assert.deepEqual(offenders, [],
    'a WhatsApp draft must come from the message file so it follows the shop\'s language:\n  '
    + offenders.join('\n  '));
  // And the scan has to actually find the calls, or a renamed helper makes it pass forever on nothing.
  assert.ok(seen >= 5, `the WhatsApp draft scan found only ${seen} call(s) — it is no longer looking at the right thing`);
}

console.log('storefrontMessages selfcheck OK (two languages out of one object, every key paired, the product page leaving no Indonesian behind, and the English never promising a member price an international order cannot get)');
