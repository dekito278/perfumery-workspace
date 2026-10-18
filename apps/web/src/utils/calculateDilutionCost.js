
/**
 * Calculate cost and composition breakdown for diluted materials
 * 
 * @param {number} usedAmount - Amount of diluted material used (in ml)
 * @param {number} dilutedMaterialPrice - Price per 10ml of the diluted mixture
 * @param {number} dilutionPercentage - Percentage of active material (0-100)
 * @returns {Object} { totalCost, activeAmount, solventAmount }
 *
 * NOTE: dilutionPercentage does NOT affect totalCost. The cost is amount x (price / 10), because the
 * price already belongs to the diluted mixture as it sits on the shelf -- the percentage only splits that
 * amount into active and solvent for display. So this is the same arithmetic as calculateIngredientCost
 * with its base quantity of 10, and that is why calculateTotalCost's two branches agree to the cent.
 * Anything that makes the percentage reach the cost makes them disagree, and pricingUtils.selfcheck.mjs
 * fails on purpose if it does.
 */
export const calculateDilutionCost = (usedAmount, dilutedMaterialPrice, dilutionPercentage) => {
  const amount = Number(usedAmount) || 0;
  const price = Number(dilutedMaterialPrice) || 0;
  const percentage = Number(dilutionPercentage) || 0;

  // Cost per ml of diluted mixture
  const costPerMl = price / 10;
  
  // Total cost for the used amount
  const totalCost = amount * costPerMl;
  
  // Active material amount (e.g., 50% of 10ml = 5ml)
  const activeAmount = amount * (percentage / 100);
  
  // Solvent amount (e.g., 50% of 10ml = 5ml)
  const solventAmount = amount * ((100 - percentage) / 100);

  return {
    totalCost: Math.round(totalCost * 1000000) / 1000000, // 6 decimal precision
    activeAmount: Math.round(activeAmount * 1000000) / 1000000,
    solventAmount: Math.round(solventAmount * 1000000) / 1000000
  };
};

/**
 * Calculate composition breakdown for display (no cost calculation)
 * @param {number} usedAmount - Amount of diluted material used (in ml)
 * @param {number} dilutionPercentage - Percentage of active material (0-100)
 * @returns {Object} { activeAmount, solventAmount }
 */
export const calculateDilutionComposition = (usedAmount, dilutionPercentage) => {
  const amount = Number(usedAmount) || 0;
  const percentage = Number(dilutionPercentage) || 0;

  const activeAmount = amount * (percentage / 100);
  const solventAmount = amount * ((100 - percentage) / 100);

  return {
    activeAmount: Math.round(activeAmount * 1000) / 1000, // 3 decimal precision for display
    solventAmount: Math.round(solventAmount * 1000) / 1000
  };
};

/**
 * Format dilution info for display
 * @param {number} dilutionPercentage - Percentage of active material
 * @returns {string} Formatted dilution info (e.g., "50% active + 50% solvent")
 */
export const formatDilutionInfo = (dilutionPercentage) => {
  const percentage = Number(dilutionPercentage) || 0;
  const solventPercentage = 100 - percentage;
  return `${percentage}% active + ${solventPercentage}% solvent`;
};

