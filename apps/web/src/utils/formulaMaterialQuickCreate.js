export const normalizeQuickMaterialName = (name) =>
  String(name || '').trim().replace(/\s+/g, ' ');

const normalizeOptionalQuickField = (value) => {
  const normalized = String(value || '').trim();
  return normalized || '';
};

export const buildQuickRawMaterialPayload = (name, details = {}) => {
  const casNumber = normalizeOptionalQuickField(details.cas_number);
  const workbookCode = normalizeOptionalQuickField(details.workbook_code);
  const category = normalizeOptionalQuickField(details.category);
  const missing = [
    casNumber ? '' : 'CAS',
    workbookCode ? '' : 'workbook',
    'impact',
    'life',
    'reference data',
  ].filter(Boolean);

  return {
    name: normalizeQuickMaterialName(name),
    type: 'raw_material',
    unit: 'g',
    category,
    stock_quantity: 0,
    minimum_stock: 0,
    cost_per_unit: 0,
    data_status: 'active',
    cas_number: casNumber,
    workbook_code: workbookCode,
    notes: `Created from formula composition. Guidance still needs ${missing.join(', ')}.`,
  };
};

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
