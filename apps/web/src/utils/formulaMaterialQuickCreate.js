export const normalizeQuickMaterialName = (name) =>
  String(name || '').trim().replace(/\s+/g, ' ');

export const buildQuickRawMaterialPayload = (name) => ({
  name: normalizeQuickMaterialName(name),
  type: 'raw_material',
  unit: 'g',
  category: '',
  stock_quantity: 0,
  minimum_stock: 0,
  cost_per_unit: 0,
  data_status: 'active',
  notes: 'Created from formula composition. Workbook guidance still needs CAS, impact, life, and reference data.',
});

export const upsertMaterialOption = (materials = [], material) => {
  if (!material?.id) {
    return materials;
  }

  const exists = materials.some((entry) => entry.id === material.id);
  if (exists) {
    return materials.map((entry) => (entry.id === material.id ? { ...entry, ...material } : entry));
  }

  return [material, ...materials];
};
