
import pb from '@/lib/pocketbaseClient.js';
import { calculateDilutionComposition } from '@/utils/calculateDilutionCost.js';
import { calculateAndValidateBatchStockDeduction, executeStockDeductions } from '@/utils/calculateBatchStockDeduction.js';

/**
 * Generates a unique batch code using timestamp and random suffix
 * Format: BATCH-{timestamp}-{randomSuffix}
 * Example: BATCH-1705432156789-A7K2X9M3
 */
const generateBatchCode = () => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substr(2, 8).toUpperCase();
  return `BATCH-${timestamp}-${randomSuffix}`;
};

/**
 * Calculate batch composition including formula ingredients AND solvent
 * Expands diluted materials into active material + dilution solvent
 * @param {Object} batch - Batch record with formula_quantity_needed, solvent_quantity_needed
 * @param {Array} formulaItems - Array of formula_items with item_id, item_type, grams, percentage
 * @param {Object} solvent - Solvent raw material record
 * @returns {Array} Array of {type, raw_material_id, name, required_quantity, unit, cost_per_unit, total_cost, source}
 */
export const calculateBatchComposition = async (batch, formulaItems, solvent) => {
  const composition = [];
  
  // Calculate total grams in formula
  const formulaTotalGrams = formulaItems.reduce((sum, item) => {
    return sum + (parseFloat(item.grams) || 0);
  }, 0);

  if (formulaTotalGrams <= 0) {
    return composition;
  }

  // Add formula ingredients (with dilution expansion)
  for (const item of formulaItems) {
    if (item.item_type === 'raw_material' || item.item_type === 'solvent') {
      const ingredientGrams = parseFloat(item.grams) || 0;
      const proportion = ingredientGrams / formulaTotalGrams;
      const requiredQuantity = proportion * batch.formula_quantity_needed;

      try {
        const material = await pb.collection('raw_materials').getOne(item.item_id, { $autoCancel: false });
        
        // Check if material is diluted
        if (material.is_diluted && material.dilution_percentage && material.dilution_solvent_id) {
          // Diluted material: split into active material + dilution solvent
          const breakdown = calculateDilutionComposition(requiredQuantity, material.dilution_percentage);
          
          // Add active material component
          const pricePerUnit = material.cost_per_unit || 0;
          const effectivePricePerMl = pricePerUnit / 10;
          const activeCost = effectivePricePerMl * breakdown.activeAmount;
          
          composition.push({
            type: 'formula_ingredient',
            raw_material_id: item.item_id,
            name: material.name,
            required_quantity: Math.round(breakdown.activeAmount * 1000) / 1000,
            unit: material.unit || batch.unit,
            cost_per_unit: pricePerUnit,
            cost_per_ml: effectivePricePerMl,
            total_cost: activeCost,
            source: `from ${material.name} ${material.dilution_percentage}% diluted`
          });
          
          // Add dilution solvent component
          try {
            const dilutionSolvent = await pb.collection('raw_materials').getOne(material.dilution_solvent_id, { $autoCancel: false });
            const solventPricePerUnit = dilutionSolvent.cost_per_unit || 0;
            const solventEffectivePricePerMl = solventPricePerUnit / 10;
            const solventCost = solventEffectivePricePerMl * breakdown.solventAmount;
            
            composition.push({
              type: 'dilution_solvent',
              raw_material_id: material.dilution_solvent_id,
              name: dilutionSolvent.name,
              required_quantity: Math.round(breakdown.solventAmount * 1000) / 1000,
              unit: dilutionSolvent.unit || batch.unit,
              cost_per_unit: solventPricePerUnit,
              cost_per_ml: solventEffectivePricePerMl,
              total_cost: solventCost,
              source: `from ${material.name} ${material.dilution_percentage}% diluted`
            });
          } catch (error) {
            console.error(`Failed to fetch dilution solvent ${material.dilution_solvent_id}:`, error);
          }
        } else {
          // Non-diluted material: add as-is
          const pricePerUnit = material.cost_per_unit || 0;
          const effectivePricePerMl = pricePerUnit / 10;
          const totalCost = effectivePricePerMl * requiredQuantity;
          
          composition.push({
            type: 'formula_ingredient',
            raw_material_id: item.item_id,
            name: material.name,
            required_quantity: Math.round(requiredQuantity * 1000) / 1000,
            unit: material.unit || batch.unit,
            cost_per_unit: pricePerUnit,
            cost_per_ml: effectivePricePerMl,
            total_cost: totalCost,
            source: 'direct ingredient'
          });
        }
      } catch (error) {
        console.error(`Failed to fetch material ${item.item_id}:`, error);
      }
    }
  }

  // Add main batch solvent as separate material
  if (solvent && batch.solvent_quantity_needed > 0) {
    const solventCost = (solvent.cost_per_unit || 0) * batch.solvent_quantity_needed;
    
    composition.push({
      type: 'main_batch_solvent',
      raw_material_id: solvent.id,
      name: solvent.name,
      required_quantity: Math.round(batch.solvent_quantity_needed * 1000) / 1000,
      unit: solvent.unit || batch.unit,
      cost_per_unit: solvent.cost_per_unit || 0,
      total_cost: solventCost,
      source: 'batch dilution solvent'
    });
  }

  return composition;
};

/**
 * Calculate total batch cost including formula ingredients AND solvent
 * Separates costs by type: formula_ingredient, dilution_solvent, main_batch_solvent
 * @param {Array} composition - Array from calculateBatchComposition
 * @param {number} targetQuantity - Target batch quantity
 * @returns {Object} { formula_ingredient_cost, dilution_solvent_cost, main_batch_solvent_cost, total_cost, cost_per_unit }
 */
export const calculateBatchCost = (composition, targetQuantity) => {
  let formulaIngredientCost = 0;
  let dilutionSolventCost = 0;
  let mainBatchSolventCost = 0;

  for (const item of composition) {
    const itemCost = item.total_cost || 0;
    
    if (item.type === 'formula_ingredient') {
      formulaIngredientCost += itemCost;
    } else if (item.type === 'dilution_solvent') {
      dilutionSolventCost += itemCost;
    } else if (item.type === 'main_batch_solvent') {
      mainBatchSolventCost += itemCost;
    }
  }

  const totalCost = formulaIngredientCost + dilutionSolventCost + mainBatchSolventCost;
  const costPerUnit = targetQuantity > 0 ? totalCost / targetQuantity : 0;

  return {
    formula_ingredient_cost: Math.round(formulaIngredientCost * 100) / 100,
    dilution_solvent_cost: Math.round(dilutionSolventCost * 100) / 100,
    main_batch_solvent_cost: Math.round(mainBatchSolventCost * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
    cost_per_unit: Math.round(costPerUnit * 100) / 100
  };
};

/**
 * Validate batch stock deduction before execution
 * @param {Object} batch - Batch record
 * @returns {Object} Validation result with deductions or errors
 */
export const validateBatchStockDeduction = async (batch) => {
  console.log('=== VALIDATING BATCH STOCK DEDUCTION ===');
  console.log('Batch:', batch);

  // Check if batch is already completed
  if (batch.is_stock_deducted) {
    throw new Error('Stock has already been deducted for this batch');
  }

  // Get formula items
  const formulaItems = await pb.collection('formula_items').getFullList({
    filter: `formula_id = "${batch.formula_id}"`,
    $autoCancel: false
  });

  // Get solvent
  let solvent = null;
  if (batch.solvent_id) {
    solvent = await pb.collection('raw_materials').getOne(batch.solvent_id, { $autoCancel: false });
  }

  // Validate stock availability
  const validation = await calculateAndValidateBatchStockDeduction(batch, formulaItems, solvent);

  if (!validation.valid) {
    const errorMessages = validation.errors.map(e => e.message).join('; ');
    throw new Error(`Insufficient stock: ${errorMessages}`);
  }

  return validation;
};

/**
 * Record batch usage in batch_usage_records collection
 * @param {string} batchId - Batch ID
 * @param {Array} usageItems - Array of usage items
 */
export const recordBatchUsage = async (batchId, usageItems) => {
  console.log('=== RECORDING BATCH USAGE ===');
  console.log('Batch ID:', batchId);
  console.log('Usage items:', usageItems);

  const records = [];

  for (const item of usageItems) {
    try {
      const record = await pb.collection('batch_usage_records').create({
        batch_id: batchId,
        raw_material_id: item.raw_material_id,
        quantity_deducted: item.amount_to_deduct,
        type: item.type,
        source: item.source,
        cost: item.cost
      }, { $autoCancel: false });

      records.push(record);
      console.log(`Recorded usage for ${item.material_name}`);
    } catch (error) {
      console.error(`Failed to record usage for ${item.material_name}:`, error);
      throw new Error(`Failed to record usage: ${error.message}`);
    }
  }

  return records;
};

/**
 * Complete batch with stock deduction
 * Validates stock, deducts materials, records usage, updates batch
 * @param {string} batchId - Batch ID
 * @returns {Object} Result with success message and updated batch
 */
export const completeBatchWithStockDeduction = async (batchId) => {
  console.log('=== COMPLETING BATCH WITH STOCK DEDUCTION ===');
  console.log('Batch ID:', batchId);

  try {
    // Get batch
    const batch = await pb.collection('batches').getOne(batchId, { $autoCancel: false });

    // Validate stock deduction
    const validation = await validateBatchStockDeduction(batch);

    // Execute stock deductions
    const deductionResult = await executeStockDeductions(validation.deductions);

    // Record batch usage
    await recordBatchUsage(batchId, validation.deductions);

    // Update batch status
    const updatedBatch = await pb.collection('batches').update(batchId, {
      status: 'completed',
      is_stock_deducted: true
    }, { $autoCancel: false });

    console.log('Batch completed successfully');

    return {
      success: true,
      message: 'Batch completed and stock deducted successfully',
      batch: updatedBatch,
      deductions: deductionResult.deductions
    };

  } catch (error) {
    console.error('=== COMPLETE BATCH ERROR ===');
    console.error('Error:', error);
    throw error;
  }
};

export const getBatches = async () => {
  try {
    const records = await pb.collection('batches').getFullList({
      sort: '-created',
      expand: 'formula_id,solvent_id',
      $autoCancel: false
    });
    return records;
  } catch (error) {
    console.error('Error fetching batches:', error);
    throw new Error('Failed to fetch batches');
  }
};

export const getBatchById = async (id) => {
  try {
    const record = await pb.collection('batches').getOne(id, {
      expand: 'formula_id,solvent_id',
      $autoCancel: false
    });
    return record;
  } catch (error) {
    console.error('Error fetching batch:', error);
    throw new Error('Failed to fetch batch');
  }
};

export const createBatch = async (batchData) => {
  try {
    const userId = pb.authStore.model?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    console.log('=== BATCH CREATION DEBUG ===');
    console.log('Input batchData:', batchData);

    // Extract formula_id as string
    const formulaId = typeof batchData.formula_id === 'string' 
      ? batchData.formula_id 
      : batchData.formula_id?.id;

    // Extract solvent_id as string
    const solventId = typeof batchData.solvent_id === 'string'
      ? batchData.solvent_id
      : batchData.solvent_id?.id;

    // Generate unique batch_code
    const batchCode = batchData.batch_code || generateBatchCode();

    // Format production_date
    const prodDate = batchData.production_date || new Date().toISOString().split('T')[0];

    // Ensure all required numeric fields are present
    const targetQuantity = Number(batchData.target_quantity);
    const formulaPercentage = Number(batchData.formula_percentage);
    const solventPercentage = Number(batchData.solvent_percentage);
    const formulaQuantityNeeded = Number(batchData.formula_quantity_needed);
    const solventQuantityNeeded = Number(batchData.solvent_quantity_needed);

    // Build minimal required payload
    const payload = {
      batch_code: batchCode,
      formula_id: formulaId,
      solvent_id: solventId,
      target_quantity: targetQuantity,
      produced_quantity: targetQuantity,
      production_date: prodDate,
      unit: batchData.unit || 'ml',
      formula_percentage: formulaPercentage,
      solvent_percentage: solventPercentage,
      formula_quantity_needed: formulaQuantityNeeded,
      solvent_quantity_needed: solventQuantityNeeded,
      userId: userId,
      is_stock_deducted: false
    };

    // Add optional fields only if provided
    if (batchData.status && ['draft', 'in_progress', 'completed'].includes(batchData.status)) {
      payload.status = batchData.status;
    }

    if (batchData.notes) {
      payload.notes = batchData.notes;
    }

    console.log('Batch payload being sent:', JSON.stringify(payload, null, 2));

    const batch = await pb.collection('batches').create(payload, { $autoCancel: false });
    
    console.log('Batch created successfully:', batch);
    
    return batch;
  } catch (error) {
    console.error('=== BATCH CREATION ERROR ===');
    console.error('Error object:', error);
    console.error('Error data:', error.data);
    
    let errorMessage = 'Failed to create batch';
    if (error.data?.data) {
      const validationErrors = Object.entries(error.data.data)
        .map(([field, err]) => `${field}: ${err.message || err.code}`)
        .join(', ');
      errorMessage = `Validation failed: ${validationErrors}`;
    } else if (error.data?.message) {
      errorMessage = error.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.error('Final error message:', errorMessage);
    throw new Error(errorMessage);
  }
};

export const updateBatch = async (batchId, batchData) => {
  try {
    console.log('=== BATCH UPDATE DEBUG ===');
    console.log('Updating batch:', batchId);
    console.log('Input batchData:', batchData);

    const payload = {};

    // Only include fields that are being updated
    if (batchData.batch_code !== undefined) {
      payload.batch_code = batchData.batch_code;
    }

    if (batchData.formula_id !== undefined) {
      payload.formula_id = typeof batchData.formula_id === 'string' 
        ? batchData.formula_id 
        : batchData.formula_id?.id;
    }

    if (batchData.solvent_id !== undefined) {
      payload.solvent_id = typeof batchData.solvent_id === 'string'
        ? batchData.solvent_id
        : batchData.solvent_id?.id;
    }

    if (batchData.target_quantity !== undefined) {
      payload.target_quantity = Number(batchData.target_quantity);
    }

    if (batchData.produced_quantity !== undefined) {
      payload.produced_quantity = Number(batchData.produced_quantity);
    }

    if (batchData.production_date !== undefined) {
      payload.production_date = batchData.production_date;
    }

    if (batchData.unit !== undefined) {
      payload.unit = batchData.unit;
    }

    if (batchData.formula_percentage !== undefined) {
      payload.formula_percentage = Number(batchData.formula_percentage);
    }

    if (batchData.solvent_percentage !== undefined) {
      payload.solvent_percentage = Number(batchData.solvent_percentage);
    }

    if (batchData.formula_quantity_needed !== undefined) {
      payload.formula_quantity_needed = Number(batchData.formula_quantity_needed);
    }

    if (batchData.solvent_quantity_needed !== undefined) {
      payload.solvent_quantity_needed = Number(batchData.solvent_quantity_needed);
    }

    if (batchData.status !== undefined) {
      payload.status = batchData.status;
    }

    if (batchData.notes !== undefined) {
      payload.notes = batchData.notes;
    }

    console.log('Update payload:', payload);

    const batch = await pb.collection('batches').update(batchId, payload, { $autoCancel: false });
    
    console.log('Batch updated successfully');
    
    return batch;
  } catch (error) {
    console.error('=== BATCH UPDATE ERROR ===');
    console.error('Error:', error);
    console.error('Error data:', error.data);
    
    let errorMessage = 'Failed to update batch';
    if (error.data?.data) {
      const validationErrors = Object.entries(error.data.data)
        .map(([field, err]) => `${field}: ${err.message || err.code}`)
        .join(', ');
      errorMessage = `Validation failed: ${validationErrors}`;
    } else if (error.data?.message) {
      errorMessage = error.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
};

export const deleteBatch = async (batchId) => {
  try {
    await pb.collection('batches').delete(batchId, { $autoCancel: false });
  } catch (error) {
    console.error('Error deleting batch:', error);
    throw new Error('Failed to delete batch');
  }
};

// Legacy completeBatch function - kept for backward compatibility
export const completeBatch = async (batchId, expandedComposition) => {
  try {
    console.log('=== COMPLETE BATCH (LEGACY) ===');
    console.log('Batch ID:', batchId);

    const batch = await pb.collection('batches').getOne(batchId, { $autoCancel: false });

    if (batch.is_stock_deducted) {
      throw new Error('Stock has already been deducted for this batch');
    }

    // Use expanded composition for stock deduction
    for (const item of expandedComposition) {
      const material = await pb.collection('raw_materials').getOne(item.raw_material_id, { $autoCancel: false });

      const newStock = material.stock_quantity - item.required_quantity;
      await pb.collection('raw_materials').update(item.raw_material_id, {
        stock_quantity: newStock
      }, { $autoCancel: false });

      // Create stock deduction record
      await pb.collection('stock_deductions').create({
        raw_material_id: item.raw_material_id,
        batch_id: batchId,
        amount_deducted: item.required_quantity,
        type: item.type === 'main_batch_solvent' ? 'solvent' : 'ingredient'
      }, { $autoCancel: false });
    }

    // Update batch status
    const updatedBatch = await pb.collection('batches').update(batchId, {
      status: 'completed',
      is_stock_deducted: true
    }, { $autoCancel: false });

    return {
      success: true,
      message: 'Batch completed successfully. Raw material stock has been updated.',
      batch: updatedBatch
    };
  } catch (error) {
    console.error('=== COMPLETE BATCH ERROR ===');
    console.error('Error:', error);
    throw new Error(error.message || 'Failed to complete batch');
  }
};
