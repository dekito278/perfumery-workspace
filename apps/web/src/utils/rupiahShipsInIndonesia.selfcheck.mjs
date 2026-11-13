// `node src/utils/rupiahShipsInIndonesia.selfcheck.mjs`
//
// Dekito's brief, 14 Nov 2026 (P0-2): rupiah prices are for delivery inside Indonesia. The order server had
// one gap: a bespoke brief with no bottles could be created with NO shipping at all — fee 0 and any address
// typed, a parcel abroad at the domestic price — straight through the unauthenticated endpoint. Bottles
// already needed a destination; a brief did not.
//
// The rule: every rupiah order names a domestic courier destination, which the server prices again through
// the domestic rate API; an order abroad is the international branch, priced in dollars, with no voucher and
// no member price. The checkout tells a buyer whose address ends in another country where their order goes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { addressLooksAbroad, countryAddressEndsIn } from './addressAbroad.js';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const endpoint = stripComments(readFileSync(join(root, '..', 'api', 'orders', 'create.js'), 'utf8'));

// --- 1. The server: no rupiah order without a domestic destination ---------------------------------------
assert.match(endpoint, /if \(!ship\.destinationId\) \{\s*return jsonResponse\(res, 422, \{[\s\S]{0,260}reason: 'domestic_destination_required'/,
  'a rupiah order can be created without a domestic courier destination again');
assert.doesNotMatch(endpoint, /catalog\.resolved\.length && !ship\.destinationId/,
  'the destination is required only when bottles are in the parcel — a bespoke brief slips through');
// The fee is the domestic rate API's, for that destination — not a number the caller sent.
assert.match(endpoint, /const \{ fee: shippingFee, summary: shippingSummary \} = await computeShippingFee\(baseUrl, \{\s*destinationId: input\.shipping\?\.destinationId,/);

// --- 2. The international branch: dollars, no voucher, no member price -------------------------------------
const intlStart = endpoint.indexOf('const createInternationalOrder = async');
assert.ok(intlStart > -1, 'the international branch is gone — the scan is broken');
const intl = endpoint.slice(intlStart, endpoint.indexOf('\n};\n', intlStart));
assert.match(intl, /if \(input\.voucherCode \|\| input\.bespoke \|\| input\.shipping\) \{/, 'an international order accepts a voucher or domestic shipping');
assert.match(intl, /p_customer_code: null,/, 'an international order files under a member code');
assert.doesNotMatch(intl, /resolveBuyerTier|memberPercent|storefront_member_status|keepsMemberPrice/,
  'an international order reads the buyer\'s member status — member codes do not apply abroad');

// --- 3. The hint: reads the end of the address, not the street ---------------------------------------------
for (const [address, abroad] of [
  ['123 Orchard Rd, Singapore 238858', true],
  ['Hauptstr. 5, 10115 Berlin, Germany', true],
  ['5th Ave, New York, NY 10001, USA', true],
  ['10 Downing St\nLondon SW1A 2AA\nUnited Kingdom', true],
  ['Kuala Lumpur, Malaysia', true],
  ['Tokyo, Jepang', true],
  ['Jl. Singapura No 5, Medan', false],
  ['Jl. Belanda 3, Jakarta Selatan', false],
  ['Jalan Jepang 2, Surabaya, Indonesia', false],
  ['Jl. Dago No. 10, Coblong, Bandung, Jawa Barat 40135', false],
  ['Jl. Kupang, Timor Tengah Selatan, NTT', false],
  ['Jl. Merdeka, Papua', false],
  ['', false],
]) {
  assert.equal(addressLooksAbroad(address), abroad, `${JSON.stringify(address)} → ${countryAddressEndsIn(address) || 'Indonesia'}`);
}

// --- 4. Both rupiah forms show it, with the way to the international shop ---------------------------------
const checkout = readFileSync(join(root, 'pages', 'CheckoutPage.jsx'), 'utf8');
assert.match(checkout, /\{addressLooksAbroad\(deliveryAddress\) \? \([\s\S]{0,200}t\('checkout\.abroadHint'\)[\s\S]{0,80}href="\/en\/cart"/);
const bespoke = readFileSync(join(root, 'pages', 'BespokePage.jsx'), 'utf8');
assert.match(bespoke, /\{addressLooksAbroad\(form\.deliveryAddress\) \? \([\s\S]{0,200}t\('checkout\.abroadHint'\)[\s\S]{0,40}href="\/en\/bespoke"/);
assert.equal(MESSAGES.id['checkout.abroadHint'], 'Untuk pengiriman ke luar negeri, harga mengikuti katalog internasional.');

console.log('rupiahShipsInIndonesia selfcheck OK (every rupiah order names a domestic destination; abroad is dollars, no voucher, no member price)');
