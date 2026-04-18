import supabase from '@/lib/supabaseClient.js';
import { getCurrentUserId, toAppRecord } from '@/services/supabaseDataHelpers.js';

const normalizeFormulaPayload = (formulaData) => ({
  name: String(formulaData.name).trim(),
  code: String(formulaData.code || `FORMULA-${Date.now()}`).trim(),
  author_name: formulaData.author_name ? String(formulaData.author_name).trim() : null,
  notes: formulaData.notes ? String(formulaData.notes).trim() : null,
  category: formulaData.category || null,
  status: formulaData.status || 'draft',
  version: formulaData.version ? String(formulaData.version) : null,
  batch_size: formulaData.batch_size !== undefined && formulaData.batch_size !== null && formulaData.batch_size !== ''
    ? Number(formulaData.batch_size)
    : null,
  batch_date: formulaData.batch_date || null,
  markup_percentage: formulaData.markup_percentage !== undefined && formulaData.markup_percentage !== null
    ? Number(formulaData.markup_percentage)
    : 0,
  packaging_cost: formulaData.packaging_cost !== undefined && formulaData.packaging_cost !== null
    ? Number(formulaData.packaging_cost)
    : 0,
  bottle_cost: formulaData.bottle_cost !== undefined && formulaData.bottle_cost !== null
    ? Number(formulaData.bottle_cost)
    : 0,
  cap_cost: formulaData.cap_cost !== undefined && formulaData.cap_cost !== null
    ? Number(formulaData.cap_cost)
    : 0,
});

const normalizeFormulaItemPayload = (formulaId, item, index) => ({
  formula_id: formulaId,
  item_type: item.item_type || 'raw_material',
  item_id: String(item.item_id),
  percentage: Number(item.percentage),
  sort_order: item.sort_order !== undefined && item.sort_order !== null ? Number(item.sort_order) : index,
  grams: item.grams !== undefined && item.grams !== null ? Number(item.grams) : null,
  dilution_percent: item.dilution_percent !== undefined && item.dilution_percent !== null ? Number(item.dilution_percent) : null,
  dilution_solvent_id: item.dilution_solvent_id || null,
  concentrate_amount: item.concentrate_amount !== undefined && item.concentrate_amount !== null ? Number(item.concentrate_amount) : null,
});

export const getFormulas = async () => {
  const { data, error } = await supabase
    .from('formulas')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching formulas:', error);
    throw new Error('Failed to fetch formulas');
  }

  return (data || []).map(toAppRecord);
};

export const getFormulaById = async (id) => {
  const { data, error } = await supabase
    .from('formulas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching formula:', error);
    throw new Error('Failed to fetch formula');
  }

  return toAppRecord(data);
};

export const getFormulaItems = async (formulaId) => {
  const { data, error } = await supabase
    .from('formula_items')
    .select('*')
    .eq('formula_id', formulaId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching formula items:', error);
    throw new Error('Failed to fetch formula items');
  }

  return (data || []).map(toAppRecord);
};

export const createFormula = async (formulaData, items) => {
  const userId = await getCurrentUserId();

  const { data: formula, error: formulaError } = await supabase
    .from('formulas')
    .insert({
      user_id: userId,
      ...normalizeFormulaPayload(formulaData),
    })
    .select('*')
    .single();

  if (formulaError) {
    console.error('Error creating formula:', formulaError);
    throw new Error(formulaError.message || 'Failed to create formula');
  }

  if (items?.length) {
    const { error: itemsError } = await supabase
      .from('formula_items')
      .insert(items.map((item, index) => normalizeFormulaItemPayload(formula.id, item, index)));

    if (itemsError) {
      console.error('Error creating formula items:', itemsError);
      throw new Error(itemsError.message || 'Failed to create formula items');
    }
  }

  return toAppRecord(formula);
};

export const updateFormula = async (formulaId, formulaData, items) => {
  const { data: formula, error: formulaError } = await supabase
    .from('formulas')
    .update(normalizeFormulaPayload(formulaData))
    .eq('id', formulaId)
    .select('*')
    .single();

  if (formulaError) {
    console.error('Error updating formula:', formulaError);
    throw new Error(formulaError.message || 'Failed to update formula');
  }

  const { error: deleteError } = await supabase
    .from('formula_items')
    .delete()
    .eq('formula_id', formulaId);

  if (deleteError) {
    console.error('Error replacing formula items:', deleteError);
    throw new Error(deleteError.message || 'Failed to replace formula items');
  }

  if (items?.length) {
    const { error: itemsError } = await supabase
      .from('formula_items')
      .insert(items.map((item, index) => normalizeFormulaItemPayload(formulaId, item, index)));

    if (itemsError) {
      console.error('Error inserting formula items:', itemsError);
      throw new Error(itemsError.message || 'Failed to update formula items');
    }
  }

  return toAppRecord(formula);
};

export const deleteFormula = async (formulaId) => {
  const { error } = await supabase
    .from('formulas')
    .delete()
    .eq('id', formulaId);

  if (error) {
    console.error('Error deleting formula:', error);
    throw new Error('Failed to delete formula');
  }
};

export const duplicateFormula = async (formulaId) => {
  const userId = await getCurrentUserId();
  const original = await getFormulaById(formulaId);
  const originalItems = await getFormulaItems(formulaId);

  const { data: duplicate, error: duplicateError } = await supabase
    .from('formulas')
    .insert({
      user_id: userId,
      ...normalizeFormulaPayload({
        ...original,
        name: `Copy of ${original.name}`,
        code: `${original.code}-COPY-${Date.now()}`,
      }),
    })
    .select('*')
    .single();

  if (duplicateError) {
    console.error('Error duplicating formula:', duplicateError);
    throw new Error('Failed to duplicate formula');
  }

  if (originalItems.length) {
    const { error: itemsError } = await supabase
      .from('formula_items')
      .insert(originalItems.map((item, index) => normalizeFormulaItemPayload(duplicate.id, item, index)));

    if (itemsError) {
      console.error('Error duplicating formula items:', itemsError);
      throw new Error('Failed to duplicate formula');
    }
  }

  return toAppRecord(duplicate);
};
