// `node src/utils/exportZonePrice.selfcheck.mjs`
//
// One buyer, one price, whichever screen is looking at them.
//
// The shop decides which international price a reader sees from their CLOCK (shippingRegion's Asia time
// zones). The Studio export calculator knows something better — the destination country the parcel is
// actually going to — and used neither: it quoted the world price to everyone.
//
// Measured on Dekito's Studio, 2026-09-25, destination Malaysia: the shop showed HUG N°1 at Rp 790.000
// and this screen wrote the order at Rp 1.260.000. Rp 470.000 a bottle, Rp 2.820.000 on the six-bottle
// order the page opens with, against a buyer who had already been quoted the lower number.
//
// So two rules have to hold together:
//   * the country split and the clock split must name the SAME countries, or the two screens disagree
//     about who is a neighbour
//   * the calculator must price from the destination, not from a single hardcoded tier
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(srcRoot, ...parts), 'utf8'));

const strip = (...parts) => readFileSync(join(srcRoot, ...parts), 'utf8')
  .replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '')
  .replace(/^export /gm, '');
const shim = [
  strip('data', 'exportZones.js'),
  strip('data', 'rayspeedRates.js'),
  strip('utils', 'memberPriceFill.js'),
  strip('utils', 'shippingRegion.js'),
  'export { ASIA_TIME_ZONES, isAsiaCountry, shippingRegionForCountry, shippingRegionForTimeZone, internationalPriceFor, ASIA_MULTIPLIER, EXPORT_ZONE_BY_COUNTRY };',
].join('\n');
const {
  ASIA_TIME_ZONES, isAsiaCountry, shippingRegionForCountry, shippingRegionForTimeZone, internationalPriceFor,
  EXPORT_ZONE_BY_COUNTRY,
} = await import(`data:text/javascript;base64,${Buffer.from(shim, 'utf8').toString('base64')}`);

// --- 1. The two definitions of "the neighbours" must be the same set ----------------------------------
// One is read off a browser clock, the other off a destination country. If they ever drift, a buyer in
// Vietnam is a neighbour on the shop and the rest of the world in Studio — quoted one price and charged
// another, which is the whole failure this file exists to prevent.
const TIME_ZONE_TO_COUNTRY = {
  'Asia/Singapore': 'SG',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Kuching': 'MY',
  'Asia/Brunei': 'BN',
  'Asia/Hong_Kong': 'HK',
  'Asia/Macau': 'MO',
  'Asia/Macao': 'MO',
  'Asia/Bangkok': 'TH',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Saigon': 'VN',
  'Asia/Manila': 'PH',
  'Asia/Phnom_Penh': 'KH',
  'Asia/Vientiane': 'LA',
  'Asia/Yangon': 'MM',
  'Asia/Rangoon': 'MM',
  'Asia/Dili': 'TL',
};
for (const zone of ASIA_TIME_ZONES) {
  const country = TIME_ZONE_TO_COUNTRY[zone];
  assert.ok(country, `${zone} is quoted the Asia price by the clock but this check cannot name its country`);
  assert.equal(isAsiaCountry(country), true,
    `${zone} gets the Asia price from a browser clock but ${country} does not from a destination country`);
  assert.equal(shippingRegionForTimeZone(zone), 'asia');
}

// Both directions, and the second one is the half a first version of this guard missed: a country that
// is a neighbour by ZONE but has no clock entry is the same bug pointing the other way — the shop would
// quote a buyer in Vietnam the world price while Studio writes their order at the Asia one.
const clockCountries = new Set(ASIA_TIME_ZONES.map((zone) => TIME_ZONE_TO_COUNTRY[zone]));
for (const [country, zone] of Object.entries(EXPORT_ZONE_BY_COUNTRY)) {
  if (zone > 2) continue;
  assert.ok(clockCountries.has(country),
    `${country} is in zone ${zone} — a neighbour by destination — but no Asia time zone maps to it, so the shop would quote it the world price`);
}

// The spellings a device might actually report are held one level up, by timeZoneListsAreClosed,
// which SWEEPS every time zone list in src rather than knowing about this one. Keeping a copy here
// would be the same rule in two places — the defect class this repo keeps finding.

// And nothing outside that set may slip into the country half.
for (const away of ['JP', 'AU', 'US', 'DE', 'GB', 'IN', 'AE', 'CN', 'KR', 'TW', 'NZ', 'CA']) {
  assert.equal(isAsiaCountry(away), false, `${away} is not a neighbour and must pay the world price`);
  assert.equal(shippingRegionForTimeZone(`Asia/${away}`), 'world', 'an unknown zone is never the cheaper one');
}

assert.equal(isAsiaCountry('ID'), false, 'Indonesia is home, not an export neighbour');
assert.equal(isAsiaCountry(''), false);
assert.equal(isAsiaCountry(), false, 'called with nothing at all, no crash');
assert.equal(isAsiaCountry('my'), true, 'a lowercase code is the same country');

// --- 2. The two prices, from the same inputs ----------------------------------------------------------
// HUG N°1 as it stands today: retail Rp 359.000, world price Rp 1.260.000 stored by hand.
const tierPrices = { overseas: 1260000 };
assert.equal(internationalPriceFor({ tierPrices, linePrice: 359000, region: 'asia' }), 790000,
  'a neighbour pays 2.2x retail, rounded the way the fill button rounds');
assert.equal(internationalPriceFor({ tierPrices, linePrice: 359000, region: 'world' }), 1260000,
  'everyone else pays the hand-set world price');
// The gap this defect was worth, per bottle.
assert.equal(1260000 - 790000, 470000);

// A neighbour is never charged more than the rest of the world, whatever the hand-set price says.
assert.equal(internationalPriceFor({ tierPrices: { overseas: 500000 }, linePrice: 359000, region: 'asia' }), 500000,
  'the Asia price is capped at the world price');

// --- 3. The calculator prices from the destination ----------------------------------------------------
const calculator = read('pages', 'ExportShippingCalculatorPage.jsx');
// HELD AS THE RULE, NOT AS THE SPELLING. This was pinned to the exact text
// `isAsiaCountry(countryCode) ? 'asia' : 'world'` and it failed the day that line became a call to
// shippingRegionForCountry — the shared split the storefront grew on 2026-10-05 when the price started
// following the destination the buyer picks. Collapsing two copies of a price rule into one is the fix,
// not the regression, and a guard that fails it is crying wolf. The message above already says what it
// means, so RUN the page's own expression and check the destination is what decides.
{
  const regionLine = (calculator.match(/const priceRegion = ([^;]+);/) || [])[1];
  assert.ok(regionLine, 'the calculator no longer decides a price region at all');
  const decide = new Function('countryCode', 'isAsiaCountry', 'shippingRegionForCountry',
    `return (${regionLine});`);
  const at = (code) => decide(code, isAsiaCountry, shippingRegionForCountry);
  assert.equal(at('MY'), 'asia', 'a parcel to Malaysia must be written at the neighbours\' price');
  assert.equal(at('VN'), 'asia', 'and so must Vietnam, the destination this defect was found on');
  assert.equal(at('DE'), 'world', 'while Europe pays the hand-set world price');
  assert.equal(at('JP'), 'world', 'Japan is zone 3 — a rich market, not a neighbour');
  assert.equal(at(''), 'world', 'and an unknown destination must never be quoted the cheaper of the two');
}
assert.match(calculator, /internationalPriceFor\(\{ tierPrices: forLine, linePrice: retailPrice, region: priceRegion \}\)/,
  'and each line must be priced with it');
assert.match(calculator, /\[rows, products, tierPrices\.index, priceRegion\]/,
  'changing the destination must reprice the lines — a stale memo quotes the previous country');

console.log('exportZonePrice selfcheck OK (a neighbour is a neighbour on both screens, and the order is written at the price they were shown)');
