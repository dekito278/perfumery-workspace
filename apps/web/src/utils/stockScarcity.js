// "Tersisa 2 botol" — the one thing a small-batch house can say that a big one cannot.
//
// Only for a genuinely short shelf. Printing a count on everything turns a scarcity signal into an
// inventory report: it stops meaning anything, and it tells anyone watching exactly how much stock is
// on hand. Below the threshold it is true and it matters; above it, silence.
//
// The count is not new information — storefront_products_public already returns variant stock to
// anyone with the anon key. This only decides when it is worth saying out loud.
export const SCARCITY_THRESHOLD = 5;

export const getScarcityCount = (stock) => {
  const count = Math.floor(Number(stock));
  if (!Number.isFinite(count) || count <= 0) return 0;
  return count <= SCARCITY_THRESHOLD ? count : 0;
};

/**
 * The scarcity line, in the language of the shop the visitor chose.
 *
 * Takes the translator rather than returning Indonesian: this sentence is on the product page, and the
 * page speaks two languages now. There is deliberately no default — a default would render Indonesian in
 * the English shop and nothing would say so, which is the silent half-translation this whole step exists
 * to avoid.
 *
 * @param translate (key, vars) => string, from useTranslate
 */
export const getScarcityLabel = (stock, translate) => {
  const count = getScarcityCount(stock);
  if (!count) return '';
  if (typeof translate !== 'function') return '';
  return count === 1 ? translate('stock.one') : translate('stock.many', { count });
};

export default getScarcityLabel;
