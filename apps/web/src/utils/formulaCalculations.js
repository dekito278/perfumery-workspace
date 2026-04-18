
import { getRawMaterialById } from '@/services/rawMaterialsService.js';
import { calculateDilutionCost } from './calculateDilutionCost.js';

export const calculateTotalGrams = (items) => {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, item) => sum + (parseFloat(item.gram_amount) || 0), 0);
};

export const calculatePercentages = (items, totalGrams) => {
  if (!items || items.length === 0 || totalGrams === 0) return [];
  
  return items.map(item => {
    const gramAmount = parseFloat(item.gram_amount) || 0;
    const percentage = (gramAmount / totalGrams) * 100;
    return {
      ...item,
      percentage: Math.round(percentage * 10) / 10
    };
  });
};

export const calculateEffectiveUnitCost = (purchasePrice, purchaseQuantity = 10) => {
  if (!purchasePrice || purchasePrice <= 0) return 0;
  if (!purchaseQuantity || purchaseQuantity <= 0) return 0;
  
  const effectiveCostPerUnit = purchasePrice / purchaseQuantity;
  return Math.round(effectiveCostPerUnit * 100) / 100;
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
  });
  
  return errors;
};

/**
 * Calculate total amount with dilution breakdown
 * @param {Array} items - Formula items
 * @returns {Object} { totalGrams, totalActive, totalSolvent, breakdown }
 */
export const calculateTotalAmount = async (items) => {
  if (!items || items.length === 0) {
    return { totalGrams: 0, totalActive: 0, totalSolvent: 0, breakdown: [] };
  }

  let totalGrams = 0;
  let totalActive = 0;
  let totalSolvent = 0;
  const breakdown = [];

  for (const item of items) {
    const gramAmount = parseFloat(item.gram_amount) || 0;
    totalGrams += gramAmount;

    // Check if this is a diluted material
    if ((item.item_type === 'raw_material' || item.item_type === 'solvent') && item.item_id) {
      try {
        const material = await getRawMaterialById(item.item_id);
        
        if (material.is_diluted && material.dilution_percentage) {
          const dilutionBreakdown = calculateDilutionCost(
            gramAmount,
            0, // price not needed for composition
            material.dilution_percentage
          );
          
          totalActive += dilutionBreakdown.activeAmount;
          totalSolvent += dilutionBreakdown.solventAmount;
          
          breakdown.push({
            item_id: item.item_id,
            name: material.name,
            totalAmount: gramAmount,
            activeAmount: dilutionBreakdown.activeAmount,
            solventAmount: dilutionBreakdown.solventAmount,
            isDiluted: true
          });
        } else {
          totalActive += gramAmount;
          breakdown.push({
            item_id: item.item_id,
            name: material.name,
            totalAmount: gramAmount,
            activeAmount: gramAmount,
            solventAmount: 0,
            isDiluted: false
          });
        }
      } catch (error) {
        console.error(`Failed to fetch material ${item.item_id}:`, error);
        totalActive += gramAmount;
      }
    } else {
      totalActive += gramAmount;
    }
  }

  return {
    totalGrams: Math.round(totalGrams * 1000) / 1000,
    totalActive: Math.round(totalActive * 1000) / 1000,
    totalSolvent: Math.round(totalSolvent * 1000) / 1000,
    breakdown
  };
};

/**
 * Calculate formula cost with dilution support
 * @param {Array} items - Formula items
 * @param {Array} materials - Raw materials array
 * @param {Array} accords - Accords array
 * @returns {Object} { totalCost, costBreakdown }
 */
export const calculateFormulaCost = async (items, materials, accords) => {
  if (!items || items.length === 0) {
    return { totalCost: 0, costBreakdown: [] };
  }
  
  let totalCost = 0;
  const costBreakdown = [];
  
  for (const item of items) {
    const gramAmount = parseFloat(item.gram_amount) || 0;
    let itemCost = 0;
    let dilutionInfo = null;
    
    if (item.item_type === 'raw_material' || item.item_type === 'solvent') {
      const material = materials.find(m => m.id === item.item_id);
      
      if (material && material.cost_per_unit) {
        if (material.is_diluted && material.dilution_percentage) {
          // Diluted material: use dilution cost calculation
          const breakdown = calculateDilutionCost(
            gramAmount,
            material.cost_per_unit,
            material.dilution_percentage
          );
          
          itemCost = breakdown.totalCost;
          dilutionInfo = {
            isDiluted: true,
            percentage: material.dilution_percentage,
            activeAmount: breakdown.activeAmount,
            solventAmount: breakdown.solventAmount
          };
        } else {
          // Non-diluted material: standard calculation
          const costPerGram = calculateEffectiveUnitCost(material.cost_per_unit, 10);
          itemCost = gramAmount * costPerGram;
        }
      }
    } else if (item.item_type === 'accord') {
      const accord = accords.find(a => a.id === item.item_id);
      if (accord && accord.cost_per_unit) {
        itemCost = gramAmount * accord.cost_per_unit;
      }
    }
    
    totalCost += itemCost;
    
    costBreakdown.push({
      item_id: item.item_id,
      item_type: item.item_type,
      gramAmount,
      cost: itemCost,
      dilutionInfo
    });
  }
  
  return {
    totalCost: Math.round(totalCost * 100) / 100,
    costBreakdown
  };
};
