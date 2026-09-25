import { useEffect, useMemo, useState } from 'react';
import {
  addCartItem,
  clearCart,
  getCartItems,
  getCartSummary,
  reconcileCartLines,
  removeCartItem,
  updateCartQuantity,
} from '@/services/cartService.js';
import { useStorefrontProducts, useTierPrices } from '@/hooks/useStorefrontProducts.js';
import { useStorefrontRegion } from '@/hooks/useStorefrontRegion.js';
import { useShippingRegion } from '@/hooks/useShippingRegion.js';
import { internationalPriceFor } from '@/utils/internationalDestination.js';
import { tierPricesForLine } from '@/utils/tierPrice.js';
import { formatRupiah } from '@/services/productCatalogService.js';

export const useCart = () => {
  const [storedItems, setStoredItems] = useState(getCartItems);
  const catalog = useStorefrontProducts();
  // Everything downstream — the cart page, the summary, and the order the buyer is charged for — reads
  // the reconciled lines, so a stale localStorage cart cannot carry an old price or a dead stock cap.
  // Which shop is being read, and which of the two international prices it quotes. The cart has to total
  // the SAME number the product page showed — a page quoting Rp 790.000 over a cart totalling Rp 359.000
  // is the exact contradiction that kept the English shop cart-less.
  const { isInternational } = useStorefrontRegion();
  const shippingRegion = useShippingRegion();
  const { index: tierIndex } = useTierPrices();

  const items = useMemo(() => {
    const lines = reconcileCartLines(storedItems, catalog);
    if (!isInternational) return lines;

    return lines.map((line) => {
      const product = catalog.find((entry) => entry.slug === (line.productSlug || line.slug));
      if (!product) return line;
      const variant = (product.variants || []).find((option) => (
        option.id === line.variantId || option.size === line.size
      )) || product.variants?.[0];
      // RETAIL, never the member price: applyTierPrices lowers priceNumber for a signed-in member and
      // keeps the original here. Multiplying a domestic loyalty discount into an export price is the bug
      // that made the same bottle cheaper abroad the moment someone logged in.
      const retail = Number(
        variant?.retailPriceNumber ?? variant?.priceNumber ?? product.retailPriceNumber ?? product.priceNumber ?? 0,
      );
      const international = internationalPriceFor({
        tierPrices: tierPricesForLine(tierIndex, product.slug, variant?.id || ''),
        linePrice: retail,
        region: shippingRegion,
      });
      // No international price means the ONLY number this line has is the Indonesian one, and
      // api/orders/create.js refuses to write an order carrying it. Returning the line unchanged left
      // the domestic price on screen for a buyer in Berlin, who filled in the whole form and was then
      // answered with the endpoint's sanitised "Pesanan belum bisa dibuat" — a sentence naming nothing.
      // Blocked and named here instead, where it is still one tap to remove it. Reaches the checkout
      // through the same blockedItems path as a sold-out bottle.
      if (!international) return { ...line, unavailable: true, noInternationalPrice: true };
      return { ...line, priceNumber: international, price: formatRupiah(international) };
    });
  }, [storedItems, catalog, isInternational, shippingRegion, tierIndex]);

  useEffect(() => {
    const syncCart = () => setStoredItems(getCartItems());
    window.addEventListener('storage', syncCart);
    window.addEventListener('dekito:cart-updated', syncCart);
    syncCart();

    return () => {
      window.removeEventListener('storage', syncCart);
      window.removeEventListener('dekito:cart-updated', syncCart);
    };
  }, []);

  const summary = useMemo(() => getCartSummary(items), [items]);

  return {
    items,
    summary,
    addItem: (product, quantity) => setStoredItems(addCartItem(product, quantity)),
    updateQuantity: (slug, quantity) => setStoredItems(updateCartQuantity(slug, quantity)),
    removeItem: (slug) => setStoredItems(removeCartItem(slug)),
    clear: () => {
      clearCart();
      setStoredItems([]);
    },
  };
};
