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
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';

export const useCart = () => {
  const [storedItems, setStoredItems] = useState(getCartItems);
  const catalog = useCatalogProducts();
  // Everything downstream — the cart page, the summary, and the order the buyer is charged for — reads
  // the reconciled lines, so a stale localStorage cart cannot carry an old price or a dead stock cap.
  const items = useMemo(() => reconcileCartLines(storedItems, catalog), [storedItems, catalog]);

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
