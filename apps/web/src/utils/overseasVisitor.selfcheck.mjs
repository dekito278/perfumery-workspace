// `node src/utils/overseasVisitor.selfcheck.mjs`
//
// An international visitor used to read the Indonesian price, ask on WhatsApp, and be quoted 2,5x it.
// This is the panel that shows the export price up front instead — and the three rules that stop a
// browser-based GUESS about where someone is from turning into a wrong price.
//
// It decides what a buyer believes they will pay, so every rule here is run rather than read.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import {
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

// --- 5. There is ONE dollar rate, and one module that divides by it ------------------------------------
// This section used to run approximateUsd, the rounded "approx" conversion that lived in this file. It
// is gone as of 2026-09-25: the storefront panels moved onto usdPriceFor when the dollar figure became
// the actual charge, and the export quote screen — its last caller, where it was setting a freight
// figure someone is billed — moved a day later. A second exported constant named "the dollar rate" with
// no callers is not dormant; it is what the next screen finds first.
//
// So the test is no longer "the approximation behaves" but the rule that made it deletable: there is one
// rupiah-to-dollar rate in this codebase. Found by walking the tree, because the next copy will not be
// called approximateUsd.
//
// Worth keeping the reason nearby, because the two rates were not a mistake — they were a considered
// separation that quietly stopped being one. One was documented as free to drift toward the market and
// only ever shown with "approx" beside it; the other decided what a buyer is asked to send. That holds
// exactly as long as the approximate one never touches a billed figure, and the export quote screen
// crossed that line without anyone noticing, pricing freight with it — the freight the "Pakai" button
// now types straight into the bill. The first attempt at a guard here asserted that the screens which
// write orders and the screens which touch the indicative rate never intersect. That guard dies with
// the constant: once nothing declares a second rate, it passes over nothing. This is what replaced it,
// and it holds whether or not the constant exists.
const everyModule = [];
const walkAll = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkAll(full);
    else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.includes('.selfcheck.')) everyModule.push(full);
  }
};
walkAll(join(root));
walkAll(join(root, '..', 'api'));

// A rate is a number of rupiah to the dollar, declared under a name that says so. Matched on the name
// and the shape rather than on 16500, because the next one will be 17000.
const RATE_DECLARATION = /export const ([A-Z][A-Z_]*)\s*=\s*(\d{4,6})\b/g;
const namesARate = (name) => /USD|RUPIAH/.test(name) && /RATE/.test(name);
const rates = [];
for (const file of everyModule) {
  for (const found of stripComments(readFileSync(file, 'utf8')).matchAll(RATE_DECLARATION)) {
    if (!namesARate(found[1])) continue;
    rates.push(`${file.slice(root.length + 1)}:${found[1]}=${found[2]}`);
  }
}
assert.deepEqual(rates, ['utils/usdPrice.js:USD_PRICE_RATE=16500'],
  'there is more than one rupiah-to-dollar rate in this codebase. Two rates drift, and drifting is how '
  + 'freight came to be priced at the one this file used to call approximate while the same order total '
  + `was figured at the other: ${rates.join(', ')}`);

// This rule INVERTED on 2026-09-24, the second time a rule in this file has turned over rather than been
// deleted. It used to require the word "approx" beside every dollar figure, because the figure was a
// conversion of the rupiah price that would actually be charged. International buyers now pay in USD into
// a USD account, so the dollar figure IS the charge — and "approx." above a payment page demanding an
// exact transfer would be the misleading half of the old sentence, kept after its reason expired.
//
// So the requirement is the opposite, and stricter: no storefront surface may hedge the dollar price, and
// all three must take it from the one function that decides it.
for (const file of [
  ['components', 'storefront', 'OverseasPriceNote.jsx'],
  ['components', 'storefront', 'InternationalPrice.jsx'],
  ['components', 'storefront', 'CardPrice.jsx'],
]) {
  const source = read(...file);
  if (!/US\$/.test(source)) continue;
  assert.doesNotMatch(source, /approx/i,
    `${file.join('/')} still hedges the dollar figure — it is the amount the buyer transfers now`);
  assert.match(source, /usdPriceFor\(/,
    `${file.join('/')} must take the dollar price from usdPrice.js, not convert it on its own`);
}
const note = read('components', 'storefront', 'OverseasPriceNote.jsx');
// This rule has inverted twice, and what survives both inversions is the part worth checking: the panel
// must SAY what happens about the freight, in the same direction the order is written.
//
//   before 19 Sep 2026 — "not included": the only carrier in the code was LTU, Rp 1.188.000 a kilo to
//                        Malaysia, and no sane price swallows that.
//   19–25 Sep 2026     — "included": RaySpeed charges Rp 90.000 to Malaysia, so it went inside the price.
//   from 25 Sep 2026   — "quoted separately": RaySpeed bills a one-kilo MINIMUM, so one 30 ml bottle to
//                        Los Angeles costs Rp 670.500 out of a US$80 price. The promise only ever held
//                        on a full parcel. Found on a live American order, for a single bottle.
//
// A silent panel is the failure in every one of those states: a buyer who is surprised by a second bill
// after paying is the complaint this sentence exists to prevent.
assert.match(note, /[Ss]hipping is quoted separately/,
  'the panel must tell an overseas reader that the freight is quoted on top, before they press the button');
assert.doesNotMatch(note, /Shipping is not\s+included|quote it by hand/i,
  'and it must not go back to promising a separate shipping bill');

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
// Held as the INVARIANT, not as one call's shape: the previous version pinned the exact expression
// `publish(resolveRegion(readStoredRegion(), detectOverseasVisitor()))`, so adding a third source to the
// resolution broke the guard without breaking the rule. What must stay true is that the only place
// detection runs is inside the effect.
{
  const effectAt = hook.indexOf('useEffect(() => {');
  assert.notEqual(effectAt, -1, 'the region hook still resolves in an effect');
  const effectBody = hook.slice(effectAt, hook.indexOf('}, []);', effectAt));
  assert.match(effectBody, /detectOverseasVisitor\(\)/, 'detection belongs in an effect');
  const outsideEffect = hook.slice(0, effectAt) + hook.slice(hook.indexOf('}, []);', effectAt));
  assert.doesNotMatch(outsideEffect, /detectOverseasVisitor\(\)/,
    'and nowhere else — detection during render bakes one visitor\'s answer into the prerendered HTML');
}
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
// The panel was the export price's first home. It is gone from the product pages: since Dekito's
// decision of 2026-09-16 the international price IS the headline there, and the panel repeated the same
// number under a sentence — "priced separately from the Indonesian price above" — that had stopped being
// true, because there is no Indonesian price above it any more.
//
// What replaced it has to be on BOTH surfaces, which is what this guard is really for.
// ImmersiveProductPage is in this list because it REPLACES the product page for a product with a
// story — a third surface, reached by a branch above every line that resolves the copy. It was not
// reachable from the English shop until Ayang-ayang got an English letter, and the moment it was, it
// offered an overseas buyer "Tambah ke Keranjang — Rp 289.000": an Indonesian button, the domestic
// price, and a cart that cannot ship to them.
for (const page of [
  ['pages', 'PublicProductDetailPage.jsx'],
  ['pages', 'mobile', 'MobileProductDetailPage.jsx'],
  ['pages', 'ImmersiveProductPage.jsx'],
]) {
  const source = read(...page);
  assert.match(source, /<InternationalPrice price=\{exportPrice\}/,
    `${page.join('/')} leads with the international price — desktop and mobile drifting apart is this repo's commonest defect`);
  assert.match(source, /<SwitchToIndonesiaHint/,
    `${page.join('/')} keeps the way back for a domestic buyer reading English`);
  assert.doesNotMatch(source, /<OverseasPriceNote/, 'and does not repeat the same number in a second panel');
}
// And all three offer the cart to EVERY reader since 2026-10-06. From 18 Sep to 6 Oct the rule here was
// the opposite — no add-to-cart on the international side of an isInternational gate — because the only
// cart was the domestic one, priced by RajaOngkir, which returns an empty area list for a foreign
// address. Dekito reopened the cart for the English shop ("orang luar itu masukin ke keranjang sama
// kayak di Indonesia"); it prices the basket in dollars, asks for the destination and hands the order to
// WhatsApp, and englishShopOrdersOnWhatsApp.selfcheck holds that it never reaches the domestic checkout.
// What survives here is the half that was always about PRICE, not about the cart: the headline's export
// price must come from the region-gated hook, or the domestic price is what gets replaced for an
// Indonesian reader too.
for (const page of [
  ['pages', 'PublicProductDetailPage.jsx'],
  ['pages', 'mobile', 'MobileProductDetailPage.jsx'],
  ['pages', 'ImmersiveProductPage.jsx'],
]) {
  const source = read(...page);
  const name = page.join('/');
  assert.doesNotMatch(source, /isInternational \? null : \(\s*<button[\s\S]{0,240}?(?:handleAddToCart|addSelectedVariant)/,
    `${name}: add-to-cart is still hidden from the English shop, which has a cart again`);
  assert.match(source, /const exportPrice = useOverseasPrice\(product, selectedVariant\);/,
    `${name} resolves the export price with the region-gated hook`);
}

const button = read('components', 'storefront', 'OverseasInquiryButton.jsx');
// The Indonesian label moved into the message file when the storefront learned English; the English one
// stays inline because it belongs to the English panel and exists in one language by definition.
// One label for one action, from the message file. The panel and the always-visible button once carried
// different wording, which an English visitor saw twice on one page as two different offers.
//
// The label is now chosen by overseasDraftKeys, because the two shops ask for different things: in the
// Indonesian shop this button sits BESIDE a working Add to cart and asks about shipping abroad, while
// the English shop has no cart at all and this button is the purchase. Still one label per shop, still
// out of the message file, still never assembled inline.
// HELD AS THE RULE. Since 2026-10-06 the label has a second state — "pick your country first", shown
// while the international shop's picker is still empty — and it is a KEY too, chosen in the same `t(`
// call. What must stay true is what the comment above says: one `t(` of message keys, never a string
// assembled inline. Pinned to the one-key spelling, this failed the gate, which was a correct change.
// overseasDraftKeys takes no argument since 2026-10-06 — the button is the enquiry in both shops.
const labelCall = button.match(/\{t\(([^{}]*overseasDraftKeys\(\)\.labelKey[^{}]*)\)\}/);
assert.ok(labelCall, 'the enquiry button speaks the language the buyer was just reading, from the message file');
assert.doesNotMatch(labelCall[1], /['"][^'"]*\s[^'"]*['"]/,
  'every branch of the label must be a message KEY — a quoted phrase with a space in it is inline text');
assert.doesNotMatch(button, /english \? 'Ask about/, 'and there is only one label, not one per surface');
assert.match(MESSAGES.id['export.ask'], /Kirim ke luar negeri/);
// It used to have to say "shipping", because the shipping was the question. It no longer is — it is
// inside the price now — so the button names the CHANNEL instead of the unknown. What it must still do
// is send the reader to WhatsApp rather than imply a form somewhere.
assert.match(MESSAGES.en['export.ask'], /WhatsApp/i);
assert.match(MESSAGES.id['export.ask'], /WhatsApp/i);
// The ORDER button lives in the English cart since 2026-10-06 (cart.intl.order); the product page's
// button is the enquiry in both shops.
assert.match(MESSAGES.en['cart.intl.order'], /order/i);
assert.match(MESSAGES.id['cart.intl.order'], /[Pp]esan/);
assert.notEqual(MESSAGES.en['export.ask'], MESSAGES.en['export.order'],
  'the two shops would say the same thing, so one of them misdescribes what its button does');
// And so does the message it drafts — checked in the message file now, because that is where it lives.
// It used to be an inline pair chosen by a prop that only one of the three callers passed, so the
// product page handed an English reader an Indonesian draft to send.
assert.match(MESSAGES.en['export.waDraft'], /Hello SOLIVAGANT/);
assert.match(MESSAGES.id['export.waDraft'], /Halo SOLIVAGANT/);
assert.doesNotMatch(button, /SOLIVAGANT,/, 'no draft is written in the component, in either language');
// The draft quotes the price the PAGE is offering for an overseas shipment. Both callers pass a
// region-gated price — null for an Indonesian reader — so the draft fell back to the domestic label and
// contradicted the export-price line printed directly above the button.
// Held as the RULE, not as the spelling it had. The quoted figure is now in DOLLARS — the currency the
// buyer is actually asked to send — so pinning the old rupiah expression made a correct change read as a
// regression. What must stay true is that the component's OWN export price wins over the caller's prop.
{
  const quoted = button.match(/const quoted = [^\n]*/);
  assert.ok(quoted, 'the draft no longer resolves a quoted price at all');
  assert.match(quoted[0], /exportPrice|quotedUsd/,
    'the export price is ungated right here; the draft must prefer it over whatever the caller passed');
  assert.ok(quoted[0].lastIndexOf('price') > quoted[0].indexOf('exportPrice') || /quotedUsd/.test(quoted[0]),
    'the caller\'s prop must remain the LAST resort, not the first choice');
}
// The draft itself moved into overseasEnquiry.js so the two sticky bars could stop sending a generic
// message that named no perfume. The rule did not move: the number resolved above is the number that
// reaches WhatsApp, and an unknown price prints no line at all rather than an empty one.
assert.match(button, /buildOverseasDraft\(\{[\s\S]{0,200}?price: quoted/,
  'and it must be the number that reaches the message');
const draftBuilder = read('utils', 'overseasEnquiry.js');
// HELD AS THE RULE, NOT AS THE SPELLING. This was pinned to the exact text
// `line: price ? t('export.waDraftPrice', { price }) : ''` and it failed the day the builder learned to
// carry a settled TOTAL as well as a bare price — a change that made the draft more honest, not less.
// Its own comment above already said what it meant: the resolved number reaches WhatsApp, and an unknown
// price prints no line at all. So RUN the builder and check that, with the real message catalogue.
{
  const runnable = "const usdPriceFor = (v) => (Number(v) > 0 ? Math.ceil(Number(v) / 16500 / 5) * 5 : null);\n"
    + readFileSync(join(root, 'utils', 'overseasEnquiry.js'), 'utf8')
      .split('\n').filter((line) => !line.startsWith('import ')).join('\n');
  const { buildOverseasDraft: build } = await import(
    `data:text/javascript;base64,${Buffer.from(runnable, 'utf8').toString('base64')}`);
  const t = (key, vars) => (vars ? String(MESSAGES.en[key] ?? key).replace(/\{(\w+)\}/g, (whole, name) => (
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole)) : (MESSAGES.en[key] ?? key));
  const draftFor = (extra) => build({ t, isInternational: true, name: 'La Tulipe', size: '30 ml', ...extra });

  // A price and nothing else: the price line, with the number in it.
  assert.match(draftFor({ price: 'US$80' }), /US\$80/,
    'the price the caller resolved must reach the message');
  // No price at all: no line, and NO leftover placeholder. An empty line is a draft with a gap in it;
  // a leftover {line} is a draft that shows the buyer the template.
  const bare = draftFor({ price: '' });
  assert.doesNotMatch(bare, /\{line\}|\{price\}/, 'an unknown price must print no line, not the template');
  assert.doesNotMatch(bare, /\n\s*\n\s*\n/, 'and must not leave a blank line where the price was');

  // A settled total REPLACES the price line rather than joining it. Both name the bottle price, and a
  // draft carrying it twice makes Dekito check one number against itself before he can reply.
  const quoted = draftFor({
    price: 'US$80',
    quote: {
      key: 'export.waDraftQuote',
      vars: { destination: 'Germany', count: '1 bottle', goods: 'US$80', shipping: 'US$140', total: 'US$220' },
    },
  });
  assert.match(quoted, /Germany/, 'the settled total must name where the parcel is going');
  assert.match(quoted, /US\$220/, 'and it must carry the total the buyer was shown');
  assert.equal((quoted.match(/US\$80/g) || []).length, 1,
    'the bottle price belongs in the quote line only — the price line must stand down when a total exists');
  assert.doesNotMatch(quoted, new RegExp(String(MESSAGES.en['export.waDraftPrice']).trim().split('{')[0].trim()),
    'the old price line must not also appear beside the total');
}
// A fixed height clipped the two-line English label half out of its own box on a 375px phone.
assert.match(button, /min-h-\[2\.75rem\]' : 'min-h-\[3rem\]/, 'the button grows to fit a label that wraps');
assert.doesNotMatch(button, /compact \? 'h-11' : 'h-12'/, 'and is never pinned to a fixed height again');
assert.match(MESSAGES.en['export.waDraft'], /does not reserve a bottle/,
  'an enquiry reserves nothing, in either language — someone who asks on Monday and orders on Friday must not believe a bottle was held');
assert.match(MESSAGES.id['export.waDraft'], /belum memesan stok/);
// The ORDER lives in the English cart since 2026-10-06 (export.waCartDraft) — and it must be just as
// careful as the enquiry. Nothing is held until Dekito confirms on WhatsApp.
assert.match(MESSAGES.en['export.waCartDraft'], /nothing is reserved/i,
  'the cart order draft lets a buyer believe a bottle is being held for them');
assert.match(MESSAGES.id['export.waCartDraft'], /belum ada botol yang ditahan/);

// --- 9b. The HEADLINE price is region-gated; the enquiry line is not -------------------------------------
// useExportPrice returns the export price to EVERYONE — that is its job, and it is what lets the
// Indonesian shop show "Harga untuk pengiriman ke luar negeri" on its enquiry button. useOverseasPrice
// returns it only to a visitor reading the international shop.
//
// Using the wrong one to decide the headline put Rp 2.630.000 at the top of the INDONESIAN product page
// and US$ prices on its catalogue cards. That shipped nowhere only because it was opened on a phone
// first; this is the guard that would have caught it.
for (const file of [
  ['pages', 'PublicProductDetailPage.jsx'],
  ['pages', 'mobile', 'MobileProductDetailPage.jsx'],
  ['components', 'storefront', 'CardPrice.jsx'],
]) {
  const source = read(...file);
  assert.doesNotMatch(source, /useExportPrice/,
    `${file.join('/')} decides a headline price, so it must use useOverseasPrice — useExportPrice hands the export price to the Indonesian shop too`);
  assert.match(source, /useOverseasPrice\(product, (?:selectedVariant|variant)\)/,
    `${file.join('/')} reads the region-gated price`);
}
// And the enquiry button keeps useExportPrice, because that line IS meant for both shops.
assert.match(button, /useExportPrice\(product, variant\)/,
  'the enquiry button still shows the export price in the Indonesian shop — that was the point of it');

// A card must never print a raw price alongside CardPrice: a sabotage kept the component in a dead
// branch and put the rupiah span back next to it, and every "does CardPrice appear?" check passed.
for (const file of [
  ['pages', 'CatalogPage.jsx'], ['pages', 'mobile', 'MobileCatalogPage.jsx'],
  ['pages', 'mobile', 'MobileStorefrontPage.jsx'], ['pages', 'HomePage.jsx'],
  ['pages', 'PublicProductDetailPage.jsx'], ['pages', 'mobile', 'MobileProductDetailPage.jsx'],
]) {
  const source = read(...file);
  const raw = source.match(/<span[^>]*card__price[^>]*>\{(?:product|item)[.?]/g) || [];
  assert.deepEqual(raw, [],
    `${file.join('/')} prints a card price outside CardPrice: ${raw.join(' | ')}`);
}

// EVERY add-to-cart on a product page is offered in BOTH shops since 2026-10-06. From 18 Sep to 6 Oct the
// rule here was the opposite — gated in the English shop, and gated twice because the sticky bar is a
// second button — until Dekito decided the English shop takes a basket too: "orang luar itu masukin ke
// keranjang sama kayak di Indonesia". The English cart prices the basket in dollars and hands the order
// to WhatsApp (englishShopOrdersOnWhatsApp.selfcheck holds that); what this block holds is that no
// product page has quietly kept the old gate, which would hide the cart from exactly the buyer the cart
// was reopened for.
for (const page of [['pages', 'PublicProductDetailPage.jsx'], ['pages', 'mobile', 'MobileProductDetailPage.jsx'], ['pages', 'ImmersiveProductPage.jsx']]) {
  const source = read(...page);
  const carts = (source.match(/t\('pdp\.addToCart(?:WithPrice)?'/g) || []).length;
  assert.ok(carts > 0, `${page.join('/')} no longer offers a cart at all`);
  assert.doesNotMatch(source, /isInternational \? null : \(\s*<button[\s\S]{0,240}?(?:handleAddToCart|addSelectedVariant)/,
    `${page.join('/')} still hides add-to-cart in the English shop — the English cart exists now`);
}

// CardPrice looks the price up through the PRIMARY VARIANT. Every export price is keyed by variant, so a
// product-level lookup finds nothing and the card falls back to the Indonesian price in silence.
const cardPrice = read('components', 'storefront', 'CardPrice.jsx');
assert.match(cardPrice, /getPrimaryVariant\(Array\.isArray\(product\?\.variants\) \? product\.variants : \[\]\)/,
  'CardPrice resolves the primary variant before looking up the export price');

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
// Whether the shipping is in the price is a money statement, so it has to survive translation. It has
// flipped twice — inside the price on 19 Sep 2026, back out on 25 Sep — and each time the half that got
// missed was a language, not a rule. Both tables are checked, in the same direction, every time.
//
// Out again because RaySpeed bills a one-kilo MINIMUM: a single 30 ml bottle to Los Angeles costs
// Rp 670.500 to send against a US$80 price, while four bottles cost the same Rp 670.500. The line is
// charged from the published card now, on every destination.
assert.match(MESSAGES.id['export.notIncluded'], /ongkir dikutip terpisah/);
assert.match(MESSAGES.en['export.notIncluded'], /quoted separately/i,
  'and the English must say it too — a buyer surprised by a second bill after paying is the complaint this line prevents');
for (const [lang, table] of [['id', MESSAGES.id], ['en', MESSAGES.en]]) {
  assert.doesNotMatch(table['export.notIncluded'], /sudah termasuk|shipping included|included to/i,
    `the ${lang} line still says the freight is in the price, which it is not`);
}

// Every caller passes the variant. All 18 tier prices are keyed by variant, so a product-level lookup
// finds nothing and the line silently never appears — the exact shape of the bug that shipped in #147.
for (const caller of [['pages', 'PublicProductDetailPage.jsx'], ['pages', 'mobile', 'MobileProductDetailPage.jsx'],
  ['components', 'storefront', 'OverseasPriceNote.jsx']]) {
  assert.match(read(...caller), /<OverseasInquiryButton[\s\S]{0,200}?variant=\{/,
    `${caller.join('/')} passes the variant to the enquiry button`);
}

console.log('overseasVisitor selfcheck OK (an export price shown up front, only when real, only to a visitor two signals agree is abroad, and never touching what anyone is charged)');
