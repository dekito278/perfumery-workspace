import supabase from '@/lib/supabaseClient.js';
import { fetchRawMaterialsMap, getCurrentUserId, toAppRecord } from '@/services/supabaseDataHelpers.js';

const mapAccordItem = (row, materialsMap = new Map()) => ({
  ...toAppRecord(row),
  expand: row.raw_material_id
    ? {
        raw_material_id: materialsMap.get(row.raw_material_id) || null,
      }
    : undefined,
});

export const getAccords = async () => {
  const { data, error } = await supabase
    .from('accords')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching accords:', error);
    throw new Error('Failed to fetch accords');
  }

  return (data || []).map(toAppRecord);
};

export const getAccordById = async (id) => {
  const { data, error } = await supabase
    .from('accords')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching accord:', error);
    throw new Error('Failed to fetch accord');
  }

  return toAppRecord(data);
};

export const getAccordItems = async (accordId) => {
  const { data, error } = await supabase
    .from('accord_items')
    .select('*')
    .eq('accord_id', accordId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching accord items:', error);
    throw new Error('Failed to fetch accord items');
  }

  const materialsMap = await fetchRawMaterialsMap((data || []).map((item) => item.raw_material_id));
  return (data || []).map((row) => mapAccordItem(row, materialsMap));
};

export const createAccord = async (accordData, items) => {
  const userId = await getCurrentUserId();

  const { data: accord, error: accordError } = await supabase
    .from('accords')
    .insert({
      user_id: userId,
      name: String(accordData.name).trim(),
      notes: accordData.notes ? String(accordData.notes).trim() : null,
      description: accordData.description ? String(accordData.description).trim() : null,
      unit: accordData.unit || 'ml',
      stock_quantity: 0,
      cost_per_unit: 0,
    })
    .select('*')
    .single();

  if (accordError) {
    console.error('Error creating accord:', accordError);
    throw new Error(accordError.message || 'Failed to create accord');
  }

  if (items?.length) {
    const { error: itemsError } = await supabase.from('accord_items').insert(
      items.map((item) => ({
        accord_id: accord.id,
        raw_material_id: String(item.raw_material_id),
        percentage: Number(item.percentage),
      }))
    );

    if (itemsError) {
      console.error('Error creating accord items:', itemsError);
      throw new Error(itemsError.message || 'Failed to create accord items');
    }
  }

  return toAppRecord(accord);
};

export const updateAccord = async (accordId, accordData, items) => {
  const { data: accord, error: accordError } = await supabase
    .from('accords')
    .update({
      name: String(accordData.name).trim(),
      notes: accordData.notes ? String(accordData.notes).trim() : null,
      description: accordData.description ? String(accordData.description).trim() : null,
      unit: accordData.unit || 'ml',
    })
    .eq('id', accordId)
    .select('*')
    .single();

  if (accordError) {
    console.error('Error updating accord:', accordError);
    throw new Error(accordError.message || 'Failed to update accord');
  }

  const { error: deleteError } = await supabase
    .from('accord_items')
    .delete()
    .eq('accord_id', accordId);

  if (deleteError) {
    console.error('Error replacing accord items:', deleteError);
    throw new Error(deleteError.message || 'Failed to replace accord items');
  }

  if (items?.length) {
    const { error: itemsError } = await supabase.from('accord_items').insert(
      items.map((item) => ({
        accord_id: accordId,
        raw_material_id: String(item.raw_material_id),
        percentage: Number(item.percentage),
      }))
    );

    if (itemsError) {
      console.error('Error inserting accord items:', itemsError);
      throw new Error(itemsError.message || 'Failed to update accord items');
    }
  }

  return toAppRecord(accord);
};

export const deleteAccord = async (accordId) => {
  const { error } = await supabase
    .from('accords')
    .delete()
    .eq('id', accordId);

  if (error) {
    console.error('Error deleting accord:', error);
    throw new Error('Failed to delete accord');
  }
};

export const produceAccord = async (accordId, quantity) => {
  const accord = await getAccordById(accordId);

  const { error } = await supabase
    .from('accords')
    .update({
      stock_quantity: Number(accord.stock_quantity || 0) + Number(quantity),
    })
    .eq('id', accordId);

  if (error) {
    console.error('Error producing accord:', error);
    throw new Error('Failed to produce accord');
  }

  return { success: true };
};
