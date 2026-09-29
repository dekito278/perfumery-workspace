/**
 * The label above a product's name, and the badge beside it.
 *
 * `category` did both jobs. The card printed it and the filter pills were built from it, so it had to
 * answer "what does this smell like" — and for ten of nineteen perfumes it answered "Limited", which is
 * how RARE something is. Measured on the live shop: filtering FLORAL returned four perfumes, and
 * Maskumambang — "White floral, olibanum, musk" by its own notes — was not one of them.
 *
 * `limited` is now its own column. The badge reads that; the category is free to say the family. While a
 * product still carries the old category, both show the same word, which is exactly today's screen — the
 * separation is invisible until Dekito re-files a perfume, and then the badge survives the change.
 */
const LIMITED = 'limited';

export const isLimitedCategory = (category) => String(category || '').trim().toLowerCase() === LIMITED;

/** True when this perfume should wear the LIMITED badge, however its category is currently filed. */
export const isLimitedProduct = (product = {}) => (
  Boolean(product?.limited) || isLimitedCategory(product?.category)
);

/**
 * What the card prints as the family line. A category that is really a badge is not a family, so it is
 * not repeated there — the badge already says it, and printing it twice is how the two stayed fused.
 */
export const familyLabel = (product = {}) => {
  const category = String(product?.category || '').trim();
  // Empty, not a fallback word. A perfume still filed as 'Limited' has no family to print yet, and the
  // badge beside it already says the only true thing — so the card reads exactly as it does today, one
  // word. Printing 'Atelier' there would be inventing a family to fill a gap.
  if (!category || isLimitedCategory(category)) return '';
  return category;
};

/**
 * Does this perfume belong under that filter pill?
 *
 * The mirror of the bug at the top of this file, which nobody did. Splitting `limited` out of `category`
 * was what let FLORAL finally find Maskumambang — and it left LIMITED unable to. The pills are built
 * from categories, so tapping LIMITED matched the word in `category` and missed every perfume that has
 * since been re-filed into its real family: measured on the live shop, ten wear the badge and the pill
 * found seven. The three it dropped are Aquilaria tuberosa, Maskumambang and Sudra — the three most
 * expensive bottles in the shop, missing from exactly the filter someone hunting rare pieces would tap.
 *
 * A pill named after a badge has to find everything wearing that badge. Every other pill is a family and
 * still matches on the category, so a re-filed perfume answers to BOTH its family and LIMITED.
 */
export const matchesCatalogCategory = (product = {}, category = '') => {
  if (!category || category === 'All') return true;
  if (isLimitedCategory(category)) return isLimitedProduct(product);
  return String(product?.publicCategory || product?.category || '') === category;
};

/** The whole label line: the family, the badge, or both once a limited perfume has been re-filed. */
export const cardLabels = (product = {}) => [
  familyLabel(product),
  isLimitedProduct(product) ? 'Limited' : '',
].filter(Boolean);

export default isLimitedProduct;
