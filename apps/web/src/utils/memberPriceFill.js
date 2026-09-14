// Working out a member price — and an overseas price — from a retail one, in bulk.
//
// Tier prices are edited inside the product form, one product at a time — which is why 17 of 18 products
// still had none weeks after the feature shipped. This is the rule behind the "isi semua" button on the
// curation screen; the screen previews what it produces and saves nothing until told.
//
// Import-free so the guard runs the arithmetic rather than reading it. Money: worth running.

export const DEFAULT_MEMBER_DISCOUNT_PERCENT = 10;

// Dekito's decision, 2026-09-15: a flat 3,5x retail for every product, replacing the single 2,55x price
// he had set by hand on Maskumambang.
export const DEFAULT_OVERSEAS_MULTIPLIER = 3.5;

// Prices here are five and six figures, and 296.100 is not a price anyone writes on a shelf. Rounding is
// DOWN to the nearest thousand, always — so the rounding can only ever favour the buyer. A member paying
// slightly less than the stated cut is a rounding choice; paying slightly more would be a broken promise.
const ROUND_TO = 1000;
const OVERSEAS_ROUND_TO = 10000;

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * @returns the member price, or null when there is nothing sensible to suggest — no retail price, a
 *   percentage outside 1..90, or a result that would not actually be below retail. Null means "leave this
 *   row alone", never "set it to zero": zero deletes a tier price, and deleting is not what a fill button
 *   is for.
 */
export const memberPriceFromRetail = (retailPrice, percent = DEFAULT_MEMBER_DISCOUNT_PERCENT) => {
  const retail = toPositiveNumber(retailPrice);
  const cut = Number(percent);
  if (retail === null || !Number.isFinite(cut) || cut <= 0 || cut > 90) return null;

  const exact = retail * (1 - cut / 100);
  const rounded = Math.floor(exact / ROUND_TO) * ROUND_TO;
  // Below a thousand the flooring would land on zero, which reads as "delete this price".
  if (rounded <= 0 || rounded >= retail) return null;
  return rounded;
};

/**
 * The overseas price for a retail one.
 *
 * Rounds UP, to the nearest ten thousand — the opposite direction to the member price above, and on
 * purpose. A member discount that rounds down costs a few hundred rupiah and keeps a promise; an export
 * price that rounds down eats into the margin that covers customs, handling and the hand-quoted shipping,
 * on an order that is already the most expensive one to get wrong.
 *
 * @returns null when there is nothing sensible to suggest — no retail price, a multiplier outside
 *   1.01..10, or a result that would not actually be above retail. Null means "leave this row alone".
 */
export const overseasPriceFromRetail = (retailPrice, multiplier = DEFAULT_OVERSEAS_MULTIPLIER) => {
  const retail = toPositiveNumber(retailPrice);
  const factor = Number(multiplier);
  if (retail === null || !Number.isFinite(factor) || factor <= 1 || factor > 10) return null;

  // No "is it actually above retail?" check here, unlike the member price above: the multiplier is
  // already forced above 1 and rounding only ever goes up, so the result cannot land at or below retail.
  // A sabotage proved that branch unreachable — dead code that reads like a safeguard is worse than none,
  // because the next reader trusts it. The screen still flags a hand-typed price below retail.
  return Math.ceil((retail * factor) / OVERSEAS_ROUND_TO) * OVERSEAS_ROUND_TO;
};

/** What the buyer saves, for the preview column. */
export const memberSaving = (retailPrice, memberPrice) => {
  const retail = toPositiveNumber(retailPrice);
  const member = toPositiveNumber(memberPrice);
  if (retail === null || member === null || member >= retail) return 0;
  return retail - member;
};

/**
 * One row per product per variant. Every catalogue product has exactly one variant today, but the tier
 * table is keyed by variant, so building rows from the variants is what keeps a second variant from
 * silently sharing the first one's price.
 */
export const buildCurationRows = (products = [], memberPriceByKey = {}, overseasPriceByKey = {}) => {
  const rows = [];
  for (const product of products || []) {
    if (!product?.id) continue;
    const variants = Array.isArray(product.variants) && product.variants.length
      ? product.variants
      : [{ id: '', size: product.size || '', priceNumber: product.priceNumber }];

    for (const variant of variants) {
      const variantId = String(variant?.id || '');
      const retail = toPositiveNumber(variant?.priceNumber ?? product.priceNumber) || 0;
      rows.push({
        key: `${product.id}|${variantId}`,
        productId: product.id,
        slug: product.slug || '',
        name: product.name || product.slug || '(tanpa nama)',
        variantId,
        size: variant?.size || '',
        retail,
        featured: product.featured === true,
        savedMember: toPositiveNumber(memberPriceByKey[`${product.id}|${variantId}`]),
        savedOverseas: toPositiveNumber(overseasPriceByKey[`${product.id}|${variantId}`]),
      });
    }
  }
  return rows;
};

/** Only what actually changed gets written. A save that touches every row rewrites history for nothing. */
export const collectCurationChanges = (rows = [], draft = {}) => {
  const priceChanges = [];
  const featuredChanges = [];

  for (const row of rows || []) {
    const next = draft?.[row.key] || {};

    // One loop, both tiers: a second copy of this comparison is how member and overseas drift apart.
    for (const [field, tier, saved] of [['member', 'member', row.savedMember], ['overseas', 'overseas', row.savedOverseas]]) {
      if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
      const raw = next[field];
      const value = raw === '' || raw === null ? null : toPositiveNumber(raw);
      if (value !== (saved ?? null)) {
        priceChanges.push({ productId: row.productId, variantId: row.variantId, tier, priceNumber: value, row });
      }
    }

    if (Object.prototype.hasOwnProperty.call(next, 'featured') && Boolean(next.featured) !== row.featured) {
      featuredChanges.push({ productId: row.productId, featured: Boolean(next.featured), row });
    }
  }

  // One product, one featured flag: two variants of the same product must not queue two writes that
  // could disagree.
  const seen = new Set();
  const uniqueFeatured = featuredChanges.filter(({ productId }) => {
    if (seen.has(productId)) return false;
    seen.add(productId);
    return true;
  });

  return { priceChanges, featuredChanges: uniqueFeatured };
};
