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

/**
 * The English shop's home order (18 Nov 2026, from the foreign-buyer audit): what can be bought first, then
 * the gentlest price first. A visitor abroad met the US$160 bottle as the featured one before any US$80
 * one, and judged the whole shop by it. Dekito's curation is kept — it is the same set of perfumes, only
 * reordered — and ties keep his order. `priceOf(product)` is the export price in any unit, or 0 when unset.
 */
export const orderForAbroad = (products = [], priceOf = () => 0) => (
  (Array.isArray(products) ? products : [])
    .map((product, position) => {
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      const stock = variants.length
        ? variants.reduce((sum, variant) => sum + Math.max(0, Number(variant?.stock) || 0), 0)
        : Math.max(0, Number(product?.stock) || 0);
      const price = Number(priceOf(product)) || 0;
      return { product, position, soldOut: !(stock > 0), price: price > 0 ? price : Infinity };
    })
    .sort((a, b) => Number(a.soldOut) - Number(b.soldOut) || a.price - b.price || a.position - b.position)
    .map((entry) => entry.product)
);

// --- The home shelf (Dekito, 26 Nov 2026) ------------------------------------------------------------------
//
// "Jangan Maskumambang yang jadi poin utamanya" and "foto produknya belum banyak di home". The home led with
// the first flagged perfume — then a white label card at Rp999.000 with two bottles left — and listed five
// names with no picture. A buyer met the most expensive bottle as a placeholder and saw no glass at all.
//
// Now the home shows BOTTLES: only perfumes whose main image is one of the new bottle photos served from the
// site (/brand/products/<slug>/, Dekito's photographs, 26 Nov 2026). A label card stays in the catalogue but
// is never what the home shows. Dekito chose (AskUserQuestion, 26 Nov 2026):
//   - featured: automatic — the first flagged perfume with a bottle photo and enough stock to survive being
//     featured (FEATURED_MIN_STOCK), else the first such perfume in catalogue order;
//   - a grid of HOME_GRID_LIMIT bottles under it, flagged ones first, then the catalogue, then "see all".

export const BOTTLE_PHOTO_PATH = '/brand/products/';
export const FEATURED_MIN_STOCK = 3;
export const HOME_GRID_LIMIT = 8;

const isSet = (product) => String(product?.category || '').trim().toLowerCase() === 'discovery set';

export const productStock = (product) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  return variants.length
    ? variants.reduce((sum, variant) => sum + Math.max(0, Number(variant?.stock) || 0), 0)
    : Math.max(0, Number(product?.stock) || 0);
};

/**
 * A real bottle photograph as the main image — not a label card, not a set box. Either one served from the
 * site (/brand/products/) or one Dekito uploaded himself and ticked "Foto utama = foto botol" for in Studio
 * (26 Nov 2026) — the tick needs a main image to mean anything.
 */
export const hasBottlePhoto = (product) => {
  const main = String(product?.imageUrl || product?.image_url || '');
  return main.includes(BOTTLE_PHOTO_PATH) || (product?.bottlePhoto === true && main !== '');
};

/**
 * { featured, grid } for the home. `curated` is Dekito's flagged set (already ordered for the shop it is
 * shown in); `order` reorders the rest the same way (identity at home, orderForAbroad abroad).
 *
 * Before any bottle photo exists — an outage, or a fresh database — it falls back to the old shape: the
 * first curated perfume featured, the rest listed. The home is never empty because of this rule.
 */
export const pickHomeShelf = ({ curated = [], catalog = [], order = (list) => list, limit = HOME_GRID_LIMIT } = {}) => {
  const ready = (product) => product && !isSet(product) && hasBottlePhoto(product) && productStock(product) > 0;
  const flagged = (Array.isArray(curated) ? curated : []).filter(ready);
  const flaggedSlugs = new Set(flagged.map((product) => product.slug));
  const rest = order((Array.isArray(catalog) ? catalog : []).filter((product) => ready(product) && !flaggedSlugs.has(product.slug)));
  const candidates = [...flagged, ...rest];
  if (!candidates.length) {
    const fallback = Array.isArray(curated) ? curated : [];
    return { featured: fallback[0] || null, grid: fallback.slice(1, 1 + limit) };
  }
  const featured = candidates.find((product) => productStock(product) >= FEATURED_MIN_STOCK) || candidates[0];
  return { featured, grid: candidates.filter((product) => product !== featured).slice(0, limit) };
};

/** Perfumes in the catalogue, sets left out — the number behind "Lihat semua N parfum". */
export const perfumeCountOf = (catalog = []) => (Array.isArray(catalog) ? catalog : []).filter((product) => !isSet(product)).length;
