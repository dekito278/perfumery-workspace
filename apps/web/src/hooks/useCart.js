import { useEffect, useMemo, useState } from 'react';
import {
  CART_ITEM_ADDED_EVENT,
  addCartItem,
  clearCart,
  getCartItems,
  getCartSummary,
  reconcileCartLines,
  removeCartItem,
  setFreeVialCartItem,
  updateCartQuantity,
} from '@/services/cartService.js';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import { dropUnfulfillableGift } from '@/utils/freeVial.js';

export const useCart = () => {
  const [storedItems, setStoredItems] = useState(getCartItems);
  const catalog = useStorefrontProducts();
  // Everything downstream — the cart page, the summary, and the order the buyer is charged for — reads
  // the reconciled lines, so a stale localStorage cart cannot carry an old price or a dead stock cap.
  // A gift whose aroma ran out is dropped here rather than carried: it would otherwise block checkout,
  // raise an "unavailable" alert about a line that is not in the list, and fail the order's inventory
  // deduction. A BOUGHT line that ran out is kept and flagged — the buyer has to be told before they pay.
  const items = useMemo(
    () => dropUnfulfillableGift(reconcileCartLines(storedItems, catalog)),
    [storedItems, catalog],
  );

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
    // Announced here rather than inside addCartItem: the customer portal's "Pesan lagi" calls that
    // writer directly, in a loop, and then navigates — a gift prompt popping up mid-reorder would be
    // asking about a basket the buyer is already being carried away from.
    addItem: (product, quantity) => {
      setStoredItems(addCartItem(product, quantity));
      window.dispatchEvent(new CustomEvent(CART_ITEM_ADDED_EVENT));
    },
    updateQuantity: (slug, quantity) => setStoredItems(updateCartQuantity(slug, quantity)),
    removeItem: (slug) => setStoredItems(removeCartItem(slug)),
    // The gift replaces itself rather than stacking; `null` takes it out.
    setGift: (item) => setStoredItems(setFreeVialCartItem(item)),
    clear: () => {
      clearCart();
      setStoredItems([]);
    },
  };
};
