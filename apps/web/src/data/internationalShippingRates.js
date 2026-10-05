// SOLIVAGANT international shipping — what the BUYER pays, derived from what the carrier bills us.
//
// This file used to be a hand-written card: five regions, 57 countries, three dollar figures each,
// transcribed from a sheet Dekito published on 2026-09-24. On 2026-10-06 he put the card next to the
// carrier's own rate sheet and found two things. Every figure on the card was the carrier's cost PLUS
// about ten percent — a margin on freight, when his actual practice was the opposite: US$65 to the United
// States against a US$95 cost, the difference paid out of the bottle's export margin. And Iceland sat in
// the card's "Europe" group at US$140 while the carrier bills it as zone 8, US$155, so the card lost
// money there before any subsidy at all.
//
// So the card is gone and the RULE is here instead. Shipping is the carrier's rate for the parcel's
// weight bracket, in dollars, minus a fixed amount SOLIVAGANT carries. That is one sentence a buyer can
// be told, one number a guard can hold, and it prices every one of the 233 destinations the carrier's
// zone sheet names — not 57.
//
// Dekito's decision, 2026-10-06. The cost side (exportZones.js, exportRates.js) is the carrier's sheet,
// transcribed; nothing here is interpolated.

import { EXPORT_ZONE_BY_COUNTRY } from '@/data/exportZones.js';

export const SHIPPING_RATES_EFFECTIVE_YEAR = 2026;

/** The rule is written for 30 ml bottles — the only size in the shop, and the size the weights assume. */
export const SHIPPING_RATE_BOTTLE_SIZE_ML = 30;

/** Past this many bottles the shop stops quoting and asks: packing, and the carrier's dangerous-goods
 *  rules for a case of alcohol-based perfume, are a conversation rather than a formula. */
export const SHIPPING_RATE_MAX_BOTTLES = 6;

/**
 * Rupiah per dollar used to turn the carrier's rupiah into the dollars a buyer sees.
 *
 * Deliberately the MARKET rate, not the pricing rate in usdPrice.js. That one is held below the market
 * so a bottle price can never come in under its rupiah; this one converts a COST, and a cost converted
 * at an understated rate looks dearer than it is, which would overstate the subsidy and quietly raise
 * every shipping price. Dekito's own figure — "DHL ke Amerika sekitar $95" — is Rp 1.709.000 at 18.000.
 */
export const SHIPPING_COST_RATE = 18000;

/**
 * What SOLIVAGANT carries on every international shipment, in dollars.
 *
 * Two bottles ride in the same one-kilo parcel as one, so the second bottle's margin can pay for more of
 * the freight: a single bottle is charged the cost less US$30, two or more the cost less US$50. Those
 * are Dekito's own numbers for the United States — US$65 and US$45 against a US$95 cost — made into a
 * rule for every zone. Not a percentage, because "we cover US$30 of your shipping" is a sentence and
 * "we cover 32%" is a calculation.
 */
export const SHIPPING_SUPPORT_USD = { single: 30, multiple: 50 };

/**
 * Bottle counts to the carrier's weight brackets. A packed 30 ml bottle is about half a kilo and the
 * carrier bills a one-kilo minimum, so one bottle and two bottles are the same parcel — "dua botol
 * setara satu kilo", in Dekito's words.
 */
export const SHIPPING_RATE_TIERS = [
  { maxBottles: 2, kg: 1, label: '1–2 bottles' },
  { maxBottles: 4, kg: 2, label: '3–4 bottles' },
  { maxBottles: 6, kg: 3, label: '5–6 bottles' },
];

/**
 * How the destinations are GROUPED for a buyer, with the carrier's zones underneath.
 *
 * The groups are for the picker and the caption; the price comes from the zone, never from the group.
 * That is the correction to the old card, whose "Europe" group priced Iceland (zone 8) at Germany's
 * (zone 7) figure. A group may span two zones — Singapore is zone 1 and Malaysia zone 2 — and the two
 * are priced differently while sitting under one heading.
 *
 * `countries` is DERIVED from the carrier's zone sheet so a destination can never be in two groups and
 * none can be missing: every code the sheet names lands in exactly one group by its zone.
 */
const GROUPS = [
  { key: 'southeast_asia', label: 'Southeast Asia', zones: [1, 2] },
  { key: 'east_asia_oceania', label: 'East Asia & Oceania', zones: [3, 4] },
  { key: 'north_america', label: 'North America', zones: [5] },
  { key: 'middle_east_south_asia', label: 'Middle East & South Asia', zones: [6] },
  { key: 'europe', label: 'Europe & nearby', zones: [7] },
  { key: 'rest_of_world', label: 'Rest of the world', zones: [8] },
];

export const SHIPPING_RATE_REGIONS = GROUPS.map((group) => ({
  ...group,
  countries: Object.entries(EXPORT_ZONE_BY_COUNTRY)
    .filter(([, zone]) => group.zones.includes(zone))
    .map(([code]) => code)
    .sort(),
}));

const REGION_BY_COUNTRY = new Map(
  SHIPPING_RATE_REGIONS.flatMap((region) => region.countries.map((code) => [code, region])),
);

export const shippingRateRegionFor = (countryCode) => (
  REGION_BY_COUNTRY.get(String(countryCode || '').trim().toUpperCase()) || null
);

/** The carrier's zone for a destination, or null for home and for a code the sheet does not name. */
export const shippingZoneFor = (countryCode) => {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!code || code === 'ID') return null;
  return EXPORT_ZONE_BY_COUNTRY[code] || null;
};

/**
 * How long the parcel is in the air, per zone, in WORKING DAYS AFTER DISPATCH — [min, max].
 *
 * Dekito's ask, 2026-10-06: a buyer who opens WhatsApp should already know the shipping and the
 * estimated arrival, not ask for them. The carrier's sheet prints prices and no transit times, so these
 * are the express service's typical ranges from Jakarta by zone — the neighbours in a day or two, Europe
 * within a week, zone 8 up to a fortnight — and they are a PROMISE the shop makes, so they live here as
 * one table he can correct rather than inside a sentence. Counted from dispatch, not from the order:
 * the days between confirming and handing the parcel to the courier are his, and the courier's clock
 * only starts at the counter.
 */
// WIDER THAN THE COURIER'S OWN FIGURES, on purpose. Dekito, 6 Oct 2026: "dikasih gap lebih jauh aja biar
// ekspektasinya gak terlalu tinggi." A parcel that lands a day early is a delighted buyer; one that lands a
// day late is a complaint — so the floor is a day or two later than the express service usually manages,
// and the ceiling leaves room for customs.
export const SHIPPING_TRANSIT_DAYS = { 1: [2, 4], 2: [3, 5], 3: [3, 6], 4: [4, 7], 5: [5, 8], 6: [5, 9], 7: [5, 10], 8: [8, 15] };

/** The conditions that travel with the numbers. */
export const SHIPPING_RATE_NOTES = [
  'Rates are in USD, per shipment, for 30 ml bottles sent by tracked express courier.',
  'Orders of 7 bottles or more are quoted on request.',
  'Import duties, taxes and customs fees in the destination country are paid by the recipient.',
  'A remote-area surcharge may apply to some addresses. We will confirm before shipping.',
  "Please make sure the recipient's name, full address and phone number are correct, as the courier may contact them for delivery or customs clearance.",
];
