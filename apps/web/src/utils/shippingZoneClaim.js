// Is the buyer's claimed destination really in Java?
//
// The shipping promotion pays out by ZONE: "Gratis ongkir Pulau Jawa" turns an Rp 85.000 parcel into
// Rp 0. getShippingDestinationArea decides that zone by reading province and label strings — and in
// api/orders/create.js those strings arrived in the REQUEST BODY, while the id the cost was priced from
// arrived separately. The two were never checked against each other.
//
// Measured with the real function before any of this was written, on a Papua destination at Rp 85.000:
//
//   promo row absent (today)                   Rp 85.000   unchanged
//   FREE_JAVA on, honest destination           Rp 85.000   unchanged
//   FREE_JAVA on, provinceName forged to Jawa  Rp 0        "Gratis ongkir Pulau Jawa"
//   FREE_JAVA on, only a Java word in label    Rp 0        "Gratis ongkir Pulau Jawa"
//
// So the parcel still goes to Papua, the shop still pays Papua postage, and the order is SAVED with a
// zero shipping fee. It is latent only because storefront_shipping_promotion_settings is empty — one
// save in Studio turns it on.
//
// WHY VERIFY RATHER THAN RECOMPUTE. The obvious fix is for the server to derive the zone itself from the
// destination id. It cannot: RajaOngkir's cost response carries no province, so the only id-to-province
// map is its destination SEARCH, which returns a handful of results per keyword. Deriving the zone from
// a search that misses would charge an honest Java buyer the full postage they were just shown as free —
// a worse bug than the one being fixed, and one they would meet far more often than any attacker.
//
// So the claim stands unless the server can prove it wrong: look the id up, and refuse only on a
// CONTRADICTION. A lookup that fails, times out or returns nothing changes nothing. The hole stays shut
// against anyone who forges a province, because the id they must also send is the id that gives them
// away; an attacker cannot make the lookup fail on demand.
//
// Free of framework imports: the server handler, the guards and any future caller all read these rules.

import { getShippingDestinationArea } from './shippingPromotion.js';

/** Zone-blind presets pay the same everywhere, so there is nothing to verify and no call to make. */
const ZONE_DEPENDENT_PRESETS = new Set([
  'free_java', 'free_java_discount_other', 'flat_java', 'flat_java_discount_other',
]);

/**
 * Is a lookup worth making at all?
 *
 * Only when a promo is live, its payout depends on the zone, and the buyer claims the paying side.
 * Claiming "outside Java" never gains anything, so it is never checked.
 */
export const javaClaimNeedsProof = ({ promo, destination } = {}) => {
  if (!promo || promo.enabled !== true) return false;
  if (!ZONE_DEPENDENT_PRESETS.has(String(promo.preset || ''))) return false;
  return getShippingDestinationArea(destination, null).area === 'java';
};

/**
 * The search terms to look the id up with, most specific first.
 *
 * These come from the buyer's own destination, which is how the picker found it in the first place, so
 * an honest entry comes back in the first page of results. An attacker choosing Java-sounding terms only
 * makes their own id harder to find, which proves nothing and so changes nothing.
 */
export const destinationSearchTerms = (destination) => [
  destination?.subdistrictName,
  destination?.districtName,
  destination?.cityName,
  destination?.label,
]
  .map((term) => String(term || '').trim())
  .filter((term) => term.length >= 3)
  .filter((term, index, all) => all.indexOf(term) === index);

/** The province RajaOngkir has on file for this exact id, or '' when the id was not in the results. */
export const provinceForDestinationId = (destinations, destinationId) => {
  const wanted = String(destinationId || '').trim();
  if (!wanted) return '';
  const match = (Array.isArray(destinations) ? destinations : [])
    .find((row) => String(row?.id || '').trim() === wanted);
  return String(match?.provinceName || '').trim();
};

/**
 * Does the looked-up province contradict a Java claim?
 *
 * Only a province the server actually found can contradict anything. '' means "not proven either way",
 * which is not the same as "proven false" and must never refuse an order.
 */
export const javaClaimIsContradicted = (trustedProvince) => {
  const province = String(trustedProvince || '').trim();
  if (!province) return false;
  return getShippingDestinationArea({ provinceName: province }, null).area !== 'java';
};
