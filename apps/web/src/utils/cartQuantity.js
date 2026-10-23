// What the + button is allowed to do.
//
// Pure and import-free so the self-check can run the real thing rather than a copy of it.
//
// THE CAP WAS ALREADY WRITTEN AND WAS ALREADY DEAD. cartService.updateCartQuantity clamps with
// `item.maxStock > 0 ? Math.min(...) : nextQuantity`, reading maxStock off the line in localStorage —
// where it is 0, because public product rows carry no stock and that is what add-to-cart stored. So the
// clamp never fired. Measured on production 2026-10-23 with Jason Voorhees, two bottles in stock: three
// presses of + wrote quantity 3 to storage.
//
// Nothing was oversold. reconcileCartLines caps the quantity again when the cart is READ, against the
// live catalogue, so the page showed 2 and the subtotal was Rp 718.000 — two bottles. The endpoint
// checks stock as well. What the buyer saw was a button that did nothing, with no word about why, on
// the last screen before they pay.
//
// The live number only exists on the reconciled line the page renders, so the cap has to be applied
// where that line is — which is why this takes a line and not a slug.

/** 0 or missing means "no cap known", which is the international cart and must stay unlimited. */
const capOf = (line) => Math.max(0, Math.round(Number(line?.maxStock) || 0));

export const quantityOf = (line) => Math.max(1, Math.round(Number(line?.quantity) || 1));

/** The quantity one press of + should produce. Never above the stock the catalogue reports. */
export const nextQuantityUp = (line) => {
  const cap = capOf(line);
  const next = quantityOf(line) + 1;
  return cap > 0 ? Math.min(next, cap) : next;
};

/** True when + can do nothing more, so the control can say so instead of swallowing the press. */
export const atStockCap = (line) => {
  const cap = capOf(line);
  return cap > 0 && quantityOf(line) >= cap;
};
