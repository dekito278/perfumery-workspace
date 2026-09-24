// Which international price a reader is being shown, and whether the shipping is on the house.
//
// One export price for the whole world was always going to be wrong at one end. It was set in USD,
// reasoning that US$62 reads modestly in New York — which it does — and then sent to the neighbours,
// where the same number is RM 290 for 30 ml from a house nobody there has heard of. Dekito spotted it
// himself: "kok jadinya kelihatannya mahal, udah kayak brand besar".
//
// So there are two prices, split where the carrier splits the world.



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

// isAsiaCountry and shippingIncludedFor used to live here. Both are questions about a DESTINATION, so
// they moved to internationalDestination.js to sit beside the third one — which of the two international
// prices applies — and a screen can no longer answer one of them from a different table.
//
// shippingIncludedFor was tied to carrier coverage while every product page promised "Southeast Asia,
// East Asia, Australia and the Americas". Thailand, the Philippines and Vietnam sat in that gap:
// promised free shipping on the page, charged for it in Studio. The promise is what the buyer read.

// internationalPriceFor moved to internationalDestination.js with the other destination rules — the
// order endpoint runs in plain node, cannot resolve the '@/' alias this module uses, and must charge
// from the same rule the shop displays.
