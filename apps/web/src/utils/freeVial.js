// One free 2 ml vial per order, chosen by the buyer in the cart.
//
// Dekito's decisions, 2026-09-29: ONE vial per order rather than per bottle; stock counted per aroma so a
// scent he has run out of stops being offered; and ONE pool — every aroma, no tiers. The tiered version
// was considered and dropped against his own catalogue: the cheapest bottle is Rp 359.000, so a "below
// Rp 300.000" tier can never fire and an "above Rp 500.000" tier fires on every single-bottle order. The
// two tiers collapsed into one. A vial is also the cheapest way to sell the SECOND bottle, and the buyer
// who most needs convincing is the first-time single-bottle one — the last person to ration it to.
//
// WHERE THE STOCK LIVES, and why it is a product rather than a table of its own:
//
// The buyer's browser has to know which aromas are still in stock, and the only thing an anonymous
// browser can read is storefront_products_public. So the vial has to be a product. It is one product
// carrying one VARIANT PER AROMA, which buys per-aroma stock, the existing deduct/restore RPCs (both key
// on variantId inside the variants jsonb) and the product form he already knows — with no migration, no
// new RLS policy, and no new SQL to deploy. A dedicated table would be tidier and is still possible
// later; it would also join a migration queue that is already waiting and add RLS that has taken this
// project down before while every check stayed green.
//
// The cost of that choice is that a row which is NOT for sale sits in a table whose every other row is.
// It breaks two catalogue assumptions — a product has a price above zero, and a variant is a size you can
// buy — so it has to be kept out of exactly three places. They are named here, and freeVial.selfcheck.mjs
// checks all three rather than trusting this comment:
//
//   1. the storefront listings, through isProductVisibleInStorefront (one helper, 11 pages)
//   2. the automatic member/export pricing, which would otherwise price a gift
//   3. the build's product fetch, which would otherwise prerender /catalog/<vial> and sitemap it
//
// Free of framework imports on purpose: the browser, the guards and the build step all read these rules,
// and the build runs in plain node with no bundler.

import { itemWeightGram } from './itemWeight.js';

/** The tag that marks the vial product. Written on the product in Studio, like every other tag. */
export const FREE_VIAL_TAG = 'Vial hadiah';

/** How many a buyer gets. One, per ORDER — not per bottle. */
export const FREE_VIALS_PER_ORDER = 1;

/** The size on the label. */
export const FREE_VIAL_SIZE = '2 ml';

/**
 * What one vial adds to a parcel, in grams. Dekito's figure, 2026-09-29.
 *
 * It matters more than it looks. The weight table knows 10/30/50/100 ml and falls back to 300 g for
 * anything else — which is HEAVIER than the 30 ml bottle most orders are. Left unmeasured, every order
 * carrying a gift would be quoted freight for 300 g that is not in the box, and on an export parcel,
 * where RaySpeed bills a one-kilogram minimum, a phantom 300 g can cross into the next band.
 */
export const FREE_VIAL_WEIGHT_GRAM = itemWeightGram(FREE_VIAL_SIZE);

// Tags arrive as an array from the database and as a comma-separated string from older rows and from the
// product form, so both are read rather than one being assumed.
const tagList = (tags) => {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag ?? '').trim()).filter(Boolean);
  return String(tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
};

/** Whether this product row is the vial stock rather than something for sale. */
export const isFreeVialProduct = (product = {}) => (
  tagList(product?.tags).some((tag) => tag.toLowerCase() === FREE_VIAL_TAG.toLowerCase())
);

export default isFreeVialProduct;
