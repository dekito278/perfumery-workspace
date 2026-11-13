// One mapping for schema.org availability, shared by the client (utils/seo.js) and the build-time
// prerender (tools/seo-artifacts.mjs). Deliberately free of imports so a node script can load it.
//
// They used to disagree. The client read the storefront's own status, where zero stock means
// "Made to order", and correctly published PreOrder. The prerender never fetched stock at all and
// hardcoded InStock for every product — and the prerendered HTML is what a crawler and a cold visitor
// read first. Two products with no stock were advertised as in stock on the pages Google indexes.

export const SCHEMA_IN_STOCK = 'https://schema.org/InStock';
export const SCHEMA_OUT_OF_STOCK = 'https://schema.org/OutOfStock';

const stockOf = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * `status` is the storefront's own words ('Available', 'Made to order', 'Inquire', 'Habis'…).
 * `stock` / `variants` are the numbers behind them. Numbers win when they are present, because a stale
 * label is exactly how this drifted in the first place.
 */
export const schemaAvailability = ({ status = '', stock, variants } = {}) => {
  const variantStock = Array.isArray(variants)
    ? variants.reduce((total, variant) => total + stockOf(variant?.stock), 0)
    : null;
  const counted = variantStock !== null && variants.length ? variantStock : (stock === undefined || stock === null ? null : stockOf(stock));

  // SINCE 13 NOV 2026 (sixth visitor audit): zero stock is OUT OF STOCK. The shop stopped selling an empty
  // perfume as a pre-order — the page says "Stok habis", the button is off and the buyer is offered a word
  // when it is back — while this still told Google "PreOrder" for Sudra. The page and the data say one thing.
  if (counted !== null) return counted > 0 ? SCHEMA_IN_STOCK : SCHEMA_OUT_OF_STOCK;

  const text = String(status).toLowerCase();
  if (/^available$/.test(text.trim())) return SCHEMA_IN_STOCK;
  if (/made to order|pre.?order|pesan|inquire|out|habis|sold|discontinued/.test(text)) return SCHEMA_OUT_OF_STOCK;
  return SCHEMA_IN_STOCK;
};
