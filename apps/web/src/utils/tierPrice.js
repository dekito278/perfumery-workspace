// Which price applies to one line. Pure and import-free so the browser and the order endpoint (plain
// node) can share it — the same reason schemaAvailability.js is shaped this way. Two implementations of
// one answer is how the availability and og:image bugs happened; pricing is the last place to repeat it.

export const PRICE_TIERS = ['retail', 'member', 'reseller'];
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

/**
 * @param retailPrice  the price already on the product or variant — always the floor of last resort
 * @param tierPrices   { member?, reseller?, overseas? } for this exact product/variant
 * @param tier         the buyer's tier, resolved from their session by the server
 * @param overseas     true when the parcel leaves Indonesia; a destination, not a customer tier
 */
export const resolveTierPrice = ({ retailPrice, tierPrices = {}, tier = 'retail', overseas = false } = {}) => {
  const retail = toPrice(retailPrice) ?? 0;

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

/** Turns the rows storefront_prices_for_me returns into { [slug]: { [variantId]: { tier: price } } }. */
export const indexTierPrices = (rows = []) => {
  const index = {};
  for (const row of rows) {
    const slug = String(row?.slug || '').trim();
    if (!slug) continue;
    const variantId = String(row?.variant_id ?? row?.variantId ?? '');
    const tier = String(row?.tier || '').trim();
    const price = toPrice(row?.price_number ?? row?.priceNumber);
    if (!tier || price === null) continue;
    index[slug] = index[slug] || {};
    index[slug][variantId] = index[slug][variantId] || {};
    index[slug][variantId][tier] = price;
  }
  return index;
};

/** The tier prices for one line, falling back to the product-level row ('') when the variant has none. */
export const tierPricesForLine = (index = {}, slug, variantId = '') => ({
  ...(index?.[slug]?.[''] || {}),
  ...(variantId ? index?.[slug]?.[variantId] || {} : {}),
});
