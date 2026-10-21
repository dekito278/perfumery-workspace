// The discovery vials that ship with an international order, on the house.
//
// A COUNT, not a choice. The atelier picks the scents at packing — Dekito's brief, §7 — which is the
// opposite of the domestic FreeVialPicker, where the buyer chooses one. That difference is deliberate:
// an overseas parcel is packed once, by hand, and a buyer three time zones away picking five scents
// from eighteen is a conversation nobody wanted.
//
// Import-free so the guard runs the arithmetic instead of reading it.

/** 3 ml, Dekito's own size (2026-10-21). The domestic gift vial is a different product at 2 ml. */
export const GIFT_VIAL_SIZE_ML = 3;

/**
 * US$9 for a 3 ml vial.
 *
 * NOT a figure I chose: the brief prices a 5 ml vial at US$15, which is US$3 per millilitre, and this is
 * that same rate at the size Dekito settled on. Change the size and this moves with it; change the rate
 * and it is one number here.
 */
export const GIFT_VIAL_VALUE_USD = 9;

/** How many bottles buy how many vials. Ascending, and the last band has no ceiling. */
export const GIFT_VIAL_BANDS = [
  { minBottles: 1, vials: 3 },
  { minBottles: 2, vials: 5 },
  { minBottles: 3, vials: 8 },
];

/**
 * @param bottles  paid 30 ml bottles on the order — not lines, and not the vials themselves
 * @returns the number of free vials, 0 for an empty order. Never negative, never fractional.
 */
export const giftVialsFor = (bottles) => {
  const count = Math.floor(Number(bottles) || 0);
  if (!Number.isFinite(count) || count < 1) return 0;
  let vials = 0;
  for (const band of GIFT_VIAL_BANDS) {
    if (count >= band.minBottles) vials = band.vials;
  }
  return vials;
};

/** The line as it appears in a quote and on an invoice: a quantity, a size, and no price. */
export const giftVialLine = (bottles) => {
  const vials = giftVialsFor(bottles);
  if (!vials) return '';
  return `Gift vials: ${vials} × ${GIFT_VIAL_SIZE_ML} ml (free)`;
};
