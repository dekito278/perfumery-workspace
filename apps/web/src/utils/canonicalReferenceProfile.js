import {
  WORKBOOK_ABC_CLASSIFICATIONS,
  getWorkbookAbcClassificationByFamilyName,
  getWorkbookAbcClassificationByLetter,
} from '@/utils/workbookAbcClassification.js';

const LETTERS = WORKBOOK_ABC_CLASSIFICATIONS.map((entry) => entry.letter);
const FIELD_KEYS = [
  'workbook_code',
  'cas_number',
  'ifra_limit',
  'reference_abc_primary_family',
  'reference_impact',
  'reference_life_hours',
  'reference_use_level_typical_percent',
  'reference_use_level_max_percent',
];

const KEYWORD_GROUPS = {
  A: ['aliphatic', 'fatty', 'waxy', 'soapy', 'clean aldehydic', 'soap'],
  B: ['iceberg', 'cooling', 'mint', 'camphor', 'marine fresh', 'aldehydic fresh', 'eucalyptus'],
  C: ['citrus', 'bergamot', 'orange', 'lemon', 'lime', 'grapefruit', 'peel', 'zest', 'citral'],
  D: ['dairy', 'milky', 'cream', 'butter', 'cheese', 'lactone'],
  E: ['edible', 'nutty', 'coffee', 'cocoa', 'meat', 'savory', 'vegetable', 'gourmand roasted'],
  F: ['fruit', 'fruity', 'berry', 'apple', 'pear', 'peach', 'melon', 'tropical', 'juicy'],
  G: ['green', 'leaf', 'leafy', 'cut grass', 'stem', 'galbanum', 'fresh green'],
  H: ['herb', 'herbal', 'aromatic', 'sage', 'lavender', 'rosemary', 'thyme', 'basil'],
  I: ['iris', 'orris', 'violet', 'ionone'],
  J: ['jasmin', 'jasmine', 'indolic floral', 'narcotic jasmin'],
  K: ['konifer', 'conifer', 'pine', 'fir', 'needle', 'terpene pine'],
  L: ['light chemical floral', 'clean floral', 'transparent floral', 'linalool', 'fresh floral'],
  M: ['muguet', 'lily of the valley', 'watery floral', 'green floral'],
  N: ['narcotic', 'tuberose', 'ylang', 'heavy floral', 'opulent floral'],
  O: ['orchid', 'salicylate floral', 'deep floral', 'exotic floral'],
  P: ['phenol', 'medicinal', 'clove phenolic', 'honey phenolic'],
  Q: ['amber', 'resin', 'resinous', 'balsam', 'incense', 'labdanum', 'oriental'],
  R: ['rose', 'geranium', 'citronellol', 'pea floral'],
  S: ['spice', 'spicy', 'cinnamon', 'clove', 'pepper', 'cardamom'],
  T: ['tar', 'smoke', 'smoky', 'burnt', 'cade', 'birch tar'],
  U: ['animal', 'faecal', 'fecal', 'leather', 'civet', 'castoreum'],
  V: ['vanilla', 'vanillic', 'coumarin', 'sweet balsamic'],
  W: ['wood', 'woody', 'cedar', 'sandal', 'vetiver', 'patchouli wood', 'timber'],
  X: ['musk', 'musky', 'skin', 'sensual'],
  Y: ['earthy', 'mossy', 'oakmoss', 'fungal', 'marine', 'seaweed', 'soil'],
  Z: ['solvent', 'ethanol', 'dpg', 'dep', 'tec', 'carrier', 'solubiliser', 'solventy'],
};

const FAMILY_ALIAS_MAP = new Map([
  ['berg-iceberg', 'ICEBERG'],
  ['herb (cool)', 'HERB'],
  ['light chemical floral', 'LIGHT CHEMICAL FLORAL'],
  ['queen of the orient', 'QUEEN OF THE ORIENT'],
  ['spice (hot)', 'SPICE'],
  ['urine faecal animal', 'ANIMAL'],
  ['x-rated musk', 'MUSK'],
  ['zolvents', 'ZOLVENTS'],
]);

const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeText = (value) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const normalizeLower = (value) => String(value || '').trim().toLowerCase();

const normalizeFamily = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const alias = FAMILY_ALIAS_MAP.get(normalized.toLowerCase());
  return alias || normalized;
};

const cloneObject = (value) => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return { ...value };
  }
};

const buildEmptyFieldLocks = () => Object.fromEntries(FIELD_KEYS.map((key) => [key, false]));

const normalizeFieldLocks = (fieldLocks) => {
  const nextLocks = buildEmptyFieldLocks();
  Object.entries(fieldLocks || {}).forEach(([key, value]) => {
    if (FIELD_KEYS.includes(key)) {
      nextLocks[key] = Boolean(value);
    }
  });
  return nextLocks;
};

const parseSourceKind = (snapshotKey, snapshot) => snapshot?.source || snapshot?.source_kind || snapshotKey || 'unknown';

const parseConfidenceValue = (value) => {
  if (value === 'explicit') {
    return 0.95;
  }
  if (value === 'heuristic') {
    return 0.72;
  }
  return 0.55;
};

const normalizeDistribution = (entries) => {
  const totals = new Map();
  (entries || []).forEach((entry) => {
    const letter = entry?.letter ? String(entry.letter).toUpperCase() : null;
    const share = toNumber(entry?.share ?? entry?.value);
    if (!letter || !LETTERS.includes(letter) || share === null || share <= 0) {
      return;
    }
    totals.set(letter, (totals.get(letter) || 0) + share);
  });

  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  if (!total) {
    return [];
  }

  return [...totals.entries()]
    .map(([letter, share]) => {
      const classification = getWorkbookAbcClassificationByLetter(letter);
      return classification ? {
        ...classification,
        share: Number(((share / total) * 100).toFixed(2)),
      } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.share - left.share);
};

const buildDistributionFromFamilies = (primaryFamily, secondaryFamily = null) => {
  const primary = getWorkbookAbcClassificationByFamilyName(normalizeFamily(primaryFamily));
  const secondary = getWorkbookAbcClassificationByFamilyName(normalizeFamily(secondaryFamily));

  if (primary && secondary) {
    return normalizeDistribution([
      { letter: primary.letter, share: 68 },
      { letter: secondary.letter, share: 32 },
    ]);
  }

  if (primary) {
    return normalizeDistribution([{ letter: primary.letter, share: 100 }]);
  }

  return [];
};

const buildDistributionFromOdourFacets = (odourFacets) => normalizeDistribution(
  (odourFacets || []).map((facet) => ({
    letter: facet.letter,
    share: facet.value,
  }))
);

const buildDistributionFromText = (text) => {
  const normalizedText = normalizeLower(text);
  if (!normalizedText) {
    return [];
  }

  const scores = new Map(LETTERS.map((letter) => [letter, 0]));
  Object.entries(KEYWORD_GROUPS).forEach(([letter, keywords]) => {
    keywords.forEach((keyword) => {
      if (normalizedText.includes(keyword)) {
        scores.set(letter, (scores.get(letter) || 0) + 1);
      }
    });
  });

  return normalizeDistribution(
    [...scores.entries()]
      .filter(([, score]) => score > 0)
      .map(([letter, score]) => ({ letter, share: score }))
  );
};

const deriveTopMiddleBaseTendency = ({ lifeHours, distribution }) => {
  const woodyBaseLetters = new Set(['Q', 'T', 'U', 'V', 'W', 'X', 'Y']);
  const volatileTopLetters = new Set(['A', 'B', 'C', 'F', 'G', 'H', 'K']);

  if (lifeHours !== null) {
    if (lifeHours <= 8) {
      return 'top';
    }
    if (lifeHours >= 36) {
      return 'base';
    }
  }

  const topWeight = (distribution || [])
    .filter((entry) => volatileTopLetters.has(entry.letter))
    .reduce((sum, entry) => sum + Number(entry.share || 0), 0);
  const baseWeight = (distribution || [])
    .filter((entry) => woodyBaseLetters.has(entry.letter))
    .reduce((sum, entry) => sum + Number(entry.share || 0), 0);

  if (topWeight >= baseWeight + 20) {
    return 'top';
  }
  if (baseWeight >= topWeight + 20) {
    return 'base';
  }
  return 'middle';
};

const buildSourceAdapters = ({ sourceSnapshots = {}, referenceProfile = null, rawMaterial = null }) => {
  const adapters = [];

  Object.entries(sourceSnapshots || {}).forEach(([key, snapshot]) => {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }

    adapters.push({
      source_kind: parseSourceKind(key, snapshot),
      reference_code: normalizeText(snapshot.workbook_code || snapshot.reference_code),
      primary_family: normalizeFamily(snapshot.reference_abc_primary_family || snapshot.abc_primary_family),
      impact: toNumber(snapshot.reference_impact),
      life_hours: toNumber(snapshot.reference_life_hours || snapshot.substantivity_hours),
      ifra_limit_percent: toNumber(snapshot.ifra_limit),
      use_level_typical_percent: toNumber(snapshot.reference_use_level_typical_percent),
      use_level_max_percent: toNumber(snapshot.reference_use_level_max_percent),
      cas_number: normalizeText(snapshot.cas_number),
      text: [
        snapshot.name,
        snapshot.description,
        snapshot.odour,
        snapshot.odor_type,
        snapshot.odor_description,
        snapshot.perfume_uses,
        snapshot.uses_in_perfumery,
        Array.isArray(snapshot.classification_path) ? snapshot.classification_path.join(' > ') : null,
      ].filter(Boolean).join(' | '),
      family_distribution: buildDistributionFromFamilies(
        snapshot.reference_abc_primary_family || snapshot.abc_primary_family,
        snapshot.abc_secondary_family
      ),
      confidence: parseConfidenceValue(snapshot.reference_impact_source || snapshot.reference_life_hours_source),
      snapshot: cloneObject(snapshot),
    });
  });

  if (referenceProfile) {
    adapters.push({
      source_kind: normalizeText(referenceProfile.source_kind) || 'reference_profile',
      reference_code: normalizeText(referenceProfile.reference_code),
      primary_family: normalizeFamily(referenceProfile.abc_primary_family),
      impact: toNumber(referenceProfile.impact),
      life_hours: toNumber(referenceProfile.life_hours),
      ifra_limit_percent: toNumber(referenceProfile.ifra_limit_percent),
      use_level_typical_percent: toNumber(referenceProfile.use_level_typical_percent),
      use_level_max_percent: toNumber(referenceProfile.use_level_max_percent),
      cas_number: normalizeText(referenceProfile.cas_no),
      text: [
        referenceProfile.name,
        referenceProfile.brief_description,
        referenceProfile.odour_description,
        referenceProfile.odour_profile,
        referenceProfile.classification,
      ].filter(Boolean).join(' | '),
      family_distribution: buildDistributionFromOdourFacets(referenceProfile.odour_facets).length
        ? buildDistributionFromOdourFacets(referenceProfile.odour_facets)
        : buildDistributionFromFamilies(referenceProfile.abc_primary_family, referenceProfile.abc_secondary_family),
      confidence: referenceProfile.source_kind === 'manual' ? 0.74 : 0.94,
      snapshot: cloneObject(referenceProfile.raw_payload),
    });
  }

  if (rawMaterial) {
    adapters.push({
      source_kind: 'raw_material_form',
      reference_code: normalizeText(rawMaterial.workbook_code),
      primary_family: normalizeFamily(rawMaterial.reference_abc_primary_family || rawMaterial.scent_family),
      impact: toNumber(rawMaterial.reference_impact),
      life_hours: toNumber(rawMaterial.reference_life_hours),
      ifra_limit_percent: toNumber(rawMaterial.ifra_limit),
      use_level_typical_percent: toNumber(rawMaterial.reference_use_level_typical_percent),
      use_level_max_percent: toNumber(rawMaterial.reference_use_level_max_percent),
      cas_number: normalizeText(rawMaterial.cas_number),
      text: [
        rawMaterial.name,
        rawMaterial.description,
        rawMaterial.notes,
        rawMaterial.category,
        rawMaterial.scent_family,
      ].filter(Boolean).join(' | '),
      family_distribution: buildDistributionFromFamilies(rawMaterial.reference_abc_primary_family || rawMaterial.scent_family),
      confidence: 0.65,
      snapshot: {
        raw_material_id: rawMaterial.id,
      },
    });
  }

  return adapters;
};

const pickStrongestValue = (adapters, fieldName) => {
  const candidates = adapters
    .map((adapter) => ({ value: adapter[fieldName], confidence: adapter.confidence, source_kind: adapter.source_kind }))
    .filter((entry) => entry.value !== null && entry.value !== undefined && entry.value !== '');

  if (!candidates.length) {
    return { value: null, source_kind: null };
  }

  candidates.sort((left, right) => right.confidence - left.confidence);
  return { value: candidates[0].value, source_kind: candidates[0].source_kind };
};

const mergeDistributionCandidates = (adapters) => {
  const explicit = adapters
    .flatMap((adapter) => (adapter.family_distribution || []).map((entry) => ({
      letter: entry.letter,
      share: Number(entry.share || 0) * (adapter.confidence || 1),
    })));

  const textCorpus = adapters.map((adapter) => adapter.text).filter(Boolean).join(' | ');
  const inferred = buildDistributionFromText(textCorpus)
    .map((entry) => ({
      letter: entry.letter,
      share: Number(entry.share || 0) * 0.45,
    }));

  return normalizeDistribution([...explicit, ...inferred]);
};

const buildCanonicalProfile = ({
  referenceProfile = null,
  rawMaterial = null,
  sourceSnapshots = {},
  fieldLocks = {},
}) => {
  const adapters = buildSourceAdapters({ sourceSnapshots, referenceProfile, rawMaterial });
  const normalizedFieldLocks = normalizeFieldLocks(fieldLocks);
  const distribution = mergeDistributionCandidates(adapters);
  const strongestReferenceCode = pickStrongestValue(adapters, 'reference_code');
  const strongestImpact = pickStrongestValue(adapters, 'impact');
  const strongestLife = pickStrongestValue(adapters, 'life_hours');
  const strongestIfra = pickStrongestValue(adapters, 'ifra_limit_percent');
  const strongestTypicalUse = pickStrongestValue(adapters, 'use_level_typical_percent');
  const strongestMaxUse = pickStrongestValue(adapters, 'use_level_max_percent');
  const strongestCas = pickStrongestValue(adapters, 'cas_number');
  const topEntry = distribution[0] || null;
  const secondaryEntry = distribution[1] || null;
  const confidenceScore = adapters.length
    ? Number((adapters.reduce((sum, adapter) => sum + (adapter.confidence || 0), 0) / adapters.length).toFixed(2))
    : 0.4;

  const canonical = {
    source_kind: strongestReferenceCode.source_kind || pickStrongestValue(adapters, 'primary_family').source_kind || 'canonical',
    reference_code: strongestReferenceCode.value
      || normalizeText(referenceProfile?.reference_code)
      || normalizeText(rawMaterial?.workbook_code)
      || null,
    canonical_status: distribution.length ? 'normalized' : 'fallback',
    abc_primary_family: topEntry?.familyName || normalizeFamily(referenceProfile?.abc_primary_family) || normalizeFamily(rawMaterial?.reference_abc_primary_family || rawMaterial?.scent_family),
    abc_secondary_family: secondaryEntry?.familyName || normalizeFamily(referenceProfile?.abc_secondary_family),
    abc_distribution: distribution,
    impact: strongestImpact.value,
    life_hours: strongestLife.value,
    ifra_limit_percent: strongestIfra.value,
    use_level_typical_percent: strongestTypicalUse.value,
    use_level_max_percent: strongestMaxUse.value,
    top_middle_base_tendency: deriveTopMiddleBaseTendency({
      lifeHours: strongestLife.value,
      distribution,
    }),
    confidence_score: confidenceScore,
    confidence_reason: distribution.length
      ? 'Canonical profile blended from available structured fields, source snapshots, and ABC text inference.'
      : 'Canonical profile fallback generated from sparse guidance fields.',
    field_locks: normalizedFieldLocks,
    source_snapshots: cloneObject(sourceSnapshots),
    cas_number: strongestCas.value,
  };

  if (normalizedFieldLocks.reference_abc_primary_family && rawMaterial?.reference_abc_primary_family) {
    canonical.abc_primary_family = normalizeFamily(rawMaterial.reference_abc_primary_family);
  }
  if (normalizedFieldLocks.reference_impact) {
    canonical.impact = toNumber(rawMaterial?.reference_impact);
  }
  if (normalizedFieldLocks.reference_life_hours) {
    canonical.life_hours = toNumber(rawMaterial?.reference_life_hours);
  }
  if (normalizedFieldLocks.ifra_limit) {
    canonical.ifra_limit_percent = toNumber(rawMaterial?.ifra_limit);
  }
  if (normalizedFieldLocks.reference_use_level_typical_percent) {
    canonical.use_level_typical_percent = toNumber(rawMaterial?.reference_use_level_typical_percent);
  }
  if (normalizedFieldLocks.reference_use_level_max_percent) {
    canonical.use_level_max_percent = toNumber(rawMaterial?.reference_use_level_max_percent);
  }
  if (normalizedFieldLocks.cas_number) {
    canonical.cas_number = normalizeText(rawMaterial?.cas_number);
  }
  if (normalizedFieldLocks.workbook_code) {
    canonical.reference_code = normalizeText(rawMaterial?.workbook_code) || canonical.reference_code;
  }

  return canonical;
};

export const getCanonicalMetadataFromRawPayload = (rawPayload) => ({
  canonical_profile: cloneObject(rawPayload?.canonical_profile),
  field_locks: normalizeFieldLocks(rawPayload?.field_locks),
  source_snapshots: cloneObject(rawPayload?.source_snapshots),
});

export const resolveCanonicalReferenceProfile = ({ referenceProfile = null, rawMaterial = null } = {}) => {
  if (!referenceProfile && !rawMaterial) {
    return null;
  }

  const rawPayload = cloneObject(referenceProfile?.raw_payload);
  const metadata = getCanonicalMetadataFromRawPayload(rawPayload);
  const canonical = buildCanonicalProfile({
    referenceProfile,
    rawMaterial,
    sourceSnapshots: metadata.source_snapshots,
    fieldLocks: metadata.field_locks,
  });

  return canonical;
};

export const buildCanonicalReferencePayload = ({
  rawMaterial,
  existingRawPayload = {},
  sourceSnapshots = null,
  fieldLocks = null,
}) => {
  const priorMetadata = getCanonicalMetadataFromRawPayload(existingRawPayload);
  const nextSourceSnapshots = sourceSnapshots ? cloneObject(sourceSnapshots) : priorMetadata.source_snapshots;
  const nextFieldLocks = fieldLocks ? normalizeFieldLocks(fieldLocks) : priorMetadata.field_locks;
  const canonicalProfile = buildCanonicalProfile({
    rawMaterial,
    referenceProfile: {
      source_kind: 'manual',
      raw_payload: existingRawPayload,
    },
    sourceSnapshots: nextSourceSnapshots,
    fieldLocks: nextFieldLocks,
  });

  return {
    ...cloneObject(existingRawPayload),
    source: existingRawPayload?.source || 'manual_raw_material_form',
    source_snapshots: nextSourceSnapshots,
    field_locks: nextFieldLocks,
    canonical_profile: canonicalProfile,
  };
};

export const createReferenceMetadataPatch = ({ sourceSnapshots = null, fieldLocks = null } = {}) => ({
  __referenceSourceSnapshots: sourceSnapshots ? cloneObject(sourceSnapshots) : null,
  __referenceFieldLocks: fieldLocks ? normalizeFieldLocks(fieldLocks) : null,
});

export const REFERENCE_FIELD_KEYS = FIELD_KEYS;
