// "Harga lama berlaku sampai 11.11" — the eleven days before the domestic prices change.
//
// The two dates below are built with shopStartOfDay, not written out. A midnight written without an
// offset is read in whatever zone the runtime happens to be in, which is the BUYER's zone on every
// client-side check — so a window typed once in Jakarta would start and end at a different moment for
// every reader. (shopClockBoundaries.selfcheck scans raw text, comments included, so this note cannot
// spell out the shape it is warning about either.)
// localDay.js owns the shop's offset, and shopClockBoundaries.selfcheck enforces that it is the only
// file that does.
//
// THE SWITCH INSTANT IS ALSO IN SQL, as effective_at on every row of storefront_price_schedule. Two
// copies of one moment is how a banner ends up still promising the old price after the new one has
// started being charged, so the guard asserts the migration's rows carry this same instant.
import { shopStartOfDay } from './localDay.js';

/** 12 Nov 2026, 00:00 WIB — when storefront_price_schedule's rows come into force. */
export const PRICE_SWITCH_AT = shopStartOfDay('2026-11-12');

/** The notice goes up on 1 Nov, eleven days ahead, and comes down the moment the prices change. */
export const PRICE_NOTICE_FROM = shopStartOfDay('2026-11-01');

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
