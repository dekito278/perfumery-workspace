export const buildComposerItemsFromMaterialIds = (materialIds = [], rawMaterials = []) => {
  const rawMaterialsById = new Map((rawMaterials || []).map((material) => [material.id, material]));

  return [...new Set((materialIds || []).filter(Boolean))]
    .map((materialId) => {
      const material = rawMaterialsById.get(materialId) || null;
      if (!material) {
        return null;
      }

      return {
        item_id: materialId,
        gram_amount: '1',
        dilution_percent: '',
        dilution_solvent_id: '',
        dilution_solvent_name: '',
        item_type: material.type === 'solvent' ? 'solvent' : 'raw_material',
        source_role: null,
        stage: null,
      };
    })
    .filter(Boolean);
};
