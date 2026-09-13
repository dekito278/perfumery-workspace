// What a BUYER is allowed to read when something fails.
//
// Services rethrow `new Error(error.message || '...')`, so a Supabase or Postgres message travels intact
// to whatever shows it. In Studio that is a feature — "duplicate key value violates unique constraint"
// tells Dekito exactly what happened. On a storefront page it is the opposite: it names tables and
// columns to a stranger, and it tells the one person who cannot act on it.
//
// The decision belongs at the surface, not in the service: the same customerService function serves the
// portal and the admin list. So this is applied by buyer-facing pages, and Studio keeps the raw text.

// Shapes that are never a sentence written for a buyer.
const INTERNAL_MARKERS = [
  /violates|constraint|duplicate key|null value in column/i,
  /relation ["']|column ["']|table ["']|schema cache|does not exist/i,
  /permission denied|row-level security|not authorized for table/i,
  /\bJWT\b|\bRLS\b|apikey|service[_ ]role/i,
  /syntax error|invalid input syntax|operator does not exist/i,
  /failed to fetch|networkerror|load failed|err_[a-z_]+/i,
  /\bTypeError\b|\bReferenceError\b|undefined is not|is not a function|Unexpected token/i,
  /https?:\/\//i,           // a URL is infrastructure, not an explanation
  /^[0-9A-Z]{5}$|^PGRST\d+/, // a bare Postgres / PostgREST code
];

// Long enough to be a dump rather than a sentence.
const MAX_LENGTH = 160;

export const isInternalErrorMessage = (message) => {
  const text = String(message || '').trim();
  if (!text) return true;
  if (text.length > MAX_LENGTH) return true;
  return INTERNAL_MARKERS.some((pattern) => pattern.test(text));
};

/**
 * The message to show a buyer. Curated sentences pass through — they are almost always more useful than
 * the fallback — and anything that looks like machinery is replaced.
 *
 * The real error is always logged, so making the buyer's copy vaguer never makes a failure harder to
 * diagnose. That trade is the only reason this is safe to do at all.
 */
export const publicErrorMessage = (error, fallback = 'Ada yang gagal. Coba lagi sebentar lagi.') => {
  const message = typeof error === 'string' ? error : error?.message;
  if (isInternalErrorMessage(message)) {
    if (message) console.warn('Hidden from the buyer:', message);
    return fallback;
  }
  return String(message).trim();
};
