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

/**
 * What a gift line says where every other line says a price.
 *
 * "Rp 0" reads as an error — a line the shop failed to price — and on a packing slip it reads as
 * something to charge for. One word, and it is Indonesian because the shop with a cart is the Indonesian
 * one: the English shop has no checkout, so no English order can carry a gift.
 */
export const FREE_VIAL_PRICE_LABEL = 'Gratis';

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


/**
 * Whether an ORDER/CART line is the gift rather than something bought.
 *
 * Identified by the product's tag, never by its price being zero — a bought line can be zero (a fully
 * discounted order) and a vial line could one day carry a stated worth. The order endpoint therefore has
 * to read `tags` when it resolves a line, which is one word added to a select and keeps the tag as the
 * single source of truth for what a vial is.
 */
export const isFreeVialLine = (line = {}) => isFreeVialProduct({
  tags: line?.tags ?? line?.product?.tags ?? line?.productTags,
});

/**
 * The lines to weigh, with the gift weighed as a vial.
 *
 * The weight of every other line comes from its SIZE label, and for the vial that would mean trusting
 * whatever Dekito typed into the variant — a label naming the aroma ("HUG N°1") parses to no millilitres
 * at all and falls to the 300 g default. Nothing in this repository can see his labels, so the weight is
 * not left to them: a line the tag says is a vial weighs a vial, whatever it is called.
 *
 * Used by BOTH sides — the browser that quotes the freight and the endpoint that charges it. They must
 * agree, or a buyer is shown one courier fee and charged another.
 */
export const weighFreeVialLines = (lines = []) => (
  (Array.isArray(lines) ? lines : []).map((line) => (
    isFreeVialLine(line) ? { ...line, size: FREE_VIAL_SIZE } : line
  ))
);

/**
 * The aromas a buyer may pick from: every variant of the vial product with stock left.
 *
 * One pool, all of them — Dekito's decision, 2026-09-29. Out of stock simply stops being offered, which
 * is the whole reason the stock is counted per aroma rather than in one lump.
 */
export const freeVialChoices = (vialProduct = {}) => (
  (Array.isArray(vialProduct?.variants) ? vialProduct.variants : [])
    .map((variant) => ({
      variantId: String(variant?.id || ''),
      label: String(variant?.size || variant?.name || variant?.id || '').trim(),
      stock: Math.max(0, Math.round(Number(variant?.stock) || 0)),
    }))
    .filter((choice) => choice.variantId && choice.label && choice.stock > 0)
);


/**
 * The gift, separated from what was bought.
 *
 * The cart list renders bought lines: a price, a quantity stepper, a remove button. None of that is true
 * of a gift, and a "Rp 0" row with a stepper beside it invites both a question and a second vial. So the
 * gift comes out of the list entirely and is shown by the picker instead. Every vial line is taken out,
 * not just the first — a cart that somehow held two must not display one of them as a purchase.
 */
export const splitFreeVialLines = (items = []) => {
  const list = Array.isArray(items) ? items : [];
  const gift = list.find(isFreeVialLine) || null;
  return { lines: list.filter((item) => !isFreeVialLine(item)), gift };
};

/**
 * The cart line for a chosen aroma.
 *
 * The name is the owner's own: the vial product's name as he wrote it, and the variant label as he wrote
 * it. It travels to the invoice and to the packing slip, where it is the only thing saying this bottle
 * was not paid for — so it has to read as a gift without any translation layer, and the shop that has a
 * cart is the Indonesian one.
 */
export const buildFreeVialCartItem = ({ vialProduct = {}, choice = {} } = {}) => ({
  productId: vialProduct.id,
  // The cart keys lines by `slug`; two aromas of the same product must not collide.
  slug: `${vialProduct.slug}-${choice.variantId}`,
  productSlug: vialProduct.slug,
  variantId: choice.variantId,
  name: [String(vialProduct.name || '').trim(), choice.label].filter(Boolean).join(' — '),
  size: choice.label,
  category: vialProduct.category || '',
  tags: [FREE_VIAL_TAG],
  priceNumber: 0,
  price: FREE_VIAL_PRICE_LABEL,
  quantity: FREE_VIALS_PER_ORDER,
  maxStock: choice.stock,
});

export default isFreeVialProduct;
