import supabase from '@/lib/supabaseClient.js';
import { fetchRawMaterialsMap, getCurrentUserId, toAppRecord } from '@/services/supabaseDataHelpers.js';

const mapAccordItem = (row, materialsMap = new Map()) => ({
  ...toAppRecord(row),
  expand: row.raw_material_id || row.dilution_solvent_id
    ? {
        raw_material_id: row.raw_material_id ? materialsMap.get(row.raw_material_id) || null : null,
        dilution_solvent_id: row.dilution_solvent_id ? materialsMap.get(row.dilution_solvent_id) || null : null,
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

  const materialsMap = await fetchRawMaterialsMap(
    (data || []).flatMap((item) => [item.raw_material_id, item.dilution_solvent_id]).filter(Boolean)
  );
  return (data || []).map((row) => mapAccordItem(row, materialsMap));
};

const normalizeAccordItemPayload = (accordId, item) => ({
  accord_id: accordId,
  raw_material_id: String(item.raw_material_id),
  percentage: Number(item.percentage),
  dilution_percent: item.dilution_percent !== undefined && item.dilution_percent !== null ? Number(item.dilution_percent) : null,
  dilution_solvent_id: item.dilution_solvent_id || null,
  concentrate_amount: item.concentrate_amount !== undefined && item.concentrate_amount !== null ? Number(item.concentrate_amount) : null,
});

const buildAccordPayload = (accordData) => ({
  name: String(accordData.name).trim(),
  author_name: accordData.author_name ? String(accordData.author_name).trim() : null,
  notes: accordData.notes ? String(accordData.notes).trim() : null,
  description: accordData.description ? String(accordData.description).trim() : null,
  unit: accordData.unit || 'ml',
});

const VERSIONED_NAME_PATTERN = /\s+v(\d+)$/i;

const buildNextVersionName = (name, nextVersion) => {
  const baseName = String(name || '').trim().replace(VERSIONED_NAME_PATTERN, '');
  return `${baseName} v${nextVersion}`;
};

const getNextAvailableAccordName = async (userId, preferredName) => {
  const normalizedName = String(preferredName || '').trim();
  const baseName = normalizedName.replace(VERSIONED_NAME_PATTERN, '');

  const { data, error } = await supabase
    .from('accords')
    .select('name')
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Failed to resolve duplicate accord name');
  }

  const existingNames = new Set((data || []).map((item) => String(item.name || '').trim().toLowerCase()));
  if (!existingNames.has(normalizedName.toLowerCase())) {
    return normalizedName;
  }

  let version = 2;
  while (existingNames.has(buildNextVersionName(baseName, version).toLowerCase())) {
    version += 1;
  }

  return buildNextVersionName(baseName, version);
};

const removeMissingColumn = (payload, message) => {
  const missingColumn = String(message || '').match(/Could not find the '([^']+)' column/i)?.[1];
  if (!missingColumn || !(missingColumn in payload)) {
    return null;
  }

  const nextPayload = { ...payload };
  delete nextPayload[missingColumn];
  return nextPayload;
};

const payloadChanged = (currentPayload, nextPayload) => {
  if (!nextPayload) {
    return false;
  }

  const currentKeys = Object.keys(currentPayload);
  const nextKeys = Object.keys(nextPayload);

  if (currentKeys.length !== nextKeys.length) {
    return true;
  }

  return currentKeys.some((key) => currentPayload[key] !== nextPayload[key]);
};

const insertAccordItemsWithCompatibility = async (accordId, items) => {
  let payloads = items.map((item) => normalizeAccordItemPayload(accordId, item));

  while (payloads.length) {
    const { error } = await supabase
      .from('accord_items')
      .insert(payloads);

    if (!error) {
      return;
    }

    const nextPayloads = payloads.map((payload) => {
      const nextPayload = removeMissingColumn(payload, error.message);
      return nextPayload || payload;
    });

    const hasAnyPayloadChanged = payloads.some((payload, index) => payloadChanged(payload, nextPayloads[index]));

    if (!hasAnyPayloadChanged) {
      console.error('Error creating accord items:', error);
      throw new Error(error.message || 'Failed to create accord items');
    }

    payloads = nextPayloads;
  }
};

const updateAccordWithCompatibility = async (accordId, accordData) => {
  let payload = buildAccordPayload(accordData);

  while (payload && Object.keys(payload).length) {
    const { data, error } = await supabase
      .from('accords')
      .update(payload)
      .eq('id', accordId)
      .select('*')
      .single();

    if (!error) {
      return data;
    }

    const nextPayload = removeMissingColumn(payload, error.message);
    if (!payloadChanged(payload, nextPayload)) {
      console.error('Error updating accord:', error);
      throw new Error(error.message || 'Failed to update accord');
    }

    payload = nextPayload;
  }

  throw new Error('Failed to update accord');
};

const createAccordWithCompatibility = async (userId, accordData) => {
  let payload = {
    user_id: userId,
    ...buildAccordPayload(accordData),
    stock_quantity: 0,
    cost_per_unit: 0,
  };

  while (payload && Object.keys(payload).length) {
    const { data, error } = await supabase
      .from('accords')
      .insert(payload)
      .select('*')
      .single();

    if (!error) {
      return data;
    }

    if (error.code === '23505' && error.message?.includes('accords_unique_name_per_user')) {
      payload = {
        ...payload,
        name: await getNextAvailableAccordName(userId, payload.name),
      };
      continue;
    }

    const nextPayload = removeMissingColumn(payload, error.message);
    if (!payloadChanged(payload, nextPayload)) {
      console.error('Error creating accord:', error);
      throw new Error(error.message || 'Failed to create accord');
    }

    payload = nextPayload;
  }

  throw new Error('Failed to create accord');
};

export const createAccord = async (accordData, items) => {
  const userId = await getCurrentUserId();
  const accord = await createAccordWithCompatibility(userId, accordData);

  if (items?.length) {
    await insertAccordItemsWithCompatibility(accord.id, items);
  }

  return toAppRecord(accord);
};

export const updateAccord = async (accordId, accordData, items) => {
  const accord = await updateAccordWithCompatibility(accordId, accordData);

  const { error: deleteError } = await supabase
    .from('accord_items')
    .delete()
    .eq('accord_id', accordId);

  if (deleteError) {
    console.error('Error replacing accord items:', deleteError);
    throw new Error(deleteError.message || 'Failed to replace accord items');
  }

  if (items?.length) {
    await insertAccordItemsWithCompatibility(accordId, items);
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
