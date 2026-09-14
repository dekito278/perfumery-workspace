// Is this formula actually costable, or is the number lying?
//
// Every costing path multiplies grams by `cost_per_unit || 0`. A material with no purchase price
// contributes exactly Rp 0 and says nothing about it, so the concentrate cost, the cost per ml, the
// dilution cost and every retail scenario built on top come out TOO LOW — in the direction that loses
// money, silently, on the screen Dekito prices products from.
//
// A material that has been deleted from the library is the same failure wearing a different hat: the row
// resolves to no source, renders as "Unknown", and costs zero.
//
// So this does not score anything. It names what is missing and how much weight is unaccounted for, and
// the pages that show a cost show this beside it.
//
// Adapted from saas-perfumers rather than copied: its version reads purchase_price / purchase_quantity /
// purchase_unit / density, a pricing model that does not exist here. The price signal in this repo is
// cost_per_unit, so that is what gets checked.
//
// Import-free so the node guard can test the rules as behaviour.

const UNKNOWN_MATERIAL_NAME = 'Unknown';

const gramsOf = (item = {}) => Number(item.gram_amount ?? item.grams ?? 0) || 0;
const priceOf = (item = {}) => Number(item.unit_price ?? item.cost_per_unit ?? 0) || 0;
const hasMaterial = (item = {}) => Boolean(item.item_id) && item.name !== UNKNOWN_MATERIAL_NAME;

const labelFor = (item = {}, index) => (
  item.name && item.name !== UNKNOWN_MATERIAL_NAME ? item.name : `Baris ${index + 1}`
);

export const buildFormulaProductionReadiness = (items = []) => {
  const rows = Array.isArray(items) ? items : [];
  const issues = [];
  const totalGrams = rows.reduce((sum, item) => sum + gramsOf(item), 0);

  let unpricedCount = 0;
  let unpricedGrams = 0;

  rows.forEach((item, index) => {
    const label = labelFor(item, index);
    const grams = gramsOf(item);

    if (!hasMaterial(item)) {
      // Counted as unpriced too: a row with no material has no price either, and its weight is just as
      // absent from the total.
      unpricedCount += 1;
      unpricedGrams += grams;
      issues.push(`${label}: materialnya tidak ada lagi di daftar bahan, jadi biayanya dihitung Rp 0.`);
      return;
    }

    if (grams <= 0) {
      issues.push(`${label}: gramnya masih 0.`);
    }

    if (priceOf(item) <= 0) {
      unpricedCount += 1;
      unpricedGrams += grams;
      issues.push(`${label}: harga belinya belum diisi, jadi biayanya dihitung Rp 0.`);
    }
  });

  if (!rows.length) {
    issues.push('Formula ini belum punya baris material.');
  } else if (totalGrams <= 0) {
    issues.push('Total gram formula masih 0.');
  }

  return {
    isReady: issues.length === 0,
    issueCount: issues.length,
    issues,
    primaryIssue: issues[0] || '',
    totalGrams,
    unpricedCount,
    unpricedGrams,
    // What share of the weight the cost below is blind to. This is the honest headline: 0% means the
    // number can be trusted, 45% means it is missing nearly half the formula.
    unpricedShare: totalGrams > 0 ? unpricedGrams / totalGrams : 0,
  };
};
