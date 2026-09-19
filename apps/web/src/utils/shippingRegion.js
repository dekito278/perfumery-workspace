// Which international price a reader is being shown, and whether the shipping is on the house.
//
// One export price for the whole world was always going to be wrong at one end. It was set in USD,
// reasoning that US$62 reads modestly in New York — which it does — and then sent to the neighbours,
// where the same number is RM 290 for 30 ml from a house nobody there has heard of. Dekito spotted it
// himself: "kok jadinya kelihatannya mahal, udah kayak brand besar".
//
// So there are two prices, split where the carrier splits the world.

import { EXPORT_ZONE_BY_COUNTRY } from '@/data/exportZones.js';
import { rayspeedServes } from '@/data/rayspeedRates.js';
import { overseasPriceFromRetail } from '@/utils/memberPriceFill.js';

/**
 * Southeast Asia plus Hong Kong and Macau — LTU's zones 1 and 2, which is also roughly "the neighbours".
 * They get a lower multiplier because free shipping cannot do the work there: RaySpeed charges about
 * Rp 90.000 to Malaysia, so waiving it is a gift worth 8% that nobody feels. Only the price itself can
 * move the number a buyer in Kuala Lumpur is looking at.
 */
export const ASIA_MULTIPLIER = 2.2;

/**
 * The same countries, as IANA time zones, because a browser tells you its clock and not its address.
 *
 * Written out one by one rather than matched on the 'Asia/' prefix: Asia/Tokyo, Asia/Dubai and
 * Asia/Kolkata are all "Asia" to a prefix test and none of them belong here, and Asia/Jakarta is home.
 */
export const ASIA_TIME_ZONES = [
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Kuching',
  'Asia/Brunei',
  'Asia/Hong_Kong',
  'Asia/Macau',
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Saigon',
  'Asia/Manila',
  'Asia/Phnom_Penh',
  'Asia/Vientiane',
  'Asia/Yangon',
  'Asia/Dili',
];

/** 'asia' | 'world'. A clock this app does not recognise is 'world', which is the dearer of the two. */
export const shippingRegionForTimeZone = (timeZone) => (
  ASIA_TIME_ZONES.includes(String(timeZone || '').trim()) ? 'asia' : 'world'
);

/**
 * ?ship=asia / ?ship=world on the address, which beats the clock.
 *
 * The same reason ?lang= exists: Dekito cannot see his own Southeast Asia price from Jakarta otherwise,
 * and neither can anyone checking his work. A guess nobody can override is a guess nobody can correct —
 * that lesson is already written into the region switch this shop shipped in September.
 */
export const readShippingRegionFromUrl = (search) => {
  try {
    const query = typeof search === 'string' ? search : window.location.search;
    const value = new URLSearchParams(query).get('ship');
    return value === 'asia' || value === 'world' ? value : null;
  } catch {
    return null;
  }
};

export const detectShippingRegion = () => {
  const chosen = readShippingRegionFromUrl();
  if (chosen) return chosen;
  try {
    return shippingRegionForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  } catch {
    // No Intl, or a browser that refuses to say. 'world' never under-quotes.
    return 'world';
  }
};

/**
 * Whether the shipping is included in the price shown.
 *
 * Tied to the CARRIER, not to the two rates that happen to be measured. RaySpeed's dearest measured
 * destination is the United States at Rp 670.500, and Dekito still earns more on every single bottle
 * sent there than on the same bottle sold in Jakarta — so the promise holds across their whole network,
 * and the unmeasured destinations (Singapore, Japan, Australia) are all nearer than the one that proves
 * it.
 *
 * Europe is the exception, and not by choice: RaySpeed does not go there, LTU does, and LTU wants
 * Rp 2.2 million and an MSDS. Shipping there is quoted by hand, as it always was.
 */
export const shippingIncludedFor = (countryCode) => rayspeedServes(countryCode);

/** The zone a country sits in, for the two callers that need to reason about the split by country. */
export const isAsiaCountry = (countryCode) => {
  const zone = EXPORT_ZONE_BY_COUNTRY[String(countryCode || '').trim().toUpperCase()];
  return zone === 1 || zone === 2;
};

/**
 * The international price for one line, in the region the reader appears to be in.
 *
 * 'world' is the price Dekito set by hand and it is left exactly alone — he asked for that, and at
 * US$62 it reads modestly in the markets it was written for.
 *
 * 'asia' is COMPUTED from the retail price rather than stored, so it follows every price change without
 * eighteen rows to keep in step. That is the whole reason it is a formula and not a column.
 *
 * And it is never dearer than the world price. A hand-set overseas price below 2.2x would otherwise make
 * the neighbours pay more than America, which is the opposite of the point.
 */
export const internationalPriceFor = ({ tierPrices = {}, linePrice = 0, region = 'world' } = {}) => {
  const world = Number(tierPrices?.overseas) || 0;
  const line = Number(linePrice) || 0;
  const worldPrice = world && line && world > line ? world : null;
  if (region !== 'asia') return worldPrice;

  const asia = overseasPriceFromRetail(line, ASIA_MULTIPLIER);
  if (!asia) return worldPrice;
  return worldPrice ? Math.min(asia, worldPrice) : asia;
};
