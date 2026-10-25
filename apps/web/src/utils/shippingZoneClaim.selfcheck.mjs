// A buyer may not pick their own shipping zone.
//
// The promotion pays by zone, and api/orders/create.js read that zone out of province and label strings
// in the REQUEST BODY while pricing the parcel from an id that arrived beside them. Nothing compared the
// two. Measured with the real promo function on a Papua parcel at Rp 85.000:
//
//   promo row absent (today)                   Rp 85.000
//   FREE_JAVA on, honest destination           Rp 85.000
//   FREE_JAVA on, provinceName forged to Jawa   Rp 0
//   FREE_JAVA on, only a Java word in the label Rp 0
//
// The parcel still went to Papua and the order was SAVED with a zero fee. Latent only because
// storefront_shipping_promotion_settings is empty — one save in Studio turns it on.
//
// The two halves this guard holds are in tension, which is the whole reason it is written down:
//   - a FORGED province must be refused
//   - an UNPROVEN one must not be, or deriving the zone from a search that missed would charge an honest
//     Java buyer the postage they were just shown as free. That is the more common failure by far.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyShippingPromotionToRates } from './shippingPromotion.js';
import {
  destinationSearchTerms, javaClaimIsContradicted, javaClaimNeedsProof, provinceForDestinationId,
} from './shippingZoneClaim.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// --- 1. The hole is real, proved by running the thing that pays out ----------------------------------
// Kept as a RUNNING assertion, not a note: if the payout ever stops depending on these strings, the
// check below is dead weight and this line says so by failing.
const PAPUA_RATE = { courierCode: 'jne', service: 'REG', cost: 85000, courierName: 'JNE', serviceLabel: 'REG' };
const FREE_JAVA = { enabled: true, preset: 'free_java', javaAmount: 10000, otherAmount: 10000, minimumSubtotal: 0, startsAt: '', endsAt: '' };
const feeFor = (destination, promo) => applyShippingPromotionToRates(
  [{ ...PAPUA_RATE }], destination, promo, { subtotal: 429000 },
)[0].cost;

const honest = { provinceName: 'Papua', cityName: 'Jayapura', label: 'Jayapura, Papua' };
const forgedProvince = { provinceName: 'Jawa Barat', cityName: 'Jayapura', label: 'Jayapura, Papua' };
const forgedLabel = { provinceName: 'Papua', cityName: 'Jayapura', label: 'Jayapura dekat Bandung' };

assert.equal(feeFor(honest, undefined), 85000, 'with no promo row nothing is discounted');
assert.equal(feeFor(honest, FREE_JAVA), 85000, 'an honest Papua parcel pays Papua postage');
assert.equal(feeFor(forgedProvince, FREE_JAVA), 0,
  'the payout still reads the claimed province — so the claim still has to be checked');
assert.equal(feeFor(forgedLabel, FREE_JAVA), 0, 'and a Java word in the label is enough on its own');

// --- 2. A lookup is made only when it could change money ---------------------------------------------
assert.equal(javaClaimNeedsProof({ promo: FREE_JAVA, destination: forgedProvince }), true);
assert.equal(javaClaimNeedsProof({ promo: FREE_JAVA, destination: forgedLabel }), true,
  'a Java claim made through the label pays out the same way, so it is proved the same way');
assert.equal(javaClaimNeedsProof({ promo: FREE_JAVA, destination: honest }), false,
  'claiming OUTSIDE Java never gains anything, so it is never worth an upstream call');
assert.equal(javaClaimNeedsProof({ promo: { ...FREE_JAVA, enabled: false }, destination: forgedProvince }), false,
  'a promo that is off pays nothing, so there is nothing to prove — today this is every order');
assert.equal(javaClaimNeedsProof({ promo: undefined, destination: forgedProvince }), false,
  'and an absent promo row must not start making upstream calls');
assert.equal(javaClaimNeedsProof(), false, 'called with nothing, no crash');

for (const preset of ['free_java', 'free_java_discount_other', 'flat_java', 'flat_java_discount_other']) {
  assert.equal(javaClaimNeedsProof({ promo: { ...FREE_JAVA, preset }, destination: forgedProvince }), true,
    `${preset} pays differently inside and outside Java, so the claim decides money`);
}
for (const preset of ['free_all', 'discount_all']) {
  assert.equal(javaClaimNeedsProof({ promo: { ...FREE_JAVA, preset }, destination: forgedProvince }), false,
    `${preset} pays the same everywhere — checking the zone would be a call that buys nothing`);
}

// --- 3. The id must match EXACTLY, which is what makes forging pointless -------------------------------
// An attacker picks Java-sounding search terms, so the results come back full of Java rows — with OTHER
// ids. Matching loosely here would hand them the province they were fishing for.
const results = [
  { id: '12345', provinceName: 'Jawa Barat', label: 'Bandung' },
  { id: '17473', provinceName: 'Papua', label: 'Jayapura' },
];
assert.equal(provinceForDestinationId(results, '17473'), 'Papua');
assert.equal(provinceForDestinationId(results, '1234'), '', 'a prefix of an id is not that id');
assert.equal(provinceForDestinationId(results, '123456'), '', 'and neither is a longer string');
assert.equal(provinceForDestinationId(results, ' 17473 '), 'Papua', 'but whitespace is not a different id');
assert.equal(provinceForDestinationId([], '17473'), '', 'nothing found is not a province');
assert.equal(provinceForDestinationId(undefined, '17473'), '', 'a failed request is not a province either');
assert.equal(provinceForDestinationId(results, ''), '', 'and no id asks no question');

// --- 4. UNPROVEN IS NOT FALSE. This is the half that protects honest buyers ----------------------------
assert.equal(javaClaimIsContradicted(''), false,
  'a lookup that missed, timed out or came back empty must NEVER refuse an order — that would charge an '
  + 'honest Java buyer the postage they were just shown as free, which is more common than any attacker');
assert.equal(javaClaimIsContradicted(null), false);
assert.equal(javaClaimIsContradicted(undefined), false);
assert.equal(javaClaimIsContradicted('Papua'), true, 'a province the server actually found, and it is not Java');
assert.equal(javaClaimIsContradicted('Jawa Barat'), false, 'an honest Java claim stands');
assert.equal(javaClaimIsContradicted('DKI Jakarta'), false, 'Jakarta counts as Java, as the payout does');

// --- 5. The search terms are the buyer's own, specific first -------------------------------------------
assert.deepEqual(
  destinationSearchTerms({ subdistrictName: 'Entrop', districtName: 'Jayapura Selatan', cityName: 'Jayapura', label: 'Entrop, Jayapura Selatan, Jayapura, Papua' }),
  ['Entrop', 'Jayapura Selatan', 'Jayapura', 'Entrop, Jayapura Selatan, Jayapura, Papua'],
  'most specific first, because that is the term the picker itself found the row with',
);
assert.deepEqual(destinationSearchTerms({ cityName: 'Yk', label: 'Yogyakarta' }), ['Yogyakarta'],
  'terms under 3 characters are refused upstream, so they are not spent on a call');
assert.deepEqual(destinationSearchTerms({ cityName: 'Jayapura', label: 'Jayapura' }), ['Jayapura'],
  'the same term twice is one call, not two');
assert.deepEqual(destinationSearchTerms(), [], 'called with nothing, no crash');

// --- 6. The handler actually does it, before the payout, and REFUSES ------------------------------------
// Without this the rules above could all hold and never be consulted.
const handler = fs.readFileSync(path.resolve(HERE, '../../api/orders/create.js'), 'utf8')
  // The header above the check explains the forgery; a rule that its own explanation satisfies is a rule
  // that only proves someone wrote a comment.
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

assert.match(handler, /javaClaimNeedsProof\(\{ promo: \{ enabled: promoRow\?\.enabled, preset: promoRow\?\.preset \}, destination \}\)/,
  'the handler must ask whether the claim needs proof, using the promo row it just read');
const checkAt = handler.indexOf('javaClaimNeedsProof');
const payoutAt = handler.indexOf('applyShippingPromotionToRates(\n');
assert.ok(checkAt > 0 && payoutAt > 0, 'both the check and the payout must be in the handler');
assert.ok(checkAt < payoutAt, 'the claim is checked BEFORE the discount is applied, not after it is priced');

const branch = handler.slice(checkAt, payoutAt);
assert.match(branch, /provinceForDestinationId\(found\?\.destinations, destinationId\)/,
  'the province must be looked up for the id the cost was priced from, not for the claimed one');
assert.match(branch, /\/api\/shipping\/rates\?search=\$\{encodeURIComponent\(term\)\}/,
  'the lookup goes through the shop\'s own destination search, which is the only id-to-province map there is');
assert.match(branch, /\.slice\(0, 2\)/, 'at most two upstream calls, so a forged order cannot be a cost attack');
assert.match(branch, /if \(javaClaimIsContradicted\(trustedProvince\)\) \{\s*\n\s*throw new Error\(/,
  'a contradicted claim must stop the order, not log a warning nobody reads');
assert.match(branch, /\.catch\(\(\) => null\)/,
  'a lookup that throws must not take the order down with it — unproven is not false');
