// WHERE THE PARCEL IS GOING, chosen by the buyer — the one input that decides what they are charged.
//
// Dekito's decision, 2026-10-05, after asking whether the gap between the Indonesian and international
// price is defensible: it is, but only if it is a price for a DESTINATION rather than a price for a
// person. The shop used to decide both the product price and the shipping from `detectShippingRegion()`,
// which reads the browser's clock and its language list — a guess about WHO IS READING. Two readers in
// Jakarta, same bottle, same parcel, could see different numbers because one of them had an English
// browser. That is the version of two-tier pricing that cannot be explained out loud.
//
// So the buyer picks the country, and the picked country decides everything: 2.2x or 3.5x on the bottle
// (shippingRegionForCountry) and the shipping line off the published card. The clock is demoted to
// seeding the default, which is what a guess is actually good for.
//
// It also replaces the thing it was built to replace: shipping was a figure Dekito typed into Studio for
// every international order. The card has been machine-readable since 24 Sep; this is the buyer reading
// it themselves.

import { SHIPPING_RATE_REGIONS } from '@/data/internationalShippingRates.js';

export const DESTINATION_STORAGE_KEY = 'solivagant.storefront.destination.v1';
export const DESTINATION_QUERY_KEY = 'dest';

/**
 * "Somewhere else" — a real choice, not an empty one.
 *
 * The card covers 57 countries and the world has rather more. Without this the only way to say "my
 * country is not on your list" is to leave the picker alone, which is indistinguishable from not having
 * noticed it. Chosen, it quotes the bottle at the world price and says the shipping is on request, which
 * is exactly what the card's own footnote instructs.
 *
 * Deliberately NOT an ISO code: 'XX' is unassigned in ISO 3166-1, so it can never collide with a country
 * the card gains later, and `shippingRateRegionFor('XX')` already answers null without being told about
 * it.
 */
export const DESTINATION_OTHER = 'XX';

/** Every country the published card can quote, flat. */
export const CARD_COUNTRIES = SHIPPING_RATE_REGIONS.flatMap((region) => region.countries);

export const isCardCountry = (countryCode) => CARD_COUNTRIES.includes(
  String(countryCode || '').trim().toUpperCase(),
);

/** A country code this picker is allowed to hold: on the card, or the explicit "somewhere else". */
export const isValidDestination = (countryCode) => {
  const code = String(countryCode || '').trim().toUpperCase();
  return code === DESTINATION_OTHER || isCardCountry(code);
};

/**
 * The country's name in the shop's language, from the platform.
 *
 * Intl.DisplayNames rather than a 57-row table in this repo: the table would be one more list to keep in
 * step with the card, in two languages, and every browser already ships both. Falling back to the code
 * keeps the picker usable on a browser without it (Safari below 14) — "DE" is worse than "Germany" and
 * far better than an empty option.
 */
export const countryNameFor = (countryCode, locale = 'en') => {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!code) return '';
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
};

/**
 * The picker's options, grouped exactly as the card groups them.
 *
 * The card's own order between groups — it is his sheet and the order is his — but A-Z by NAME inside
 * each, because the card lists countries in the order he wrote them and a reader scanning for "Germany"
 * is scanning an alphabet. Sorted by the LOCALISED name, so the Indonesian shop reads Jerman under J.
 */
export const destinationOptions = (locale = 'en') => SHIPPING_RATE_REGIONS.map((region) => ({
  key: region.key,
  label: region.label,
  countries: region.countries
    .map((code) => ({ code, name: countryNameFor(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale)),
}));

/**
 * ?dest=DE on the address, which beats both the stored choice and the clock.
 *
 * The same reason ?lang= and ?ship= exist, and the same lesson: Dekito cannot see what a buyer in Berlin
 * is quoted from a desk in Jakarta, and neither can anyone checking his work. A guess nobody can override
 * is a guess nobody can correct.
 */
export const readDestinationFromUrl = (search) => {
  try {
    const query = typeof search === 'string' ? search : window.location.search;
    const value = new URLSearchParams(query).get(DESTINATION_QUERY_KEY);
    const code = String(value || '').trim().toUpperCase();
    return isValidDestination(code) ? code : null;
  } catch {
    return null;
  }
};

export const readStoredDestination = () => {
  try {
    const value = window.localStorage.getItem(DESTINATION_STORAGE_KEY);
    return isValidDestination(value) ? String(value).toUpperCase() : null;
  } catch {
    // Private windows and blocked storage throw on read. No stored choice, so the picker starts empty
    // and the clock's guess stands — the same place a first-time visitor starts.
    return null;
  }
};

export const writeStoredDestination = (countryCode) => {
  if (!isValidDestination(countryCode)) return false;
  try {
    window.localStorage.setItem(DESTINATION_STORAGE_KEY, String(countryCode).toUpperCase());
    return true;
  } catch {
    // Blocked storage must not break the picker: the choice still applies to this page view, it just
    // will not survive a reload.
    return false;
  }
};
