// What we CHARGE for an international parcel, from the published rate card.
//
// Separate from exportShipping.js on purpose. That file answers "what will the carrier bill us" — a cost,
// in rupiah, per kilo, and blank for any country nobody has measured. This one answers "what does the
// buyer pay", which the owner has already decided and printed: a region, a bottle count, a dollar figure.
//
// The card's own limits are answers, not gaps: 7 bottles or more, and any destination it does not list,
// are quoted on request. Returning a number there would be inventing a price the shop never published.
import {
  SHIPPING_RATE_MAX_BOTTLES,
  SHIPPING_RATE_TIERS,
  shippingRateRegionFor,
} from '@/data/internationalShippingRates.js';

export const QUOTE_ON_REQUEST = 'on_request';

/**
 * @returns null for a domestic or empty destination; otherwise
 *   { region, regionLabel, tierLabel, bottles, usd }            — a price from the card
 *   { region, regionLabel, bottles, usd: null, onRequest: 'bottles' | 'destination' }
 */
export const quoteInternationalShippingPrice = ({ countryCode, bottles } = {}) => {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!code || code === 'ID') return null;

  const region = shippingRateRegionFor(code);
  // A count below one is an empty form, not an order — quote the smallest parcel the card describes
  // rather than nothing, so the page has a number to show before the first line is filled in.
  const count = Math.max(1, Math.round(Number(bottles) || 0));

  if (!region) {
    return { region: null, regionLabel: '', bottles: count, usd: null, onRequest: 'destination' };
  }

  const tierIndex = SHIPPING_RATE_TIERS.findIndex((tier) => count <= tier.maxBottles);
  if (tierIndex < 0 || count > SHIPPING_RATE_MAX_BOTTLES) {
    return { region: region.key, regionLabel: region.label, bottles: count, usd: null, onRequest: 'bottles' };
  }

  return {
    region: region.key,
    regionLabel: region.label,
    tierLabel: SHIPPING_RATE_TIERS[tierIndex].label,
    bottles: count,
    usd: region.usd[tierIndex],
  };
};

/** Whole dollars, the way the card prints them. */
export const formatShippingUsd = (usd) => (
  Number.isFinite(Number(usd)) && Number(usd) > 0 ? `US$${Math.round(Number(usd))}` : ''
);
