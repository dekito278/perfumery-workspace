/**
 * Buyer reviews — the rules the pages share (Dekito, 20 Nov 2026).
 *
 * The database decides who may review and what is stored (supabase/manual/20261120090000_buyer_reviews.sql):
 * only a signed-in buyer, only for a perfume in one of their own orders that has SHIPPED, one review per
 * perfume per order, editable for 30 days, and nothing shows until Dekito publishes it in Studio. What lives
 * here is what the pages need to agree on: the limits, the public name, and when a number is worth showing.
 *
 * Nothing here — or anywhere in this repo — writes a review. A review is a buyer's sentence or nothing.
 */

export const REVIEW_BODY_MAX = 600;
export const REVIEW_EDIT_DAYS = 30;
export const REVIEW_STATUSES = ['pending', 'published', 'hidden'];

/**
 * Stars on a catalogue card only from three reviews up. One 5★ beside a perfume reads as a friend's
 * favour, and a row of "(1)" announces how few people have bought — the reason the shop chose silence over
 * "Ulasan (0)" in October. The product page shows any published review, because there the words carry it.
 */
export const CARD_RATING_MIN_REVIEWS = 3;

/** How many reviews the product page shows before "Lihat semua". */
export const PRODUCT_PAGE_REVIEW_LIMIT = 3;

/**
 * The anchor of the review panel on the account page and of the reviews on a product page. One Indonesian
 * word in both shops on purpose: Studio's WhatsApp ask links /customer#ulasan, and that link must keep working.
 */
export const REVIEWS_ANCHOR = 'ulasan';

const NOT_A_NAME = new Set(['', '-', 'customer', 'walk-in customer']);

/**
 * "Rina Sari Dewi" → "Rina D.", "rina" → "Rina". The same rule as storefront_review_display_name in the SQL:
 * the database stores ITS answer, this one only previews it in the form. Empty means the shop prints
 * "Pembeli terverifikasi".
 */
export const reviewDisplayName = (fullName = '') => {
  const cleaned = String(fullName ?? '').trim().replace(/\s+/g, ' ');
  if (NOT_A_NAME.has(cleaned.toLowerCase())) return '';
  const parts = cleaned.split(' ');
  const first = parts[0].slice(0, 20);
  // Postgres initcap: every run of letters/digits starts upper-case, the rest lower ("anne-marie" → "Anne-Marie").
  const firstName = first.toLocaleLowerCase('id-ID')
    .replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, before, letter) => `${before}${letter.toLocaleUpperCase('id-ID')}`);
  const initial = parts.length > 1 ? ` ${parts[parts.length - 1].charAt(0).toLocaleUpperCase('id-ID')}.` : '';
  return `${firstName}${initial}`.slice(0, 40);
};

export const clampRating = (value) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0;
};

export const cleanReviewBody = (value = '') => String(value ?? '')
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
  .slice(0, REVIEW_BODY_MAX);

/** One published review as the shop prints it. Nothing about the order or the buyer beyond the public name. */
export const normalizePublicReview = (row = {}) => ({
  id: String(row.id || ''),
  productSlug: String(row.product_slug || ''),
  productName: String(row.product_name || ''),
  rating: clampRating(row.rating),
  body: String(row.body || ''),
  displayName: String(row.display_name || ''),
  reply: String(row.reply || ''),
  publishedAt: row.published_at || row.created_at || null,
});

/** The stats view as { [slug]: { count, average } }. */
export const indexReviewStats = (rows = []) => Object.fromEntries(
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.product_slug && Number(row.review_count) > 0)
    .map((row) => [String(row.product_slug), {
      count: Number(row.review_count),
      average: Math.round(Number(row.average_rating) * 10) / 10,
    }]),
);

/** The average over a list of reviews, as the stats view computes it (one decimal). */
export const averageRating = (reviews = []) => {
  const ratings = reviews.map((review) => clampRating(review.rating)).filter(Boolean);
  if (!ratings.length) return 0;
  return Math.round((ratings.reduce((sum, n) => sum + n, 0) / ratings.length) * 10) / 10;
};

/** "4,8" in the Indonesian shop, "4.8" in the English one. */
export const formatAverage = (value, locale = 'id-ID') => Number(value || 0).toLocaleString(locale, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const cardShowsRating = (stats) => Boolean(stats && stats.count >= CARD_RATING_MIN_REVIEWS);

/** Whether a buyer can still change this review (30 days from when it was first sent). */
export const reviewIsEditable = (review, now = Date.now()) => {
  if (!review) return true;
  const until = Date.parse(review.editable_until || review.editableUntil || '');
  return Number.isFinite(until) ? until > now : false;
};

/** One reviewable (order, perfume) pair from storefront_my_reviewable_items. */
export const normalizeReviewableItem = (row = {}) => ({
  orderId: String(row.order_id || ''),
  orderNumber: String(row.order_number || ''),
  orderedAt: row.ordered_at || null,
  // The name on that order, the buyer's own: the form previews the public name from it.
  buyerName: String(row.buyer_name || ''),
  productId: String(row.product_id || ''),
  productSlug: String(row.product_slug || ''),
  productName: String(row.product_name || ''),
  imageUrl: String(row.image_url || ''),
  review: row.review && typeof row.review === 'object' ? {
    id: String(row.review.id || ''),
    rating: clampRating(row.review.rating),
    body: String(row.review.body || ''),
    anonymous: row.review.anonymous === true,
    displayName: String(row.review.display_name || ''),
    status: REVIEW_STATUSES.includes(row.review.status) ? row.review.status : 'pending',
    reply: String(row.review.reply || ''),
    editableUntil: row.review.editable_until || null,
  } : null,
});

/**
 * The WhatsApp text behind Studio's "Minta ulasan" button on a shipped order. A separate message Dekito
 * chooses to send — never part of the order-confirmation or shipping templates. It names the Google sign-in
 * because that is what opens the review form: the account the buyer ordered with.
 */
export const reviewRequestMessage = (order = {}, origin = 'https://www.solivagantscent.com') => {
  const firstName = reviewDisplayName(order.customerName || order.customer_name || '').split(' ')[0];
  const hello = firstName ? `Halo ${firstName}, ini SOLIVAGANT.` : 'Halo, ini SOLIVAGANT.';
  return [
    hello,
    'Parfumnya sudah sempat dipakai? Kalau berkenan, kami minta ulasannya ya — cukup pilih bintang, tulisannya boleh singkat.',
    `Masuk dengan akun Google yang kamu pakai waktu pesan di ${String(origin).replace(/\/$/, '')}/customer#${REVIEWS_ANCHOR}`,
    'Terima kasih sudah jalan bareng kami.',
  ].join('\n\n');
};
