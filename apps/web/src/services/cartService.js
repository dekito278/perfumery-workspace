export const CART_STORAGE_KEY = 'dekito.storefront.cart.v1';

const readCart = () => {
  if (typeof window === 'undefined') return [];

  try {
    const value = window.localStorage.getItem(CART_STORAGE_KEY);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    return [];
  }
};

const writeCart = (items) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('dekito:cart-updated'));
};

export const getCartItems = () => readCart();

export const addCartItem = (product, quantity = 1) => {
  const items = readCart();
  const current = items.find((item) => item.productId === product.id && item.slug === product.slug);
  const nextItems = current
    ? items.map((item) => (
      item.productId === product.id && item.slug === product.slug
        ? { ...item, quantity: item.quantity + quantity }
        : item
    ))
    : [{
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      priceNumber: product.priceNumber,
      size: product.size,
      category: product.category,
      notes: product.notes,
      quantity,
    }, ...items];
  writeCart(nextItems);
  return nextItems;
};

export const updateCartQuantity = (slug, quantity) => {
  const nextQuantity = Math.max(Number(quantity || 1), 1);
  const nextItems = readCart().map((item) => (
    item.slug === slug ? { ...item, quantity: nextQuantity } : item
  ));
  writeCart(nextItems);
  return nextItems;
};

export const removeCartItem = (slug) => {
  const nextItems = readCart().filter((item) => item.slug !== slug);
  writeCart(nextItems);
  return nextItems;
};

export const clearCart = () => writeCart([]);

export const getCartSummary = (items) => {
  const quantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const subtotal = items.reduce((sum, item) => sum + Number(item.priceNumber || 0) * Number(item.quantity || 0), 0);
  return { quantity, subtotal };
};

export const buildCheckoutDraft = ({
  customerName,
  contact,
  deliveryAddress = '',
  deliveryArea = '',
  paymentMethod = 'Manual confirmation',
  notes,
  items,
}) => {
  const { quantity, subtotal } = getCartSummary(items);
  const lines = items.map((item) => `- ${item.name} (${item.size}) x${item.quantity}: ${item.price}`);
  return [
    'Dekito Perfumery order draft',
    '',
    `Customer: ${customerName || '-'}`,
    `Contact: ${contact || '-'}`,
    `Address: ${deliveryAddress || '-'}`,
    `Area: ${deliveryArea || '-'}`,
    `Payment: ${paymentMethod || 'Manual confirmation'}`,
    '',
    'Items:',
    ...lines,
    '',
    `Total items: ${quantity}`,
    `Subtotal: Rp ${new Intl.NumberFormat('id-ID').format(subtotal)}`,
    notes ? `Notes: ${notes}` : 'Notes: -',
  ].join('\n');
};
