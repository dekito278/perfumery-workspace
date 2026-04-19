
import supabase from '@/lib/supabaseClient.js';
import { deriveScentFamilyFromCategory, inferRawMaterialTypeFromCategory } from '@/utils/rawMaterialCategoryMeta.js';

const mapRawMaterial = (row, solventMap = new Map()) => ({
  ...row,
  created: row.created_at,
  updated: row.updated_at,
  expand: row.dilution_solvent_id
    ? {
        dilution_solvent_id: solventMap.get(row.dilution_solvent_id) || null,
      }
    : undefined,
});

const mapUsageRecord = (row) => ({
  id: row.id,
  type: row.type,
  source: row.source,
  quantity_deducted: row.quantity_deducted,
  cost: row.cost,
  created_at: row.created_at,
  expand: {
    batch_id: row.batches ? { batch_code: row.batches.batch_code } : null,
    raw_material_id: row.raw_materials
      ? { name: row.raw_materials.name, unit: row.raw_materials.unit }
      : null,
  },
});

const normalizeOptionalText = (value) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const normalizeOptionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};

const buildRawMaterialPayload = (data) => {
  const normalizedCategory = data.category || null;
  const normalizedType = inferRawMaterialTypeFromCategory(normalizedCategory, data.type || 'material');
  const normalizedFamily = deriveScentFamilyFromCategory(normalizedCategory, data.scent_family || '');
  const isDiluted = Boolean(data.is_diluted);

  return {
    name: String(data.name || '').trim(),
    category: normalizedCategory,
    type: normalizedType,
    stock_quantity: Number(data.stock_quantity || 0),
    unit: data.unit,
    cost_per_unit: Number(data.cost_per_unit || 0),
    minimum_stock: Number(data.minimum_stock || 0),
    notes: normalizeOptionalText(data.notes),
    workbook_code: normalizeOptionalText(data.workbook_code),
    scent_family: normalizedFamily || null,
    low_stock_threshold: normalizeOptionalNumber(data.low_stock_threshold),
    vendor: normalizeOptionalText(data.vendor),
    cas_number: normalizeOptionalText(data.cas_number),
    ifra_limit: normalizeOptionalNumber(data.ifra_limit),
    is_diluted: isDiluted,
    dilution_solvent_id: isDiluted ? data.dilution_solvent_id : null,
    dilution_percentage: isDiluted ? normalizeOptionalNumber(data.dilution_percentage) : null,
  };
};

const getCurrentUserId = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message || 'Failed to read authenticated user');
  }

  if (!user) {
    throw new Error('User not authenticated');
  }

  return user.id;
};

const getSolventMap = async (solventIds) => {
  if (!solventIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('raw_materials')
    .select('id, name, unit')
    .in('id', solventIds);

  if (error) {
    console.error('Error fetching dilution solvents:', error);
    return new Map();
  }

  return new Map((data || []).map((item) => [item.id, item]));
};

const findExistingRawMaterialByName = async (userId, name) => {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) {
    return null;
  }

  const { data, error } = await supabase
    .from('raw_materials')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', normalizedName)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error checking existing raw material by name:', error);
    return null;
  }

  return data || null;
};

const findExistingRawMaterialByWorkbookCode = async (userId, workbookCode) => {
  const normalizedWorkbookCode = String(workbookCode || '').trim();
  if (!normalizedWorkbookCode) {
    return null;
  }

  const { data, error } = await supabase
    .from('raw_materials')
    .select('*')
    .eq('user_id', userId)
    .ilike('workbook_code', normalizedWorkbookCode)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error checking existing raw material by workbook code:', error);
    return null;
  }

  return data || null;
};

export const getRawMaterials = async () => {
  try {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const solventIds = [...new Set((data || []).map((item) => item.dilution_solvent_id).filter(Boolean))];
    const solventMap = await getSolventMap(solventIds);

    return (data || []).map((row) => mapRawMaterial(row, solventMap));
  } catch (error) {
    console.error('Error fetching raw materials:', error);
    throw new Error('Failed to fetch raw materials');
  }
};

export const getRawMaterialById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    const solventMap = await getSolventMap(data.dilution_solvent_id ? [data.dilution_solvent_id] : []);
    return mapRawMaterial(data, solventMap);
  } catch (error) {
    console.error('Error fetching raw material:', error);
    throw new Error('Failed to fetch raw material');
  }
};

export const getSolvents = async () => {
  try {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('id, name')
      .eq('type', 'solvent')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((item) => ({
      value: item.id,
      label: item.name,
    }));
  } catch (error) {
    console.error('Error fetching solvents:', error);
    throw new Error('Failed to fetch solvents');
  }
};

export const getRawMaterialVendorSuggestions = async () => {
  try {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('vendor')
      .not('vendor', 'is', null)
      .order('vendor', { ascending: true });

    if (error) {
      throw error;
    }

    return [...new Set((data || []).map((item) => item.vendor).filter(Boolean))];
  } catch (error) {
    console.error('Error fetching vendor suggestions:', error);
    return [];
  }
};

export const getRawMaterialUsageHistory = async (id) => {
  try {
    const { data, error } = await supabase
      .from('batch_usage_records')
      .select(`
        id,
        type,
        source,
        quantity_deducted,
        cost,
        created_at,
        batches(batch_code),
        raw_materials(name, unit)
      `)
      .eq('raw_material_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching raw material usage history:', error);
      return [];
    }

    return (data || []).map(mapUsageRecord);
  } catch (error) {
    console.error('Error fetching raw material usage history:', error);
    return [];
  }
};

export const createRawMaterial = async (data) => {
  try {
    const userId = await getCurrentUserId();
    const payload = buildRawMaterialPayload(data);

    // Validate dilution fields
    if (data.is_diluted) {
      if (!data.dilution_solvent_id) {
        throw new Error('Dilution solvent is required for diluted materials');
      }
      if (!data.dilution_percentage || data.dilution_percentage <= 0 || data.dilution_percentage > 100) {
        throw new Error('Dilution percentage must be between 0 and 100');
      }
    }

    const { data: record, error } = await supabase
      .from('raw_materials')
      .insert({
        user_id: userId,
        ...payload,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505' && error.message?.includes('raw_materials_unique_workbook_code_per_user')) {
        const existingRecord = await findExistingRawMaterialByWorkbookCode(userId, payload.workbook_code);
        if (existingRecord) {
          const solventMap = await getSolventMap(existingRecord.dilution_solvent_id ? [existingRecord.dilution_solvent_id] : []);
          return mapRawMaterial(existingRecord, solventMap);
        }
      }

      if (error.code === '23505' && error.message?.includes('raw_materials_unique_name_per_user')) {
        const existingRecord = await findExistingRawMaterialByName(userId, payload.name);
        if (existingRecord) {
          const solventMap = await getSolventMap(existingRecord.dilution_solvent_id ? [existingRecord.dilution_solvent_id] : []);
          return mapRawMaterial(existingRecord, solventMap);
        }
      }
      throw error;
    }

    const solventMap = await getSolventMap(record.dilution_solvent_id ? [record.dilution_solvent_id] : []);
    return mapRawMaterial(record, solventMap);
  } catch (error) {
    console.error('Error creating raw material:', error);
    throw new Error(error.message || 'Failed to create raw material');
  }
};

export const updateRawMaterial = async (id, data) => {
  try {
    const payload = buildRawMaterialPayload(data);

    // Validate dilution fields
    if (data.is_diluted) {
      if (!data.dilution_solvent_id) {
        throw new Error('Dilution solvent is required for diluted materials');
      }
      if (!data.dilution_percentage || data.dilution_percentage <= 0 || data.dilution_percentage > 100) {
        throw new Error('Dilution percentage must be between 0 and 100');
      }
    }

    const { data: record, error } = await supabase
      .from('raw_materials')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    const solventMap = await getSolventMap(record.dilution_solvent_id ? [record.dilution_solvent_id] : []);
    return mapRawMaterial(record, solventMap);
  } catch (error) {
    console.error('Error updating raw material:', error);
    throw new Error(error.message || 'Failed to update raw material');
  }
};

export const deleteRawMaterial = async (id) => {
  try {
    const { error } = await supabase
      .from('raw_materials')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error deleting raw material:', error);
    throw new Error('Failed to delete raw material');
  }
};
