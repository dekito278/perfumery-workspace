// The two numbers in the international shipping rule that are POLICY rather than arithmetic.
//
// The rule itself does not change: the buyer pays the carrier's rate for the parcel's weight bracket,
// in dollars, minus a fixed amount SOLIVAGANT carries. What Dekito decides is how much he carries, and
// what rate he converts the carrier's rupiah at. Both were constants in a source file until now, which
// meant a change of policy needed me.
//
// The carrier's own sheet stays where it is — exportRates.js is transcribed data, not a decision, and
// it is not editable from a screen for the same reason the price of a stamp is not.
//
// Import-free so the guard runs the arithmetic instead of reading it.

/** What the shop carried, and the rate it converted at, on 2026-10-21 — the live behaviour. */
export const DEFAULT_EXPORT_SHIPPING_POLICY = {
  supportSingleUsd: 30,
  supportMultipleUsd: 50,
  costRateIdr: 18000,
};

const number = (value, fallback) => {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Every field, in range, whatever arrives.
 *
 * The clamps are the ones that keep a typo from pricing a parcel at zero: a negative subsidy would ADD
 * to the carrier's cost, and a rate at or below zero divides the cost into infinity. A subsidy larger
 * than the freight is allowed — that is a free-shipping decision, and quoteInternationalShippingPrice
 * floors the charge at zero rather than paying the buyer.
 */
export const normalizeExportShippingPolicy = (input = {}) => {
  const single = Math.max(0, number(input.supportSingleUsd ?? input.support_single_usd, DEFAULT_EXPORT_SHIPPING_POLICY.supportSingleUsd));
  const multiple = Math.max(0, number(input.supportMultipleUsd ?? input.support_multiple_usd, DEFAULT_EXPORT_SHIPPING_POLICY.supportMultipleUsd));
  const rate = number(input.costRateIdr ?? input.cost_rate_idr, DEFAULT_EXPORT_SHIPPING_POLICY.costRateIdr);
  return {
    supportSingleUsd: Math.round(single),
    supportMultipleUsd: Math.round(multiple),
    // A rate of zero or less is not a cheaper shop, it is a division by nothing.
    costRateIdr: rate > 0 ? Math.round(rate) : DEFAULT_EXPORT_SHIPPING_POLICY.costRateIdr,
  };
};

/** What the shop carries for this many bottles. One bottle, or two and more. */
export const supportUsdFor = (bottles, policy = DEFAULT_EXPORT_SHIPPING_POLICY) => {
  const safe = normalizeExportShippingPolicy(policy);
  return Number(bottles) >= 2 ? safe.supportMultipleUsd : safe.supportSingleUsd;
};
