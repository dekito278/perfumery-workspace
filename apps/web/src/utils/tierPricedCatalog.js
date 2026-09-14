// Rewriting a catalog's prices to what one visitor is entitled to pay. Import-free apart from the
// shared pricing rule, so it can be exercised directly by a selfcheck instead of only being read as
// source — this decides what a buyer is quoted, and reading it is not the same as running it.
import { resolveTierPrice, tierPricesForLine } from './tierPrice.js';
import { carryCatalogFlags } from './catalogArrayFlags.js';

/**
 * @param products    the catalog, as normalizeProduct leaves it
 * @param tier        the visitor's tier, resolved by the server from their session
 * @param index       tier prices by slug/variant, from storefront_prices_for_me
 * @param formatPrice the app's own Rupiah formatter — passed in rather than reimplemented, so the
 *                    rewritten `price` string cannot drift from every other price on the page
 *
 * Returns the array it was given, by reference, when nothing applies. Before the migration runs that
 * is always, so the storefront behaves exactly as it does today — no re-render, no near-miss copy.
 */
export const applyTierPrices = (products = [], tier = 'retail', index = {}, formatPrice = String) => {
  if (!products.length || !index || !Object.keys(index).length) return products;

  let changed = false;
  const priced = products.map((product) => {
    const priceFor = (retailPrice, variantId) => resolveTierPrice({
      retailPrice,
      tierPrices: tierPricesForLine(index, product.slug, variantId),
      tier,
      // overseas is a destination, not a visitor. Those orders are quoted by hand and never priced here.
      overseas: false,
    });

    const originalVariants = Array.isArray(product.variants) ? product.variants : [];
    const variants = originalVariants.map((variant) => {
      const retailPrice = Number(variant.priceNumber || 0);
      const price = priceFor(retailPrice, variant.id || '');
      if (price === retailPrice) return variant;
      return { ...variant, priceNumber: price, price: formatPrice(price), retailPriceNumber: retailPrice };
    });

    // A card reads the product's price and the detail page reads the first variant's, so when the first
    // variant gets a tier price the product has to follow it — one bottle, one price.
    //
    // Only THEN, though. Some rows carry a product price that already disagrees with variant[0] (saved
    // before the form made variants authoritative). Rewriting those here would change a retail
    // visitor's price with no tier price in sight — the bug this guard's first assertion caught.
    const retailPrice = Number(product.priceNumber || 0);
    let price = retailPrice;
    if (originalVariants.length) {
      if (variants[0] !== originalVariants[0]) price = Number(variants[0].priceNumber || retailPrice);
    } else {
      price = priceFor(retailPrice, '');
    }

    if (price === retailPrice && variants.every((variant, i) => variant === originalVariants[i])) return product;
    changed = true;
    return {
      ...product,
      variants,
      priceNumber: price,
      price: formatPrice(price),
      retailPriceNumber: retailPrice,
      // Reaching here means a price on this product moved — the product's own or one variant's. The tag
      // belongs on the product either way, or a member price that exists only on the 50 ml goes
      // unexplained on the page that applies it.
      priceTier: tier,
    };
  });

  if (!changed) return products;
  // useCatalogProducts hangs non-enumerable flags off its array — `loading`, which pages read to tell
  // "empty shop" from "not loaded yet", and `stale`. Mapping drops them, so they are carried across.
  return carryCatalogFlags(priced, products);
};
