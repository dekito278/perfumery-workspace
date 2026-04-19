import { fetchAccordsMap } from '@/services/supabaseDataHelpers.js';

export const buildFormulaItemReferenceMaps = async (items, rawMaterials = []) => {
  const rawMaterialsMap = new Map((rawMaterials || []).map((material) => [material.id, material]));
  const accordIds = [...new Set((items || [])
    .filter((item) => item.item_type === 'accord' && item.item_id)
    .map((item) => item.item_id))];

  const accordsMap = await fetchAccordsMap(accordIds);

  return {
    rawMaterialsMap,
    accordsMap,
  };
};

export const resolveFormulaItemReference = (item, referenceMaps) => {
  if (item.item_type === 'accord') {
    const accord = referenceMaps.accordsMap.get(item.item_id) || null;
    return accord
      ? {
          ...accord,
          item_type: 'accord',
          category: 'accord',
          unit: accord.unit || 'ml',
          is_diluted: false,
          dilution_percentage: null,
          dilution_solvent_id: null,
          dilution_solvent_name: null,
        }
      : null;
  }

  const material = referenceMaps.rawMaterialsMap.get(item.item_id) || null;
  return material
    ? {
        ...material,
        item_type: material.type === 'solvent' ? 'solvent' : 'raw_material',
      }
    : null;
};
