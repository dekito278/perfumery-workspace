// `node src/utils/overseasVisitor.selfcheck.mjs`
//
// An international visitor used to read the Indonesian price, ask on WhatsApp, and be quoted 2,5x it.
// This is the panel that shows the export price up front instead — and the three rules that stop a
// browser-based GUESS about where someone is from turning into a wrong price.
//
// It decides what a buyer believes they will pay, so every rule here is run rather than read.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import {
  USD_PER_RUPIAH_RATE,
  approximateUsd,
  isLikelyOverseas,
  overseasPriceFor,
} from './overseasVisitor.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. Every Indonesian zone means "not abroad" -----------------------------------------------------
// Getting one of these wrong shows an English export panel, at 2,5x the price, to a buyer in Indonesia.
for (const zone of ['Asia/Jakarta', 'Asia/Pontianak', 'Asia/Makassar', 'Asia/Jayapura']) {
  assert.equal(isLikelyOverseas(zone, ['en-US']), false, `${zone} is Indonesia even with an English browser`);
  assert.equal(isLikelyOverseas(zone, []), false, `${zone} is Indonesia with no language at all`);
}

// --- 2. Silence is the default: evidence is required to SHOW, never to hide ---------------------------
for (const nothing of ['', null, undefined, '   ', 'UTC', 'GMT', 'Asia', 'nonsense']) {
  assert.equal(isLikelyOverseas(nothing, ['en']), false,
    `${JSON.stringify(nothing)} is not evidence of being abroad`);
}

// --- 3. Both signals must agree ------------------------------------------------------------------------
assert.equal(isLikelyOverseas('Europe/Berlin', ['de-DE', 'en']), true);
assert.equal(isLikelyOverseas('Asia/Singapore', ['en-SG']), true);
assert.equal(isLikelyOverseas('America/New_York', []), true, 'a foreign zone with no language is still foreign');

// An Indonesian abroad — travelling, studying, working — still buys at Indonesian prices. This is the
// one direction that loses a real sale, so the Indonesian language tag wins over the foreign zone.
for (const tag of ['id', 'id-ID', 'ID-id', ' id-ID ']) {
  assert.equal(isLikelyOverseas('Europe/Berlin', [tag, 'en']), false, `${tag} is an Indonesian browser`);
}
assert.equal(isLikelyOverseas('Europe/Berlin', ['en', 'id']), false, 'anywhere in the list counts');
// ...but a language that merely starts with the letters "id" is a different language.
assert.equal(isLikelyOverseas('Europe/Berlin', ['ido']), true, 'ido is not Indonesian');

// --- 4. The export price is shown only when it is real AND above the domestic one ----------------------
assert.equal(overseasPriceFor({ overseas: 1380000 }, 550000), 1380000);
assert.equal(overseasPriceFor({ member: 260000 }, 289000), null, 'a member price is not an export price');
assert.equal(overseasPriceFor({}, 550000), null, 'no export price set, no panel');
assert.equal(overseasPriceFor({ overseas: 550000 }, 550000), null, 'equal to retail says nothing worth saying');
assert.equal(overseasPriceFor({ overseas: 400000 }, 550000), null, 'below retail is a typo, not an announcement');
assert.equal(overseasPriceFor({ overseas: 1380000 }, 0), null, 'nothing to compare against');
for (const bad of [null, undefined, 'abc', -1, 0]) {
  assert.equal(overseasPriceFor({ overseas: bad }, 550000), null, `${JSON.stringify(bad)} is not a price`);
}

// --- 5. The dollar figure is an approximation and is only ever shown as one ----------------------------
assert.equal(approximateUsd(1380000), Math.round(1380000 / USD_PER_RUPIAH_RATE));
assert.equal(approximateUsd(1380000) % 1, 0, 'whole dollars — cents would claim precision this does not have');
assert.equal(approximateUsd(0), null);
assert.equal(approximateUsd(-5), null);
assert.equal(approximateUsd('abc'), null);

const note = read('components', 'storefront', 'OverseasPriceNote.jsx');
assert.match(note, /approx\. US\$\{usd\}/, 'the dollar figure must carry the word approx, always');
assert.doesNotMatch(note, /Shipping is included|final price|total price/i,
  'shipping is quoted by hand — the panel must not imply this number is the final total');

// --- 6. The guess must never move money ----------------------------------------------------------------
// This is the whole safety argument. The panel ADDS a number beside the price; it must not rewrite the
// price, the cart, or anything the server prices from.
assert.doesNotMatch(note, /addItem|priceNumber:|setSelected|cartSlug/,
  'the panel must not touch the cart or rewrite a price');
const catalog = read('utils', 'tierPricedCatalog.js');
assert.match(catalog, /overseas: false/,
  'the catalog must still refuse to price overseas — a destination is not a visitor tier');

// --- 7. Detection runs after mount, never during render -------------------------------------------------
// 18 product pages are prerendered at build time. Detecting during render bakes an English export panel
// into the HTML Google indexes, and flashes it at every Indonesian visitor on hydration.
const hook = read('hooks', 'useStorefrontRegion.js');
// Two hooks, deliberately. The price exists for everyone; being QUOTED in it is a guess. Collapsing them
// would either hide the price from an Indonesian visitor with a reason to see it — Dekito checking his
// own shop — or silence the member nudge for people who can still use it.
const exportHook = read('hooks', 'useOverseasPrice.js');
assert.match(exportHook, /export const useExportPrice = \(product, variant = null\) =>/, 'the price, for anyone');
assert.match(exportHook, /export const useOverseasPrice = \(product, variant = null\) => \{[\s\S]{0,240}?return overseasVisitor \? price : null;/,
  'and the price only for a visitor looking at the international shop');
// Detection now reaches the page through the region hook, which resolves it in an effect. Asserted here
// too, not only in storefrontRegion.selfcheck: this is the file that explains WHY it must never run
// during render, and a rule whose reason lives somewhere else is one the next reader deletes.
assert.match(hook, /useEffect\(\(\) => \{[\s\S]{0,400}?publish\(resolveRegion\(readStoredRegion\(\), detectOverseasVisitor\(\)\)\);/,
  'detection belongs in an effect');
// Starts on the Indonesian shop, so the first render — the one matching the prerendered HTML — quotes nobody.
assert.match(hook, /let current = REGION_ID;/,
  'nothing is quoted internationally until the effect has run');

// --- 8. One detection, shared ------------------------------------------------------------------------------
// Two components each detecting for themselves is this repo's commonest defect, and here the two would
// contradict each other ON THE SAME SCREEN: the panel announcing Rp 1.400.000 while the line above offers
// Rp 550.000 to anyone who signs in.
const priceNote = read('components', 'storefront', 'PriceNote.jsx');
const priceHook = read('hooks', 'useOverseasPrice.js');
for (const [name, source] of [['the panel', note], ['PriceNote', priceNote]]) {
  assert.match(source, /useOverseasPrice\(product, variant\)/, `${name} asks the shared hook`);
  assert.doesNotMatch(source, /detectOverseasVisitor/, `${name} must not detect for itself`);
}
assert.doesNotMatch(priceHook, /detectOverseasVisitor/,
  'and the price hook itself reads the chosen region, not the raw guess');

// The member nudge must be silent for an international visitor: their price is the export price, so
// inviting them to sign in for the member price promises a number they will never be charged.
assert.match(priceNote, /if \(!overseasPrice && price && memberPrice && memberPrice < price\) \{/,
  'the member nudge is gated on NOT being quoted internationally');

// There are TWO member nudges. The mobile sticky bar carries its own, outside PriceNote entirely, and it
// went on offering Rp 550.000 under a Rp 1.400.000 panel until it was caught on the phone. Every place
// that prints a member price has to be gated, so every place is counted here rather than spot-checked.
const mobilePdp = read('pages', 'mobile', 'MobileProductDetailPage.jsx');
assert.match(mobilePdp, /\{!overseasPrice && \(selectedVariant\?\.memberPriceNumber \|\| product\.memberPriceNumber\) \?/,
  "the mobile sticky bar's own member nudge is gated too");
// The hook must be called before this page's early returns, or React crashes on the loading render.
assert.match(mobilePdp, /const overseasPrice = useOverseasPrice\(product, selectedVariant\);[\s\S]*?if \(!product && allProducts\.loading\)/,
  'the hook runs above the early returns');
for (const [name, source] of [['PriceNote', priceNote], ['the mobile sticky bar', mobilePdp]]) {
  const printed = (source.match(/memberPriceNumber/g) || []).length;
  const gated = (source.match(/!overseasPrice/g) || []).length;
  assert.ok(gated >= 1, `${name} gates its member price on the export price`);
  assert.ok(printed > 0, `${name} still has a member nudge to gate`);
}

// toPublicFragrance rebuilds the public product field by field, so a price attached upstream has to be
// named there too. A member price nudge shipped invisible exactly that way (#147). Reading the index in
// the hook means there is no field for that mapper to drop.
assert.match(priceHook, /tierPricesForLine\(index, product\.slug, variant\?\.id \|\| ''\)/,
  'the export price comes from the tier index, not from a field on the product');

// --- 9. On both storefronts, and in English -------------------------------------------------------------
for (const page of [['pages', 'PublicProductDetailPage.jsx'], ['pages', 'mobile', 'MobileProductDetailPage.jsx']]) {
  assert.match(read(...page), /<OverseasPriceNote product=\{product\} variant=\{selectedVariant\} \/>/,
    `${page.join('/')} shows the export panel — desktop and mobile drifting apart is this repo's commonest defect`);
}
const button = read('components', 'storefront', 'OverseasInquiryButton.jsx');
// The Indonesian label moved into the message file when the storefront learned English; the English one
// stays inline because it belongs to the English panel and exists in one language by definition.
assert.match(button, /english \? 'Ask about shipping to my country' : t\('export\.ask'\)/,
  'the enquiry button speaks the language the buyer was just reading');
assert.match(MESSAGES.id['export.ask'], /Kirim ke luar negeri/);
assert.match(button, /Hello SOLIVAGANT/, 'and so does the message it drafts');
// A fixed height clipped the two-line English label half out of its own box on a 375px phone.
assert.match(button, /min-h-\[2\.75rem\]' : 'min-h-\[3rem\]/, 'the button grows to fit a label that wraps');
assert.doesNotMatch(button, /compact \? 'h-11' : 'h-12'/, 'and is never pinned to a fixed height again');
assert.match(button, /does not reserve a bottle/,
  'an enquiry reserves nothing, in either language — someone who asks on Monday and orders on Friday must not believe a bottle was held');

// --- 10. The export price is reachable without the guess ----------------------------------------------------
// Detection decides who gets the English panel. It must not decide who is allowed to know the price at
// all: a visitor abroad behind a VPN or on a browser reporting no timezone would otherwise have to open
// WhatsApp to find out, and Dekito could never check his own export prices from Indonesia.
assert.match(button, /const \{ price: exportPrice, overseasVisitor \} = useExportPrice\(product, variant\);/,
  'the always-visible enquiry button knows the export price');
assert.match(button, /const showExportPrice = Boolean\(exportPrice\) && !english && !overseasVisitor;/,
  'shown exactly when the English panel is not already showing it');
assert.match(button, /t\('export\.priceLine'\)/, 'the price line is translated');
assert.match(MESSAGES.id['export.priceLine'], /Harga untuk pengiriman ke luar negeri/, 'in Indonesian, on the Indonesian button');
// Shipping being excluded is a money statement, so it has to survive translation in both languages.
assert.match(MESSAGES.id['export.notIncluded'], /belum termasuk ongkir/);
assert.match(MESSAGES.en['export.notIncluded'], /shipping not included/i,
  'and the English must say it too — an international price read as final is the surprise this prevents');

// Every caller passes the variant. All 18 tier prices are keyed by variant, so a product-level lookup
// finds nothing and the line silently never appears — the exact shape of the bug that shipped in #147.
for (const caller of [['pages', 'PublicProductDetailPage.jsx'], ['pages', 'mobile', 'MobileProductDetailPage.jsx'],
  ['components', 'storefront', 'OverseasPriceNote.jsx']]) {
  assert.match(read(...caller), /<OverseasInquiryButton[\s\S]{0,200}?variant=\{/,
    `${caller.join('/')} passes the variant to the enquiry button`);
}

console.log('overseasVisitor selfcheck OK (an export price shown up front, only when real, only to a visitor two signals agree is abroad, and never touching what anyone is charged)');
