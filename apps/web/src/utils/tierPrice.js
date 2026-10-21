// Which price applies to one line. Pure and import-free so the browser and the order endpoint (plain
// node) can share it — the same reason schemaAvailability.js is shaped this way. Two implementations of
// one answer is how the availability and og:image bugs happened; pricing is the last place to repeat it.

export const OVERSEAS_TIER = 'overseas';

// What a buyer on each tier may fall back to, best first. A reseller never pays more than a member:
// if no reseller price is set, the member one applies before retail.
const LADDER = {
  reseller: ['reseller', 'member'],
  member: ['member'],
  retail: [],
};

const toPrice = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const RETAIL_TIER = 'retail';

/**
 * @param retailPrice  the price already on the product or variant — the floor when nothing is scheduled
 * @param tierPrices   { retail?, member?, reseller?, overseas? } for this exact product/variant
 * @param tier         the buyer's tier, resolved from their session by the server
 * @param overseas     true when the parcel leaves Indonesia; a destination, not a customer tier
 */
export const resolveTierPrice = ({ retailPrice, tierPrices = {}, tier = 'retail', overseas = false } = {}) => {
  // A SCHEDULED retail price outranks the one on the variant. That is how the 12 Nov 2026 change is
  // delivered: the new figure is a row with an effective_at, and until it arrives indexTierPrices does
  // not hand it over at all. The variant keeps the old price, so nothing has to be rewritten in place
  // and the switch can be moved or cancelled by editing one date.
  const retail = toPrice(tierPrices[RETAIL_TIER]) ?? toPrice(retailPrice) ?? 0;

  // Where the parcel is going wins over who is buying: member and reseller are Indonesia-only, and
  // overseas is one price for everyone.
  if (overseas) {
    return toPrice(tierPrices[OVERSEAS_TIER]) ?? retail;
  }

  for (const candidate of LADDER[tier] || []) {
    const price = toPrice(tierPrices[candidate]);
    if (price !== null) return price;
  }
  return retail;
};

const effectiveTime = (row) => {
  const raw = row?.effective_at ?? row?.effectiveAt;
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : null;
};

/**
 * Turns price rows into { [slug]: { [variantId]: { tier: price } } }.
 *
 * TIME IS PART OF THE ANSWER. A row may carry an effective_at, and the table holds the current price and
 * the scheduled one side by side. Two rules, and the order endpoint and the browser share them because
 * they share this function:
 *
 *   1. A row whose effective_at has not arrived is not a price yet. It is dropped, not kept for later.
 *   2. Among the rows that HAVE arrived, the one with the latest effective_at wins; an undated row is
 *      the base price and loses to any dated row that is in force.
 *
 * Without rule 2 the winner was whichever row the query happened to return last — the order endpoint
 * reads this table directly with the service-role key, so it sees future rows that the RPC can filter
 * away, and "last row wins" would have charged the new price early or the old one late at random.
 *
 * @param asOf  the instant to judge against. Defaults to now. The callers that matter pass a SERVER
 *   clock: the RPC filters in SQL with now(), and the order endpoint uses its own. A buyer's device
 *   clock never decides when a price changes.
 */
export const indexTierPrices = (rows = [], { asOf = Date.now() } = {}) => {
  const now = new Date(asOf).getTime();
  const index = {};
  const chosenAt = {};
  for (const row of rows) {
    const slug = String(row?.slug || '').trim();
    if (!slug) continue;
    const variantId = String(row?.variant_id ?? row?.variantId ?? '');
    const tier = String(row?.tier || '').trim();
    const price = toPrice(row?.price_number ?? row?.priceNumber);
    if (!tier || price === null) continue;

    const at = effectiveTime(row);
    if (at !== null && Number.isFinite(now) && at > now) continue;

    const key = `${slug}\u0000${variantId}\u0000${tier}`;
    const previous = chosenAt[key];
    if (previous !== undefined && (previous ?? -Infinity) > (at ?? -Infinity)) continue;

    index[slug] = index[slug] || {};
    index[slug][variantId] = index[slug][variantId] || {};
    index[slug][variantId][tier] = price;
    chosenAt[key] = at;
  }
  return index;
};

/** The tier prices for one line, falling back to the product-level row ('') when the variant has none. */
export const tierPricesForLine = (index = {}, slug, variantId = '') => ({
  ...(index?.[slug]?.[''] || {}),
  ...(variantId ? index?.[slug]?.[variantId] || {} : {}),
});
