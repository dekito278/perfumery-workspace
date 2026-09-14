// Attaching "what a member would pay" to a catalog WITHOUT changing what this visitor pays.
//
// applyTierPrices rewrites prices for the tier the server says the visitor is on. This does the other
// half: for whoever is looking, note beside each price the member price that exists for it — so the
// storefront can say "Member Rp 299.000, masuk dengan Google" to someone who is not a member yet.
//
// It only ever ADDS memberPriceNumber. price and priceNumber are untouched, so nothing here can quote a
// visitor the wrong number — the order endpoint remains the only thing that decides a price.
//
// Silent by construction: a member price that is not strictly lower than the price already on the line
// is not attached. That covers a signed-in member (applyTierPrices already lowered their price to it),
// a member price accidentally set at or above retail, and — for now — every product, since no member
// prices have been filled in yet. Nothing on screen changes until Dekito fills one in.
//
// Import-free apart from the shared tier index helpers, so the guard runs it rather than reads it.
import { tierPricesForLine } from './tierPrice.js';
import { carryCatalogFlags } from './catalogArrayFlags.js';

const toPrice = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/** The member price for one line, or null when there is none or it would not save anything. */
export const memberPriceFor = (index = {}, slug, variantId = '', currentPrice) => {
  const member = toPrice(tierPricesForLine(index, slug, variantId).member);
  const price = toPrice(currentPrice);
  if (member === null || price === null) return null;
  return member < price ? member : null;
};

/**
 * Returns the array it was given, by reference, when no product gains a member price — before the
 * migration runs, and until a member price is filled in, that is always.
 */
export const attachMemberPrices = (products = [], index = {}) => {
  if (!Array.isArray(products) || !products.length || !index || !Object.keys(index).length) return products;

  let changed = false;
  const next = products.map((product) => {
    const originalVariants = Array.isArray(product.variants) ? product.variants : [];
    const variants = originalVariants.map((variant) => {
      const member = memberPriceFor(index, product.slug, variant.id || '', variant.priceNumber);
      return member === null ? variant : { ...variant, memberPriceNumber: member };
    });

    // The card reads the product's price; the detail page reads the chosen variant's. The product
    // follows its first variant when that has one, otherwise its own product-level row — the same rule
    // applyTierPrices uses, so "Member Rp X" on a card and on the page it opens agree.
    let productMember = null;
    if (originalVariants.length) {
      productMember = variants[0]?.memberPriceNumber ?? null;
    } else {
      productMember = memberPriceFor(index, product.slug, '', product.priceNumber);
    }

    const variantsChanged = variants.some((variant, i) => variant !== originalVariants[i]);
    if (productMember === null && !variantsChanged) return product;
    changed = true;
    return {
      ...product,
      variants: variantsChanged ? variants : originalVariants,
      ...(productMember === null ? {} : { memberPriceNumber: productMember }),
    };
  });

  if (!changed) return products;
  return carryCatalogFlags(next, products);
};

/**
 * What the whole cart would save at member prices — the number that goes on the checkout sign-in button.
 *
 * Keyed by productSlug, NOT slug: a cart line's `slug` is the cartSlug (product slug + variant suffix),
 * which matches nothing in the member index. Keying by the wrong one would make every saving read 0 and
 * the button would silently keep saying "data terisi otomatis" forever.
 *
 * Only lines where the member price is strictly lower count, so a signed-in member (whose lines already
 * carry member prices) and a cart with no member-priced products both come out at 0 — and 0 means the
 * caller keeps its ordinary copy.
 */
export const memberSavingForCart = (items = [], index = {}) => {
  if (!Array.isArray(items) || !items.length || !index || !Object.keys(index).length) return 0;
  let saving = 0;
  for (const item of items) {
    const slug = String(item?.productSlug || '').trim();
    if (!slug) continue;
    const member = memberPriceFor(index, slug, item?.variantId || '', item?.priceNumber);
    if (member === null) continue;
    const quantity = Math.max(Number(item?.quantity) || 0, 0);
    saving += (Number(item.priceNumber) - member) * quantity;
  }
  return saving > 0 ? Math.round(saving) : 0;
};
