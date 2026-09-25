// Is this visitor probably outside Indonesia, and what should they be quoted?
//
// The shop prices in Rupiah and ships domestically. An international order is priced separately and its
// shipping is quoted by hand over WhatsApp — so a visitor abroad who reads the Indonesian price and then
// asks is quoted something far higher. Dekito's one hand-set export price is 2,55x retail. A 2,5x jump
// after the fact reads as a bait-and-switch, which is worse than showing no price at all.
//
// So the export price is shown UP FRONT to visitors who are probably abroad. Three rules hold it together:
//
//   1. It never changes what anybody is charged. The headline price, the cart and the server stay exactly
//      as they are. This is a second number shown beside the first, the same shape as the member nudge —
//      because the detection below is a GUESS, and a guess must never move money.
//   2. It only appears when Dekito has actually set an export price for that line. No price, no panel.
//   3. Silence is the default. Anything undetectable is treated as "in Indonesia".
//
// Import-free so the guard runs the rules instead of reading them.

// Indonesia spans three zones; Asia/Pontianak is the fourth name browsers report for WIB/WITA.
const INDONESIAN_TIME_ZONES = ['Asia/Jakarta', 'Asia/Pontianak', 'Asia/Makassar', 'Asia/Jayapura'];

/**
 * @param timeZone   IANA zone from Intl, e.g. 'Europe/Berlin'
 * @param languages  navigator.languages, e.g. ['en-GB', 'en']
 *
 * Both signals must agree before the panel appears: an Indonesian abroad — travelling, studying, working —
 * still has an Indonesian browser and still buys at Indonesian prices, and showing them an English export
 * panel would be wrong in the one direction that loses a real sale.
 */
export const isLikelyOverseas = (timeZone, languages = []) => {
  const zone = String(timeZone || '').trim();
  // No zone means no evidence. Evidence is required to show the panel, never to hide it.
  if (!zone) return false;
  if (INDONESIAN_TIME_ZONES.includes(zone)) return false;
  // Asia/Jakarta is the only zone that matters, but a browser reporting a bare 'Asia' or an unknown
  // string is not evidence of being abroad either.
  if (!zone.includes('/')) return false;

  const tags = (Array.isArray(languages) ? languages : [languages]).filter(Boolean).map(String);
  if (!tags.length) return true;
  return !tags.some((tag) => /^id\b/i.test(tag.trim()));
};

/** Reads the browser. Separated from the rule above so the rule can be tested without a browser. */
export const detectOverseasVisitor = () => {
  if (typeof window === 'undefined' || typeof Intl === 'undefined') return false;
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    // Some hardened browsers throw rather than report a zone. No evidence, so: not abroad.
    return false;
  }
  const languages = typeof navigator !== 'undefined'
    ? (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])
    : [];
  return isLikelyOverseas(zone, languages);
};

/**
 * The export price for one line, or null. Reads the same tier index the storefront already loads —
 * storefront_prices_for_me returns the overseas rows to everyone, because the price of a parcel leaving
 * Indonesia is not private to any one buyer.
 *
 * Null when it is not strictly ABOVE the price on the line: an export price at or below the domestic one
 * is either unset or a typo, and either way announcing it as "the international price" would be a lie
 * about the number the buyer will actually be quoted.
 */
export const overseasPriceFor = (tierPrices = {}, linePrice = 0) => {
  const price = Number(tierPrices?.overseas) || 0;
  const line = Number(linePrice) || 0;
  if (!price || !line || price <= line) return null;
  return price;
};

// The approximate dollar rate lived here — a second 16500 beside the one in usdPrice.js, rounded to
// whole dollars and always shown with the word "approx" beside it. It was right while an overseas buyer
// paid rupiah and the dollars were only ever a hint. They pay dollars into a dollar account now, so the
// figure IS the charge, the storefront panels were moved onto usdPriceFor on 2026-09-24, and the export
// quote screen — its last caller, and the one place it reached a number someone is billed — was moved
// on 2026-09-25.
//
// Deleted rather than left sitting: an exported constant named "the dollar rate" with no callers is not
// dormant, it is the first thing autocomplete offers the next screen that needs one. There is one rate
// in this codebase and it is USD_PRICE_RATE.
