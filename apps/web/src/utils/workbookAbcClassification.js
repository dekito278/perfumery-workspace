const WORKBOOK_ABC_CLASSIFICATIONS = [
  { letter: 'A', classIndex: 1, familyName: 'ALI-FAT-IC', description: 'Fatty, waxy, soapy, clean', color: '#c97b63' },
  { letter: 'B', classIndex: 2, familyName: 'ICEBERG', description: 'Cooling, borneol, mint, camphor', color: '#5bb4d8' },
  { letter: 'C', classIndex: 3, familyName: 'CITRUS', description: 'Sour, sharp, citrus peel', color: '#f0a83a' },
  { letter: 'D', classIndex: 4, familyName: 'DAIRY', description: 'Milky, cream, butter, cheese', color: '#d5bf7a' },
  { letter: 'E', classIndex: 5, familyName: 'EDIBLE', description: 'Vegetable, nut, fish, meat', color: '#9c7b58' },
  { letter: 'F', classIndex: 6, familyName: 'FRUIT', description: 'Sour, sweet fruits, strawberry', color: '#dd5f78' },
  { letter: 'G', classIndex: 7, familyName: 'GREEN', description: 'Cut-grass, leaves', color: '#57a764' },
  { letter: 'H', classIndex: 8, familyName: 'HERB', description: 'Cool herbaceous notes', color: '#3d8a59' },
  { letter: 'I', classIndex: 9, familyName: 'IRIS', description: 'Orris, violet', color: '#7f78cf' },
  { letter: 'J', classIndex: 10, familyName: 'JASMIN', description: 'Fruity, oily, narcotic, jasmin', color: '#e17194' },
  { letter: 'K', classIndex: 11, familyName: 'KONIFER', description: 'Pine, pineneedle', color: '#4f8a6d' },
  { letter: 'L', classIndex: 12, familyName: 'LIGHT CHEMICAL FLORAL', description: 'Fresh light floral chemical', color: '#b58de5' },
  { letter: 'M', classIndex: 13, familyName: 'MUGUET', description: 'Lily of the valley, green, fresh', color: '#7fd6c8' },
  { letter: 'N', classIndex: 14, familyName: 'NARCOTIC', description: 'Heavy sweet florals, absolutes', color: '#8d5ea8' },
  { letter: 'O', classIndex: 15, familyName: 'ORCHID', description: 'Aromatic, deep floral', color: '#c676b5' },
  { letter: 'P', classIndex: 16, familyName: 'PHENOL', description: 'Phenol, medicinal, honey', color: '#b06d44' },
  { letter: 'Q', classIndex: 17, familyName: 'QUEEN OF THE ORIENT', description: 'Resin, balsam', color: '#7b5e3f' },
  { letter: 'R', classIndex: 18, familyName: 'ROSE', description: 'Rose otto, absolute, geranium', color: '#d96d86' },
  { letter: 'S', classIndex: 19, familyName: 'SPICE', description: 'Hot culinary spice', color: '#c85f32' },
  { letter: 'T', classIndex: 20, familyName: 'TAR SMOKE', description: 'Smoke, tar, burnt', color: '#6b5b57' },
  { letter: 'U', classIndex: 21, familyName: 'ANIMAL', description: 'Animal, faecal, leather', color: '#7a4e3b' },
  { letter: 'V', classIndex: 22, familyName: 'VANILLA', description: 'Sweet edible vanilla', color: '#caa36b' },
  { letter: 'W', classIndex: 23, familyName: 'WOOD', description: 'Wood, oily', color: '#8d6843' },
  { letter: 'X', classIndex: 24, familyName: 'MUSK', description: 'Sexy, musk, sensual, sweet', color: '#8e6ec9' },
  { letter: 'Y', classIndex: 25, familyName: 'EARTHY MOSSY', description: 'Yeast, fungal, moss, marine', color: '#607f5c' },
  { letter: 'Z', classIndex: 26, familyName: 'ZOLVENTS', description: 'Low odour solvents and solubilisers', color: '#7e91ad' },
];

const byLetter = new Map(WORKBOOK_ABC_CLASSIFICATIONS.map((entry) => [entry.letter, entry]));
const byClassIndex = new Map(WORKBOOK_ABC_CLASSIFICATIONS.map((entry) => [entry.classIndex, entry]));
const byFamilyName = new Map(
  WORKBOOK_ABC_CLASSIFICATIONS.map((entry) => [entry.familyName.toLowerCase(), entry])
);

const normalizeLetter = (value) => {
  const match = String(value || '').trim().match(/[A-Za-z]/);
  return match ? match[0].toUpperCase() : null;
};

const normalizeFamilyName = (value) => String(value || '').trim().toLowerCase();

const filterPositiveShareEntries = (entries) => (
  entries.filter((entry) => entry && Number(entry.share || 0) > 0)
);

const mapEntryWithMetadata = (entry, share, source) => {
  if (!entry) {
    return null;
  }

  return {
    letter: entry.letter,
    classIndex: entry.classIndex,
    familyName: entry.familyName,
    description: entry.description,
    color: entry.color,
    share,
    source,
  };
};

const parseRawPayloadDistribution = (rawPayload) => {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return [];
  }

  const entries = [];
  for (let classIndex = 1; classIndex <= WORKBOOK_ABC_CLASSIFICATIONS.length; classIndex += 1) {
    const share = Number(rawPayload[`Class_${classIndex}`] || 0);
    if (share <= 0) {
      continue;
    }

    entries.push(mapEntryWithMetadata(getWorkbookAbcClassificationByIndex(classIndex), share, 'raw_payload'));
  }

  return filterPositiveShareEntries(entries);
};

const parseOdourProfileDistribution = (odourProfile) => {
  const entries = [];
  const expression = /([A-Za-z])\s*:\s*([0-9.]+)/g;
  const text = String(odourProfile || '');
  let match = expression.exec(text);

  while (match) {
    const classification = getWorkbookAbcClassificationByLetter(match[1]);
    const share = Number(match[2] || 0);
    if (classification && share > 0) {
      entries.push(mapEntryWithMetadata(classification, share, 'odour_profile'));
    }
    match = expression.exec(text);
  }

  return filterPositiveShareEntries(entries);
};

const buildFamilyFallbackDistribution = (referenceProfile) => {
  const primary = getWorkbookAbcClassificationByFamilyName(referenceProfile?.abc_primary_family);
  const secondary = getWorkbookAbcClassificationByFamilyName(referenceProfile?.abc_secondary_family);

  if (primary && secondary) {
    return filterPositiveShareEntries([
      mapEntryWithMetadata(primary, 70, 'family_fallback'),
      mapEntryWithMetadata(secondary, 30, 'family_fallback'),
    ]);
  }

  if (primary) {
    return filterPositiveShareEntries([mapEntryWithMetadata(primary, 100, 'family_fallback')]);
  }

  return [];
};

export const getWorkbookAbcClassificationByLetter = (letter) => byLetter.get(normalizeLetter(letter)) || null;

export const getWorkbookAbcClassificationByIndex = (classIndex) => {
  const normalizedClassIndex = Number(classIndex);
  return Number.isFinite(normalizedClassIndex) ? byClassIndex.get(normalizedClassIndex) || null : null;
};

export const getWorkbookAbcClassificationByFamilyName = (familyName) => (
  byFamilyName.get(normalizeFamilyName(familyName)) || null
);

export const extractWorkbookClassDistribution = (referenceProfile) => {
  const fromRawPayload = parseRawPayloadDistribution(referenceProfile?.raw_payload);
  if (fromRawPayload.length) {
    return fromRawPayload;
  }

  const fromOdourProfile = parseOdourProfileDistribution(referenceProfile?.odour_profile);
  if (fromOdourProfile.length) {
    return fromOdourProfile;
  }

  return buildFamilyFallbackDistribution(referenceProfile);
};

export const WORKBOOK_ABC_CLASSIFICATIONS_BY_INDEX = byClassIndex;
export { WORKBOOK_ABC_CLASSIFICATIONS };
