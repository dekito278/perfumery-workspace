// The address a buyer meant, when the one they typed is almost right.
//
// Visitor audit, 13 Nov 2026: /catalog/j-adore-la-vanille — the perfume's own name — answered "Halaman tidak
// ditemukan", because its address is soli-extended-j-adore-la-vanille. The Jason Voorhees article lives at
// kisah-jason-vorhees, so the correct spelling is the one that finds nothing. Both are a person a few
// characters away from a page that exists.
//
// CAUTIOUS ON PURPOSE: a wrong guess is worse than "not found" — it shows a buyer a different perfume as
// if it were the one they asked for. So a guess is taken only when it is the ONLY candidate:
//   1. the typed address is the tail of exactly one real one (j-adore-la-vanille → soli-extended-j-adore-la-vanille),
//   2. or exactly one real address is within two edits of it, and the typed one is long enough (≥ 8)
//      that two edits cannot turn one name into another (kisah-jason-voorhees → kisah-jason-vorhees).
// Import-free so the guard runs it.

const clean = (value) => String(value || '').trim().toLowerCase().replace(/\/+$/, '');

const distance = (a, b, limit) => {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, current[j]);
    }
    if (best > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
};

// Articles carry an 8-character id on the end ("kisah-jason-vorhees-32209a44"); nobody types it, so the
// comparison is made without it and the full address is what is returned.
const withoutId = (slug) => slug.replace(/-[0-9a-f]{8}$/, '');

/** The one real slug the typed one most likely means, or '' when there is none or more than one. */
export const nearestSlug = (typed, slugs = []) => {
  const wanted = withoutId(clean(typed));
  const known = [...new Set((Array.isArray(slugs) ? slugs : []).map(clean).filter(Boolean))];
  if (!wanted || !known.length) return '';
  const exact = known.filter((slug) => slug === wanted || withoutId(slug) === wanted);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return '';

  // Two words at least: "vanille" is the tail of J'adore la Vanille AND the head of Vanille Planifolia, and a
  // single word is a search, not an address.
  const tails = wanted.includes('-') ? known.filter((slug) => withoutId(slug).endsWith(`-${wanted}`)) : [];
  if (tails.length === 1) return tails[0];
  if (tails.length > 1) return '';

  if (wanted.length < 8) return '';
  const near = known.filter((slug) => distance(wanted, withoutId(slug), 2) <= 2);
  return near.length === 1 ? near[0] : '';
};

export default nearestSlug;
