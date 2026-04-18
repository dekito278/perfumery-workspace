
import pb from '@/lib/pocketbaseClient.js';

export const getRawMaterials = async () => {
  try {
    const records = await pb.collection('raw_materials').getFullList({
      sort: '-created',
      expand: 'dilution_solvent_id',
      $autoCancel: false
    });
    return records;
  } catch (error) {
    console.error('Error fetching raw materials:', error);
    throw new Error('Failed to fetch raw materials');
  }
};

export const getRawMaterialById = async (id) => {
  try {
    const record = await pb.collection('raw_materials').getOne(id, {
      expand: 'dilution_solvent_id',
      $autoCancel: false
    });
    return record;
  } catch (error) {
    console.error('Error fetching raw material:', error);
    throw new Error('Failed to fetch raw material');
  }
};

export const createRawMaterial = async (data) => {
  try {
    const userId = pb.authStore.model?.id;
    if (!userId) throw new Error('User not authenticated');

    // Validate dilution fields
    if (data.is_diluted) {
      if (!data.dilution_solvent_id) {
        throw new Error('Dilution solvent is required for diluted materials');
      }
      if (!data.dilution_percentage || data.dilution_percentage <= 0 || data.dilution_percentage > 100) {
        throw new Error('Dilution percentage must be between 0 and 100');
      }
    }

    const record = await pb.collection('raw_materials').create({
      name: data.name,
      category: data.category,
      type: data.type,
      stock_quantity: data.stock_quantity,
      unit: data.unit,
      cost_per_unit: data.cost_per_unit,
      supplier_name: data.supplier_name || '',
      minimum_stock: data.minimum_stock,
      notes: data.notes || '',
      default_dilution_percent: data.default_dilution_percent || null,
      scent_family: data.scent_family || '',
      note_type: data.note_type || '',
      low_stock_threshold: data.low_stock_threshold || null,
      description: data.description || '',
      vendor: data.vendor || '',
      ifra_limit: data.ifra_limit || null,
      pyramid_placement: data.pyramid_placement || null,
      dilution_info: data.dilution_info || '',
      is_diluted: data.is_diluted || false,
      dilution_solvent_id: data.is_diluted ? data.dilution_solvent_id : null,
      dilution_percentage: data.is_diluted ? data.dilution_percentage : null,
      userId: userId
    }, { $autoCancel: false });

    return record;
  } catch (error) {
    console.error('Error creating raw material:', error);
    throw new Error(error.message || 'Failed to create raw material');
  }
};

export const updateRawMaterial = async (id, data) => {
  try {
    // Validate dilution fields
    if (data.is_diluted) {
      if (!data.dilution_solvent_id) {
        throw new Error('Dilution solvent is required for diluted materials');
      }
      if (!data.dilution_percentage || data.dilution_percentage <= 0 || data.dilution_percentage > 100) {
        throw new Error('Dilution percentage must be between 0 and 100');
      }
    }

    const record = await pb.collection('raw_materials').update(id, {
      name: data.name,
      category: data.category,
      type: data.type,
      stock_quantity: data.stock_quantity,
      unit: data.unit,
      cost_per_unit: data.cost_per_unit,
      supplier_name: data.supplier_name || '',
      minimum_stock: data.minimum_stock,
      notes: data.notes || '',
      default_dilution_percent: data.default_dilution_percent || null,
      scent_family: data.scent_family || '',
      note_type: data.note_type || '',
      low_stock_threshold: data.low_stock_threshold || null,
      description: data.description || '',
      vendor: data.vendor || '',
      ifra_limit: data.ifra_limit || null,
      pyramid_placement: data.pyramid_placement || null,
      dilution_info: data.dilution_info || '',
      is_diluted: data.is_diluted || false,
      dilution_solvent_id: data.is_diluted ? data.dilution_solvent_id : null,
      dilution_percentage: data.is_diluted ? data.dilution_percentage : null
    }, { $autoCancel: false });

    return record;
  } catch (error) {
    console.error('Error updating raw material:', error);
    throw new Error(error.message || 'Failed to update raw material');
  }
};

export const deleteRawMaterial = async (id) => {
  try {
    await pb.collection('raw_materials').delete(id, { $autoCancel: false });
  } catch (error) {
    console.error('Error deleting raw material:', error);
    throw new Error('Failed to delete raw material');
  }
};
