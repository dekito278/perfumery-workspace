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

const SOURCE_PRIORITIES = {
  perfumersworld: 100,
  manual_approved: 92,
  approved_external: 84,
  scentree: 76,
  tgsc: 72,
  manual: 28,
  reference_profile: 26,
  raw_material_form: 18,
  fallback: 12,
};

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

const FIELD_META = {
  workbook_code: { adapterKey: 'reference_code', type: 'text' },
  cas_number: { adapterKey: 'cas_number', type: 'text' },
  ifra_limit: { adapterKey: 'ifra_limit_percent', type: 'number', max: 100, spreads: { explicit: 0, heuristic: 5 } },
  reference_abc_primary_family: { adapterKey: 'primary_family', type: 'family' },
  reference_impact: { adapterKey: 'impact', type: 'number', spreads: { explicit: 0, heuristic: 35 } },
  reference_life_hours: { adapterKey: 'life_hours', type: 'number', spreads: { explicit: 0.5, heuristic: 10 } },
  reference_use_level_typical_percent: { adapterKey: 'use_level_typical_percent', type: 'number', max: 100, spreads: { explicit: 0, heuristic: 6 } },
  reference_use_level_max_percent: { adapterKey: 'use_level_max_percent', type: 'number', max: 100, spreads: { explicit: 0, heuristic: 8 } },
};

const CONFLICT_THRESHOLDS = {
  reference_impact: 45,
  reference_life_hours: 12,
  ifra_limit: 8,
  reference_use_level_typical_percent: 8,
  reference_use_level_max_percent: 10,
};

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

const normalizeSnapshotKey = (value) => String(value || '').trim().toLowerCase();

const buildExternalReferenceCode = ({ sourceKind, workbookCode, casNumber, name }) => {
  const normalizedWorkbook = normalizeText(workbookCode);
  if (normalizedWorkbook) {
    return normalizedWorkbook;
  }

  const normalizedCas = normalizeText(casNumber);
  const normalizedName = String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 12);
  const sourceCode = String(sourceKind || 'ext').replace(/[^a-z0-9]+/gi, '').toUpperCase().slice(0, 8) || 'EXT';

  if (normalizedCas) {
    return `EXT-${sourceCode}-${normalizedCas.replace(/[^0-9]+/g, '').slice(0, 10)}`;
  }

  if (normalizedName) {
    return `EXT-${sourceCode}-${normalizedName}`;
  }

  return `EXT-${sourceCode}-UNMAPPED`;
};

const getSourcePriority = (sourceKind, reviewStatus = null) => {
  const normalizedSource = normalizeSnapshotKey(sourceKind);
  const normalizedStatus = normalizeSnapshotKey(reviewStatus);

  if (normalizedSource === 'perfumersworld') {
    return SOURCE_PRIORITIES.perfumersworld;
  }
  if (normalizedStatus === 'approved_external') {
    return SOURCE_PRIORITIES.approved_external;
  }
  if (normalizedSource === 'manual' && normalizedStatus === 'approved_external') {
    return SOURCE_PRIORITIES.manual_approved;
  }

  return SOURCE_PRIORITIES[normalizedSource] || SOURCE_PRIORITIES.fallback;
};

const getNormalizedMethod = (sourceValue, fallback = 'captured') => {
  const normalizedSourceValue = normalizeSnapshotKey(sourceValue);
  if (normalizedSourceValue === 'explicit') {
    return 'explicit';
  }
  if (normalizedSourceValue === 'heuristic') {
    return 'heuristic';
  }
  return fallback;
};

const getExplicitnessScore = (method) => {
  if (method === 'explicit') {
    return 2;
  }
  if (method === 'mapped_family' || method === 'manual_lock') {
    return 1.5;
  }
  if (method === 'heuristic') {
    return 1;
  }
  return 0.5;
};

const parseConfidenceValue = (method, sourceKind = null) => {
  const normalizedMethod = getNormalizedMethod(method, method);
  if (normalizedMethod === 'explicit') {
    return sourceKind === 'perfumersworld' ? 0.99 : 0.93;
  }
  if (normalizedMethod === 'mapped_family') {
    return sourceKind === 'perfumersworld' ? 0.95 : 0.82;
  }
  if (normalizedMethod === 'heuristic') {
    return 0.72;
  }
  if (normalizedMethod === 'manual_lock') {
    return 1;
  }
  return 0.6;
};

const clampNumber = (value, min = 0, max = null) => {
  if (!Number.isFinite(value)) {
    return null;
  }

  let nextValue = value;
  if (Number.isFinite(min)) {
    nextValue = Math.max(min, nextValue);
  }
  if (Number.isFinite(max)) {
    nextValue = Math.min(max, nextValue);
  }
  return nextValue;
};

const buildNumericBand = (fieldKey, value, method) => {
  const numericValue = toNumber(value);
  const field = FIELD_META[fieldKey];
  if (numericValue === null || !field) {
    return { min: null, max: null };
  }

  const spread = field.spreads?.[method === 'heuristic' ? 'heuristic' : 'explicit'] ?? 0;
  const min = clampNumber(Number((numericValue - spread).toFixed(2)), 0, field.max ?? null);
  const max = clampNumber(Number((numericValue + spread).toFixed(2)), 0, field.max ?? null);

  return {
    min: min === null ? numericValue : min,
    max: max === null ? numericValue : max,
  };
};

const buildFieldSourcesForSnapshot = (snapshot) => {
  const sourceKind = normalizeSnapshotKey(snapshot?.source_kind || snapshot?.source || '');

  return {
    workbook_code: {
      method: snapshot?.workbook_code ? (sourceKind === 'perfumersworld' ? 'explicit' : 'captured') : null,
      confidence: parseConfidenceValue(sourceKind === 'perfumersworld' ? 'explicit' : 'captured', sourceKind),
    },
    cas_number: {
      method: snapshot?.cas_number ? 'explicit' : null,
      confidence: parseConfidenceValue('explicit', sourceKind),
    },
    ifra_limit: {
      method: snapshot?.ifra_limit !== null && snapshot?.ifra_limit !== undefined ? 'explicit' : null,
      confidence: parseConfidenceValue('explicit', sourceKind),
    },
    reference_abc_primary_family: {
      method: snapshot?.reference_abc_primary_family ? (sourceKind === 'perfumersworld' ? 'explicit' : 'mapped_family') : null,
      confidence: parseConfidenceValue(sourceKind === 'perfumersworld' ? 'explicit' : 'mapped_family', sourceKind),
    },
    reference_impact: {
      method: getNormalizedMethod(snapshot?.reference_impact_source, snapshot?.reference_impact !== null && snapshot?.reference_impact !== undefined ? 'captured' : null),
      confidence: parseConfidenceValue(snapshot?.reference_impact_source, sourceKind),
    },
    reference_life_hours: {
      method: getNormalizedMethod(snapshot?.reference_life_hours_source, snapshot?.reference_life_hours !== null && snapshot?.reference_life_hours !== undefined ? 'captured' : null),
      confidence: parseConfidenceValue(snapshot?.reference_life_hours_source, sourceKind),
    },
    reference_use_level_typical_percent: {
      method: snapshot?.reference_use_level_typical_percent !== null && snapshot?.reference_use_level_typical_percent !== undefined ? 'explicit' : null,
      confidence: parseConfidenceValue('explicit', sourceKind),
    },
    reference_use_level_max_percent: {
      method: snapshot?.reference_use_level_max_percent !== null && snapshot?.reference_use_level_max_percent !== undefined ? 'explicit' : null,
      confidence: parseConfidenceValue('explicit', sourceKind),
    },
  };
};

const normalizeSourceSnapshot = (snapshotKey, snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const normalizedSourceKind = normalizeSnapshotKey(snapshot?.source_kind || snapshot?.source || snapshotKey || 'unknown');
  const normalized = {
    ...cloneObject(snapshot),
    source_kind: normalizedSourceKind,
    source: normalizedSourceKind,
    source_url: normalizeText(snapshot?.source_url || snapshot?.url),
    url: normalizeText(snapshot?.source_url || snapshot?.url),
    extracted_at: normalizeText(snapshot?.extracted_at) || new Date().toISOString(),
    review_status: normalizeSnapshotKey(snapshot?.review_status)
      || (normalizedSourceKind === 'perfumersworld' ? 'approved_pw' : 'provisional_external'),
  };

  if (!normalized.reference_code && !normalized.workbook_code) {
    normalized.reference_code = buildExternalReferenceCode({
      sourceKind: normalizedSourceKind,
      workbookCode: snapshot?.workbook_code,
      casNumber: snapshot?.cas_number,
      name: snapshot?.name,
    });
  }

  normalized.field_sources = {
    ...buildFieldSourcesForSnapshot(normalized),
    ...cloneObject(snapshot?.field_sources),
  };

  return normalized;
};

const normalizeSourceSnapshots = (sourceSnapshots = {}) => Object.fromEntries(
  Object.entries(sourceSnapshots || {})
    .map(([key, value]) => [normalizeSnapshotKey(key), normalizeSourceSnapshot(key, value)])
    .filter(([, value]) => value)
);

export const deriveTopMiddleBaseTendency = ({ lifeHours, distribution }) => {
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
  const normalizedSnapshots = normalizeSourceSnapshots(sourceSnapshots);

  Object.entries(normalizedSnapshots).forEach(([key, snapshot]) => {
    adapters.push({
      adapter_key: key,
      source_kind: snapshot.source_kind,
      source_url: snapshot.source_url,
      review_status: snapshot.review_status,
      priority: getSourcePriority(snapshot.source_kind, snapshot.review_status),
      confidence: Math.max(
        parseConfidenceValue(snapshot?.reference_impact_source, snapshot.source_kind),
        parseConfidenceValue(snapshot?.reference_life_hours_source, snapshot.source_kind),
        snapshot.source_kind === 'perfumersworld' ? 0.99 : 0.82,
      ),
      field_sources: cloneObject(snapshot.field_sources),
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
      snapshot: cloneObject(snapshot),
    });
  });

  if (referenceProfile) {
    const referencePayload = cloneObject(referenceProfile.raw_payload);
    const referenceCanonical = cloneObject(referencePayload.canonical_profile);
    const referenceReviewStatus = normalizeSnapshotKey(referenceCanonical.review_status)
      || normalizeSnapshotKey(referencePayload.review_status)
      || (referenceProfile.source_kind === 'manual' ? 'fallback_manual' : 'approved_external');

    adapters.push({
      adapter_key: 'reference_profile',
      source_kind: normalizeText(referenceProfile.source_kind) || 'reference_profile',
      source_url: normalizeText(referencePayload?.source_url || referencePayload?.url),
      review_status: referenceReviewStatus,
      priority: getSourcePriority(referenceProfile.source_kind, referenceReviewStatus),
      field_sources: cloneObject(referencePayload.field_sources),
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
      confidence: referenceProfile.source_kind === 'manual' ? 0.78 : 0.94,
      snapshot: referencePayload,
    });
  }

  if (rawMaterial) {
    adapters.push({
      adapter_key: 'raw_material_form',
      source_kind: 'raw_material_form',
      source_url: null,
      review_status: 'fallback_manual',
      priority: SOURCE_PRIORITIES.raw_material_form,
      field_sources: {},
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
      confidence: 0.64,
      snapshot: {
        raw_material_id: rawMaterial.id,
      },
    });
  }

  return {
    adapters,
    normalizedSnapshots,
  };
};

const createFieldCandidate = (adapter, fieldKey) => {
  const fieldDefinition = FIELD_META[fieldKey];
  const candidateValue = adapter[fieldDefinition.adapterKey];

  if (candidateValue === null || candidateValue === undefined || candidateValue === '') {
    return null;
  }

  const fallbackMethod = fieldDefinition.type === 'family'
    ? (adapter.source_kind === 'perfumersworld' ? 'explicit' : 'mapped_family')
    : 'captured';
  const sourceDescriptor = adapter.field_sources?.[fieldKey] || {};
  const method = getNormalizedMethod(sourceDescriptor.method, fallbackMethod);
  const confidenceScore = Number((sourceDescriptor.confidence ?? parseConfidenceValue(method, adapter.source_kind)).toFixed(2));
  const numericBand = fieldDefinition.type === 'number'
    ? buildNumericBand(fieldKey, candidateValue, method)
    : { min: null, max: null };

  return {
    field_key: fieldKey,
    value: candidateValue,
    normalized_value: candidateValue,
    normalized_band_min: numericBand.min,
    normalized_band_max: numericBand.max,
    confidence_score: confidenceScore,
    normalization_method: method,
    source_priority_winner: adapter.source_kind,
    source_kind: adapter.source_kind,
    source_url: adapter.source_url,
    review_status: adapter.review_status,
    priority: adapter.priority,
    explicitness_score: getExplicitnessScore(method),
  };
};

const pickPreferredFieldCandidate = (adapters, fieldKey) => {
  const candidates = adapters
    .map((adapter) => createFieldCandidate(adapter, fieldKey))
    .filter(Boolean);

  if (!candidates.length) {
    return null;
  }

  candidates.sort((left, right) => (
    right.priority - left.priority
    || right.explicitness_score - left.explicitness_score
    || right.confidence_score - left.confidence_score
    || String(left.source_kind || '').localeCompare(String(right.source_kind || ''))
  ));

  return candidates[0];
};

const mergeDistributionCandidates = (adapters) => {
  const explicit = adapters
    .flatMap((adapter) => (adapter.family_distribution || []).map((entry) => ({
      letter: entry.letter,
      share: Number(entry.share || 0) * (adapter.priority / 100),
    })));

  const textCorpus = adapters.map((adapter) => adapter.text).filter(Boolean).join(' | ');
  const inferred = buildDistributionFromText(textCorpus)
    .map((entry) => ({
      letter: entry.letter,
      share: Number(entry.share || 0) * 0.35,
    }));

  return normalizeDistribution([...explicit, ...inferred]);
};

const uniqueCandidateValues = (candidates, fieldKey) => {
  if (FIELD_META[fieldKey]?.type === 'number') {
    return [...new Set(candidates.map((candidate) => Number(candidate.value).toFixed(2)))];
  }
  return [...new Set(candidates.map((candidate) => normalizeLower(candidate.value)))];
};

const detectFieldConflicts = (adapters, fieldLocks) => Object.fromEntries(
  FIELD_KEYS.map((fieldKey) => {
    if (fieldLocks[fieldKey]) {
      return [fieldKey, false];
    }

    const candidates = adapters
      .filter((adapter) => ['perfumersworld', 'scentree', 'tgsc'].includes(normalizeSnapshotKey(adapter.source_kind)))
      .map((adapter) => createFieldCandidate(adapter, fieldKey))
      .filter(Boolean);

    if (candidates.length < 2) {
      return [fieldKey, false];
    }

    const topPriority = Math.max(...candidates.map((candidate) => candidate.priority));
    const topCandidates = candidates.filter((candidate) => candidate.priority === topPriority);

    if (fieldKey === 'reference_impact' || fieldKey === 'reference_life_hours' || fieldKey === 'ifra_limit'
      || fieldKey === 'reference_use_level_typical_percent' || fieldKey === 'reference_use_level_max_percent') {
      const numericValues = topCandidates.map((candidate) => toNumber(candidate.value)).filter((value) => value !== null);
      if (numericValues.length < 2) {
        return [fieldKey, false];
      }

      const spread = Math.max(...numericValues) - Math.min(...numericValues);
      return [fieldKey, spread >= (CONFLICT_THRESHOLDS[fieldKey] || 0)];
    }

    return [fieldKey, uniqueCandidateValues(topCandidates, fieldKey).length > 1];
  })
);

const deriveReviewStatus = ({ normalizedSnapshots, adapters, fieldConflicts }) => {
  const snapshots = Object.values(normalizedSnapshots || {});
  const hasPw = snapshots.some((snapshot) => snapshot.source_kind === 'perfumersworld');
  const hasExternal = snapshots.some((snapshot) => snapshot.source_kind !== 'perfumersworld');
  const hasApprovedExternal = snapshots.some((snapshot) => snapshot.review_status === 'approved_external');
  const hasConflictFlag = snapshots.some((snapshot) => snapshot.review_status === 'conflict_review')
    || Object.values(fieldConflicts).some(Boolean);

  if (hasConflictFlag) {
    return 'conflict_review';
  }
  if (hasPw) {
    return 'approved_pw';
  }
  if (hasApprovedExternal) {
    return 'approved_external';
  }
  if (hasExternal) {
    return 'provisional_external';
  }
  if (adapters.some((adapter) => adapter.source_kind === 'raw_material_form' || adapter.source_kind === 'manual')) {
    return 'fallback_manual';
  }
  return 'fallback_manual';
};

const buildCanonicalProfile = ({
  referenceProfile = null,
  rawMaterial = null,
  sourceSnapshots = {},
  fieldLocks = {},
}) => {
  const { adapters, normalizedSnapshots } = buildSourceAdapters({ sourceSnapshots, referenceProfile, rawMaterial });
  const normalizedFieldLocks = normalizeFieldLocks(fieldLocks);
  const distribution = mergeDistributionCandidates(adapters);
  const topEntry = distribution[0] || null;
  const secondaryEntry = distribution[1] || null;
  const fieldResolution = Object.fromEntries(
    FIELD_KEYS.map((fieldKey) => [fieldKey, pickPreferredFieldCandidate(adapters, fieldKey)])
  );
  const fieldConflicts = detectFieldConflicts(adapters, normalizedFieldLocks);
  const reviewStatus = deriveReviewStatus({
    normalizedSnapshots,
    adapters,
    fieldConflicts,
  });

  const canonical = {
    source_kind: fieldResolution.workbook_code?.source_kind
      || fieldResolution.reference_abc_primary_family?.source_kind
      || 'canonical',
    reference_code: fieldResolution.workbook_code?.value
      || normalizeText(referenceProfile?.reference_code)
      || normalizeText(rawMaterial?.workbook_code)
      || null,
    canonical_status: reviewStatus === 'fallback_manual'
      ? 'fallback'
      : 'normalized',
    review_status: reviewStatus,
    abc_primary_family: fieldResolution.reference_abc_primary_family?.value
      || topEntry?.familyName
      || normalizeFamily(referenceProfile?.abc_primary_family)
      || normalizeFamily(rawMaterial?.reference_abc_primary_family || rawMaterial?.scent_family),
    abc_secondary_family: secondaryEntry?.familyName || normalizeFamily(referenceProfile?.abc_secondary_family),
    abc_distribution: distribution,
    impact: fieldResolution.reference_impact?.value ?? null,
    life_hours: fieldResolution.reference_life_hours?.value ?? null,
    ifra_limit_percent: fieldResolution.ifra_limit?.value ?? null,
    use_level_typical_percent: fieldResolution.reference_use_level_typical_percent?.value ?? null,
    use_level_max_percent: fieldResolution.reference_use_level_max_percent?.value ?? null,
    top_middle_base_tendency: deriveTopMiddleBaseTendency({
      lifeHours: fieldResolution.reference_life_hours?.value ?? null,
      distribution,
    }),
    confidence_score: Number((
      Object.values(fieldResolution)
        .filter(Boolean)
        .reduce((sum, resolution) => sum + Number(resolution.confidence_score || 0), 0)
      / Math.max(1, Object.values(fieldResolution).filter(Boolean).length)
    ).toFixed(2)),
    confidence_reason: reviewStatus === 'conflict_review'
      ? 'Multiple external sources disagree on one or more normalized fields and need review.'
      : 'Canonical profile resolved with source priority first, then confidence and method strength.',
    field_locks: normalizedFieldLocks,
    source_snapshots: normalizedSnapshots,
    cas_number: fieldResolution.cas_number?.value ?? null,
    field_resolution: fieldResolution,
    field_conflicts: fieldConflicts,
    provenance_summary: {
      total_sources: Object.keys(normalizedSnapshots).length,
      primary_source_kind: fieldResolution.reference_impact?.source_kind
        || fieldResolution.reference_life_hours?.source_kind
        || fieldResolution.reference_abc_primary_family?.source_kind
        || null,
      pending_review_sources: Object.values(normalizedSnapshots).filter((snapshot) => snapshot.review_status === 'provisional_external').length,
      approved_external_sources: Object.values(normalizedSnapshots).filter((snapshot) => snapshot.review_status === 'approved_external').length,
      conflict_fields: Object.entries(fieldConflicts).filter(([, value]) => value).map(([key]) => key),
    },
  };

  if (normalizedFieldLocks.reference_abc_primary_family && rawMaterial?.reference_abc_primary_family) {
    canonical.abc_primary_family = normalizeFamily(rawMaterial.reference_abc_primary_family);
    canonical.field_resolution.reference_abc_primary_family = {
      field_key: 'reference_abc_primary_family',
      value: canonical.abc_primary_family,
      normalized_value: canonical.abc_primary_family,
      normalized_band_min: null,
      normalized_band_max: null,
      confidence_score: 1,
      normalization_method: 'manual_lock',
      source_priority_winner: 'manual_lock',
      source_kind: 'manual_lock',
      source_url: null,
      review_status: reviewStatus,
      priority: 1000,
      explicitness_score: getExplicitnessScore('manual_lock'),
    };
  }

  if (normalizedFieldLocks.reference_impact) {
    const lockedValue = toNumber(rawMaterial?.reference_impact);
    const band = buildNumericBand('reference_impact', lockedValue, 'explicit');
    canonical.impact = lockedValue;
    canonical.field_resolution.reference_impact = {
      field_key: 'reference_impact',
      value: lockedValue,
      normalized_value: lockedValue,
      normalized_band_min: band.min,
      normalized_band_max: band.max,
      confidence_score: 1,
      normalization_method: 'manual_lock',
      source_priority_winner: 'manual_lock',
      source_kind: 'manual_lock',
      source_url: null,
      review_status: reviewStatus,
      priority: 1000,
      explicitness_score: getExplicitnessScore('manual_lock'),
    };
  }

  if (normalizedFieldLocks.reference_life_hours) {
    const lockedValue = toNumber(rawMaterial?.reference_life_hours);
    const band = buildNumericBand('reference_life_hours', lockedValue, 'explicit');
    canonical.life_hours = lockedValue;
    canonical.field_resolution.reference_life_hours = {
      field_key: 'reference_life_hours',
      value: lockedValue,
      normalized_value: lockedValue,
      normalized_band_min: band.min,
      normalized_band_max: band.max,
      confidence_score: 1,
      normalization_method: 'manual_lock',
      source_priority_winner: 'manual_lock',
      source_kind: 'manual_lock',
      source_url: null,
      review_status: reviewStatus,
      priority: 1000,
      explicitness_score: getExplicitnessScore('manual_lock'),
    };
  }

  if (normalizedFieldLocks.ifra_limit) {
    const lockedValue = toNumber(rawMaterial?.ifra_limit);
    const band = buildNumericBand('ifra_limit', lockedValue, 'explicit');
    canonical.ifra_limit_percent = lockedValue;
    canonical.field_resolution.ifra_limit = {
      field_key: 'ifra_limit',
      value: lockedValue,
      normalized_value: lockedValue,
      normalized_band_min: band.min,
      normalized_band_max: band.max,
      confidence_score: 1,
      normalization_method: 'manual_lock',
      source_priority_winner: 'manual_lock',
      source_kind: 'manual_lock',
      source_url: null,
      review_status: reviewStatus,
      priority: 1000,
      explicitness_score: getExplicitnessScore('manual_lock'),
    };
  }

  if (normalizedFieldLocks.reference_use_level_typical_percent) {
    const lockedValue = toNumber(rawMaterial?.reference_use_level_typical_percent);
    const band = buildNumericBand('reference_use_level_typical_percent', lockedValue, 'explicit');
    canonical.use_level_typical_percent = lockedValue;
    canonical.field_resolution.reference_use_level_typical_percent = {
      field_key: 'reference_use_level_typical_percent',
      value: lockedValue,
      normalized_value: lockedValue,
      normalized_band_min: band.min,
      normalized_band_max: band.max,
      confidence_score: 1,
      normalization_method: 'manual_lock',
      source_priority_winner: 'manual_lock',
      source_kind: 'manual_lock',
      source_url: null,
      review_status: reviewStatus,
      priority: 1000,
      explicitness_score: getExplicitnessScore('manual_lock'),
    };
  }

  if (normalizedFieldLocks.reference_use_level_max_percent) {
    const lockedValue = toNumber(rawMaterial?.reference_use_level_max_percent);
    const band = buildNumericBand('reference_use_level_max_percent', lockedValue, 'explicit');
    canonical.use_level_max_percent = lockedValue;
    canonical.field_resolution.reference_use_level_max_percent = {
      field_key: 'reference_use_level_max_percent',
      value: lockedValue,
      normalized_value: lockedValue,
      normalized_band_min: band.min,
      normalized_band_max: band.max,
      confidence_score: 1,
      normalization_method: 'manual_lock',
      source_priority_winner: 'manual_lock',
      source_kind: 'manual_lock',
      source_url: null,
      review_status: reviewStatus,
      priority: 1000,
      explicitness_score: getExplicitnessScore('manual_lock'),
    };
  }

  if (normalizedFieldLocks.cas_number) {
    const lockedValue = normalizeText(rawMaterial?.cas_number);
    canonical.cas_number = lockedValue;
    canonical.field_resolution.cas_number = {
      field_key: 'cas_number',
      value: lockedValue,
      normalized_value: lockedValue,
      normalized_band_min: null,
      normalized_band_max: null,
      confidence_score: 1,
      normalization_method: 'manual_lock',
      source_priority_winner: 'manual_lock',
      source_kind: 'manual_lock',
      source_url: null,
      review_status: reviewStatus,
      priority: 1000,
      explicitness_score: getExplicitnessScore('manual_lock'),
    };
  }

  if (normalizedFieldLocks.workbook_code) {
    const lockedValue = normalizeText(rawMaterial?.workbook_code) || canonical.reference_code;
    canonical.reference_code = lockedValue;
    canonical.field_resolution.workbook_code = {
      field_key: 'workbook_code',
      value: lockedValue,
      normalized_value: lockedValue,
      normalized_band_min: null,
      normalized_band_max: null,
      confidence_score: 1,
      normalization_method: 'manual_lock',
      source_priority_winner: 'manual_lock',
      source_kind: 'manual_lock',
      source_url: null,
      review_status: reviewStatus,
      priority: 1000,
      explicitness_score: getExplicitnessScore('manual_lock'),
    };
  }

  return canonical;
};

export const getCanonicalMetadataFromRawPayload = (rawPayload) => ({
  canonical_profile: cloneObject(rawPayload?.canonical_profile),
  field_locks: normalizeFieldLocks(rawPayload?.field_locks),
  source_snapshots: normalizeSourceSnapshots(rawPayload?.source_snapshots),
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
  const nextSourceSnapshots = sourceSnapshots
    ? normalizeSourceSnapshots(sourceSnapshots)
    : priorMetadata.source_snapshots;
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
    review_status: canonicalProfile.review_status,
    source_snapshots: nextSourceSnapshots,
    field_locks: nextFieldLocks,
    canonical_profile: canonicalProfile,
  };
};

export const createReferenceMetadataPatch = ({ sourceSnapshots = null, fieldLocks = null } = {}) => ({
  __referenceSourceSnapshots: sourceSnapshots ? normalizeSourceSnapshots(sourceSnapshots) : null,
  __referenceFieldLocks: fieldLocks ? normalizeFieldLocks(fieldLocks) : null,
});

export const REFERENCE_FIELD_KEYS = FIELD_KEYS;
