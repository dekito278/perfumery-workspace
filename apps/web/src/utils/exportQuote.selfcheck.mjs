// `node src/utils/exportQuote.selfcheck.mjs`
//
// The quote Dekito copies out of the Studio and sends to an overseas buyer — the only message that
// crosses from his side of the shop to theirs.
//
// It was written in Indonesian rupiah until 2026-10-06, and this chain asserted exactly that: it matched
// "Subtotal produk", "Ongkir", "Rp 2.209.000". The storefront learned English in September and moved its
// international prices to the dollar on 24 Sep, and nothing looked at the one piece of copy pointed at a
// foreign customer. A buyer who wrote in English, reading US$80 on the product page, was answered with a
// rupiah figure in a language they do not read.
//
// So the rule is now about WHO READS IT: English, dollars, and the same rounding the page they came from
// used — a hand-sent figure that disagrees with the website by five dollars is the bait-and-switch this
// whole feature exists to prevent, arriving by WhatsApp instead.
import assert from 'node:assert/strict';
import { buildExportQuote } from './exportQuote.js';
import { usdPriceFor } from './usdPrice.js';

const money = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
// La Tulipe's class, measured in production: retail Rp 359.000, export Rp 1.260.000 -> US$80.
const line = (overseasPriceSet = true, unitPrice = 1260000) => ({
  name: 'Jason Voorhees', size: '30 ml', quantity: 2, unitPrice, overseasPriceSet,
});
const shipping = { total: 1072500, label: 'confirmed below' };
const quote = buildExportQuote({
  destinationName: 'Germany', lines: [line()], shipping, toUsd: usdPriceFor, formatMoney: money,
});

// --- 1. The figures the Studio screen keeps, in rupiah ------------------------------------------------
assert.equal(quote.bottles, 2);
assert.equal(quote.subtotal, 2520000);
assert.equal(quote.shippingTotal, 1072500);
assert.equal(quote.total, 3592500, 'the rupiah total must be the subtotal plus shipping, nothing else');

// --- 2. The message the BUYER reads: English, dollars, and the storefront's own arithmetic -------------
assert.match(quote.message, /2 × Jason Voorhees 30 ml — US\$80 = US\$160/,
  'each line is priced per bottle in dollars, the way the product page prices it');
assert.match(quote.message, /Perfume: US\$160/);
assert.match(quote.message, /Shipping: US\$65/, 'the typed rupiah figure is converted with the same rounding');
assert.match(quote.message, /Total: US\$225/);
assert.match(quote.message, /Germany/);
// THE ROUNDING IS PER BOTTLE. Summing the rupiah first and converting once gives a different answer, and
// the buyer would be quoted a total the product page never showed them.
assert.equal(quote.goodsUsd, usdPriceFor(1260000) * 2, 'the goods total is the per-bottle dollar times the count');
assert.notEqual(quote.goodsUsd, usdPriceFor(2520000), 'converting the summed rupiah is a different number — that is the bug this prevents');
assert.equal(quote.totalUsd, quote.goodsUsd + quote.shippingUsd);

// No rupiah, and no Indonesian, in anything the buyer reads. Held as a sweep over the whole message
// rather than on the phrases that happened to be there: the next sentence someone adds has to be caught.
assert.doesNotMatch(quote.message, /\bRp\b/, 'the buyer pays in dollars; rupiah in this message is a number they cannot act on');
for (const indonesian of [/Subtotal produk/, /Ongkir/, /\bbelum\b/, /\bditagih\b/, /\bperkiraan\b/i, /\bdikutip\b/]) {
  assert.doesNotMatch(quote.message, indonesian, `the quote still speaks Indonesian to a foreign buyer: ${indonesian}`);
}

// --- 3. The two promises it must not make ------------------------------------------------------------
for (const [label, built] of [
  ['with shipping', quote],
  ['without', buildExportQuote({ destinationName: 'Germany', lines: [line()], toUsd: usdPriceFor, formatMoney: money })],
]) {
  assert.match(built.message, /charged to the recipient on arrival/, `${label}: the duty line must be there`);
  assert.match(built.message, /does not reserve stock/, `${label}: the quote must not read as a reservation`);
  assert.doesNotMatch(built.message, /shipping is included|free shipping|included in the price/i,
    `${label}: nothing may say the freight is in the price — that promise was retired on 2026-09-25`);
}

// --- 4. Where there is no figure yet, it says so rather than printing a zero --------------------------
const later = buildExportQuote({
  destinationName: 'Iceland', lines: [line()], toUsd: usdPriceFor, formatMoney: money,
  shipping: { total: 0, label: 'to be confirmed — we will send it shortly' },
});
assert.equal(later.shippingUsd, 0);
assert.match(later.message, /Shipping: to be confirmed/, 'a shipping figure still to come is said, not printed as zero');
assert.doesNotMatch(later.message, /Shipping: US\$0/, '"US$0" reads as free on a parcel that is not free');
assert.equal(later.totalUsd, later.goodsUsd, 'and the total is the goods alone until the freight is known');
const unserved = buildExportQuote({ destinationName: 'Nauru', lines: [line()], toUsd: usdPriceFor, formatMoney: money });
assert.match(unserved.message, /confirming the rate to your country/, 'no shipping object at all still gets an honest sentence');
assert.doesNotMatch(unserved.message, /Ongkir \(LTU Express/, 'and never names a carrier the shop does not use');

// --- 5. The arrival estimate, when the destination has one --------------------------------------------
// The website promises one the moment a country is picked; a hand-sent quote that omits it leaves the
// buyer with less than the page gave them.
const withEta = buildExportQuote({
  destinationName: 'Germany', lines: [line()], shipping, toUsd: usdPriceFor, formatMoney: money,
  eta: '5–10 working days after dispatch',
});
assert.match(withEta.message, /Estimated delivery: 5–10 working days after dispatch/);
assert.doesNotMatch(quote.message, /Estimated delivery/, 'and it is left out entirely when there is none to give');

// --- 6. A line still on the domestic price is named, never swallowed ----------------------------------
const mixed = buildExportQuote({
  destinationName: 'Germany', toUsd: usdPriceFor, formatMoney: money, shipping,
  lines: [line(true), { name: 'Pantura', size: '30 ml', quantity: 1, unitPrice: 429000, overseasPriceSet: false }],
});
assert.deepEqual(mixed.withoutOverseasPrice, ['Pantura'],
  'quoting an overseas buyer the Indonesian price is the whole thing the overseas tier exists to prevent');
assert.deepEqual(buildExportQuote({ lines: [line(true)], shipping, toUsd: usdPriceFor, formatMoney: money }).withoutOverseasPrice, []);

// --- 7. Nothing to quote, nothing to send -------------------------------------------------------------
assert.equal(buildExportQuote({ formatMoney: money }).message, '');
assert.equal(buildExportQuote({ lines: [{ name: 'Sunda', quantity: 0, unitPrice: 650000 }], toUsd: usdPriceFor, formatMoney: money }).message, '',
  'a row with no quantity is not a line');
assert.equal(buildExportQuote({ lines: [{ name: '', quantity: 3, unitPrice: 1 }], toUsd: usdPriceFor, formatMoney: money }).message, '',
  'nor is a row with no product');
const junk = buildExportQuote({ destinationName: 'Germany', lines: [{ name: 'Sunda', quantity: 2 }], toUsd: usdPriceFor, shipping, formatMoney: money });
assert.equal(junk.subtotal, 0, 'a missing price counts as zero, it must not become NaN in the message');
assert.doesNotMatch(junk.message, /NaN/);

// --- 8. The page passes the real converter, not a stand-in -------------------------------------------
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'pages', 'ExportShippingCalculatorPage.jsx'), 'utf8');
assert.match(page, /toUsd: usdPriceFor/, 'the Studio must hand the quote the app\'s own dollar rounding');
assert.match(page, /eta: priceCard\?\.transitDays/, 'and the arrival estimate it already shows on screen');
// The LABEL travels into the buyer's message, so it is their language too — and it is declared on its own
// line, not inline in the object, which is how a first version of this check missed a sabotage that put
// "dikutip menyusul" straight back. Read the declaration and sweep its words.
{
  const declaration = (page.match(/const shippingLabel = [^\n]*/) || [''])[0];
  assert.ok(declaration, 'the page no longer names where the shipping figure came from');
  assert.doesNotMatch(declaration, /\b(dikutip|menyusul|belum|nanti|ongkir|akan|kami|kirim|tangan)\b/i,
    `the shipping label reaches a foreign buyer verbatim and may not be Indonesian: ${declaration.trim()}`);
}

console.log('exportQuote selfcheck OK (the one message that reaches a foreign buyer is English, in dollars, rounded the way the page they came from rounds)');
