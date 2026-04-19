
/**
 * Calculate percentages for accord items based on gram amounts
 * @param {Array} accordItems - Array of {raw_material_id, gram_amount}
 * @returns {Array} Array with calculated percentages added
 */
export const calculateAccordPercentages = (accordItems) => {
  if (!accordItems || accordItems.length === 0) {
    return [];
  }

  const totalGrams = calculateAccordTotalGrams(accordItems);
  
  if (totalGrams === 0) {
    return accordItems.map(item => ({
      ...item,
      percentage: 0
    }));
  }

  return accordItems.map((item) => {
    const gramAmount = parseFloat(item.gram_amount) || 0;
    const percentage = (gramAmount / totalGrams) * 100;
    const roundedPercentage = Math.round(percentage * 100) / 100;

    return {
      ...item,
      percentage: roundedPercentage
    };
  });
};

/**
 * Calculate total grams from accord items
 * @param {Array} accordItems - Array of {raw_material_id, gram_amount}
 * @returns {number} Sum of all gram amounts
 */
export const calculateAccordTotalGrams = (accordItems) => {
  if (!accordItems || accordItems.length === 0) {
    return 0;
  }

  return accordItems.reduce((sum, item) => {
    const gramAmount = parseFloat(item.gram_amount) || 0;
    return sum + gramAmount;
  }, 0);
};
