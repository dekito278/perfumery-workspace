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
    // Left the catalog (deleted, or its slug changed): keep the line so the buyer can see what dropped
    // out, but mark it. Silently keeping it at its stored price meant checkout only failed at the very
    // end, with the endpoint's raw `Unknown product: <slug>` (audit round 9).
    if (!product) return { ...item, unavailable: true, outOfStock: false };

    // Matched exactly the way api/orders/create.js matches: the variant id when the line names one, the
    // size otherwise. It used to be an OR between the two, with variants[0] behind it — so a line whose
    // variant had been deleted matched something else here, was RE-PRICED to that other bottle and given
    // its stock cap, and then hit the endpoint, which refuses any line naming a variant it cannot find.
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const variantRef = item.variantId || item.variant_id || '';
    const variant = variants.find((option) => (
      variantRef ? option.id === variantRef : option.size === item.size
    ));
    // The same answer the endpoint gives, given in the cart instead of at the last step. This is the
    // mirror of the missing-PRODUCT case above, which exists for exactly this reason: checkout used to
    // fail at the very end with a raw English `Unknown product: <slug>`. A missing VARIANT was left
    // doing it — and doing it after quietly showing the buyer another variant's price.
    //
    // It matters most to the gift. The vial is the one product with a variant per aroma, so retiring an
    // aroma is routine; unflagged, every cart holding that gift failed checkout outright instead of
    // dropUnfulfillableGift simply taking the gift back out.
    if (variants.length && !variant) return { ...item, unavailable: true, outOfStock: false };
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
      // Stock 0 used to mean "no cap" everywhere, so a sold-out line kept whatever quantity it had and
      // rode all the way to checkout. Both flags are always written, never left over from a stale line.
      unavailable: false,
      outOfStock: liveStock <= 0,
    };
  });
};
