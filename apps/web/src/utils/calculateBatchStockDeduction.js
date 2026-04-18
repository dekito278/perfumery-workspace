
import pb from '@/lib/pocketbaseClient';
import { calculateBatchComposition } from '@/services/batchesService.js';

/**
 * Calculate and validate stock deductions for batch production using expanded composition
 * Uses the same composition breakdown as calculateBatchCost for consistency
 * 
 * @param {Object} batch - Batch record with formula_quantity_needed, solvent_quantity_needed
 * @param {Array} formulaItems - Array of formula_items
 * @param {Object} solvent - Solvent raw material record
 * @returns {Object} { valid: boolean, deductions: Array, errors: Array }
 */
export const calculateAndValidateBatchStockDeduction = async (batch, formulaItems, solvent) => {
  console.log('=== CALCULATING AND VALIDATING BATCH STOCK DEDUCTION ===');
  console.log('Batch:', batch);

  const errors = [];
  const deductions = [];

  try {
    // Get expanded composition (same as used in cost calculation)
    const expandedComposition = await calculateBatchComposition(batch, formulaItems, solvent);
    
    console.log('Expanded composition:', expandedComposition);

    // Validate stock availability for each material
    for (const item of expandedComposition) {
      try {
        const material = await pb.collection('raw_materials').getOne(item.raw_material_id, { $autoCancel: false });
        
        const availableStock = material.stock_quantity || 0;
        const requiredQuantity = item.required_quantity || 0;

        console.log(`Checking ${material.name}: available=${availableStock}, required=${requiredQuantity}`);

        if (availableStock < requiredQuantity) {
          errors.push({
            material_id: item.raw_material_id,
            material_name: material.name,
            type: item.type,
            available: availableStock,
            required: requiredQuantity,
            shortage: requiredQuantity - availableStock,
            message: `Insufficient stock for ${material.name}: need ${requiredQuantity} ${material.unit}, have ${availableStock} ${material.unit}`
          });
        }

        // Add to deductions list
        deductions.push({
          raw_material_id: item.raw_material_id,
          material_name: material.name,
          amount_to_deduct: requiredQuantity,
          type: item.type,
          source: item.source,
          cost: item.total_cost || 0,
          unit: material.unit
        });

      } catch (error) {
        console.error(`Failed to fetch material ${item.raw_material_id}:`, error);
        errors.push({
          material_id: item.raw_material_id,
          message: `Failed to validate material: ${error.message}`
        });
      }
    }

    const valid = errors.length === 0;

    console.log('Validation result:', { valid, deductions, errors });

    return {
      valid,
      deductions,
      errors,
      summary: {
        total_materials: deductions.length,
        formula_ingredients: deductions.filter(d => d.type === 'formula_ingredient').length,
        dilution_solvents: deductions.filter(d => d.type === 'dilution_solvent').length,
        main_batch_solvents: deductions.filter(d => d.type === 'main_batch_solvent').length
      }
    };

  } catch (error) {
    console.error('Failed to calculate stock deduction:', error);
    throw new Error(`Failed to calculate stock deduction: ${error.message}`);
  }
};

/**
 * Execute stock deductions atomically
 * @param {Array} deductions - Array from calculateAndValidateBatchStockDeduction
 * @returns {Object} Summary of deductions
 */
export const executeStockDeductions = async (deductions) => {
  console.log('=== EXECUTING STOCK DEDUCTIONS ===');
  console.log('Deductions:', deductions);

  const results = [];

  for (const deduction of deductions) {
    try {
      const material = await pb.collection('raw_materials').getOne(deduction.raw_material_id, { $autoCancel: false });
      
      const newStock = material.stock_quantity - deduction.amount_to_deduct;
      
      await pb.collection('raw_materials').update(deduction.raw_material_id, {
        stock_quantity: newStock
      }, { $autoCancel: false });

      results.push({
        material_id: deduction.raw_material_id,
        material_name: deduction.material_name,
        previous_stock: material.stock_quantity,
        deducted: deduction.amount_to_deduct,
        new_stock: newStock,
        type: deduction.type
      });

      console.log(`Deducted ${deduction.amount_to_deduct} from ${deduction.material_name}: ${material.stock_quantity} → ${newStock}`);

    } catch (error) {
      console.error(`Failed to deduct stock for ${deduction.material_name}:`, error);
      throw new Error(`Failed to deduct stock for ${deduction.material_name}: ${error.message}`);
    }
  }

  return {
    success: true,
    deductions: results,
    total_deducted: deductions.length
  };
};

/**
 * Legacy function - kept for backward compatibility
 */
export const calculateStockDeductionFromComposition = (expandedComposition) => {
  const deductions = [];

  for (const item of expandedComposition) {
    let deductionType = 'ingredient';
    if (item.type === 'main_batch_solvent') {
      deductionType = 'solvent';
    } else if (item.type === 'dilution_solvent') {
      deductionType = 'solvent';
    }

    deductions.push({
      raw_material_id: item.raw_material_id,
      amount_to_deduct: item.required_quantity,
      type: deductionType,
      source: item.source || 'batch production'
    });
  }

  return deductions;
};
