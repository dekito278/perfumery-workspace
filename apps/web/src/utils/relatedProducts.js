/**
 * The four perfumes offered under "Mungkin kamu suka".
 *
 * They were the first four in the catalogue, on every product page. Verified on production: a metallic,
 * milky, musky perfume (HUG N°1) and a vanilla gourmand (Vanille Planifolia) both offered L'iris,
 * Maskumambang, La Tulipe and .Wayback — the same four, in catalogue order. The vanilla's own sibling,
 * J'adore la Vanille, was never suggested on it.
 *
 * The desktop page called that list `contextual` while computing `catalog.slice(0, 4)`; the phone did not
 * even try. Explicit picks — `relatedFragrances` — exist only in the static seed file and are not mapped
 * from the database, so for every live product the fallback IS the feature.
 *
 * So the fallback does the work: same category first, then everything else, self always excluded. A
 * gourmand now leads with the other gourmand. Explicit picks still win when a product has them, because
 * a hand-chosen pairing beats any rule.
 */
export const relatedFor = (product, catalog = [], limit = 4) => {
  if (!product?.slug || !Array.isArray(catalog)) return [];
  const others = catalog.filter((item) => item?.slug && item.slug !== product.slug);

  const explicit = (product.relatedFragrances || [])
    .map((slug) => others.find((item) => item.slug === slug))
    .filter(Boolean);

  const taken = new Set(explicit.map((item) => item.slug));
  const sameCategory = others.filter((item) => (
    !taken.has(item.slug)
    && item.category
    && product.category
    && String(item.category).toLowerCase() === String(product.category).toLowerCase()
  ));
  sameCategory.forEach((item) => taken.add(item.slug));
  const rest = others.filter((item) => !taken.has(item.slug));

  return [...explicit, ...sameCategory, ...rest].slice(0, limit);
};

export default relatedFor;
