// What we CHARGE for an international parcel: the carrier's cost for its weight, less what SOLIVAGANT
// carries.
//
// Separate from exportShipping.js on purpose. That file answers "what will the carrier bill us" for an
// arbitrary weight and address, with the remote-area fee and the rest. This one answers "what does the
// buyer pay" for a count of bottles, which is a published rule — see internationalShippingRates.js for
// the rule and for why it replaced a hand-written card.
//
// The limits are answers, not gaps: more than six bottles, and any destination the carrier's zone sheet
// does not name, are quoted on request. Returning a number there would be inventing a price.
import { EXPORT_PACKAGE_RATES } from '@/data/exportRates.js';
import {
  SHIPPING_COST_RATE,
  SHIPPING_RATE_MAX_BOTTLES,
  SHIPPING_RATE_TIERS,
  SHIPPING_SUPPORT_USD,
  shippingRateRegionFor,
  shippingZoneFor,
} from '@/data/internationalShippingRates.js';

export const QUOTE_ON_REQUEST = 'on_request';

/** Whole dollars on a US$5 step, rounded UP — a cost rounded down is a cost understated. */
const up5 = (usd) => Math.ceil(usd / 5) * 5;

/** The bracket a bottle count ships in, or null past the last one. */
export const shippingTierFor = (bottles) => (
  SHIPPING_RATE_TIERS.find((tier) => bottles <= tier.maxBottles) || null
);

/** What SOLIVAGANT carries, by count: one bottle, or two and more. */
export const shippingSupportUsd = (bottles) => (
  bottles >= 2 ? SHIPPING_SUPPORT_USD.multiple : SHIPPING_SUPPORT_USD.single
);

/** The carrier's rupiah for a zone at a weight bracket, straight off the PACKAGE table. */
export const shippingCostIdr = (zone, kg) => {
  const row = EXPORT_PACKAGE_RATES.find((entry) => entry[0] === kg);
  const idr = row ? Number(row[zone]) : 0;
  return Number.isFinite(idr) && idr > 0 ? idr : 0;
};

/**
 * @returns null for a domestic or empty destination; otherwise
 *   { region, regionLabel, zone, tierLabel, bottles, costIdr, costUsd, supportUsd, usd }   — a price
 *   { region, regionLabel, zone, bottles, usd: null, onRequest: 'bottles' | 'destination' }
 */
export const quoteInternationalShippingPrice = ({ countryCode, bottles } = {}) => {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!code || code === 'ID') return null;

  const zone = shippingZoneFor(code);
  const region = shippingRateRegionFor(code);
  // A count below one is an empty form, not an order — quote the smallest parcel rather than nothing, so
  // the page has a number to show before the first line is filled in.
  const count = Math.max(1, Math.round(Number(bottles) || 0));

  if (!zone || !region) {
    return { region: null, regionLabel: '', zone: null, bottles: count, usd: null, onRequest: 'destination' };
  }

  const tier = shippingTierFor(count);
  if (!tier || count > SHIPPING_RATE_MAX_BOTTLES) {
    return { region: region.key, regionLabel: region.label, zone, bottles: count, usd: null, onRequest: 'bottles' };
  }

  const costIdr = shippingCostIdr(zone, tier.kg);
  const costUsd = up5(costIdr / SHIPPING_COST_RATE);
  const supportUsd = shippingSupportUsd(count);
  return {
    region: region.key,
    regionLabel: region.label,
    zone,
    tierLabel: tier.label,
    bottles: count,
    costIdr,
    costUsd,
    supportUsd,
    usd: costUsd - supportUsd,
  };
};

/** Whole dollars, the way the shop prints them. */
export const formatShippingUsd = (usd) => (
  Number.isFinite(Number(usd)) && Number(usd) > 0 ? `US$${Math.round(Number(usd))}` : ''
);
