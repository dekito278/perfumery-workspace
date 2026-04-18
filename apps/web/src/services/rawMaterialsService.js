
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
    const normalizedCategory = data.category || null;
    const normalizedType = inferRawMaterialTypeFromCategory(normalizedCategory, data.type || 'material');
    const normalizedFamily = deriveScentFamilyFromCategory(normalizedCategory, data.scent_family || '');

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
        name: data.name,
        category: normalizedCategory,
        type: normalizedType,
        stock_quantity: data.stock_quantity,
        unit: data.unit,
        cost_per_unit: data.cost_per_unit,
        supplier_name: data.supplier_name || null,
        minimum_stock: data.minimum_stock,
        notes: data.notes || null,
        workbook_code: data.workbook_code || null,
        default_dilution_percent: data.default_dilution_percent || null,
        scent_family: normalizedFamily || null,
        note_type: data.note_type || null,
        low_stock_threshold: data.low_stock_threshold || null,
        vendor: data.vendor || null,
        cas_number: data.cas_number || null,
        charge_number: data.charge_number || null,
        ifra_limit: data.ifra_limit || null,
        pyramid_placement: data.pyramid_placement || null,
        is_diluted: data.is_diluted || false,
        dilution_solvent_id: data.is_diluted ? data.dilution_solvent_id : null,
        dilution_percentage: data.is_diluted ? data.dilution_percentage : null,
      })
      .select('*')
      .single();

    if (error) {
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
    const normalizedCategory = data.category || null;
    const normalizedType = inferRawMaterialTypeFromCategory(normalizedCategory, data.type || 'material');
    const normalizedFamily = deriveScentFamilyFromCategory(normalizedCategory, data.scent_family || '');

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
      .update({
        name: data.name,
        category: normalizedCategory,
        type: normalizedType,
        stock_quantity: data.stock_quantity,
        unit: data.unit,
        cost_per_unit: data.cost_per_unit,
        supplier_name: data.supplier_name || null,
        minimum_stock: data.minimum_stock,
        notes: data.notes || null,
        workbook_code: data.workbook_code || null,
        default_dilution_percent: data.default_dilution_percent || null,
        scent_family: normalizedFamily || null,
        note_type: data.note_type || null,
        low_stock_threshold: data.low_stock_threshold || null,
        vendor: data.vendor || null,
        cas_number: data.cas_number || null,
        charge_number: data.charge_number || null,
        ifra_limit: data.ifra_limit || null,
        pyramid_placement: data.pyramid_placement || null,
        is_diluted: data.is_diluted || false,
        dilution_solvent_id: data.is_diluted ? data.dilution_solvent_id : null,
        dilution_percentage: data.is_diluted ? data.dilution_percentage : null,
      })
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
