// Where an international order can go, and what that destination implies.
//
// One country, three answers, all of them decided here so no screen decides differently:
//
//   priceRegion       which of the two international prices applies (the neighbours pay 2.2x retail,
//                     the rest of the world the hand-set price)
//   shippingIncluded  whether the freight is already inside that price
//   shippingQuoted    whether Dekito quotes the freight by hand before the buyer can pay
//
// WHY THE INCLUDED SET IS THE CARD'S, NOT THE CARRIER'S. Every product page tells an international
// reader "Shipping included to Southeast Asia, East Asia, Australia and the Americas". Until now the code
// answered that question with rayspeedServes() — the eight countries whose carrier rate happens to be
// measured — so Thailand, the Philippines and Vietnam were promised free shipping on the page and
// charged for it in Studio. The promise is what the buyer read, so the promise is the rule, and the
// regions on the published rate card are how that sentence is spelled out:
//
//   Southeast Asia, East Asia & Oceania, North America  -> included
//   Middle East & South Asia, Europe                    -> quoted by hand
//
// A country on neither list cannot be checked out to at all. That is not a gap to fill with a guess: it
// is a parcel nobody has priced, and WhatsApp is where those still belong.
//
// Relative imports, and only to import-free modules, because api/orders/create.js runs in plain node and
// cannot resolve the '@/' alias — and the price a server charges an international buyer has to come from
// THIS rule, not from a second copy written for the server.
import { SHIPPING_RATE_REGIONS, shippingRateRegionFor } from '../data/internationalShippingRates.js';
import { EXPORT_ZONE_BY_COUNTRY } from '../data/exportZones.js';
import { overseasPriceFromRetail } from './memberPriceFill.js';

/**
 * Southeast Asia plus Hong Kong and Macau — the carrier's zones 1 and 2, which is also "the neighbours".
 *
 * Lives here rather than in shippingRegion.js because it is a question about a DESTINATION, and putting
 * it beside the other two destination questions is what stops a third definition appearing. shippingRegion
 * re-exports it for the callers that always read it from there.
 */
export const isAsiaCountry = (countryCode) => {
  const zone = EXPORT_ZONE_BY_COUNTRY[String(countryCode || '').trim().toUpperCase()];
  return zone === 1 || zone === 2;
};

/** The card's regions whose price already carries the freight. */
export const SHIPPING_INCLUDED_REGIONS = ['southeast_asia', 'east_asia_oceania', 'north_america'];

export const HOME_COUNTRY = 'ID';

/**
 * @returns null when the destination is home, empty, or somewhere the shop does not ship to yet;
 *   otherwise { code, regionKey, regionLabel, priceRegion, shippingIncluded, shippingQuoted }.
 */
export const destinationFor = (countryCode) => {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!code || code === HOME_COUNTRY) return null;

  const region = shippingRateRegionFor(code);
  if (!region) return null;

  const shippingIncluded = SHIPPING_INCLUDED_REGIONS.includes(region.key);
  return {
    code,
    regionKey: region.key,
    regionLabel: region.label,
    // The neighbours' price is a country question, the same one shippingRegion answers for the shop.
    priceRegion: isAsiaCountry(code) ? 'asia' : 'world',
    shippingIncluded,
    // The other half of the same fact, named rather than inferred: a screen that has to write "we will
    // quote this" should not have to remember that it means "not included".
    shippingQuoted: !shippingIncluded,
  };
};

export const canCheckoutTo = (countryCode) => Boolean(destinationFor(countryCode));

/**
 * Whether the price already carries the freight — the sentence printed on every product page.
 *
 * This used to be rayspeedServes(): the eight countries whose carrier rate happened to be measured. The
 * page promised Thailand, the Philippines and Vietnam their shipping was included and Studio charged
 * them for it. Carrier coverage is a fact about us; the promise is a fact the buyer was told, and the
 * buyer's version wins.
 */
export const shippingIncludedFor = (countryCode) => Boolean(destinationFor(countryCode)?.shippingIncluded);

/**
 * The picker, grouped the way the rate card groups it — so a buyer choosing their country can see which
 * group they are in, which is also the group that decides their price.
 */
export const listCheckoutDestinations = (countryName = () => '') => SHIPPING_RATE_REGIONS.map((region) => ({
  key: region.key,
  label: region.label,
  shippingIncluded: SHIPPING_INCLUDED_REGIONS.includes(region.key),
  countries: region.countries
    .map((code) => ({ code, name: countryName(code) || code }))
    .sort((left, right) => left.name.localeCompare(right.name)),
}));

/** Southeast Asia pays this much of retail. */
export const ASIA_MULTIPLIER = 2.2;

/**
 * The international price for one line, in the region the destination sits in.
 *
 * 'world' is the price Dekito set by hand and it is left exactly alone. 'asia' is COMPUTED from retail
 * rather than stored, so it follows every price change without eighteen rows to keep in step — that is
 * the whole reason it is a formula and not a column.
 *
 * And it is never dearer than the world price: a hand-set overseas price below 2.2x would otherwise make
 * the neighbours pay more than America, which is the opposite of the point.
 *
 * Moved here from shippingRegion.js so the browser and the order endpoint share one implementation. Two
 * implementations of one price is how a buyer gets shown one number and charged another.
 */
export const internationalPriceFor = ({ tierPrices = {}, linePrice = 0, region = 'world' } = {}) => {
  const world = Number(tierPrices?.overseas) || 0;
  const line = Number(linePrice) || 0;
  const worldPrice = world && line && world > line ? world : null;
  if (region !== 'asia') return worldPrice;

  const asia = overseasPriceFromRetail(line, ASIA_MULTIPLIER);
  if (!asia) return worldPrice;
  return worldPrice ? Math.min(asia, worldPrice) : asia;
};
