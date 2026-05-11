export const CART_STORAGE_KEY = 'dekito.storefront.cart.v1';

export const MANUAL_TRANSFER_PAYMENT = {
  id: 'manual_transfer_bca',
  provider: 'manual_transfer_bca',
  label: 'Transfer manual BCA',
  shortLabel: 'BCA Transfer',
  bankName: 'BCA',
  accountNumber: '7401775441',
  accountName: 'Ade Rizki Wiranto',
  description: 'Transfer sesuai total bayar, lalu admin akan konfirmasi manual.',
};

export const checkoutPaymentMethods = [
  MANUAL_TRANSFER_PAYMENT,
  {
    id: 'doku',
    provider: 'doku',
    label: 'DOKU Checkout',
    shortLabel: 'DOKU',
    description: 'Bayar lewat panel DOKU dengan metode pembayaran digital.',
  },
];

export const checkoutPaymentOptions = [
  MANUAL_TRANSFER_PAYMENT.label,
  'DOKU Checkout',
  'WhatsApp confirmation',
  'QRIS payment request',
  'Bank transfer request',
  'Payment link request',
];

export const getCheckoutPaymentMethod = (methodId) => (
  checkoutPaymentMethods.find((method) => method.id === methodId || method.provider === methodId)
  || MANUAL_TRANSFER_PAYMENT
);

export const isManualTransferPayment = (provider) => provider === MANUAL_TRANSFER_PAYMENT.provider || provider === 'manual';

export const getStorefrontWhatsAppNumber = () => String(import.meta.env.VITE_STOREFRONT_WHATSAPP_NUMBER || '')
  .replace(/[^0-9]/g, '');

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
  const cartSlug = product.cartSlug || product.slug;
  const current = items.find((item) => item.productId === product.id && item.slug === cartSlug);
  const maxStock = Number(product.maxStock ?? product.stock ?? 0);
  const nextItems = current
    ? items.map((item) => (
      item.productId === product.id && item.slug === cartSlug
        ? { ...item, quantity: maxStock > 0 ? Math.min(item.quantity + quantity, maxStock) : item.quantity + quantity, maxStock }
        : item
    ))
    : [{
      productId: product.id,
      slug: cartSlug,
      productSlug: product.slug,
      variantId: product.variantId || '',
      name: product.name,
      price: product.price,
      priceNumber: product.priceNumber,
      size: product.size,
      category: product.category,
      notes: product.notes,
      maxStock,
      quantity: maxStock > 0 ? Math.min(quantity, maxStock) : quantity,
    }, ...items];
  writeCart(nextItems);
  return nextItems;
};

export const updateCartQuantity = (slug, quantity) => {
  const nextQuantity = Math.max(Number(quantity || 1), 1);
  const nextItems = readCart().map((item) => (
    item.slug === slug ? { ...item, quantity: item.maxStock > 0 ? Math.min(nextQuantity, Number(item.maxStock)) : nextQuantity } : item
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

export const buildOrderNotes = ({
  deliveryAddress = '',
  deliveryArea = '',
  paymentMethod = 'Manual confirmation',
  shippingSummary = '',
  notes = '',
}) => [
  deliveryAddress ? `Address: ${deliveryAddress}` : '',
  deliveryArea ? `Area: ${deliveryArea}` : '',
  shippingSummary ? `Shipping: ${shippingSummary}` : '',
  paymentMethod ? `Payment: ${paymentMethod}` : '',
  notes ? `Notes: ${notes}` : '',
].filter(Boolean).join('\n');

export const buildCheckoutDraft = ({
  customerName,
  customerCode = '',
  contact,
  deliveryAddress = '',
  deliveryArea = '',
  paymentMethod = 'Manual confirmation',
  shippingSummary = '',
  shippingFee = 0,
  notes,
  items,
}) => {
  const { quantity, subtotal } = getCartSummary(items);
  const total = subtotal + Number(shippingFee || 0);
  const lines = items.map((item) => `- ${item.name} (${item.size}) x${item.quantity}: ${item.price}`);
  return [
    'Solivagant order draft',
    '',
    `Customer: ${customerName || '-'}`,
    customerCode ? `Customer code: ${customerCode}` : '',
    `Contact: ${contact || '-'}`,
    `Address: ${deliveryAddress || '-'}`,
    `Area: ${deliveryArea || '-'}`,
    `Shipping: ${shippingSummary || '-'}`,
    `Payment: ${paymentMethod || 'Manual confirmation'}`,
    '',
    'Items:',
    ...lines,
    '',
    `Total items: ${quantity}`,
    `Subtotal: Rp ${new Intl.NumberFormat('id-ID').format(subtotal)}`,
    shippingFee ? `Shipping fee: Rp ${new Intl.NumberFormat('id-ID').format(Number(shippingFee))}` : '',
    `Total: Rp ${new Intl.NumberFormat('id-ID').format(total)}`,
    notes ? `Notes: ${notes}` : 'Notes: -',
  ].filter((line) => line !== '').join('\n');
};

export const buildWhatsAppCheckoutUrl = (message, phoneNumber = getStorefrontWhatsAppNumber()) => {
  const text = encodeURIComponent(message);
  return phoneNumber ? `https://wa.me/${phoneNumber}?text=${text}` : `https://wa.me/?text=${text}`;
};

