export const calculateTotalGrams = (items) => {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, item) => sum + (parseFloat(item.gram_amount) || 0), 0);
};

export const calculatePercentages = (items, totalGrams) => {
  if (!items || items.length === 0 || totalGrams === 0) return [];

  // Largest-remainder rounding: round each to 1 decimal but hand the leftover 0.1s to the items with
  // the biggest dropped fraction, so the percentages sum to exactly 100.0. Rounding each item
  // independently drifts the total to 99.8 / 100.2, which is misleading for a perfumery composition.
  const exact = items.map((item) => ((parseFloat(item.gram_amount) || 0) / totalGrams) * 100);
  const floored = exact.map((value) => Math.floor(value * 10) / 10);
  const flooredSum = floored.reduce((sum, value) => sum + value, 0);
  let remainingTenths = Math.round((100 - flooredSum) * 10);
  const order = exact
    .map((value, index) => ({ index, frac: value * 10 - Math.floor(value * 10) }))
    .sort((a, b) => b.frac - a.frac);
  const bump = new Array(items.length).fill(0);
  for (let i = 0; i < order.length && remainingTenths > 0; i += 1) {
    bump[order[i].index] = 0.1;
    remainingTenths -= 1;
  }

  return items.map((item, index) => ({
    ...item,
    percentage: Math.round((floored[index] + bump[index]) * 10) / 10,
  }));
};

export const validateFormulaItems = (items) => {
  const errors = [];
  
  if (!items || items.length === 0) {
    errors.push('Formula must have at least one ingredient');
    return errors;
  }
  
  items.forEach((item, index) => {
    if (!item.item_type) {
      errors.push(`Item ${index + 1}: Item type is required`);
    }
    if (!item.item_id) {
      errors.push(`Item ${index + 1}: Material selection is required`);
    }
    if (!item.gram_amount || parseFloat(item.gram_amount) <= 0) {
      errors.push(`Item ${index + 1}: Gram amount must be greater than 0`);
    }
    const percent = parseFloat(item.dilution_percent);
    const hasDilutionPercent = !Number.isNaN(percent) && percent > 0;
    const hasDilutionConfig = hasDilutionPercent || Boolean(item.dilution_solvent_id);

    if (hasDilutionConfig) {
      if (!hasDilutionPercent) {
        errors.push(`Item ${index + 1}: Dilution percentage must be between 0 and 100`);
      }
      if (!item.dilution_solvent_id && hasDilutionPercent) {
        errors.push(`Item ${index + 1}: Dilution solvent is required`);
      }
      if (hasDilutionPercent && percent > 100) {
        errors.push(`Item ${index + 1}: Dilution percentage must be between 0 and 100`);
      }
    }
  });
  
  return errors;
};

