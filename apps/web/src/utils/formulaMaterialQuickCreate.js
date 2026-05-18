export const normalizeQuickMaterialName = (name) =>
  String(name || '').trim().replace(/\s+/g, ' ');

const normalizeLookupValue = (value) =>
  normalizeQuickMaterialName(value).toLowerCase();

const tokenizeLookupValue = (value) =>
  normalizeLookupValue(value)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

const compactLookupValue = (value) => normalizeLookupValue(value).replace(/[^a-z0-9]+/gi, '');

const getTokenOverlap = (leftTokens = [], rightTokens = []) =>
  leftTokens.filter((leftToken) =>
    rightTokens.some((rightToken) =>
      rightToken === leftToken
      || rightToken.startsWith(leftToken)
      || leftToken.startsWith(rightToken)
    )
  ).length;

export const getQuickMaterialDuplicateCandidates = (materials = [], name, limit = 4) => {
  const normalizedName = normalizeLookupValue(name);
  if (!normalizedName) return [];

  const queryTokens = tokenizeLookupValue(normalizedName);
  const compactQuery = compactLookupValue(normalizedName);

  return materials
    .map((material) => {
      const materialName = normalizeLookupValue(material?.name);
      if (!material?.id || !materialName) return null;

      const materialTokens = tokenizeLookupValue(materialName);
      const compactMaterial = compactLookupValue(materialName);
      const tokenOverlap = getTokenOverlap(queryTokens, materialTokens);
      let score = 0;

      if (materialName === normalizedName) score += 1000;
      if (materialName.includes(normalizedName) || normalizedName.includes(materialName)) score += 420;
      if (compactMaterial.includes(compactQuery) || compactQuery.includes(compactMaterial)) score += 360;
      score += tokenOverlap * 120;

      if (material?.cas_number && normalizedName.includes(String(material.cas_number).toLowerCase())) score += 220;
      if (material?.workbook_code && normalizedName.includes(String(material.workbook_code).toLowerCase())) score += 220;

      return score >= 100 ? { material, score } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.material.name.localeCompare(right.material.name))
    .slice(0, limit)
    .map((entry) => entry.material);
};

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
