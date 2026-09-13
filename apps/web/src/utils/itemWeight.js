// What one bottle actually weighs, shipped. Measured by Dekito on 2026-09-13.
//
// Import-free so the browser and the order endpoint (plain node) share one table. They MUST: the browser
// quotes a shipping cost from this and the endpoint reprices the order from it, and a buyer shown one
// courier fee and charged another is the same class of bug as a price that moves at checkout.
//
// Before this, every size was assumed to be 300 g. That over-weighed a 10 ml by three times and
// under-weighed a 100 ml by more than half — the second one costs Dekito money on every large parcel,
// and export rates are steep enough that it mattered most exactly where it was most wrong.

/** Grams per bottle, by nominal size in millilitres. */
export const ITEM_WEIGHT_GRAM_BY_ML = {
  10: 100,
  30: 250,
  50: 350,
  100: 650,
};

// The flat weight this repo used everywhere. Still the answer for a size that is not in the table, so a
// product with an unusual size behaves exactly as it did before rather than getting a number nobody
// weighed. Kept in sync with VITE_DEFAULT_ITEM_WEIGHT_GRAM / DEFAULT_ITEM_WEIGHT_GRAM by build.mjs.
export const DEFAULT_ITEM_WEIGHT_GRAM = 300;

/** The millilitres in a size label ("30 ml", "30ml", "Botol 100 ml"), or null when there are none. */
export const parseSizeMl = (size) => {
  const match = String(size ?? '').match(/(\d+(?:[.,]\d+)?)\s*ml/i);
  if (!match) return null;
  const ml = Number(match[1].replace(',', '.'));
  return Number.isFinite(ml) && ml > 0 ? ml : null;
};

/** One item's shipping weight in grams. Unknown sizes fall back rather than being guessed at. */
export const itemWeightGram = (size, fallback = DEFAULT_ITEM_WEIGHT_GRAM) => {
  const ml = parseSizeMl(size);
  const known = ml === null ? undefined : ITEM_WEIGHT_GRAM_BY_ML[ml];
  return known ?? (Number(fallback) > 0 ? Number(fallback) : DEFAULT_ITEM_WEIGHT_GRAM);
};

/** Whether this size was actually weighed, as opposed to falling back. Surfaced in Studio, not hidden. */
export const isWeighedSize = (size) => {
  const ml = parseSizeMl(size);
  return ml !== null && ITEM_WEIGHT_GRAM_BY_ML[ml] !== undefined;
};

/**
 * Total shipping weight for a set of lines, each `{ size, quantity }`.
 *
 * Never returns zero: a courier quote asked for 0 g comes back as either an error or a suspiciously
 * cheap rate. But the fallback applies ONLY to an empty total — as a minimum weight it would round a
 * single 10 ml bottle (100 g) up to 300 g and overcharge the lightest orders, which is the mistake the
 * old `Math.max(quantity * w, w)` never made because its floor could only bind at quantity zero.
 */
export const totalItemWeightGram = (items = [], fallback = DEFAULT_ITEM_WEIGHT_GRAM) => {
  const total = (Array.isArray(items) ? items : []).reduce((sum, item) => {
    const quantity = Math.max(0, Math.round(Number(item?.quantity) || 0));
    return sum + quantity * itemWeightGram(item?.size, fallback);
  }, 0);
  if (total > 0) return total;
  return Number(fallback) > 0 ? Number(fallback) : DEFAULT_ITEM_WEIGHT_GRAM;
};
