// `node src/utils/internationalShippingPrice.selfcheck.mjs`
//
// The international shipping price, checked as a RULE that is run rather than a table that is read.
//
// Until 2026-10-06 this chain read a hand-written card back — nine countries, three tiers, the dollar
// figures Dekito had published. Then he put the card beside the carrier's rate sheet: every figure was
// the carrier's cost plus about ten percent, when his own practice was US$65 to the United States against
// a US$95 cost. And Iceland sat in "Europe" at US$140 while the carrier bills it at US$155. The card was
// a margin on freight that he was not actually charging, and it lost money on one destination before any
// subsidy. So the card is gone and the rule is: carrier cost for the parcel's bracket, in dollars, less a
// fixed support — US$30 for one bottle, US$50 for two or more. His numbers, made general.
//
// Two failure modes, and the second is the expensive one:
//   * a wrong number — the rule says US$65 to the United States and the app must say US$65
//   * a number where the rule REFUSES. Seven bottles, and any destination the carrier's sheet does not
//     name, are "quoted on request". Filling that in commits the shop to a price it never published.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { Buffer } from 'node:buffer';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => stripComments(readFileSync(join(srcRoot, ...parts), 'utf8'));

// The rule reads two carrier sheets through the '@/' alias, which node does not resolve: inline all four
// modules in dependency order with their imports and exports stripped, so the REAL sheets and the REAL
// arithmetic are what run — never a copy written for the test.
const inline = (...parts) => readFileSync(join(srcRoot, ...parts), 'utf8')
  .replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '')
  .replace(/^export /gm, '');
const module = await import(`data:text/javascript;base64,${Buffer.from(`
${inline('data', 'exportZones.js')}
${inline('data', 'exportRates.js')}
${inline('data', 'internationalShippingRates.js')}
${inline('utils', 'internationalShippingPrice.js')}
export {
  quoteInternationalShippingPrice, formatShippingUsd, shippingSupportUsd, shippingCostIdr,
  SHIPPING_RATE_REGIONS, SHIPPING_RATE_TIERS, SHIPPING_RATE_MAX_BOTTLES, SHIPPING_COST_RATE,
  SHIPPING_SUPPORT_USD, EXPORT_PACKAGE_RATES, EXPORT_ZONE_BY_COUNTRY,
};
`, 'utf8').toString('base64')}`);
const {
  quoteInternationalShippingPrice: quote, formatShippingUsd, shippingSupportUsd,
  SHIPPING_RATE_REGIONS, SHIPPING_RATE_TIERS, SHIPPING_RATE_MAX_BOTTLES, SHIPPING_COST_RATE,
  SHIPPING_SUPPORT_USD, EXPORT_PACKAGE_RATES, EXPORT_ZONE_BY_COUNTRY,
} = module;

// --- 1. Dekito's own numbers, as facts -------------------------------------------------------------------
// The rule was fitted to these four and must keep producing them. "DHL ke Amerika sekitar $95" is
// Rp 1.709.000 at 18.000; he charges US$65 for one bottle and US$45 for two.
assert.equal(SHIPPING_COST_RATE, 18000, 'the cost is converted at the market rate he quoted, not the pricing rate');
assert.deepEqual(SHIPPING_SUPPORT_USD, { single: 30, multiple: 50 }, "Dekito's decision, 2026-10-06");
{
  const one = quote({ countryCode: 'US', bottles: 1 });
  const two = quote({ countryCode: 'US', bottles: 2 });
  assert.equal(one.costUsd, 95, 'one bottle to the United States costs the shop US$95 to send');
  assert.equal(one.usd, 65, 'and the buyer is charged US$65 — his number');
  assert.equal(two.costUsd, 95, 'two bottles ride in the same one-kilo parcel');
  assert.equal(two.usd, 45, 'and are charged US$45 — his number');
  assert.equal(one.zone, 5, 'the United States is zone 5 on the carrier sheet');
}

// --- 2. The rule, re-derived independently and compared for every zone and count ------------------------
// Not a table of expected dollars: that would be the old card again, written by hand inside the guard.
// The arithmetic is done HERE, from the carrier's own rows, and the function must agree everywhere.
const up5 = (usd) => Math.ceil(usd / 5) * 5;
const bracketKg = (bottles) => (bottles <= 2 ? 1 : bottles <= 4 ? 2 : 3);
const sample = { 1: 'SG', 2: 'MY', 3: 'JP', 4: 'AU', 5: 'US', 6: 'AE', 7: 'DE', 8: 'IS' };
let compared = 0;
for (const zone of [1, 2, 3, 4, 5, 6, 7, 8]) {
  for (let bottles = 1; bottles <= SHIPPING_RATE_MAX_BOTTLES; bottles += 1) {
    const row = EXPORT_PACKAGE_RATES.find((entry) => entry[0] === bracketKg(bottles));
    const expectedCost = up5(row[zone] / SHIPPING_COST_RATE);
    const expectedPrice = expectedCost - (bottles >= 2 ? 50 : 30);
    const result = quote({ countryCode: sample[zone], bottles });
    assert.equal(result.zone, zone, `${sample[zone]} must resolve to zone ${zone}`);
    assert.equal(result.costUsd, expectedCost, `zone ${zone} x${bottles}: cost must be the carrier's row at ${SHIPPING_COST_RATE}, rounded up to US$5`);
    assert.equal(result.usd, expectedPrice, `zone ${zone} x${bottles}: price must be cost less the support`);
    assert.ok(result.usd > 0, `zone ${zone} x${bottles}: the support must never swallow the whole cost`);
    compared += 1;
  }
}
console.log(`  ${compared} zone x bottle quotes re-derived from the carrier sheet and matched`);

// Iceland — the destination the old card got wrong — is priced by its zone, not by the continent it is on.
assert.equal(quote({ countryCode: 'IS', bottles: 1 }).zone, 8, 'Iceland is zone 8 on the carrier sheet');
assert.equal(quote({ countryCode: 'IS', bottles: 1 }).usd, quote({ countryCode: 'BR', bottles: 1 }).usd,
  'and pays what every other zone-8 destination pays, not what Germany pays');
assert.ok(quote({ countryCode: 'IS', bottles: 1 }).usd > quote({ countryCode: 'DE', bottles: 1 }).usd,
  'which is more than Germany — the card had it at the same figure and lost money on every Icelandic parcel');

// --- 3. The brackets, and the one-kilo minimum ----------------------------------------------------------
// Two bottles cost the same to send as one, so the second bottle is charged LESS freight, not more.
assert.equal(quote({ countryCode: 'SG', bottles: 1 }).costUsd, quote({ countryCode: 'SG', bottles: 2 }).costUsd,
  'one and two bottles are the same parcel');
assert.ok(quote({ countryCode: 'SG', bottles: 2 }).usd < quote({ countryCode: 'SG', bottles: 1 }).usd,
  'and the buyer of two pays less freight than the buyer of one — the second bottle carries more of it');
assert.ok(quote({ countryCode: 'SG', bottles: 3 }).costUsd > quote({ countryCode: 'SG', bottles: 2 }).costUsd,
  '3 bottles crosses into the two-kilo bracket');
assert.equal(quote({ countryCode: 'SG', bottles: 4 }).costUsd, quote({ countryCode: 'SG', bottles: 3 }).costUsd);
assert.ok(quote({ countryCode: 'SG', bottles: 5 }).costUsd > quote({ countryCode: 'SG', bottles: 4 }).costUsd);
assert.equal(shippingSupportUsd(1), 30); assert.equal(shippingSupportUsd(2), 50); assert.equal(shippingSupportUsd(6), 50);

// --- 4. Where the rule refuses, the app refuses ---------------------------------------------------------
const sevenBottles = quote({ countryCode: 'SG', bottles: 7 });
assert.equal(sevenBottles.usd, null, '7 bottles has no price — inventing one commits the shop to it');
assert.equal(sevenBottles.onRequest, 'bottles');
assert.equal(quote({ countryCode: 'SG', bottles: 40 }).usd, null);
for (const unlisted of ['XX', 'ZZ', 'AA']) {
  const result = quote({ countryCode: unlisted, bottles: 2 });
  assert.equal(result.usd, null, `${unlisted} is not on the carrier sheet and must be quoted on request`);
  assert.equal(result.onRequest, 'destination');
}
// Destinations the OLD card refused and the rule now prices, because the carrier does ship there.
for (const nowPriced of ['TR', 'RS', 'UA', 'RU', 'BR', 'ZA', 'NG', 'EG', 'KH']) {
  assert.ok(quote({ countryCode: nowPriced, bottles: 1 }).usd > 0, `${nowPriced} has a zone and must have a price`);
}

// --- 5. Home and nonsense; every zone-sheet destination lands in exactly one group ----------------------
assert.equal(quote({ countryCode: 'ID', bottles: 2 }), null, 'Indonesia is not an international destination');
assert.equal(quote({ countryCode: '', bottles: 2 }), null);
assert.equal(quote(), null, 'called with nothing at all, no crash');
assert.equal(quote({ countryCode: 'sg', bottles: 2 }).usd, quote({ countryCode: 'SG', bottles: 2 }).usd, 'a lowercase code is the same country');
assert.equal(quote({ countryCode: 'SG', bottles: 0 }).usd, quote({ countryCode: 'SG', bottles: 1 }).usd, 'an empty form quotes the smallest parcel, not nothing');
assert.equal(quote({ countryCode: 'SG', bottles: -4 }).usd, quote({ countryCode: 'SG', bottles: 1 }).usd);
assert.equal(quote({ countryCode: 'SG', bottles: 2.6 }).usd, quote({ countryCode: 'SG', bottles: 3 }).usd, 'a fractional count rounds to whole bottles');

const seen = new Map();
for (const region of SHIPPING_RATE_REGIONS) {
  assert.ok(region.countries.length > 0, `${region.key} must hold at least one destination`);
  for (const code of region.countries) {
    assert.ok(!seen.has(code), `${code} is in both ${seen.get(code)} and ${region.key} — one country, one group`);
    assert.ok(region.zones.includes(EXPORT_ZONE_BY_COUNTRY[code]), `${code} sits in ${region.key} but its zone is not one of that group's`);
    seen.set(code, region.key);
  }
}
assert.equal(seen.size, Object.keys(EXPORT_ZONE_BY_COUNTRY).length,
  'every destination on the carrier sheet must land in a group — a missing one is a buyer told "on request" for a parcel we can price');
assert.equal(SHIPPING_RATE_TIERS.length, 3);
console.log(`  ${seen.size} destinations in ${SHIPPING_RATE_REGIONS.length} groups, none missing, none twice`);

// --- 5b. Nothing anywhere may promise the freight is in the price ---------------------------------------
// Moved here from asiaPrice.selfcheck when the Asia split was retired; the rule outlived the split. It was
// promised from 19 to 25 September 2026 and broke on a single bottle, because the carrier bills a one-kilo
// minimum. Held on the exported names, not on a comment, because a helper that lingers gets called again.
const regionModule = read('utils', 'shippingRegion.js');
assert.doesNotMatch(regionModule, /export const shippingIncludedFor/,
  'shipping is charged on every destination — a helper that answers "is it free here" invites the old rule back');
assert.doesNotMatch(regionModule, /^import .*rayspeedRates/m,
  'and the carrier network no longer decides anything about the PRICE a buyer is shown');
const messages = read('i18n', 'messages.js');
for (const line of messages.split('\n')) {
  if (!/'(export|intl|intlQuote)\.[\w.]+'|"(export|intl|intlQuote)\.[\w.]+"/.test(line)) continue;
  assert.doesNotMatch(line, /ongkir sudah termasuk|shipping included|shipping is included|free shipping|gratis ongkir/i,
    `this line still promises the freight is in the price:\n  ${line.trim()}`);
}
assert.doesNotMatch(read('components', 'storefront', 'OverseasPriceNote.jsx'), /[Ss]hipping is included/,
  'the price panel still promises the freight is in the price');

// --- 6. The card ADVISES the Studio page; Dekito decides ----------------------------------------------
// This has moved twice and the direction it settled in is the point. The calculator first billed the
// CARRIER COST, because that was the only number it had. Then it billed the published CARD outright.
// Neither was a figure Dekito had agreed to apply to every order: the card charges US$80 to Southeast
// Asia where RaySpeed costs about Rp 90.000, and the cost is not a price at all.
//
// His decision, 2026-09-25: the international price is fixed at 3.5x retail, and he sets the shipping
// himself on this screen with both tables in front of him. So the charge is the TYPED figure, and the
// card and the carrier rate are reference — each with a button that fills the field, because a number
// you have to retype is a number that gets retyped wrong.
const page = read('pages', 'ExportShippingCalculatorPage.jsx');
assert.match(page, /quoteInternationalShippingPrice\(/, 'the card must still be on the screen as the reference');
const chargedLine = (page.match(/const shippingCharged = [\s\S]*?;/) || [''])[0];
assert.ok(chargedLine, 'the page must compute one shipping figure');
assert.match(chargedLine, /typedShipping/, 'the charge is the figure Dekito typed');
for (const automatic of ['priceCardIdr', 'quote?.total', 'quote.total']) {
  assert.ok(!chargedLine.includes(automatic),
    `${automatic} may advise the figure but never become it: ${chargedLine.replace(/\s+/g, ' ')}`);
}
// Reference is useless unless it can be taken in one press, and the button must fill the FIELD rather
// than the charge — otherwise it is the automatic rule again, wearing a button.
// What the press has to DO, not how it is spelled. Pinned to `String(priceCardIdr)` these two lines
// failed the day the field moved to LocalizedNumberInput and stopped needing the String() — a change
// that made the figure MORE correct, not less.
assert.match(page, /onClick=\{\(\) => setManualShipping\((?:String\()?priceCardIdr/,
  'the card figure must be one press away from the shipping field');
assert.match(page, /onClick=\{\(\) => setManualShipping\((?:String\()?Math\.round\(quote\.total\)/,
  'and so must the carrier cost, for the orders he passes through at cost');
// An empty field is "not decided", never "free": that is what stops a whole freight being given away by
// someone tabbing past it. Zero is still allowed — it just has to be typed. RUN the rule rather than
// pinning its text: the control now reports a number, so `.trim()` is gone and the words changed while
// the rule did not.
const settledSource = (page.match(/const shippingSettled = ([\s\S]*?);/) || [])[1];
assert.ok(settledSource, 'the page must decide whether the shipping figure has been settled');
// eslint-disable-next-line no-new-func -- the page's own expression, read from the file, run as written
const isSettled = new Function('quoteLater', 'manualShipping', `return (${settledSource});`);
assert.equal(!!isSettled(false, ''), false, 'an untouched field is undecided, not free');
assert.equal(!!isSettled(false, 0), true, 'a typed zero is a decision Dekito is allowed to make');
assert.equal(!!isSettled(false, 670500), true, 'and a typed charge settles it');
assert.equal(!!isSettled(true, ''), true, 'quoting later settles it too — the figure follows by hand');
assert.match(page, /shippingSettled,/, 'and the order builder must be told');
// The rate is named by whatever it ACTUALLY converted with — read off the conversion, not pinned to a
// constant. Pinned to USD_PER_RUPIAH_RATE, this line held the screen to the rate documented as
// indicative on the very figure the "Pakai" button types into the bill, and would have failed the fix
// rather than the bug.
const conversion = (page.match(/priceCard\??\.usd \* (\w+)/) || [])[1];
assert.ok(conversion, 'the page no longer converts the published shipping price to rupiah at all');
assert.ok(page.includes(`{${conversion}.toLocaleString(`),
  `the caption must name the rate the figure was converted at — it converts with ${conversion} and shows `
  + 'something else, which is a number that cannot be checked against anything');

// One figure, two places. Caught on the screen before this shipped: the WhatsApp summary was still built
// from the carrier quote while the order used the card, so the message said Rp 180.000 and the order said
// Rp 2.227.500 for the same six bottles to Malaysia.
assert.match(page, /shipping: shippingCharged > 0 \? \{ total: shippingCharged/,
  'the copied summary must quote the same shipping figure the order is billed');
assert.doesNotMatch(page, /shipping: quote,/,
  'the summary may not be built from the carrier cost while the order bills what Dekito typed');

// --- 6b. Shipping is charged on every destination -----------------------------------------------------
// The inverse of the rule that stood here from 24 to 25 September 2026. That one said the shop promised
// the freight was in the price, so this screen must write Rp 0 for every country RaySpeed serves.
//
// The promise was measured on a full parcel and broke on a single bottle: RaySpeed bills a one-kilo
// MINIMUM, so ONE 30 ml bottle to Los Angeles costs Rp 670.500 to send against a US$80 price, while FOUR
// cost the same Rp 670.500. Dekito found it on a live American order — the shop had already shown the
// buyer "shipping included".
//
// Held on the ABSENCE of the by-country escape, not on the presence of a sentence: any branch that can
// zero the figure because of where the parcel is going brings the loss straight back.
assert.doesNotMatch(page, /shippingIncludedFor/,
  'no destination may be exempted from shipping — the card prices every one of them');
// Counted, not pattern-matched: a second `? 0` anywhere in the expression is a second way for the
// figure to reach zero, whatever it is spelled as or how it is wrapped across lines. The first version
// of this check looked for "? 0 :" followed by a country test and walked straight past
// `isAsiaCountry(countryCode) ? 0 : ...` because the real code breaks the line after the zero.
const zeroBranches = chargedLine.match(/\?\s*0\b/g) || [];
assert.equal(zeroBranches.length, 1,
  `exactly one branch may write a zero shipping figure: ${chargedLine.replace(/\s+/g, ' ')}`);
// And that one is the owner ticking a box, never a lookup by country.
assert.match(chargedLine, /quoteLater\s*\?\s*0/,
  'the only zero left is the order that is waiting for a hand-made quote');

// --- 6c. The message must not name the wrong basis -----------------------------------------------------
// And the message must name where that figure came from, instead of the carrier it stopped using.
const quoteBuilder = read('utils', 'exportQuote.js');
assert.doesNotMatch(quoteBuilder, /Ongkir \(LTU Express/,
  'the quote message may not hardcode a carrier the shop no longer bills through');
assert.match(quoteBuilder, /shipping\.label/, 'it must name the basis the caller actually used');

// Zero shipping is an answer, not a blank: "Ongkir: Rp 0" reads like a mistake to the person receiving
// the quote, and invites the question the sentence exists to prevent.
assert.match(quoteBuilder, /shippingTotal > 0/, 'a zero total must take a different sentence');
const zeroQuote = quoteBuilder.match(/Ongkir: \$\{shipping\.label\}/);
assert.ok(zeroQuote, 'and that sentence must say what is true instead of printing Rp 0');

// --- 7. The rule's conditions reach the BUYER'S SCREEN -------------------------------------------------
// This asserted that three sentences were PRESENT IN THE DATA FILE, under the heading "the conditions
// travel with the numbers". They travelled nowhere: SHIPPING_RATE_NOTES was an exported array of five
// English sentences that nothing imported. Two had been retyped into intlQuote.duties and reached the
// buyer that way; three reached no screen at all — including the one that strands a parcel, that the
// courier telephones the RECIPIENT to clear customs. A guard that reads a file can be satisfied by a file;
// this one reads the screen.
//
// They also cannot live in a data file: the shop is bilingual, and English sentences in src/data are the
// exact leak this repo's i18n rules exist to stop. So the conditions are message keys, the quote block
// renders them, and both shops must carry them.
const dataFile = read('data', 'internationalShippingRates.js');
assert.doesNotMatch(dataFile, /export const SHIPPING_RATE_NOTES/,
  'the card conditions are back in the data file, where nothing renders them and no translation can reach them');
const quoteScreen = read('components', 'storefront', 'InternationalShippingQuote.jsx');
for (const key of ['intlQuote.duties', 'intlQuote.recipient']) {
  assert.ok(quoteScreen.includes(`t('${key}')`), `the quote block must show ${key} — it is a condition of the price beside it`);
  for (const shop of ['id', 'en']) {
    assert.ok(MESSAGES[shop][key], `${key} is missing from the ${shop} shop`);
  }
}
// What each condition has to SAY, in both languages — held on meaning, not on one wording.
assert.match(MESSAGES.en['intlQuote.duties'], /duties|taxes/i, 'the duties note must name the duties');
assert.match(MESSAGES.id['intlQuote.duties'], /bea|pajak/i);
assert.match(MESSAGES.en['intlQuote.recipient'], /courier|contact/i, 'the recipient note must say the courier may make contact');
assert.match(MESSAGES.id['intlQuote.recipient'], /kurir|hubungi/i);

assert.equal(formatShippingUsd(80), 'US$80');
assert.equal(formatShippingUsd(0), '', 'no price is no string, not "US$0"');
assert.equal(formatShippingUsd(null), '');

console.log('internationalShippingPrice selfcheck OK (the price is the carrier cost less the support, re-derived for every zone, and the refusals are kept)');
