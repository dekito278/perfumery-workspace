import supabase from '@/lib/supabaseClient.js';
import { getFormulaItems } from '@/services/formulasSupabaseService.js';
import { getAccordItemsByAccordIds } from '@/services/accordsSupabaseService.js';
import { getCurrentUserId, fetchAccordsMap, fetchFormulasMap, fetchRawMaterialsMap, toAppRecord } from '@/services/supabaseDataHelpers.js';
import { calculateDilutionComposition } from '@/utils/calculateDilutionCost.js';

const generateBatchCode = () => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `BATCH-${timestamp}-${randomSuffix}`;
};

const mapBatch = (row, formulasMap = new Map(), materialsMap = new Map()) => ({
  ...toAppRecord(row),
  expand: {
    formula_id: row.formula_id ? formulasMap.get(row.formula_id) || null : null,
    solvent_id: row.solvent_id ? materialsMap.get(row.solvent_id) || null : null,
  },
});

export const calculateBatchComposition = async (batch, formulaItems, solvent) => {
  const composition = [];
  const formulaTotalGrams = formulaItems.reduce((sum, item) => sum + (parseFloat(item.grams) || 0), 0);

  if (formulaTotalGrams <= 0) {
    return composition;
  }

  const materialIds = formulaItems
    .filter((item) => item.item_type === 'raw_material' || item.item_type === 'solvent')
    .map((item) => item.item_id);
  const dilutionSolventIds = formulaItems
    .map((item) => item.dilution_solvent_id)
    .filter(Boolean);
  const materialsMap = await fetchRawMaterialsMap(materialIds);
  const dilutionSolventsMap = await fetchRawMaterialsMap(dilutionSolventIds);
  const accordIds = formulaItems
    .filter((item) => item.item_type === 'accord')
    .map((item) => item.item_id);
  const accordsMap = await fetchAccordsMap(accordIds);
  const accordItemsMap = await getAccordItemsByAccordIds(accordIds);

  const pushMaterialComposition = async ({
    material,
    requiredQuantity,
    source,
    dilutionPercent = null,
    dilutionSolventId = null,
  }) => {
    const hasDilution = dilutionPercent && dilutionSolventId;

    if (hasDilution) {
      const breakdown = calculateDilutionComposition(requiredQuantity, dilutionPercent);
      const effectivePricePerUnit = (material.cost_per_unit || 0) / 10;

      composition.push({
        type: 'formula_ingredient',
        raw_material_id: material.id,
        name: material.name,
        required_quantity: Math.round(breakdown.activeAmount * 1000) / 1000,
        unit: material.unit || batch.unit,
        cost_per_unit: material.cost_per_unit || 0,
        total_cost: effectivePricePerUnit * breakdown.activeAmount,
        source,
      });

      const dilutionSolvent = dilutionSolventsMap.get(dilutionSolventId) || materialsMap.get(dilutionSolventId) || null;
      if (dilutionSolvent) {
        composition.push({
          type: 'dilution_solvent',
          raw_material_id: dilutionSolvent.id,
          name: dilutionSolvent.name,
          required_quantity: Math.round(breakdown.solventAmount * 1000) / 1000,
          unit: dilutionSolvent.unit || batch.unit,
          cost_per_unit: dilutionSolvent.cost_per_unit || 0,
          total_cost: ((dilutionSolvent.cost_per_unit || 0) / 10) * breakdown.solventAmount,
          source,
        });
      }

      return;
    }

    composition.push({
      type: 'formula_ingredient',
      raw_material_id: material.id,
      name: material.name,
      required_quantity: Math.round(requiredQuantity * 1000) / 1000,
      unit: material.unit || batch.unit,
      cost_per_unit: material.cost_per_unit || 0,
      total_cost: ((material.cost_per_unit || 0) / 10) * requiredQuantity,
      source,
    });
  };

  for (const item of formulaItems) {
    const ingredientGrams = parseFloat(item.grams) || 0;
    const proportion = ingredientGrams / formulaTotalGrams;
    const requiredQuantity = proportion * batch.formula_quantity_needed;
    if (item.item_type === 'accord') {
      const accord = accordsMap.get(item.item_id);
      const accordItems = accordItemsMap.get(item.item_id) || [];
      const accordTotalPercentage = accordItems.reduce((sum, accordItem) => sum + Number(accordItem.percentage || 0), 0) || 100;

      for (const accordItem of accordItems) {
        const material = accordItem.expand?.raw_material_id || null;
        if (!material) {
          continue;
        }

        const accordPortion = Number(accordItem.percentage || 0) / accordTotalPercentage;
        const accordRequiredQuantity = requiredQuantity * accordPortion;
        const accordDilutionPercent = accordItem.dilution_percent ? Number(accordItem.dilution_percent) : null;
        const accordDilutionSolventId = accordItem.dilution_solvent_id || null;
        const hasAccordDilution = accordDilutionPercent && accordDilutionSolventId;

        await pushMaterialComposition({
          material,
          requiredQuantity: accordRequiredQuantity,
          source: `from legacy accord ${accord?.name || 'Unknown accord'}`,
          dilutionPercent: hasAccordDilution ? accordDilutionPercent : material.dilution_percentage,
          dilutionSolventId: hasAccordDilution ? accordDilutionSolventId : material.dilution_solvent_id,
        });
      }

      continue;
    }

    if (item.item_type !== 'raw_material' && item.item_type !== 'solvent') {
      continue;
    }

    const material = materialsMap.get(item.item_id);
    if (!material) {
      continue;
    }

    const formulaLevelDilutionPercent = item.dilution_percent ? Number(item.dilution_percent) : null;
    const formulaLevelDilutionSolventId = item.dilution_solvent_id || null;
    const hasFormulaLevelDilution = formulaLevelDilutionPercent && formulaLevelDilutionSolventId;

    await pushMaterialComposition({
      material,
      requiredQuantity,
      source: hasFormulaLevelDilution || (material.is_diluted && material.dilution_percentage && material.dilution_solvent_id)
        ? `from ${material.name} ${(hasFormulaLevelDilution ? formulaLevelDilutionPercent : material.dilution_percentage)}% diluted in formula`
        : 'direct ingredient',
      dilutionPercent: hasFormulaLevelDilution ? formulaLevelDilutionPercent : material.dilution_percentage,
      dilutionSolventId: hasFormulaLevelDilution ? formulaLevelDilutionSolventId : material.dilution_solvent_id,
    });
  }

  if (solvent && batch.solvent_quantity_needed > 0) {
    composition.push({
      type: 'main_batch_solvent',
      raw_material_id: solvent.id,
      name: solvent.name,
      required_quantity: Math.round(batch.solvent_quantity_needed * 1000) / 1000,
      unit: solvent.unit || batch.unit,
      cost_per_unit: solvent.cost_per_unit || 0,
      total_cost: ((solvent.cost_per_unit || 0) / 10) * batch.solvent_quantity_needed,
      source: 'batch dilution solvent',
    });
  }

  return composition;
};

export const calculateBatchCost = (composition, targetQuantity) => {
  const totals = composition.reduce((acc, item) => {
    acc.total_cost += item.total_cost || 0;
    if (item.type === 'formula_ingredient') acc.formula_ingredient_cost += item.total_cost || 0;
    if (item.type === 'dilution_solvent') acc.dilution_solvent_cost += item.total_cost || 0;
    if (item.type === 'main_batch_solvent') acc.main_batch_solvent_cost += item.total_cost || 0;
    return acc;
  }, {
    formula_ingredient_cost: 0,
    dilution_solvent_cost: 0,
    main_batch_solvent_cost: 0,
    total_cost: 0,
  });

  return {
    ...totals,
    formula_ingredient_cost: Math.round(totals.formula_ingredient_cost * 100) / 100,
    dilution_solvent_cost: Math.round(totals.dilution_solvent_cost * 100) / 100,
    main_batch_solvent_cost: Math.round(totals.main_batch_solvent_cost * 100) / 100,
    total_cost: Math.round(totals.total_cost * 100) / 100,
    cost_per_unit: targetQuantity > 0 ? Math.round((totals.total_cost / targetQuantity) * 100) / 100 : 0,
  };
};

export const getBatches = async () => {
  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to fetch batches');
  }

  const formulasMap = await fetchFormulasMap((data || []).map((row) => row.formula_id));
  const materialsMap = await fetchRawMaterialsMap((data || []).map((row) => row.solvent_id));
  return (data || []).map((row) => mapBatch(row, formulasMap, materialsMap));
};

export const getBatchById = async (id) => {
  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching batch:', error);
    throw new Error('Failed to fetch batch');
  }

  const formulasMap = await fetchFormulasMap([data.formula_id]);
  const materialsMap = await fetchRawMaterialsMap([data.solvent_id]);
  return mapBatch(data, formulasMap, materialsMap);
};

export const createBatch = async (batchData) => {
  const userId = await getCurrentUserId();

  const payload = {
    user_id: userId,
    batch_code: batchData.batch_code || generateBatchCode(),
    formula_id: typeof batchData.formula_id === 'string' ? batchData.formula_id : batchData.formula_id?.id,
    solvent_id: typeof batchData.solvent_id === 'string' ? batchData.solvent_id : batchData.solvent_id?.id,
    target_quantity: Number(batchData.target_quantity),
    produced_quantity: Number(batchData.produced_quantity ?? batchData.target_quantity),
    production_date: batchData.production_date || new Date().toISOString().split('T')[0],
    unit: batchData.unit || 'ml',
    formula_percentage: Number(batchData.formula_percentage),
    solvent_percentage: Number(batchData.solvent_percentage),
    formula_quantity_needed: Number(batchData.formula_quantity_needed),
    solvent_quantity_needed: Number(batchData.solvent_quantity_needed),
    status: batchData.status || 'draft',
    notes: batchData.notes || null,
    is_stock_deducted: batchData.is_stock_deducted || false,
  };

  const { data, error } = await supabase
    .from('batches')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('Error creating batch:', error);
    throw new Error(error.message || 'Failed to create batch');
  }

  return toAppRecord(data);
};

export const updateBatch = async (batchId, batchData) => {
  const payload = {
    batch_code: batchData.batch_code,
    formula_id: typeof batchData.formula_id === 'string' ? batchData.formula_id : batchData.formula_id?.id,
    solvent_id: typeof batchData.solvent_id === 'string' ? batchData.solvent_id : batchData.solvent_id?.id,
    target_quantity: batchData.target_quantity !== undefined ? Number(batchData.target_quantity) : undefined,
    produced_quantity: batchData.produced_quantity !== undefined ? Number(batchData.produced_quantity) : undefined,
    production_date: batchData.production_date,
    unit: batchData.unit,
    formula_percentage: batchData.formula_percentage !== undefined ? Number(batchData.formula_percentage) : undefined,
    solvent_percentage: batchData.solvent_percentage !== undefined ? Number(batchData.solvent_percentage) : undefined,
    formula_quantity_needed: batchData.formula_quantity_needed !== undefined ? Number(batchData.formula_quantity_needed) : undefined,
    solvent_quantity_needed: batchData.solvent_quantity_needed !== undefined ? Number(batchData.solvent_quantity_needed) : undefined,
    status: batchData.status,
    notes: batchData.notes,
    is_stock_deducted: batchData.is_stock_deducted,
  };

  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

  const { data, error } = await supabase
    .from('batches')
    .update(payload)
    .eq('id', batchId)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating batch:', error);
    throw new Error(error.message || 'Failed to update batch');
  }

  return toAppRecord(data);
};

export const deleteBatch = async (batchId) => {
  const { error } = await supabase
    .from('batches')
    .delete()
    .eq('id', batchId);

  if (error) {
    console.error('Error deleting batch:', error);
    throw new Error('Failed to delete batch');
  }
};

export const validateBatchStockDeduction = async (batch) => {
  if (batch.is_stock_deducted) {
    throw new Error('Stock has already been deducted for this batch');
  }

  const formulaItems = await getFormulaItems(batch.formula_id);
  const solvent = batch.solvent_id ? (await fetchRawMaterialsMap([batch.solvent_id])).get(batch.solvent_id) : null;
  const deductions = await calculateBatchComposition(batch, formulaItems, solvent);
  const materialsMap = await fetchRawMaterialsMap(deductions.map((item) => item.raw_material_id));

  const errors = [];
  const normalizedDeductions = deductions.map((item) => {
    const material = materialsMap.get(item.raw_material_id);
    const availableStock = material?.stock_quantity || 0;
    if (availableStock < item.required_quantity) {
      errors.push({
        material_id: item.raw_material_id,
        material_name: material?.name || item.name,
        message: `Insufficient stock for ${material?.name || item.name}`,
      });
    }

    return {
      raw_material_id: item.raw_material_id,
      material_name: material?.name || item.name,
      amount_to_deduct: item.required_quantity,
      type: item.type,
      source: item.source,
      cost: item.total_cost || 0,
      unit: material?.unit || item.unit,
    };
  });

  return {
    valid: errors.length === 0,
    deductions: normalizedDeductions,
    errors,
    summary: {
      total_materials: normalizedDeductions.length,
      formula_ingredients: normalizedDeductions.filter((d) => d.type === 'formula_ingredient').length,
      dilution_solvents: normalizedDeductions.filter((d) => d.type === 'dilution_solvent').length,
      main_batch_solvents: normalizedDeductions.filter((d) => d.type === 'main_batch_solvent').length,
    },
  };
};

const executeStockDeductions = async (deductions) => {
  for (const deduction of deductions) {
    const material = (await fetchRawMaterialsMap([deduction.raw_material_id])).get(deduction.raw_material_id);
    const newStock = Number(material.stock_quantity || 0) - Number(deduction.amount_to_deduct);

    const { error } = await supabase
      .from('raw_materials')
      .update({
        stock_quantity: newStock,
      })
      .eq('id', deduction.raw_material_id);

    if (error) {
      throw new Error(`Failed to deduct stock for ${deduction.material_name}`);
    }
  }
};

const recordBatchUsage = async (batchId, usageItems) => {
  if (!usageItems.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('batch_usage_records')
    .insert(
      usageItems.map((item) => ({
        batch_id: batchId,
        raw_material_id: item.raw_material_id,
        quantity_deducted: item.amount_to_deduct,
        type: item.type,
        source: item.source,
        cost: item.cost || 0,
      }))
    )
    .select('*');

  if (error) {
    throw new Error(error.message || 'Failed to record usage');
  }

  return data || [];
};

export const completeBatchWithStockDeduction = async (batchId) => {
  const batch = await getBatchById(batchId);
  const validation = await validateBatchStockDeduction(batch);

  if (!validation.valid) {
    throw new Error(validation.errors.map((item) => item.message).join('; '));
  }

  await executeStockDeductions(validation.deductions);
  await recordBatchUsage(batchId, validation.deductions);
  await updateBatch(batchId, {
    status: 'completed',
    is_stock_deducted: true,
  });

  return {
    success: true,
    message: 'Batch completed and stock deducted successfully',
    deductions: validation.deductions,
  };
};

export const getBatchUsageRecords = async (batchId) => {
  const { data, error } = await supabase
    .from('batch_usage_records')
    .select(`
      *,
      raw_materials(name, unit)
    `)
    .eq('batch_id', batchId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching batch usage records:', error);
    return [];
  }

  return (data || []).map((record) => ({
    ...toAppRecord(record),
    material_name: record.raw_materials?.name || null,
    material_unit: record.raw_materials?.unit || null,
  }));
};
