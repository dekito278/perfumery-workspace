
/**
 * Calculate percentages for accord items based on gram amounts
 * @param {Array} accordItems - Array of {raw_material_id, gram_amount}
 * @returns {Array} Array with calculated percentages added
 */
export const calculateAccordPercentages = (accordItems) => {
  console.log('=== CALCULATING ACCORD PERCENTAGES ===');
  console.log('Input items:', JSON.stringify(accordItems, null, 2));

  if (!accordItems || accordItems.length === 0) {
    console.log('No items to calculate');
    return [];
  }

  const totalGrams = calculateAccordTotalGrams(accordItems);
  console.log('Total grams:', totalGrams);
  
  if (totalGrams === 0) {
    console.warn('Total grams is 0, returning 0% for all items');
    return accordItems.map(item => ({
      ...item,
      percentage: 0
    }));
  }

  const itemsWithPercentages = accordItems.map((item, index) => {
    const gramAmount = parseFloat(item.gram_amount) || 0;
    const percentage = (gramAmount / totalGrams) * 100;
    const roundedPercentage = Math.round(percentage * 100) / 100; // Round to 2 decimals
    
    console.log(`Item ${index + 1} percentage calc:`, {
      raw_material_id: item.raw_material_id,
      gram_amount: gramAmount,
      totalGrams: totalGrams,
      percentage: percentage,
      roundedPercentage: roundedPercentage,
      isNumber: typeof roundedPercentage === 'number'
    });
    
    return {
      ...item,
      percentage: roundedPercentage
    };
  });

  console.log('Items with percentages:', JSON.stringify(itemsWithPercentages, null, 2));
  return itemsWithPercentages;
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

  const total = accordItems.reduce((sum, item) => {
    const gramAmount = parseFloat(item.gram_amount) || 0;
    return sum + gramAmount;
  }, 0);

  console.log('Total grams calculated:', total);
  return total;
};
