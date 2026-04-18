
/**
 * Calculate total amount from formula items
 * Handles both gram_amount (frontend) and grams (database) field names
 * @param {Array} items - Array of formula items
 * @returns {number} Total amount in grams
 */
export const calculateTotalAmount = (items) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return 0;
  }
  
  return items.reduce((sum, item) => {
    const amount = parseFloat(item.gram_amount || item.grams || 0);
    return sum + amount;
  }, 0);
};
