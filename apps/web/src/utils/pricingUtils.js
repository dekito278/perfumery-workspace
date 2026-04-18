
/**
 * Pricing utility functions for cost calculations and formatting
 * Indonesian Rupiah formatting with period (.) as thousand separator
 */

import { calculateDilutionCost } from './calculateDilutionCost.js';

/**
 * Format price in Indonesian Rupiah with thousand separators and no decimals
 * @param {number} price - Price value to format
 * @returns {string} Formatted price string (e.g., "Rp 3.000", "Rp 1.200.000")
 */
export const formatPrice = (price) => {
  if (price === null || price === undefined) return 'Rp 0';
  const numValue = Number(price);
  if (isNaN(numValue)) return 'Rp 0';
  
  const rounded = Math.round(numValue);
  const formatted = rounded.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return `Rp ${formatted}`;
};

/**
 * Format price per unit (10ml) in Indonesian Rupiah
 * @param {number} price - Price per 10ml
 * @returns {string} Formatted price string (e.g., "Rp 3.000 per 10 ml")
 */
export const formatPricePerUnit = (price) => {
  if (price === null || price === undefined) return 'Rp 0 per 10 ml';
  const numValue = Number(price);
  if (isNaN(numValue)) return 'Rp 0 per 10 ml';
  
  const rounded = Math.round(numValue);
  const formatted = rounded.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return `Rp ${formatted} per 10 ml`;
};

/**
 * Calculate ingredient cost based on gram amount and unit price (per 10ml)
 * @param {number} gramAmount - Amount in grams
 * @param {number} unitPrice - Price per 10ml
 * @returns {number} Calculated cost
 */
export const calculateIngredientCost = (gramAmount, unitPrice) => {
  const grams = Number(gramAmount) || 0;
  const price = Number(unitPrice) || 0;
  return (grams / 10) * price;
};

/**
 * Calculate ingredient cost with dilution support
 * @param {Object} ingredient - Ingredient object with gram_amount
 * @param {Object} rawMaterial - Raw material object with cost_per_unit, is_diluted, dilution_percentage
 * @returns {Object} { cost, activeAmount, solventAmount, dilutionInfo }
 */
export const calculateIngredientCostWithDilution = (ingredient, rawMaterial) => {
  const gramAmount = ingredient.gram_amount || ingredient.grams || 0;
  const unitPrice = rawMaterial.cost_per_unit || 0;

  if (rawMaterial.is_diluted && rawMaterial.dilution_percentage) {
    // Diluted material: calculate breakdown
    const breakdown = calculateDilutionCost(
      gramAmount,
      unitPrice,
      rawMaterial.dilution_percentage
    );

    return {
      cost: breakdown.totalCost,
      activeAmount: breakdown.activeAmount,
      solventAmount: breakdown.solventAmount,
      dilutionInfo: {
        isDiluted: true,
        percentage: rawMaterial.dilution_percentage,
        solventId: rawMaterial.dilution_solvent_id
      }
    };
  } else {
    // Non-diluted material: standard calculation
    const cost = calculateIngredientCost(gramAmount, unitPrice);
    return {
      cost,
      activeAmount: gramAmount,
      solventAmount: 0,
      dilutionInfo: {
        isDiluted: false
      }
    };
  }
};

/**
 * Calculate total cost from array of ingredients
 * @param {Array} ingredients - Array of ingredient objects with gram_amount and unit_price
 * @returns {number} Total cost
 */
export const calculateTotalCost = (ingredients) => {
  if (!Array.isArray(ingredients)) return 0;
  
  return ingredients.reduce((total, ingredient) => {
    const gramAmount = ingredient.gram_amount || ingredient.grams || 0;
    const unitPrice = ingredient.unit_price || 0;
    
    // Check if ingredient has dilution info
    if (ingredient.is_diluted && ingredient.dilution_percentage) {
      const breakdown = calculateDilutionCost(
        gramAmount,
        unitPrice,
        ingredient.dilution_percentage
      );
      return total + breakdown.totalCost;
    } else {
      return total + calculateIngredientCost(gramAmount, unitPrice);
    }
  }, 0);
};
