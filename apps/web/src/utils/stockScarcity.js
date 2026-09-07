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

export const getScarcityLabel = (stock) => {
  const count = getScarcityCount(stock);
  if (!count) return '';
  return count === 1 ? 'Tersisa 1 botol' : `Tersisa ${count} botol`;
};

export default getScarcityLabel;
