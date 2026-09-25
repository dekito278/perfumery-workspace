// `node src/utils/asiaPrice.selfcheck.mjs`
//
// One export price for the whole world was always going to be wrong at one end. It was set in USD —
// US$62 reads modestly in New York, and it does — and then shown to the neighbours, where the same
// number is RM 290 for 30 ml from a house nobody there has heard of.
//
// So Southeast Asia pays 2.2x retail and everywhere else keeps the 3.5x Dekito set by hand. The Asia
// price is COMPUTED, never stored: eighteen rows kept in step by hand is eighteen rows that drift.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// Comments go first, every time. The first version of the copy check below failed on the COMMENT that
// explains why the old promise was removed — the sentence it forbids, quoted in the file that removed
// it. That trap has caught this repo more than once.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const readRaw = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');
const read = (...parts) => stripComments(readRaw(...parts));

const stubs = `
const EXPORT_ZONE_BY_COUNTRY = { MY: 2, SG: 1, HK: 2, US: 5, JP: 3, DE: 7, ID: 0 };
const overseasPriceFromRetail = (retail, factor) => {
  const r = Number(retail) || 0;
  if (!r || !Number.isFinite(factor) || factor <= 1 || factor > 10) return null;
  return Math.ceil((r * factor) / 10000) * 10000;
};
`;
const runnable = stubs + readRaw('utils', 'shippingRegion.js')
  .split('\n').filter((line) => !line.startsWith('import ')).join('\n');
const {
  ASIA_MULTIPLIER, internationalPriceFor, shippingRegionForTimeZone, isAsiaCountry,
  readShippingRegionFromUrl,
} = await import(`data:text/javascript;base64,${Buffer.from(runnable, 'utf8').toString('base64')}`);

// La Tulipe, measured on the live site: retail Rp 289.000, hand-set export Rp 1.020.000.
const LINE = 289000;
const tiers = { overseas: 1020000 };

// --- 1. Two prices, and the neighbours pay the lower one ----------------------------------------------
assert.equal(internationalPriceFor({ tierPrices: tiers, linePrice: LINE, region: 'world' }), 1020000,
  'the world price is the one Dekito set by hand and must not be recomputed');
assert.equal(internationalPriceFor({ tierPrices: tiers, linePrice: LINE, region: 'asia' }), 640000,
  '289.000 x 2.2 rounded up to the nearest 10.000');
assert.equal(ASIA_MULTIPLIER, 2.2);

// --- 2. The Asia price is never dearer than the world price -------------------------------------------
// A hand-set export price below 2.2x would otherwise make Kuala Lumpur pay more than New York, which is
// the exact inversion this split exists to remove.
assert.equal(internationalPriceFor({ tierPrices: { overseas: 500000 }, linePrice: LINE, region: 'asia' }), 500000,
  'the neighbours were quoted more than the rest of the world');

// --- 3. It is computed, so a product with no stored export price still has an Asia price ---------------
// That is the point of a formula: eighteen rows nobody has to remember to fill.
assert.equal(internationalPriceFor({ tierPrices: {}, linePrice: LINE, region: 'asia' }), 640000);
assert.equal(internationalPriceFor({ tierPrices: {}, linePrice: LINE, region: 'world' }), null,
  'and without a stored price there is nothing honest to show the rest of the world');
// A line with no price of its own gets no international price either, in either region — the same
// answer the old single-price helper gave. An "international price" for a bottle whose domestic price
// is unknown is a number with nothing behind it.
assert.equal(internationalPriceFor({ tierPrices: tiers, linePrice: 0, region: 'asia' }), null);
assert.equal(internationalPriceFor({ tierPrices: tiers, linePrice: 0, region: 'world' }), null);
assert.equal(internationalPriceFor(), null);

// --- 4. A clock is not an address, so the list is explicit --------------------------------------------
for (const zone of ['Asia/Kuala_Lumpur', 'Asia/Singapore', 'Asia/Bangkok', 'Asia/Manila', 'Asia/Hong_Kong', 'Asia/Dili']) {
  assert.equal(shippingRegionForTimeZone(zone), 'asia', `${zone} should be priced as a neighbour`);
}
// The ones a naive 'Asia/' prefix test would swallow. Each is a real market on the world price.
for (const zone of ['Asia/Tokyo', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Seoul']) {
  assert.equal(shippingRegionForTimeZone(zone), 'world', `${zone} is not Southeast Asia`);
}
assert.equal(shippingRegionForTimeZone('Asia/Jakarta'), 'world', 'home is not an export region at all');
assert.equal(shippingRegionForTimeZone('Europe/Berlin'), 'world');
assert.equal(shippingRegionForTimeZone(''), 'world', 'a browser that will not say gets the dearer price, never the cheaper');
assert.equal(shippingRegionForTimeZone(null), 'world');

// --- 5. Nothing anywhere may promise the freight is in the price ---------------------------------------
// It was promised from 19 to 25 September 2026, on RaySpeed's Rp 90.000 kilo to Malaysia, and the
// arithmetic only ever worked on a full parcel: the carrier bills a one-kilo MINIMUM, so ONE 30 ml
// bottle to Los Angeles costs Rp 670.500 to send out of a US$80 price, while FOUR cost the same
// Rp 670.500. Dekito found it on a live American order for a single bottle.
//
// So the rule is the absence of the old one: shippingIncludedFor is gone, and no surface may say the
// shipping is included. This is held on the exported names, not on a string in a comment, because a
// helper that lingers is a helper someone calls again.
const regionModule = read('utils', 'shippingRegion.js');
assert.doesNotMatch(regionModule, /export const shippingIncludedFor/,
  'shipping is charged on every destination now — a helper that answers "is it free here" invites the old rule back');
assert.doesNotMatch(regionModule, /^import .*rayspeedRates/m,
  'and the carrier network no longer decides anything about the PRICE a buyer is shown');

// --- 5b. A member discount does not travel -------------------------------------------------------------
// applyTierPrices lowers priceNumber to the member price for a signed-in member and keeps the original
// as retailPriceNumber. The international price is built on RETAIL: reading the lowered number
// multiplied a domestic loyalty discount into an export price, so the same bottle cost US$45 to a buyer
// who had logged in and US$50 to one who had not. Dekito's decision, 2026-09-24.
const exportHook = read('hooks', 'useOverseasPrice.js');
assert.match(exportHook, /variant\?\.retailPriceNumber/,
  'the international price must start from the retail price a member price replaced');
assert.match(exportHook, /product\?\.retailPriceNumber/,
  'and from the product-level retail price when there is no variant');
// Order matters, not just presence: `priceNumber ?? retailPriceNumber` reads the member price first and
// would keep the bug while satisfying both assertions above.
const lineExpression = (exportHook.match(/const linePrice = Number\(([\s\S]*?)\);/) || [])[1] || '';
assert.ok(lineExpression, 'the hook must compute one line price');
const firstRetail = lineExpression.search(/retailPriceNumber/);
const firstTierPrice = lineExpression.search(/(?<!retail)(?<!Retail)\bpriceNumber/);
assert.ok(firstRetail >= 0 && (firstTierPrice < 0 || firstRetail < firstTierPrice),
  `retail must be read before the tier-rewritten price: ${lineExpression.replace(/\s+/g, ' ')}`);

assert.equal(isAsiaCountry('MY'), true);
assert.equal(isAsiaCountry('SG'), true);
assert.equal(isAsiaCountry('JP'), false, 'Japan is zone 3 — a rich market on the world price');
assert.equal(isAsiaCountry('US'), false);

// --- 5b. The guess can be overridden, because Dekito cannot see it from Jakarta otherwise --------------
assert.equal(readShippingRegionFromUrl('?ship=asia'), 'asia');
assert.equal(readShippingRegionFromUrl('?ship=world'), 'world');
assert.equal(readShippingRegionFromUrl('?ship=cheap'), null, 'an invented value must not become a price');
assert.equal(readShippingRegionFromUrl('?lang=en'), null);
assert.equal(readShippingRegionFromUrl(''), null);

// --- 6. And nothing on the site still says the shipping is extra --------------------------------------
// The money statement flipped. A line left saying "belum termasuk ongkir" sends a buyer looking for a
// second bill that never arrives, and they do not come back to ask about it.
const messages = read('i18n', 'messages.js');
for (const line of messages.split('\n')) {
  if (!/'(export|intl)\.[a-zA-Z]+'|"(export|intl)\.[a-zA-Z]+"/.test(line)) continue;
  // The BUTTON labels are in here too, and they are the half that got missed the first time: the price
  // line said "ongkir sudah termasuk" while the button directly beneath it said "Tanya ongkir". Two
  // sentences on one screen, arguing — caught on the phone, by none of the checks above.
  assert.doesNotMatch(line, /ongkir sudah termasuk|shipping included|shipping is included|free shipping/i,
    `this line still promises the freight is in the price:\n  ${line.trim()}`);
}
// The headline price and the sentence under it must agree about which region they belong to: a
// Southeast Asia figure under "anywhere else we work the shipping out on WhatsApp" invites a question
// the reader does not need to ask.
const headline = read('components', 'storefront', 'InternationalPrice.jsx');
assert.match(headline, /shippingRegion === 'asia' \? 'intl\.priceNoteAsia' : 'intl\.priceNote'/,
  'the headline price shows one sentence for both regions');

const note = read('components', 'storefront', 'OverseasPriceNote.jsx');
assert.doesNotMatch(note, /[Ss]hipping is included/, 'the price panel still promises the freight is in the price');
assert.match(note, /shippingRegion === 'asia'/, 'the panel does not name which of the two prices it is showing');

console.log('asiaPrice selfcheck OK (the neighbours pay 2.2x, the rest of the world keeps the hand-set price, and no surface promises the freight is in it)');
