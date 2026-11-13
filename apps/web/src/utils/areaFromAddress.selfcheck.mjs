// `node src/utils/areaFromAddress.selfcheck.mjs`
//
// The checkout chose the delivery area from the WHOLE address and took the first hit (visitor audit,
// 13 Nov 2026). Measured on production's own destination search the same day:
//
//   "Jl. Ir. H. Juanda 100, Coblong, Bandung"  → 1st: PAL SERATUS/100, BERMANI ULU RAYA, REJANG LEBONG, BENGKULU
//   "Coblong, Bandung"                         → 1st: CIPAGANTI, COBLONG, BANDUNG, JAWA BARAT, 40131
//   "Kebayoran Baru, Jakarta Selatan"          → 1st: KEBAYORAN LAMA SELATAN, KEBAYORAN LAMA, … (wrong district)
//
// The labels below are those real answers. The rules are RUN on them, then their wiring is read.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  areaQueryFromAddress, courierAreaSpelling, destinationSearchText, isConfidentAreaMatch, pickConfidentDestination, rankDestinations,
  resultsNameTheArea,
} from './areaFromAddress.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// --- 1. The area part of an address ------------------------------------------------------------------
for (const [address, area] of [
  ['Jl. Ir. H. Juanda 100, Coblong, Bandung', 'Coblong, Bandung'],
  ['Jl. Kaliurang Km 5, Sleman, Yogyakarta', 'Sleman, Yogyakarta'],
  ['Kebayoran Baru, Jakarta Selatan', 'Kebayoran Baru, Jakarta Selatan'],
  ['Jl Juanda 100 Coblong Bandung', 'Coblong Bandung'],
  ['Perum Griya Asri Blok C2 No 5, RT 03/RW 04, Kel. Sukamaju, Kec. Cilodong, Kota Depok 16415', 'Cilodong, Depok'],
  ['Jalan Melati No. 3\nKecamatan Denpasar Selatan\nDenpasar, Bali 80222', 'Denpasar Selatan, Denpasar'],
]) assert.equal(areaQueryFromAddress(address), area, `area of ${JSON.stringify(address)}`);
assert.doesNotMatch(areaQueryFromAddress('Jl. Ir. H. Juanda 100, Coblong, Bandung'), /\d|Jl/, 'never the street or the house number');
assert.equal(destinationSearchText({ areaText: 'Coblong', address: 'Jl. X 1, Dago, Bandung' }), 'Coblong', 'an area the buyer typed wins');
assert.equal(destinationSearchText({ areaText: '', address: 'Jl. X 1, Coblong, Bandung' }), 'Coblong, Bandung');

// --- 2. When a result may be taken without asking --------------------------------------------------------
const bandung = [
  { label: 'PAL SERATUS/100, BERMANI ULU RAYA, REJANG LEBONG, BENGKULU, 39152' },
  { label: 'CIPAGANTI, COBLONG, BANDUNG, JAWA BARAT, 40131' },
  { label: 'DAGO, COBLONG, BANDUNG, JAWA BARAT, 40135' },
];
assert.equal(pickConfidentDestination('Coblong, Bandung', bandung).label, bandung[1].label, 'Bandung is never Bengkulu');
assert.equal(pickConfidentDestination('Coblong, Bandung', bandung, 'Jl. Dago 5, Coblong, Bandung').label, bandung[2].label,
  'the kelurahan the address names wins, so the postcode is right too');
const kebayoran = [
  { label: 'KEBAYORAN LAMA SELATAN, KEBAYORAN LAMA, JAKARTA SELATAN, DKI JAKARTA, 12240' },
  { label: 'CIPETE UTARA, KEBAYORAN BARU, JAKARTA SELATAN, DKI JAKARTA, 12150' },
];
assert.equal(pickConfidentDestination('Kebayoran Baru, Jakarta Selatan', kebayoran).label, kebayoran[1].label,
  'Kebayoran Baru is not Kebayoran Lama');
assert.equal(pickConfidentDestination('Denpasar', [{ label: 'PANJER, DENPASAR SELATAN, DENPASAR, BALI, 80225' }]), null,
  'a city alone matches every district in it: the buyer picks');
assert.equal(pickConfidentDestination('Coblong, Bandung', [bandung[0]]), null, 'no confident match: the buyer picks');
assert.equal(isConfidentAreaMatch('Sleman, Yogyakarta', 'TRIDADI, SLEMAN, SLEMAN, DI YOGYAKARTA, 55511'), true);

// --- 3. Both pages use it, and neither searches with the whole address or takes destinations[0] -----------
const flow = read('hooks', 'useCheckoutFlow.js');
const bespoke = read('pages', 'BespokePage.jsx');
for (const [name, source] of [['useCheckoutFlow.js', flow], ['BespokePage.jsx', bespoke]]) {
  assert.match(source, /pickConfidentDestination\(search, destinations, /, `${name} picks only a confident area`);
  assert.doesNotMatch(source, /loadShippingRates\(destinations\[0\]/, `${name} must not take the first result blindly`);
  assert.match(source, /areaQueryFromAddress\((form\.)?deliveryAddress\)/, `${name} searches with the area part of the address`);
}
assert.doesNotMatch(read('pages', 'CheckoutPage.jsx'), /destinationSearch\.trim\(\) \|\| deliveryAddress\.trim\(\)|searchText: destinationSearch \|\| deliveryAddress/,
  'the checkout page no longer hands the whole address to the search');
// A pick made from the address is dropped when the address names another area.
assert.match(flow, /areaGuessedFromRef\.current && areaQueryFromAddress\(value\) !== areaGuessedFromRef\.current/,
  'changing the address drops an area that was read from the old one');

// --- 4. The courier's spelling, and what the buyer typed first (fourth audit, 13 Nov 2026) ----------------
// Results copied from the live search that day.
const L = (label, id = label) => ({ id, label });
assert.equal(courierAreaSpelling('Gedongtengen, Jogja'), 'Gedong Tengen, Yogyakarta');
assert.equal(courierAreaSpelling('Tebet, Jaksel'), 'Tebet, Jakarta Selatan');
assert.equal(courierAreaSpelling('Coblong, Bandung'), 'Coblong, Bandung', 'an ordinary name is left alone');
const kuta = [
  L('KUTA ALAM, KUTA ALAM, BANDA ACEH, NANGGROE ACEH DARUSSALAM (NAD), 23121'),
  L('KULU KUTA, KUTA BLANG, BIREUEN, NANGGROE ACEH DARUSSALAM (NAD), 24356'),
  L('KUTA, KUTA, BADUNG, BALI, 80361'),
  L('KUTA BULUH, KUTA BULUH, KARO, SUMATERA UTARA, 22155'),
];
assert.equal(rankDestinations('Kuta', kuta)[0].label, 'KUTA, KUTA, BADUNG, BALI, 80361', '"Kuta" puts Kuta, Badung first');
assert.equal(rankDestinations('Kuta', kuta).length, kuta.length, 'nothing is dropped');
const kebayoranResults = [
  L('KEBAYORAN LAMA SELATAN, KEBAYORAN LAMA, JAKARTA SELATAN, DKI JAKARTA, 12240'),
  L('KEBAYORAN LAMA UTARA, KEBAYORAN LAMA, JAKARTA SELATAN, DKI JAKARTA, 12240'),
  L('CIPETE UTARA, KEBAYORAN BARU, JAKARTA SELATAN, DKI JAKARTA, 12150'),
];
assert.match(rankDestinations('Kebayoran Baru, Jakarta Selatan', kebayoranResults)[0].label, /, KEBAYORAN BARU,/, 'Kebayoran Baru before Kebayoran Lama');
const yogya = [L('BENER, TEGALREJO, YOGYAKARTA, DI YOGYAKARTA, 55243'), L('BUMIJO, JETIS, YOGYAKARTA, DI YOGYAKARTA, 55231')];
assert.equal(resultsNameTheArea('Gedong Tengen, Yogyakarta', yogya), false, 'a list that never names the kecamatan asks again');
assert.equal(resultsNameTheArea('Kuta', kuta), true);
assert.equal(pickConfidentDestination('Gedongtengen, Yogyakarta', [L('SOSROMENDURAN, GEDONG TENGEN, YOGYAKARTA, DI YOGYAKARTA, 55271')])?.label,
  'SOSROMENDURAN, GEDONG TENGEN, YOGYAKARTA, DI YOGYAKARTA, 55271', 'the written-together spelling is still a confident match');
const service = read('services', 'shippingService.js');
assert.match(service, /const search = courierAreaSpelling\(/, 'the search goes out in the courier\'s spelling');
assert.match(service, /return rankDestinations\(search, combined\);/, 'and comes back ranked');
assert.doesNotMatch(read('pages', 'CheckoutPage.jsx'), /destinationOptions\.slice\(0, 4\)/, 'the checkout shows every result, not the first four');
assert.match(read('..', 'api', 'shipping', 'rates.js'), /rajaResponse\.status === 404 && \/not found\/i[\s\S]{0,120}destinations: \[\]/, 'no match is an empty list, not a 404');

console.log('areaFromAddress selfcheck OK (the area comes from the kecamatan and city, and is picked only when it matches)');
