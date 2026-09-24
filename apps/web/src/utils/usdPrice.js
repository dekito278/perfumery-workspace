// The dollar price an international buyer actually pays.
//
// This used to be an approximation, and was labelled as one everywhere it appeared: one constant rate,
// a rounded number, "approx. US$76" over the rupiah figure that would really be charged. That was honest
// while the rupiah was the amount being charged.
//
// It stopped being honest on 2026-09-24, when Dekito decided international buyers pay in USD into his
// Jenius USD account. The dollar figure is now THE amount transferred — the rupiah underneath is the
// reference, not the charge — and a headline marked "approx." on a page that then asks for an exact
// transfer is the worst of both.
//
// So: one rate, set by hand, rounded UP to a clean price point.
//
// ROUNDING UP IS THE SAFETY PROPERTY, not a styling choice. The rate below is deliberately under the
// market — Jenius quoted 17.888 the day this was written — so a dollar buys fewer rupiah on paper than
// it really does, and rounding up adds to that. Both cushions point the same way: what lands in the
// account is never less than the rupiah price, which leaves room for the $15-25 an intermediary bank
// can take out of an international transfer without asking anyone.
//
// Import-free so the guard runs the arithmetic instead of reading it.

/**
 * Rupiah per dollar used to SET PRICES — deliberately not the market rate.
 *
 * Kept separate from the display rate in overseasVisitor.js on purpose: that one exists to show a rough
 * figure next to a rupiah price and may be corrected toward the market at any time. This one decides
 * what a buyer is asked to send, so it moves only when Dekito moves it.
 */
export const USD_PRICE_RATE = 16500;
export const USD_PRICE_RATE_SET_ON = '2026-09-24';

/** Prices land on a multiple of this. $76 is a conversion; $80 is a price. */
export const USD_PRICE_STEP = 5;

/**
 * @returns whole dollars on a $5 step, or null when there is no price to convert. Null means "say
 *   nothing", never "free".
 */
export const usdPriceFor = (rupiah, rate = USD_PRICE_RATE) => {
  const amount = Number(rupiah);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  // The rate is an argument so an order can be re-totalled at the rate IT was written with. When the
  // freight is added days later, the goods half of the total must not move because the market did —
  // the buyer agreed to a dollar figure for the bottles, and only the shipping is new.
  const applied = Number(rate) > 0 ? Number(rate) : USD_PRICE_RATE;
  const exact = amount / applied;
  const rounded = Math.ceil(exact / USD_PRICE_STEP) * USD_PRICE_STEP;
  return rounded > 0 ? rounded : null;
};

/** The way it is written wherever it is shown. */
export const formatUsdPrice = (rupiah) => {
  const usd = usdPriceFor(rupiah);
  return usd ? `US$${usd}` : '';
};
