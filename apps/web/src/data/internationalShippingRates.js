// SOLIVAGANT International Shipping Rates 2026 — the price card Dekito publishes to buyers.
//
// This is a PRICE, not a cost. Everything else international in this repo quotes what a carrier will
// bill US (rayspeedRates.js, exportZones.js): per kilo, in rupiah, measured or blank. This table is the
// other side of the same parcel — what the BUYER is asked to pay, in USD, per shipment, decided by where
// it goes and how many bottles are in it. The two must never be mixed up: one is the floor, the other is
// the promise, and the gap between them is the margin.
//
// Transcribed from the owner's own rate card, handed over 2026-09-24. Nothing here is interpolated. A
// destination or a quantity the card does not cover comes back "quote on request", because that is
// exactly what the card says to do — not a guess dressed up as a rate.

export const SHIPPING_RATES_EFFECTIVE_YEAR = 2026;

/** The card prices for 30 ml bottles. Sizes other than 30 ml are not what the card was written against. */
export const SHIPPING_RATE_BOTTLE_SIZE_ML = 30;

/** Past this many bottles the card stops quoting and asks. */
export const SHIPPING_RATE_MAX_BOTTLES = 6;

export const SHIPPING_RATE_TIERS = [
  { maxBottles: 2, label: '1–2 bottles' },
  { maxBottles: 4, label: '3–4 bottles' },
  { maxBottles: 6, label: '5–6 bottles' },
];

/**
 * Regions exactly as the card groups them, in the card's own order.
 *
 * Hong Kong and Macau sit under Southeast Asia here. That is not a geography error to correct — it is
 * the owner's grouping, and the price he has committed to. Transcribe the card; do not improve it.
 *
 * `usd` runs parallel to SHIPPING_RATE_TIERS.
 */
export const SHIPPING_RATE_REGIONS = [
  {
    key: 'southeast_asia',
    label: 'Southeast Asia',
    countries: ['SG', 'MY', 'TH', 'PH', 'VN', 'BN', 'HK', 'MO'],
    usd: [80, 100, 135],
  },
  {
    key: 'east_asia_oceania',
    label: 'East Asia & Oceania',
    countries: ['JP', 'CN', 'KR', 'TW', 'AU', 'NZ'],
    usd: [100, 125, 165],
  },
  {
    key: 'north_america',
    label: 'North America',
    countries: ['US', 'CA', 'MX'],
    usd: [115, 160, 195],
  },
  {
    key: 'middle_east_south_asia',
    label: 'Middle East & South Asia',
    countries: ['AE', 'SA', 'QA', 'KW', 'OM', 'BH', 'IN', 'LK'],
    usd: [125, 160, 195],
  },
  {
    // The card names seven countries and then says "Nordics & most of the EU", so the EU/EEA members are
    // in. A European country that is NOT in the EU/EEA — Turkey, Serbia, Ukraine, Russia — is not "most
    // of the EU" by any reading, and is quoted on request instead of being waved through at this price.
    key: 'europe',
    label: 'Europe',
    countries: [
      'GB', 'FR', 'DE', 'NL', 'IT', 'ES', 'CH',
      'SE', 'NO', 'DK', 'FI', 'IS',
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'EE', 'GR', 'HU', 'IE', 'LV', 'LT',
      'LU', 'MT', 'PL', 'PT', 'RO', 'SK', 'SI', 'LI',
    ],
    usd: [140, 180, 215],
  },
];

const REGION_BY_COUNTRY = new Map(
  SHIPPING_RATE_REGIONS.flatMap((region) => region.countries.map((code) => [code, region])),
);

export const shippingRateRegionFor = (countryCode) => (
  REGION_BY_COUNTRY.get(String(countryCode || '').trim().toUpperCase()) || null
);

/** The conditions printed under the table, kept with the numbers they qualify. */
export const SHIPPING_RATE_NOTES = [
  'Rates are in USD, per shipment, for 30 ml bottles sent by tracked express courier.',
  'Orders of 7 bottles or more, and destinations not listed above, are quoted on request.',
  'Import duties, taxes and customs fees in the destination country are paid by the recipient.',
  'A remote-area surcharge may apply to some addresses. We will confirm before shipping.',
  "Please make sure the recipient's name, full address and phone number are correct, as the courier may contact them for delivery or customs clearance.",
];
