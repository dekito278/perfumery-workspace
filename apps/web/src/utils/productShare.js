/**
 * The link a buyer sends a friend.
 *
 * Not `window.location.href`: on a phone that is /mobile/products/<slug>, a second set of URLs for the
 * same shop that exists for the phone's own layout. Sent to someone on a laptop it opens the phone page,
 * and it is not the address the share card (og:title, og:image) was prerendered for.
 *
 * The basename is what keeps the English shop English: a reader of /en/catalog/<slug> who shares must
 * hand over /en/..., or their friend gets the Indonesian card for a bottle they were told about in
 * English.
 */
export const productShareUrl = (slug, { origin = '', basename = '' } = {}) => {
  const clean = String(slug || '').trim();
  if (!clean) return '';
  return `${origin}${basename}/catalog/${encodeURIComponent(clean)}`;
};
