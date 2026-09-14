// Working out a member price from a retail one, in bulk.
//
// Tier prices are edited inside the product form, one product at a time — which is why 17 of 18 products
// still had none weeks after the feature shipped. This is the rule behind the "isi semua" button on the
// curation screen; the screen previews what it produces and saves nothing until told.
//
// Import-free so the guard runs the arithmetic rather than reading it. Money: worth running.

export const DEFAULT_MEMBER_DISCOUNT_PERCENT = 10;

// Prices here are five and six figures, and 296.100 is not a price anyone writes on a shelf. Rounding is
// DOWN to the nearest thousand, always — so the rounding can only ever favour the buyer. A member paying
// slightly less than the stated cut is a rounding choice; paying slightly more would be a broken promise.
const ROUND_TO = 1000;

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
export const buildCurationRows = (products = [], memberPriceByKey = {}) => {
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

    if (Object.prototype.hasOwnProperty.call(next, 'member')) {
      const value = next.member === '' || next.member === null ? null : toPositiveNumber(next.member);
      if (value !== (row.savedMember ?? null)) {
        priceChanges.push({ productId: row.productId, variantId: row.variantId, priceNumber: value, row });
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
