// Which rows the Studio price editor draws for one product.
//
// A tier price sits on one of two kinds of row: '' (every size) or a size id, and a size row overrides
// the '' row for that size. The editor used to draw only the '' row whenever a product had one size, on
// the reasoning that both mean the same bottle. But the automatic member and export prices are written
// per size, so on 2026-11-08 every price in the table — 19 member, 19 export, 1 reseller — sat on a size
// row and the form showed all of them as empty. A price typed into that empty box landed on '' and was
// then overridden by the size row the form could not see: an edit that changed nothing a buyer paid.
//
// So every size gets its own row, always. The '' row is drawn as well when there is more than one size
// (it is the default for the sizes left blank) or when it already holds a price — a saved price is
// never hidden.
//
// Plain relative imports only, so the guard runs it.
import { tierPriceIsNotBelowRetail } from './memberPriceFill.js';

export const tierCellKey = (variantId, tier) => `${variantId}|${tier}`;

const hasPrice = (value) => Number(value) > 0;

/**
 * @param variants the product's variants, as the form holds them
 * @param cells    { 'variantId|tier': price } — the saved or drafted prices
 * @returns [{ id, label, retail }] — id '' is the every-size row
 */
export const tierEditorRows = (variants = [], cells = {}) => {
  const sizes = (variants || []).map((variant) => ({
    id: String(variant?.id || ''),
    label: variant?.size || variant?.id || 'Varian',
    retail: Number(variant?.priceNumber || 0),
  })).filter((row) => row.id);

  const allSizesHasPrice = Object.entries(cells || {}).some(([key, value]) => key.startsWith('|') && hasPrice(value));
  const allSizes = { id: '', label: 'Semua ukuran', retail: 0 };

  if (!sizes.length) return [allSizes];
  return sizes.length > 1 || allSizesHasPrice ? [allSizes, ...sizes] : sizes;
};

/** What an empty box means, which depends on whether the every-size row has a price for that tier. */
export const tierEmptyMeaning = (rowId, tier, cells = {}) => (
  rowId && hasPrice(cells?.[tierCellKey('', tier)]) ? 'Kosong = ikut semua ukuran' : 'Kosong = harga retail'
);

/**
 * The warning under a tier price, or '' for none. Member and reseller exist to be CHEAPER than retail;
 * the export price exists to be dearer. One rule for all three painted every correct export price red the
 * day those prices first became visible in this editor.
 */
export const tierPriceWarning = (tier, retail, value) => {
  if (tier === 'overseas') {
    return Number(value) > 0 && Number(retail) > 0 && Number(value) <= Number(retail) ? 'Di bawah harga retail' : '';
  }
  return tierPriceIsNotBelowRetail(retail, value) ? 'Tidak di bawah harga retail' : '';
};
