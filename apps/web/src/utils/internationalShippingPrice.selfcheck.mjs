// `node src/utils/internationalShippingPrice.selfcheck.mjs`
//
// The published rate card, checked as a price list rather than as a file that exists.
//
// Two failure modes are worth guarding, and the second is the expensive one:
//   * a wrong number — the card says $140 to Europe and the app must say $140, not $135 or $215
//   * a number where the card printed a REFUSAL. Seven bottles, and any destination not on the card, are
//     "quoted on request". Filling that in with the nearest tier would commit the shop to a price it
//     never published, on the parcel most likely to be the expensive one.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => stripComments(readFileSync(join(srcRoot, ...parts), 'utf8'));

// The util imports the data through the '@/' alias, which node does not resolve: inline the data module
// and strip the import, so the REAL table is what gets tested — not a copy written for the test.
const dataSource = readFileSync(join(srcRoot, 'data', 'internationalShippingRates.js'), 'utf8')
  .replace(/^export /gm, '');
const utilSource = readFileSync(join(srcRoot, 'utils', 'internationalShippingPrice.js'), 'utf8')
  .replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '')
  .replace(/^export /gm, '');
const module = await import(`data:text/javascript;base64,${Buffer.from(`${dataSource}\n${utilSource}
export { quoteInternationalShippingPrice, formatShippingUsd, SHIPPING_RATE_REGIONS, SHIPPING_RATE_TIERS, shippingRateRegionFor };
`, 'utf8').toString('base64')}`);
const { quoteInternationalShippingPrice: quote, formatShippingUsd, SHIPPING_RATE_REGIONS, SHIPPING_RATE_TIERS } = module;

// --- 1. Every price on the card, read back ------------------------------------------------------------
// One country per region, all three tiers. If a digit is ever fat-fingered in the table, this is what
// says so — and the table is the only place the shop's shipping price exists.
const CARD = [
  ['SG', [[1, 80], [2, 80], [3, 100], [4, 100], [5, 135], [6, 135]]],
  ['HK', [[2, 80], [6, 135]]],
  ['JP', [[1, 100], [3, 125], [5, 165]]],
  ['AU', [[2, 100], [4, 125], [6, 165]]],
  ['US', [[1, 115], [3, 160], [5, 195]]],
  ['AE', [[1, 125], [3, 160], [5, 195]]],
  ['IN', [[2, 125], [4, 160], [6, 195]]],
  ['GB', [[1, 140], [3, 180], [5, 215]]],
  ['DE', [[2, 140], [4, 180], [6, 215]]],
];

for (const [code, rows] of CARD) {
  for (const [bottles, usd] of rows) {
    const result = quote({ countryCode: code, bottles });
    assert.equal(result.usd, usd, `${code} x${bottles} must be US$${usd} — the card is the price we committed to`);
  }
}

// --- 2. Tier boundaries are where the card drew them --------------------------------------------------
assert.equal(quote({ countryCode: 'SG', bottles: 2 }).usd, 80, '2 bottles is still the first tier');
assert.equal(quote({ countryCode: 'SG', bottles: 3 }).usd, 100, '3 bottles crosses into the second');
assert.equal(quote({ countryCode: 'SG', bottles: 4 }).usd, 100);
assert.equal(quote({ countryCode: 'SG', bottles: 5 }).usd, 135);
assert.equal(quote({ countryCode: 'SG', bottles: 6 }).usd, 135, '6 bottles is the last price the card prints');

// --- 3. Where the card refuses, the app refuses -------------------------------------------------------
const sevenBottles = quote({ countryCode: 'SG', bottles: 7 });
assert.equal(sevenBottles.usd, null, '7 bottles has no price on the card — inventing one commits the shop to it');
assert.equal(sevenBottles.onRequest, 'bottles');
assert.equal(quote({ countryCode: 'SG', bottles: 40 }).usd, null);

for (const unlisted of ['TR', 'RS', 'UA', 'RU', 'BR', 'ZA', 'NG', 'EG', 'KH']) {
  const result = quote({ countryCode: unlisted, bottles: 2 });
  assert.equal(result.usd, null, `${unlisted} is not on the card and must be quoted on request`);
  assert.equal(result.onRequest, 'destination');
}

// Europe on the card is "Nordics & most of the EU" — an EU member is in, a non-EU European country is not.
assert.equal(quote({ countryCode: 'PL', bottles: 1 }).usd, 140, 'an EU member is inside "most of the EU"');
assert.equal(quote({ countryCode: 'TR', bottles: 1 }).usd, null, 'Turkey is not "most of the EU"');

// --- 4. Home and nonsense -----------------------------------------------------------------------------
assert.equal(quote({ countryCode: 'ID', bottles: 2 }), null, 'Indonesia is not an international destination');
assert.equal(quote({ countryCode: '', bottles: 2 }), null);
assert.equal(quote(), null, 'called with nothing at all, no crash');
assert.equal(quote({ countryCode: 'sg', bottles: 2 }).usd, 80, 'a lowercase code is the same country');
assert.equal(quote({ countryCode: 'SG', bottles: 0 }).usd, 80, 'an empty form quotes the smallest parcel, not nothing');
assert.equal(quote({ countryCode: 'SG', bottles: -4 }).usd, 80);
assert.equal(quote({ countryCode: 'SG', bottles: 2.6 }).usd, 100, 'a fractional count rounds to whole bottles');

// --- 5. A price is never zero, and the regions never overlap ------------------------------------------
const seen = new Map();
for (const region of SHIPPING_RATE_REGIONS) {
  assert.equal(region.usd.length, SHIPPING_RATE_TIERS.length, `${region.key} must price every tier`);
  region.usd.forEach((usd, index) => {
    assert.ok(usd > 0, `${region.key} tier ${index} must have a price`);
    if (index > 0) {
      assert.ok(usd >= region.usd[index - 1], `${region.key} must not get cheaper as the parcel grows`);
    }
  });
  for (const code of region.countries) {
    assert.ok(!seen.has(code), `${code} is in both ${seen.get(code)} and ${region.key} — one country, one price`);
    seen.set(code, region.key);
  }
}

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
assert.match(page, /onClick=\{\(\) => setManualShipping\(String\(priceCardIdr\)\)\}/,
  'the card figure must be one press away from the shipping field');
assert.match(page, /onClick=\{\(\) => setManualShipping\(String\(Math\.round\(quote\.total\)\)\)\}/,
  'and so must the carrier cost, for the orders he passes through at cost');
// An empty field is "not decided", never "free": that is what stops a whole freight being given away by
// someone tabbing past it. Zero is still allowed — it just has to be typed.
assert.match(page, /const shippingSettled = quoteLater \|\| manualShipping\.trim\(\) !== '';/,
  'an undecided shipping figure must block the order, not default to zero');
assert.match(page, /shippingSettled,/, 'and the order builder must be told');
assert.match(page, /USD_PER_RUPIAH_RATE/, 'the rupiah figure must name the rate it was converted at');

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

// --- 7. The card's conditions travel with the numbers -------------------------------------------------
const data = read('data', 'internationalShippingRates.js');
for (const condition of ['7 bottles or more', 'paid by the recipient', 'remote-area surcharge']) {
  assert.ok(data.includes(condition), `the card's condition "${condition}" must stay with the prices it qualifies`);
}

assert.equal(formatShippingUsd(80), 'US$80');
assert.equal(formatShippingUsd(0), '', 'no price is no string, not "US$0"');
assert.equal(formatShippingUsd(null), '');

console.log('internationalShippingPrice selfcheck OK (the card is quoted exactly, and its refusals are kept)');
