// SOLIVAGANT operates on Jakarta time. `new Date().toISOString().slice(0, 10)` returns the UTC calendar
// day, so between 00:00 and 07:00 WIB every default production/validation date was stamped as *yesterday*
// (audit round 7). Same reasoning for a date-only voucher expiry: the owner types a date meaning "end of
// that day here", and the client (WIB) and the server (UTC) each read it in their own zone.

export const SHOP_TIME_ZONE = 'Asia/Jakarta';
export const SHOP_UTC_OFFSET = '+07:00';

// YYYY-MM-DD for the shop's calendar day, whatever zone the browser or the server runs in.
export const shopToday = (date = new Date()) => (
  new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE }).format(date)
);

// Both ends of a date-only value, pinned to the shop's zone so every runtime agrees on the same instant.
// A bare `${isoDate}T23:59:59.999` is read in whatever zone the runtime happens to be in, which is the
// buyer's zone on every client-side check — so a promo window typed once in Jakarta started and ended at
// a different moment for every reader.
export const shopEndOfDay = (isoDate) => `${isoDate}T23:59:59.999${SHOP_UTC_OFFSET}`;
export const shopStartOfDay = (isoDate) => `${isoDate}T00:00:00.000${SHOP_UTC_OFFSET}`;
