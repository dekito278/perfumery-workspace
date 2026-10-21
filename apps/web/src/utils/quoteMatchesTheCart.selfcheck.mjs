// `node src/utils/quoteMatchesTheCart.selfcheck.mjs`
//
// "Total quote = total keranjang untuk input yang sama" — Dekito's brief, §5, and the reason the brief
// was written: a figure sent by hand on WhatsApp that disagrees with the website is the same
// bait-and-switch the export tier exists to prevent, arriving by another door.
//
// The protection is not that the two are compared somewhere. It is that there is only ONE of each
// calculation, and both callers reach for it: quoteInternationalShippingPrice for the freight,
// usdPriceFor for the dollars, giftVialsFor for the gift. This guard runs both paths over the same input
// and asserts the totals are equal, which is the only form of that promise a machine can keep.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildExportQuote } from './exportQuote.js';
import { usdPriceFor } from './usdPrice.js';
import { GIFT_VIAL_SIZE_ML, giftVialLine, giftVialsFor } from './internationalGiftVials.js';

const src = dirname(fileURLToPath(import.meta.url));

// --- 1. The bands ------------------------------------------------------------------------------------
assert.equal(giftVialsFor(0), 0, 'an empty order ships no gift');
assert.equal(giftVialsFor(1), 3);
assert.equal(giftVialsFor(2), 5);
assert.equal(giftVialsFor(3), 8);
assert.equal(giftVialsFor(6), 8, 'the last band has no ceiling');
assert.equal(giftVialsFor(2.7), 5, 'a fractional bottle count is floored, never rounded up into a band');
assert.equal(giftVialsFor(-3), 0, 'and a negative one is not a gift');
assert.equal(giftVialsFor('x'), 0);
assert.equal(GIFT_VIAL_SIZE_ML, 3, "Dekito's size, 2026-10-21 — the domestic gift vial is a different product at 2 ml");

// --- 2. The quote and the cart agree, on production prices -------------------------------------------
// The overseas tier prices as they stand in the live table, 2026-10-21: tier A 1.260.000, tier B
// 1.510.000. usdPriceFor turns those into US$80 and US$95, which is what the product pages show.
const TIER_A_IDR = 1260000;
const TIER_B_IDR = 1510000;
assert.equal(usdPriceFor(TIER_A_IDR), 80, 'tier A is the US$80 the site shows');
assert.equal(usdPriceFor(TIER_B_IDR), 95, 'tier B is US$95');

const lines = [
  { name: 'Jason Voorhees', size: '30 ml', quantity: 1, unitPrice: TIER_A_IDR, overseasPriceSet: true },
  { name: '.Wayback', size: '30 ml', quantity: 1, unitPrice: TIER_B_IDR, overseasPriceSet: true },
];
// What the cart would charge for the same basket: per bottle, converted per bottle, then summed — the
// order the storefront uses, because the rounding is per bottle. Summing rupiah first and converting
// once gives a different answer, and that difference is exactly the five dollars this guard is about.
const cartGoodsUsd = lines.reduce((sum, line) => sum + usdPriceFor(line.unitPrice) * line.quantity, 0);
const SHIPPING_USD = 40;

const quote = buildExportQuote({
  destinationName: 'the United States',
  lines,
  shipping: { total: SHIPPING_USD * 16500, label: '' },
  toUsd: usdPriceFor,
  giftVialLine,
});
assert.equal(quote.goodsUsd, cartGoodsUsd, 'the quote prices the goods exactly as the cart does');
assert.equal(quote.goodsUsd, 175, 'US$80 + US$95');
assert.equal(quote.totalUsd, quote.goodsUsd + quote.shippingUsd, 'and the total is the sum of its parts');
assert.equal(quote.bottles, 2, 'two bottles');

// --- 3. The gift is in the message, as a count and a size --------------------------------------------
// Loose on purpose: an exact-line match would fail for ANY edit, so a price appended to the line would
// be reported as a wrong vial count. The count is checked here and the price by the assertion below.
assert.match(quote.message, /Gift vials: 5 × 3 ml/,
  'two bottles ship with five vials, and the message says so');
assert.match(quote.message, /\(free\)/, 'and says the gift is free in those words');
assert.doesNotMatch(quote.message, /Gift vials[^\n]*US\$/,
  'the gift carries no price in the quote — a free line with a number beside it reads as a charge');
assert.ok(quote.message.indexOf('Gift vials') < quote.message.indexOf('Total:'),
  'and it is named before the total, so nobody reads it as something they are paying for');
// Never a list of scent names: the atelier picks them at packing, weeks after this message is sent.
assert.doesNotMatch(quote.message, /Gift vials[^\n]*(Wayback|Tulipe|Maskumambang)/,
  'the quote must not name which scents ship — that is a promise about stock nobody can keep yet');

// --- 4. No tracking promise, in any form -------------------------------------------------------------
// The brief's own draft ended with "send you the tracking number". Dekito had it removed: this shop does
// not record waybills (10 Oct 2026). Asserted on the MESSAGE rather than on the source, so a sentence
// arriving from any of the three inputs is caught too.
for (const forbidden of [/tracking/i, /waybill/i, /nomor resi/i, /AWB/]) {
  assert.doesNotMatch(quote.message, forbidden,
    `the quote must not promise tracking (${forbidden}) — this shop does not record waybills`);
}

// --- 5. What Dekito needs back -----------------------------------------------------------------------
assert.match(quote.message, /full shipping address, email, and phone number/,
  'the quote asks for what he cannot pack without');
assert.match(quote.message, /Import duties and taxes/, 'and keeps the two promises it must not make');
assert.match(quote.message, /does not reserve stock/);

// --- 6. One shipping rule, not two -------------------------------------------------------------------
// The Studio tool and the storefront cart must both read quoteInternationalShippingPrice. A second
// implementation anywhere is the defect this brief describes, so the shape is asserted on both callers.
// Read, not tolerated: the first version pointed at utils/useInternationalQuote.js, which does not
// exist — the hook lives in hooks/ — and a try/catch let that assertion skip in silence. A guard that
// shrugs when its subject is missing is a guard that proves nothing.
for (const [file, label] of [
  [join(src, '..', 'pages', 'ExportShippingCalculatorPage.jsx'), 'the Studio quote tool'],
  [join(src, '..', 'hooks', 'useInternationalQuote.js'), 'the storefront cart'],
]) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /quoteInternationalShippingPrice/,
    `${label} must read the one shipping rule, not a table or a figure of its own`);
}
const tool = readFileSync(join(src, '..', 'pages', 'ExportShippingCalculatorPage.jsx'), 'utf8');
assert.match(tool, /giftVialLine/, 'and the tool takes the gift count from the shared band rule');

console.log('quoteMatchesTheCart: ok (quote goods US$175 = cart US$175 on the same basket, five vials on '
  + 'two bottles, no price on the gift and no tracking promised)');
