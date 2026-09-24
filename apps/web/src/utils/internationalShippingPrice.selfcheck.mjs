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

// --- 6. The price card is what the Studio page charges, and the carrier rate is not -------------------
// The calculator used to put the CARRIER COST into the order it creates, because that was the only
// number it had. With a published price in the repo, billing the cost is billing the wrong number.
const page = read('pages', 'ExportShippingCalculatorPage.jsx');
assert.match(page, /quoteInternationalShippingPrice\(/, 'the Studio calculator must quote from the card');
// Pinning the exact expression made this fail the moment the rule legitimately grew a third branch, so
// it reads the PRECEDENCE instead: a typed figure wins, then the shop's promise, then the published
// price, and the carrier cost is the last resort it used to be the first.
const chargedLine = (page.match(/const shippingCharged = .*/) || [''])[0];
assert.ok(chargedLine, 'the page must compute one shipping figure');
assert.ok(chargedLine.indexOf('typedShipping') === 0 + 'const shippingCharged = '.length - 0,
  `a hand-typed figure must win: ${chargedLine}`);
assert.ok(chargedLine.indexOf('priceCardIdr') < chargedLine.indexOf('quote?.total'),
  `the published price must come before the carrier cost: ${chargedLine}`);
assert.match(page, /USD_PER_RUPIAH_RATE/, 'the rupiah figure must name the rate it was converted at');

// One figure, two places. Caught on the screen before this shipped: the WhatsApp summary was still built
// from the carrier quote while the order used the card, so the message said Rp 180.000 and the order said
// Rp 2.227.500 for the same six bottles to Malaysia.
assert.match(page, /shipping: shippingCharged > 0 \? \{ total: shippingCharged/,
  'the copied summary must quote the same shipping figure the order is billed');
assert.doesNotMatch(page, /shipping: quote,/,
  'the summary may not be built from the carrier cost while the order bills the published price');

// --- 6b. Where the shop says shipping is included, the order must not add it ---------------------------
// Every product page tells an international buyer "Shipping is included", and this screen is where that
// buyer's order is written down. Billing the rate card on top of a price that already carries the
// shipping charges them twice for the same parcel. Decision, 2026-09-24: not charged yet.
assert.match(page, /shippingIncludedFor\(countryCode\)/,
  'the calculator must ask the shop\'s own rule whether the price already carries the shipping');
assert.match(page, /shippingInPrice \? 0 :/,
  'and must charge nothing where it does');

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
