// `node src/utils/exportQuote.selfcheck.mjs`
//
// This text gets pasted into a message to a real buyer, so every number and every omission in it is a
// statement Dekito made. Two of them are promises he must not accidentally make: that the price covers
// the destination country's import duty (it does not — the recipient pays it on arrival), and that
// asking holds a bottle (it does not).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildExportQuote } from './exportQuote.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const money = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(Number(value) || 0))}`;
const shipping = { total: 909000, chargeableKg: 2 };
const line = (over) => ({ name: 'Sunda', size: '30 ml', quantity: 2, unitPrice: 650000, overseasPriceSet: over });

// --- the arithmetic ---------------------------------------------------------------------------------
const quote = buildExportQuote({ destinationName: 'Malaysia', lines: [line(true)], shipping, formatMoney: money });
assert.equal(quote.bottles, 2);
assert.equal(quote.subtotal, 1300000);
assert.equal(quote.shippingTotal, 909000);
assert.equal(quote.total, 2209000, 'the total must be the subtotal plus shipping, nothing else');
assert.match(quote.message, /2 × Sunda 30 ml — Rp 650\.000 = Rp 1\.300\.000/);
assert.match(quote.message, /Total: Rp 2\.209\.000/);
assert.match(quote.message, /Malaysia/);

// --- the two promises, in every quote ---------------------------------------------------------------
for (const [label, built] of [
  ['served country', quote],
  ['unserved country', buildExportQuote({ destinationName: 'Nowhere', lines: [line(true)], shipping: null, formatMoney: money })],
  ['domestic price', buildExportQuote({ destinationName: 'Malaysia', lines: [line(false)], shipping, formatMoney: money })],
]) {
  assert.match(built.message, /ditagih ke penerima saat barang tiba/, `${label}: the duty line must be there`);
  assert.match(built.message, /belum memesan stok/, `${label}: the quote must not read as a reservation`);
}

// --- no shipping rate is said out loud, never implied as free ---------------------------------------
const unserved = buildExportQuote({ destinationName: 'Nowhere', lines: [line(true)], shipping: null, formatMoney: money });
assert.equal(unserved.shippingTotal, 0);
assert.match(unserved.message, /belum ada di daftar tujuan kurir/,
  'a country with no rate must say so — a quote reading "Ongkir: Rp 0" would promise free shipping');
assert.doesNotMatch(unserved.message, /Ongkir \(LTU Express/);

// --- lines still at the domestic price are named, not swallowed --------------------------------------
const mixed = buildExportQuote({
  destinationName: 'Malaysia',
  lines: [line(true), { name: 'Pantura', size: '10 ml', quantity: 1, unitPrice: 129000, overseasPriceSet: false }],
  shipping, formatMoney: money,
});
assert.deepEqual(mixed.withoutOverseasPrice, ['Pantura'],
  'quoting an overseas buyer the Indonesian price is what the overseas tier exists to prevent');
assert.deepEqual(buildExportQuote({ lines: [line(true)], shipping, formatMoney: money }).withoutOverseasPrice, []);

// --- empty and junk input ---------------------------------------------------------------------------
// An empty message is what lets the page disable the copy button; a blank quote sent to a buyer is worse
// than no reply.
assert.equal(buildExportQuote({ formatMoney: money }).message, '');
assert.equal(buildExportQuote({ lines: [{ name: 'Sunda', quantity: 0, unitPrice: 650000 }], formatMoney: money }).message, '',
  'a line with no quantity is not an order line');
assert.equal(buildExportQuote({ lines: [{ name: '', quantity: 3, unitPrice: 1 }], formatMoney: money }).message, '',
  'a row with no product chosen must not reach the message');
const junk = buildExportQuote({ lines: [{ name: 'Sunda', quantity: '2', unitPrice: undefined }], shipping, formatMoney: money });
assert.equal(junk.subtotal, 0, 'a missing price counts as zero, it must not become NaN in the message');
assert.doesNotMatch(junk.message, /NaN/);

// --- the page asks for the overseas price, not the viewer's own tier ---------------------------------
const page = readFileSync(join(src, 'pages', 'ExportShippingCalculatorPage.jsx'), 'utf8');
assert.match(page, /resolveTierPrice\(\{ retailPrice, tierPrices: forLine, overseas: true \}\)/,
  'the quote must use the overseas price; the admin viewing this page is a member, and member pricing '
  + 'is Indonesia-only');
assert.match(page, /20260913090000_customer_tiers_and_tier_prices\.sql/,
  'Studio must name the migration when the tier table is missing, or every quote silently goes out at '
  + 'the domestic price');
assert.match(page, /disabled=\{!summary\.message\}/, 'the copy button must be dead until there is something to copy');
assert.doesNotMatch(page, /useStorefrontProducts/,
  'this page prices in overseas terms itself — a tier-priced catalog here would apply member prices too');

console.log('exportQuote selfcheck OK (duty and stock are never promised; a missing rate says so)');
