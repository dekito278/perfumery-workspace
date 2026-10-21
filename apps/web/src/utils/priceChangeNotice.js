// "Harga lama berlaku sampai 11.11" — the eleven days before the domestic prices change.
//
// Import-free so the guard runs the arithmetic instead of reading it, and so the instant below is the
// ONE place the date lives on this side of the wire.
//
// THE SWITCH INSTANT IS ALSO IN SQL, as effective_at on every row of storefront_price_schedule. Two
// copies of one moment is how a banner ends up still promising the old price after the new one has
// started being charged, so the guard asserts this string appears in that migration.

/** 2026-11-12 00:00 WIB — when storefront_price_schedule's rows come into force. */
export const PRICE_SWITCH_AT = '2026-11-12T00:00:00+07:00';

/** The notice goes up on 1 Nov, eleven days ahead, and comes down the moment the prices change. */
export const PRICE_NOTICE_FROM = '2026-11-01T00:00:00+07:00';

const time = (value) => {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Is the notice due?
 *
 * @param asOf    the instant to judge, defaulting to now. A banner may read the visitor's own clock —
 *   unlike a PRICE, which is decided by the database in SQL (see indexTierPrices). The worst a wrong
 *   clock does here is show or hide a sentence a day early.
 * @param region  'en' for the international shop. The notice is DOMESTIC ONLY: the dollar prices are
 *   not changing, so telling an overseas visitor that "current prices hold until 11.11" would be
 *   announcing a change that will never reach them.
 */
export const priceNoticeIsDue = ({ asOf = Date.now(), region = 'id' } = {}) => {
  if (String(region) === 'en') return false;
  const now = time(asOf);
  const from = time(PRICE_NOTICE_FROM);
  const until = time(PRICE_SWITCH_AT);
  if (now === null || from === null || until === null) return false;
  return now >= from && now < until;
};
