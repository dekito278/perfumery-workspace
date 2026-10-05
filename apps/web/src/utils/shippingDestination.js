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
/** The country <select>'s DOM id — stable, because the order buttons send a buyer who has not picked yet to it. */
export const DESTINATION_PICKER_ID = 'international-destination';

/**
 * "Somewhere else" — a real choice, not an empty one.
 *
 * The carrier's zone sheet names 233 destinations and the picker offers every one it can put a name to,
 * so this is now the rare case rather than the common one. It stays because the alternative — leaving the
 * picker alone — is indistinguishable from not having noticed it. Chosen, it quotes the bottle and says
 * the shipping is on request.
 *
 * Deliberately NOT an ISO code: 'XX' is unassigned in ISO 3166-1, so it can never collide with a country
 * the card gains later, and `shippingRateRegionFor('XX')` already answers null without being told about
 * it.
 */
export const DESTINATION_OTHER = 'XX';

/** Every destination the rule can price, flat — the carrier's zone sheet, by way of the groups. */
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
 * The picker's options, grouped as the rate groups are, A-Z by LOCALISED name inside each — a reader
 * scanning for "Germany" is scanning an alphabet, and the Indonesian shop reads Jerman under J.
 *
 * Only destinations the platform can NAME. The carrier's sheet carries a handful of codes that are not
 * ISO 3166 — Bonaire as XB, Curaçao as XC, Kosovo as KV, the Canaries as IC — and Intl.DisplayNames has
 * no word for them, so they would appear in the list as their bare code between "Bolivia" and "Brazil".
 * A buyer there can still choose "another country"; a dropdown that shows "XB" looks broken to everyone
 * else.
 */
export const destinationOptions = (locale = 'en') => SHIPPING_RATE_REGIONS.map((region) => ({
  key: region.key,
  label: region.label,
  countries: region.countries
    .map((code) => ({ code, name: countryNameFor(code, locale) }))
    .filter((item) => item.name !== item.code)
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
