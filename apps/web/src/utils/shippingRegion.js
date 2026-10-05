// The international price of one line.
//
// This file used to hold a split: Southeast Asia at 2.2x retail, the rest of the world at the hand-set
// 3.5x, decided first from the browser's clock and then from the destination the buyer picked. Dekito
// retired the split on 2026-10-06. Looking at the numbers with the carrier's cost beside them, the
// neighbours' price left almost nothing above the Indonesian retail once the parcel was paid for — "saya
// mau untung, gak mau sama kayak di Indonesia" — and the thing the lower price was for, a total that does
// not frighten a buyer in Kuala Lumpur, is now done by the SHIPPING line instead: Singapore pays the
// least to ship to, so Singapore still pays the least in total, with the bottle at the same price
// everywhere. See internationalShippingRates.js.
//
// So there is one international price, and it is the one Dekito set by hand.

/**
 * The hand-set international price for a line, or null when none is set.
 *
 * Null rather than a guess: a product with no export price has not been priced for export, and inventing
 * one from the domestic price is the thing OverseasPriceNote and CardPrice exist to refuse. The price
 * must also exceed the retail line, because an "export price" below retail is a data-entry slip, not a
 * discount.
 */
export const internationalPriceFor = ({ tierPrices = {}, linePrice = 0 } = {}) => {
  const world = Number(tierPrices?.overseas) || 0;
  const line = Number(linePrice) || 0;
  return world && line && world > line ? world : null;
};

/*
 * There is no longer a `shippingIncludedFor`, and its absence is the rule.
 *
 * It read `rayspeedServes(country)` and meant "the price already carries the freight". The arithmetic
 * behind that only ever worked on a full parcel: the carrier bills a one-kilo minimum, so ONE 30 ml
 * bottle to the United States costs as much to send as two. The promise was measured on the full parcel
 * and quietly applied to the single bottle.
 *
 * Dekito's decision, 2026-09-25, on a live American order for a single bottle: shipping is charged, to
 * every destination. Since 2026-10-06 the charge is derived from the carrier's rate less a fixed support
 * (internationalShippingRates.js). Nothing in the shop may say the freight is included —
 * internationalShippingPrice.selfcheck holds that across the copy.
 */
