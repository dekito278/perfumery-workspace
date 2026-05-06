import { useEffect, useMemo, useState } from 'react';
import {
  addCartItem,
  clearCart,
  getCartItems,
  getCartSummary,
  removeCartItem,
  updateCartQuantity,
} from '@/services/cartService.js';

export const useCart = () => {
  const [items, setItems] = useState(getCartItems);

  useEffect(() => {
    const syncCart = () => setItems(getCartItems());
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
    addItem: (product, quantity) => setItems(addCartItem(product, quantity)),
    updateQuantity: (slug, quantity) => setItems(updateCartQuantity(slug, quantity)),
    removeItem: (slug) => setItems(removeCartItem(slug)),
    clear: () => {
      clearCart();
      setItems([]);
    },
  };
};
