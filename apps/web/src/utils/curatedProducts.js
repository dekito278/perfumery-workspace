// Which products the home pages show under "Fragrance pilihan".
//
// Both homes used to take the first N of the catalogue — desktop 8, phone 4 — in catalogue order, and
// the mapper forced the first three to read as "featured" regardless. So the featured flag Dekito sets
// in Studio decided nothing: "pilihan" was whatever happened to sort first, and all 18 products carried
// the flag because it had never been seen to do anything.
//
// Now the flag is the curation. Flagged products, in catalogue order, capped. If nothing is flagged the
// home falls back to the first `limit` so it is never empty — but says nothing is curated, honestly.
//
// Import-free so the guard runs it.

export const CURATED_LIMIT_DESKTOP = 6;
export const CURATED_LIMIT_MOBILE = 4;

export const pickCuratedProducts = (catalog = [], limit = CURATED_LIMIT_DESKTOP) => {
  const list = Array.isArray(catalog) ? catalog : [];
  const cap = Math.max(0, Math.floor(Number(limit) || 0));
  if (!cap) return [];
  const flagged = list.filter((product) => product?.featured === true);
  return (flagged.length ? flagged : list).slice(0, cap);
};

/** True when the home is showing a real curation rather than the "first N" fallback. */
export const hasCuration = (catalog = []) => (
  Array.isArray(catalog) && catalog.some((product) => product?.featured === true)
);
