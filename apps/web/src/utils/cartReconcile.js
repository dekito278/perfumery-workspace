// Pure cart-line reconciliation — no aliases, no browser APIs, so it runs in node for the self-check.
import { formatRupiah } from './voucherValidation.js';

// Cart lines are a snapshot taken at add-to-cart time: price, stock cap and image are frozen in
// localStorage and were never revisited, so a cart left open for a week checked out at last week's price
// and the storefront's stock cap was always 0 (public products carry no stock) — the quantity stepper's
// cap was dead code. Reconcile against the live catalog every time the cart is read (audit round 7).
export const reconcileCartLines = (items = [], catalog = []) => {
  if (!catalog.length) return items;

  return items.map((item) => {
    const product = catalog.find((entry) => (
      entry.slug === item.productSlug || entry.slug === item.slug || entry.id === item.productId
    ));
    if (!product) return item;

    const variant = (product.variants || []).find((option) => (
      option.id === item.variantId || option.size === item.size
    )) || product.variants?.[0];
    const livePrice = Number(variant?.priceNumber ?? product.priceNumber ?? 0);
    const liveStock = Number(variant?.stock ?? product.stock ?? 0);
    const storedPrice = Number(item.priceNumber || 0);

    return {
      ...item,
      category: product.category || item.category,
      images: product.images,
      imageUrl: product.imageUrl,
      visual: product.visual,
      ...(livePrice > 0 ? {
        priceNumber: livePrice,
        price: formatRupiah(livePrice),
        priceChanged: storedPrice > 0 && livePrice !== storedPrice,
        previousPriceNumber: storedPrice,
      } : {}),
      maxStock: liveStock,
      quantity: liveStock > 0 ? Math.min(Number(item.quantity || 1), liveStock) : Number(item.quantity || 1),
    };
  });
};
