import { resolveRawMaterialGuidanceSnapshot } from '@/utils/rawMaterialGuidanceResolver.js';
import { buildGuidanceLimitAdvisories, getDilutionFactor } from '@/utils/rawMaterialGuidanceAdvisories.js';

const FUNCTION_PATTERNS = [
  { key: 'linear_substrate', pattern: /linear[\s-_]*substrate|substrate/i },
  { key: 'fixative', pattern: /fixative|fixateur|tenacity|long[\s-]*lasting/i },
  { key: 'modifier', pattern: /modifier|accent|nuance/i },
  { key: 'blender', pattern: /blender|blending|smoother|rounder/i },
  { key: 'bridge', pattern: /bridge|linker|connector|transition/i },
  { key: 'diffuser', pattern: /diffuser|diffusion|lift|sparkle|radiance/i },
  { key: 'support', pattern: /support|body|booster/i },
  { key: 'hero', pattern: /hero|signature|theme/i },
  { key: 'solvent', pattern: /solvent/i },
];

const keywordScore = (text, keywords) => keywords.reduce(
  (sum, keyword) => sum + (text.includes(keyword) ? 1 : 0),
  0
);

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const tokenizeText = (value) => normalizeText(value)
  .split(/[^a-z0-9]+/g)
  .filter((token) => token.length >= 3);

const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeFunctionLabel = (label) => String(label || '').replace(/_/g, ' ').trim();

const normalizeBand = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
};

const buildClassShareMap = (classDistribution = []) => new Map(
  classDistribution.map((entry) => [String(entry?.letter || '').toUpperCase(), Number(entry?.share || 0)])
);

const sumMapValues = (map) => [...map.values()].reduce((sum, value) => sum + Number(value || 0), 0);

const buildNormalizedDistributionMap = (classDistribution = []) => {
  const classShareMap = buildClassShareMap(classDistribution);
  const total = sumMapValues(classShareMap);
  if (total <= 0) {
    return new Map();
  }

  return new Map(
    [...classShareMap.entries()].map(([letter, share]) => [letter, Number(share || 0) / total])
  );
};

const computeDistributionOverlap = (leftDistribution = [], rightDistribution = []) => {
  const leftMap = buildNormalizedDistributionMap(leftDistribution);
  const rightMap = buildNormalizedDistributionMap(rightDistribution);
  const allLetters = new Set([...leftMap.keys(), ...rightMap.keys()]);
  let overlap = 0;

  allLetters.forEach((letter) => {
    overlap += Math.min(leftMap.get(letter) || 0, rightMap.get(letter) || 0);
  });

  return overlap;
};

const inferFunctionsFromText = (functionText) => {
  const matches = FUNCTION_PATTERNS
    .filter((entry) => entry.pattern.test(functionText))
    .map((entry) => entry.key);

  return [...new Set(matches)];
};

const inferFallbackFunctions = (stageScores, combinedText, impact, lifeHours) => {
  const stageEntries = Object.entries(stageScores).sort((left, right) => right[1] - left[1]);
  const primaryStage = stageEntries[0]?.[0] || 'middle';

  if (primaryStage === 'base' && (lifeHours || 0) >= 72) {
    return ['fixative', 'support'];
  }

  if (primaryStage === 'top' && /sparkle|bright|fresh|lift|diffusion/i.test(combinedText)) {
    return ['diffuser', 'modifier'];
  }

  if ((impact || 0) >= 65 && /rose|jasmine|oud|patchouli|amber|musk|cedar|sandal|vetiver/i.test(combinedText)) {
    return ['hero', 'support'];
  }

  if (/blend|smooth|round|transition|bridge/i.test(combinedText)) {
    return ['blender', 'bridge'];
  }

  return ['support', primaryStage === 'base' ? 'fixative' : 'modifier'];
};

export const resolveMaterialCompositionProfile = (material, referenceLink = null) => {
  const guidance = resolveRawMaterialGuidanceSnapshot(material, referenceLink);
  const referenceProfile = guidance.referenceProfile;
  const family = normalizeText(guidance.family);
  const category = normalizeText(material?.category);
  const impact = toNumber(guidance.impact);
  const lifeHours = toNumber(guidance.lifeHours);
  const ifraLimit = toNumber(guidance.ifraLimitPercent);
  const useLevelTypical = toNumber(guidance.useLevelTypicalPercent);
  const useLevelMax = toNumber(guidance.useLevelMaxPercent);
  const combinedText = normalizeText(guidance.descriptorText);

  const functionSignals = inferFunctionsFromText(normalizeText([
    referenceProfile?.function_labels,
    referenceProfile?.function_raw,
    referenceProfile?.perfume_uses,
    material?.notes,
    material?.description,
  ].filter(Boolean).join(' | ')));
  const stageScores = guidance.stageScores;

  const normalizedFunctions = functionSignals.length
    ? functionSignals
    : inferFallbackFunctions(stageScores, combinedText, impact, lifeHours);

  const sourceConfidence = [
    referenceProfile?.reference_code ? 1 : 0,
    impact !== null ? 1 : 0,
    lifeHours !== null ? 1 : 0,
    ifraLimit !== null ? 1 : 0,
    useLevelTypical !== null || useLevelMax !== null ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  return {
    material,
    reference_profile: referenceProfile,
    family,
    category,
    impact,
    life_hours: lifeHours,
    ifra_limit_percent: ifraLimit,
    use_level_typical_percent: useLevelTypical,
    use_level_max_percent: useLevelMax,
    stage_scores: stageScores,
    class_distribution: guidance.classDistribution,
    pyramid_placement: guidance.pyramidPlacement,
    primary_function: normalizedFunctions[0] || 'support',
    secondary_function: normalizedFunctions[1] || null,
    descriptors_text: combinedText,
    source_confidence: sourceConfidence,
    warning_flags: [
      impact === null ? 'missing impact' : null,
      lifeHours === null ? 'missing life' : null,
      !family ? 'missing family' : null,
      !referenceProfile ? 'missing guidance source' : null,
    ].filter(Boolean),
  };
};

const STAGE_WEIGHT = {
  top: { top: 3, middle: 1, base: 0.25 },
  middle: { top: 0.8, middle: 3, base: 1.2 },
  base: { top: 0.25, middle: 1, base: 3 },
};

const STAGE_FUNCTION_PRIORITIES = {
  top: ['diffuser', 'modifier', 'hero', 'support', 'bridge', 'blender'],
  middle: ['hero', 'bridge', 'support', 'blender', 'modifier', 'diffuser'],
  base: ['fixative', 'support', 'blender', 'bridge', 'hero', 'linear_substrate'],
};

const STAGE_PLACEMENT_FIT = {
  top: { top: 1, middle: 0.5, base: -0.8 },
  middle: { top: 0.25, middle: 1, base: 0.35 },
  base: { top: -0.9, middle: 0.35, base: 1 },
};

const getStageAnswerKeywords = (answers = {}) => Object.values(answers)
  .flatMap((value) => String(value || '').split(/[_\s-]+/))
  .map((value) => value.toLowerCase())
  .filter(Boolean);

const getTargetProfileKeywords = (targetProfile = null) => ([
  ...(Array.isArray(targetProfile?.tags) ? targetProfile.tags : []),
  ...(Array.isArray(targetProfile?.preferred_functions) ? targetProfile.preferred_functions : []),
  ...(Array.isArray(targetProfile?.preferred_letters) ? targetProfile.preferred_letters : []),
])
  .flatMap((value) => String(value || '').split(/[_\s-]+/))
  .map((value) => value.toLowerCase())
  .filter(Boolean);

const toPercentScore = (value) => Math.round(Math.max(0, Math.min(Number(value || 0), 1)) * 100);
const normalizeLifecycleRatio = (value, floor = 0.6, ceiling = 1.15) => Math.min(ceiling, Math.max(floor, Number(value || 1)));

const STAGE_SEED_PERCENT = {
  top: 7,
  middle: 11,
  base: 9,
};

const FUNCTION_SEED_MULTIPLIER = {
  hero: 1.18,
  support: 1.02,
  bridge: 0.92,
  blender: 0.9,
  modifier: 0.82,
  diffuser: 0.76,
  fixative: 0.88,
  linear_substrate: 1.12,
};

const TRACE_ROLE_SET = new Set(['modifier', 'diffuser']);
const EFFECT_KEYWORDS = {
  sparkle: ['aldehyde', 'aldehydic', 'fizzy', 'sparkle', 'champagne', 'effervescent'],
  cool: ['menthol', 'mint', 'camphor', 'cool', 'eucalyptus'],
  smoke: ['smoke', 'smoky', 'tar', 'burnt', 'birch tar'],
  animalic: ['animalic', 'civet', 'castoreum', 'barnyard', 'fecal'],
  leathery: ['quinoline', 'leather', 'suede', 'isobutyl quinoline'],
  mineral: ['mineral', 'metallic', 'stone', 'geosmin', 'ozonic', 'concrete'],
  fruity_lift: ['apple', 'pear', 'pineapple', 'berry', 'allyl amyl glycolate', 'manzanate'],
  spicy_ping: ['pepper', 'cinnamon', 'clove', 'anise', 'cardamom', 'saffron'],
  dirty_wood: ['nagarmotha', 'cypriol', 'oud', 'agar', 'styrax', 'guaiac', 'patchouli'],
  creamy_body: ['lactone', 'methyl laitone', 'milk', 'coconut', 'cream', 'tuberose'],
};

const STAGE_ARCHITECTURE_SLOTS = {
  top: ['anchor', 'lift', 'lift', 'bridge', 'effect', 'effect', 'contrast', 'support'],
  middle: ['anchor', 'body', 'body', 'bridge', 'effect', 'contrast', 'support', 'effect'],
  base: ['anchor', 'body', 'body', 'bridge', 'effect', 'effect', 'support', 'contrast'],
};

const ARCHITECTURE_ROLE_LABELS = {
  anchor: 'Anchor',
  body: 'Body',
  bridge: 'Bridge',
  lift: 'Lift',
  effect: 'Effect',
  contrast: 'Contrast',
  support: 'Support',
};

const THEME_EFFECT_PRIORITIES = {
  oud: ['dirty_wood', 'animalic', 'leathery', 'smoke', 'spicy_ping'],
  smoky: ['smoke', 'dirty_wood', 'animalic'],
  cola: ['sparkle', 'cool', 'fruity_lift', 'spicy_ping'],
  citrus: ['sparkle', 'fruity_lift'],
  tuberose: ['creamy_body', 'sparkle', 'animalic'],
  floral: ['creamy_body', 'sparkle'],
  musk: ['animalic', 'creamy_body', 'mineral'],
  skin: ['animalic', 'mineral', 'creamy_body'],
  amber: ['smoke', 'spicy_ping', 'dirty_wood'],
  mineral: ['mineral', 'sparkle', 'cool'],
  ozonic: ['mineral', 'sparkle', 'cool'],
  metallic: ['mineral', 'sparkle', 'cool'],
  aldehydic: ['sparkle', 'cool'],
  solventy: ['mineral', 'cool'],
  gas: ['mineral', 'sparkle', 'cool'],
  fuel: ['mineral', 'sparkle', 'cool'],
  woody: ['dirty_wood', 'smoke', 'leathery'],
};

const THEME_RECIPE_LIBRARY = {
  oud: {
    keywords: ['oud', 'agar', 'smoky', 'animalic', 'leather', 'barnyard', 'resin'],
    preferred_roles: ['body', 'body', 'bridge', 'effect', 'support'],
    required_effects: ['dirty_wood', 'animalic', 'leathery'],
    loud_direct_limit: 2,
  },
  cola: {
    keywords: ['cola', 'sparkling', 'fizzy', 'syrupy', 'coke', 'citrus', 'spice'],
    preferred_roles: ['lift', 'lift', 'bridge', 'effect', 'effect'],
    required_effects: ['sparkle', 'cool', 'fruity_lift'],
    loud_direct_limit: 1,
  },
  tuberose: {
    keywords: ['tuberose', 'white floral', 'creamy floral', 'indolic', 'lactonic'],
    preferred_roles: ['body', 'body', 'bridge', 'effect', 'support'],
    required_effects: ['creamy_body', 'sparkle', 'animalic'],
    loud_direct_limit: 2,
  },
  musk: {
    keywords: ['musk', 'skin', 'soft skin', 'clean musk', 'animalic musk'],
    preferred_roles: ['body', 'support', 'bridge', 'effect', 'contrast'],
    required_effects: ['animalic', 'creamy_body', 'mineral'],
    loud_direct_limit: 2,
  },
  amber: {
    keywords: ['amber', 'resin', 'balsamic', 'incense', 'warm'],
    preferred_roles: ['body', 'body', 'support', 'effect', 'contrast'],
    required_effects: ['smoke', 'spicy_ping', 'dirty_wood'],
    loud_direct_limit: 2,
  },
  mineral: {
    keywords: ['mineral', 'metallic', 'stone', 'concrete', 'cold air', 'ozonic'],
    preferred_roles: ['body', 'support', 'effect', 'effect', 'contrast'],
    required_effects: ['mineral', 'sparkle', 'cool'],
    loud_direct_limit: 1,
  },
  gas_vapor: {
    keywords: ['gas', 'fuel', 'gasoline', 'bensin', 'petrol', 'vapor', 'uap', 'ozonic', 'metallic', 'aldehydic', 'solventy', 'cold air'],
    preferred_roles: ['lift', 'effect', 'bridge', 'contrast', 'support'],
    required_effects: ['mineral', 'sparkle', 'cool'],
    loud_direct_limit: 1,
  },
  fig: {
    keywords: ['fig', 'green fig', 'lactonic green', 'milky green'],
    preferred_roles: ['body', 'lift', 'bridge', 'effect', 'contrast'],
    required_effects: ['creamy_body', 'fruity_lift'],
    loud_direct_limit: 2,
  },
};

const inferEffectTags = (profile, targetProfile = null) => {
  const descriptorText = String(profile?.descriptors_text || '').toLowerCase();
  const targetText = getTargetProfileKeywords(targetProfile).join(' ');
  const combinedText = `${descriptorText} ${targetText}`.trim();

  return Object.entries(EFFECT_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => combinedText.includes(keyword)))
    .map(([tag]) => tag);
};

const inferPreferredEffectTags = (targetProfile = null) => {
  const targetKeywords = getTargetProfileKeywords(targetProfile);
  const preferredEffects = new Set();

  targetKeywords.forEach((keyword) => {
    const mappedEffects = THEME_EFFECT_PRIORITIES[keyword] || [];
    mappedEffects.forEach((effectTag) => preferredEffects.add(effectTag));
  });

  return [...preferredEffects];
};

const inferThemeRecipe = ({ targetProfile = null, briefText = '' } = {}) => {
  const targetKeywords = getTargetProfileKeywords(targetProfile);
  const combinedText = `${targetKeywords.join(' ')} ${String(briefText || '').toLowerCase()}`.trim();
  let bestThemeKey = null;
  let bestScore = 0;

  Object.entries(THEME_RECIPE_LIBRARY).forEach(([themeKey, recipe]) => {
    const score = (recipe.keywords || []).reduce(
      (sum, keyword) => sum + (combinedText.includes(String(keyword).toLowerCase()) ? 1 : 0),
      0,
    );

    if (score > bestScore) {
      bestThemeKey = themeKey;
      bestScore = score;
    }
  });

  if (!bestThemeKey) {
    return {
      key: null,
      confidence: 0,
      recipe: null,
    };
  }

  return {
    key: bestThemeKey,
    confidence: bestScore,
    recipe: THEME_RECIPE_LIBRARY[bestThemeKey] || null,
  };
};

export const inferRecommendationTheme = ({ targetProfile = null, briefText = '' } = {}) => inferThemeRecipe({
  targetProfile,
  briefText,
});

const POSITIVE_STAGE_SELECTION_STATES = new Set(['selected', 'manual']);
const NEGATIVE_STAGE_SELECTION_STATES = new Set(['rejected', 'skipped']);

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));

const normalizeFeedbackUsageKey = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return 'direct';
  }

  if (normalized.includes('dilution')) {
    return 'dilution';
  }
  if (normalized.includes('trace')) {
    return 'trace';
  }
  return 'direct';
};

const inferComposerUsageKey = (item, totalFormulaGrams = null) => {
  const dilutionPercent = Number(item?.dilution_percent);
  if (Number.isFinite(dilutionPercent) && dilutionPercent > 0 && dilutionPercent <= 20) {
    return 'dilution';
  }

  const grams = Number(item?.gram_amount ?? item?.grams);
  const totalGrams = Number(totalFormulaGrams);
  const percentage = Number(item?.percentage);
  const resolvedPercent = Number.isFinite(percentage) && percentage > 0
    ? percentage
    : (Number.isFinite(grams) && grams > 0 && Number.isFinite(totalGrams) && totalGrams > 0)
      ? (grams / totalGrams) * 100
      : null;

  if (Number.isFinite(resolvedPercent) && resolvedPercent <= 0.65) {
    return 'trace';
  }

  return 'direct';
};

const bumpMapCount = (map, key, amount) => {
  if (!key) {
    return;
  }
  map.set(key, Number((map.get(key) || 0) + Number(amount || 0)).toFixed(4));
};

const bumpAverageAccumulator = (totalsMap, countsMap, key, value, weight = 1) => {
  if (!key || !Number.isFinite(Number(value)) || !Number.isFinite(Number(weight)) || Number(weight) <= 0) {
    return;
  }

  bumpMapCount(totalsMap, key, Number(value) * Number(weight));
  bumpMapCount(countsMap, key, Number(weight));
};

const getAverageAccumulatorValue = (totalsMap, countsMap, key) => {
  const total = Number(totalsMap?.get?.(key) || 0);
  const count = Number(countsMap?.get?.(key) || 0);
  if (!count) {
    return null;
  }
  return total / count;
};

const SUPPORTED_DILUTION_PERCENTS = [1, 5, 10, 20];
const normalizeDilutionPercent = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return SUPPORTED_DILUTION_PERCENTS.reduce((closest, current) => (
    Math.abs(current - numericValue) < Math.abs(closest - numericValue) ? current : closest
  ), SUPPORTED_DILUTION_PERCENTS[0]);
};

const createEmptyFeedbackSignalBucket = () => ({
  materials: new Map(),
  functions: new Map(),
  effects: new Map(),
  usage: new Map(),
});

const createEmptyCorrectionBucket = () => ({
  material_seed_totals: new Map(),
  material_seed_counts: new Map(),
  function_seed_totals: new Map(),
  function_seed_counts: new Map(),
  material_dilution_totals: new Map(),
  material_dilution_counts: new Map(),
  function_dilution_totals: new Map(),
  function_dilution_counts: new Map(),
});

export const createEmptyRecommendationFeedbackContext = () => ({
  positive: createEmptyFeedbackSignalBucket(),
  negative: createEmptyFeedbackSignalBucket(),
  correction: createEmptyCorrectionBucket(),
  signal_strength: 0,
  has_feedback: false,
});

const serializeFeedbackMap = (map) => Object.fromEntries([...(map?.entries?.() || [])]);
const deserializeFeedbackMap = (value) => new Map(Object.entries(value || {}));

export const serializeRecommendationFeedbackContext = (context = null) => {
  if (!context) {
    return null;
  }

  return {
    positive: {
      materials: serializeFeedbackMap(context.positive?.materials),
      functions: serializeFeedbackMap(context.positive?.functions),
      effects: serializeFeedbackMap(context.positive?.effects),
      usage: serializeFeedbackMap(context.positive?.usage),
    },
    negative: {
      materials: serializeFeedbackMap(context.negative?.materials),
      functions: serializeFeedbackMap(context.negative?.functions),
      effects: serializeFeedbackMap(context.negative?.effects),
      usage: serializeFeedbackMap(context.negative?.usage),
    },
    correction: {
      material_seed_totals: serializeFeedbackMap(context.correction?.material_seed_totals),
      material_seed_counts: serializeFeedbackMap(context.correction?.material_seed_counts),
      function_seed_totals: serializeFeedbackMap(context.correction?.function_seed_totals),
      function_seed_counts: serializeFeedbackMap(context.correction?.function_seed_counts),
      material_dilution_totals: serializeFeedbackMap(context.correction?.material_dilution_totals),
      material_dilution_counts: serializeFeedbackMap(context.correction?.material_dilution_counts),
      function_dilution_totals: serializeFeedbackMap(context.correction?.function_dilution_totals),
      function_dilution_counts: serializeFeedbackMap(context.correction?.function_dilution_counts),
    },
    signal_strength: Number(context.signal_strength || 0),
    has_feedback: Boolean(context.has_feedback),
  };
};

export const deserializeRecommendationFeedbackContext = (payload = null) => {
  if (!payload || typeof payload !== 'object') {
    return createEmptyRecommendationFeedbackContext();
  }

  return {
    positive: {
      materials: deserializeFeedbackMap(payload.positive?.materials),
      functions: deserializeFeedbackMap(payload.positive?.functions),
      effects: deserializeFeedbackMap(payload.positive?.effects),
      usage: deserializeFeedbackMap(payload.positive?.usage),
    },
    negative: {
      materials: deserializeFeedbackMap(payload.negative?.materials),
      functions: deserializeFeedbackMap(payload.negative?.functions),
      effects: deserializeFeedbackMap(payload.negative?.effects),
      usage: deserializeFeedbackMap(payload.negative?.usage),
    },
    correction: {
      material_seed_totals: deserializeFeedbackMap(payload.correction?.material_seed_totals),
      material_seed_counts: deserializeFeedbackMap(payload.correction?.material_seed_counts),
      function_seed_totals: deserializeFeedbackMap(payload.correction?.function_seed_totals),
      function_seed_counts: deserializeFeedbackMap(payload.correction?.function_seed_counts),
      material_dilution_totals: deserializeFeedbackMap(payload.correction?.material_dilution_totals),
      material_dilution_counts: deserializeFeedbackMap(payload.correction?.material_dilution_counts),
      function_dilution_totals: deserializeFeedbackMap(payload.correction?.function_dilution_totals),
      function_dilution_counts: deserializeFeedbackMap(payload.correction?.function_dilution_counts),
    },
    signal_strength: Number(payload.signal_strength || 0),
    has_feedback: Boolean(payload.has_feedback),
  };
};

const getFeedbackMapScore = (map, key, weight = 0.45, cap = 1.8) => {
  if (!key) {
    return 0;
  }

  const rawValue = Number(map?.get?.(key) || 0);
  if (!rawValue) {
    return 0;
  }

  return clampNumber(rawValue * weight, -cap, cap);
};

const accumulateFeedbackSignals = ({
  target,
  materialId,
  profile,
  effectTags = [],
  usageKey = 'direct',
  weight = 1,
} = {}) => {
  if (!target || !profile || !materialId) {
    return;
  }

  bumpMapCount(target.materials, materialId, weight);
  bumpMapCount(target.functions, String(profile.primary_function || '').toLowerCase(), weight);
  if (profile.secondary_function) {
    bumpMapCount(target.functions, String(profile.secondary_function || '').toLowerCase(), weight * 0.45);
  }
  bumpMapCount(target.usage, normalizeFeedbackUsageKey(usageKey), weight);
  effectTags.forEach((tag) => bumpMapCount(target.effects, tag, weight * 0.75));
};

export const buildRecommendationFeedbackContext = ({
  composerItems = [],
  stageItems = [],
  rawMaterialsById = new Map(),
  referenceLinksMap = new Map(),
  stage = 'middle',
  totalFormulaGrams = null,
} = {}) => {
  const positive = {
    materials: new Map(),
    functions: new Map(),
    effects: new Map(),
    usage: new Map(),
  };
  const negative = {
    materials: new Map(),
    functions: new Map(),
    effects: new Map(),
    usage: new Map(),
  };

  const normalizedStageItems = Array.isArray(stageItems) ? stageItems : [];
  const composerRows = (composerItems || []).filter((item) => item?.item_id && item.item_type !== 'solvent');
  const composerMaterialIds = new Set(composerRows.map((item) => String(item.item_id)));
  const selectedStageItems = normalizedStageItems.filter((item) => POSITIVE_STAGE_SELECTION_STATES.has(String(item?.selection_state || '').toLowerCase()));
  const rejectedStageItems = normalizedStageItems.filter((item) => NEGATIVE_STAGE_SELECTION_STATES.has(String(item?.selection_state || '').toLowerCase()));
  const selectedStageMaterialIds = new Set(selectedStageItems.map((item) => String(item.raw_material_id)));

  composerRows.forEach((item) => {
    const materialId = String(item.item_id || '');
    const material = rawMaterialsById.get(materialId) || null;
    if (!material) {
      return;
    }

    const profile = resolveMaterialCompositionProfile(material, referenceLinksMap.get(materialId) || null);
    const effectTags = inferEffectTags(profile);
    const usageKey = inferComposerUsageKey(item, totalFormulaGrams);
    const baseWeight = selectedStageMaterialIds.has(materialId) ? 1.1 : 1.35;
    accumulateFeedbackSignals({
      target: positive,
      materialId,
      profile,
      effectTags,
      usageKey,
      weight: baseWeight,
    });
  });

  selectedStageItems.forEach((item) => {
    const materialId = String(item.raw_material_id || '');
    if (!materialId || composerMaterialIds.has(materialId)) {
      return;
    }

    const material = rawMaterialsById.get(materialId) || item?.expand?.raw_material_id || null;
    if (!material) {
      return;
    }

    const profile = resolveMaterialCompositionProfile(material, referenceLinksMap.get(materialId) || null);
    const effectTags = inferEffectTags(profile);
    const weight = item.stage === stage ? 0.95 : 0.45;
    accumulateFeedbackSignals({
      target: negative,
      materialId,
      profile,
      effectTags,
      usageKey: 'direct',
      weight,
    });
  });

  rejectedStageItems.forEach((item) => {
    const materialId = String(item.raw_material_id || '');
    const material = rawMaterialsById.get(materialId) || item?.expand?.raw_material_id || null;
    if (!material) {
      return;
    }

    const profile = resolveMaterialCompositionProfile(material, referenceLinksMap.get(materialId) || null);
    const effectTags = inferEffectTags(profile);
    const weight = item.stage === stage ? 1.1 : 0.55;
    accumulateFeedbackSignals({
      target: negative,
      materialId,
      profile,
      effectTags,
      usageKey: 'direct',
      weight,
    });
  });

  selectedStageItems
    .filter((item) => item.stage === stage)
    .forEach((item) => {
      const materialId = String(item.raw_material_id || '');
      const material = rawMaterialsById.get(materialId) || item?.expand?.raw_material_id || null;
      if (!material) {
        return;
      }

      const profile = resolveMaterialCompositionProfile(material, referenceLinksMap.get(materialId) || null);
      const effectTags = inferEffectTags(profile);
      accumulateFeedbackSignals({
        target: positive,
        materialId,
        profile,
        effectTags,
        usageKey: 'direct',
        weight: 0.55,
      });
    });

  const positiveSignalCount = [
    positive.materials.size,
    positive.functions.size,
    positive.effects.size,
    positive.usage.size,
  ].reduce((sum, value) => sum + value, 0);
  const negativeSignalCount = [
    negative.materials.size,
    negative.functions.size,
    negative.effects.size,
    negative.usage.size,
  ].reduce((sum, value) => sum + value, 0);

  return {
    positive,
    negative,
    correction: {
      material_seed_totals: new Map(),
      material_seed_counts: new Map(),
      function_seed_totals: new Map(),
      function_seed_counts: new Map(),
      material_dilution_totals: new Map(),
      material_dilution_counts: new Map(),
      function_dilution_totals: new Map(),
      function_dilution_counts: new Map(),
    },
    signal_strength: positiveSignalCount + negativeSignalCount,
    has_feedback: positiveSignalCount > 0 || negativeSignalCount > 0,
  };
};

export const mergeRecommendationFeedbackContexts = (...contexts) => {
  const positive = {
    materials: new Map(),
    functions: new Map(),
    effects: new Map(),
    usage: new Map(),
  };
  const negative = {
    materials: new Map(),
    functions: new Map(),
    effects: new Map(),
    usage: new Map(),
  };
  const correction = {
    material_seed_totals: new Map(),
    material_seed_counts: new Map(),
    function_seed_totals: new Map(),
    function_seed_counts: new Map(),
    material_dilution_totals: new Map(),
    material_dilution_counts: new Map(),
    function_dilution_totals: new Map(),
    function_dilution_counts: new Map(),
  };

  contexts
    .filter(Boolean)
    .forEach((context) => {
      ['materials', 'functions', 'effects', 'usage'].forEach((key) => {
        context?.positive?.[key]?.forEach?.((value, entryKey) => bumpMapCount(positive[key], entryKey, value));
        context?.negative?.[key]?.forEach?.((value, entryKey) => bumpMapCount(negative[key], entryKey, value));
      });
      Object.keys(correction).forEach((key) => {
        context?.correction?.[key]?.forEach?.((value, entryKey) => bumpMapCount(correction[key], entryKey, value));
      });
    });

  const signalStrength = contexts.reduce((sum, context) => sum + Number(context?.signal_strength || 0), 0);
  const hasFeedback = contexts.some((context) => context?.has_feedback);

  return {
    positive,
    negative,
    correction,
    signal_strength: signalStrength,
    has_feedback: hasFeedback,
  };
};

export const buildHistoricalFormulaFeedbackContext = ({
  entries = [],
  rawMaterialsById = new Map(),
  referenceLinksMap = new Map(),
  stage = 'middle',
  targetProfile = null,
  briefText = '',
} = {}) => {
  const currentTheme = inferThemeRecipe({ targetProfile, briefText });
  const currentKeywords = new Set(tokenizeText([briefText, ...getTargetProfileKeywords(targetProfile)].join(' ')));
  const positive = {
    materials: new Map(),
    functions: new Map(),
    effects: new Map(),
    usage: new Map(),
  };

  (entries || []).forEach((entry) => {
    const formulaItems = Array.isArray(entry?.items) ? entry.items : [];
    if (!formulaItems.length) {
      return;
    }

    const entryBriefText = String(entry?.briefText || '');
    const entryTheme = inferThemeRecipe({ briefText: entryBriefText });
    const entryKeywords = new Set(tokenizeText(entryBriefText));
    let keywordOverlap = 0;
    currentKeywords.forEach((keyword) => {
      if (entryKeywords.has(keyword)) {
        keywordOverlap += 1;
      }
    });

    const sameTheme = currentTheme.key && entryTheme.key && currentTheme.key === entryTheme.key;
    const baseSimilarity = sameTheme ? 0.95 : 0;
    const overlapSimilarity = keywordOverlap * 0.18;
    const similarityWeight = clampNumber(baseSimilarity + overlapSimilarity, 0, 1.45);

    if (similarityWeight < 0.3) {
      return;
    }

    formulaItems.forEach((item) => {
      const materialId = String(item?.item_id || '');
      const material = rawMaterialsById.get(materialId) || null;
      if (!material) {
        return;
      }

      const profile = resolveMaterialCompositionProfile(material, referenceLinksMap.get(materialId) || null);
      const effectTags = inferEffectTags(profile);
      const usageKey = inferComposerUsageKey(item, null);
      const stageBias = Number(profile?.stage_scores?.[stage] || 0) >= 2.3 ? 1.12 : 0.92;
      accumulateFeedbackSignals({
        target: positive,
        materialId,
        profile,
        effectTags,
        usageKey,
        weight: Number((similarityWeight * stageBias).toFixed(4)),
      });
    });
  });

  const signalStrength = [
    positive.materials.size,
    positive.functions.size,
    positive.effects.size,
    positive.usage.size,
  ].reduce((sum, value) => sum + value, 0);

  return {
    positive,
    negative: {
      materials: new Map(),
      functions: new Map(),
      effects: new Map(),
      usage: new Map(),
    },
    correction: {
      material_seed_totals: new Map(),
      material_seed_counts: new Map(),
      function_seed_totals: new Map(),
      function_seed_counts: new Map(),
      material_dilution_totals: new Map(),
      material_dilution_counts: new Map(),
      function_dilution_totals: new Map(),
      function_dilution_counts: new Map(),
    },
    signal_strength: signalStrength,
    has_feedback: signalStrength > 0,
  };
};

const resolveCorrectionSeedMultiplier = ({
  feedbackContext = null,
  materialId = '',
  primaryFunction = '',
} = {}) => {
  if (!feedbackContext?.correction) {
    return 1;
  }

  const materialAverage = getAverageAccumulatorValue(
    feedbackContext.correction.material_seed_totals,
    feedbackContext.correction.material_seed_counts,
    materialId,
  );
  const functionAverage = getAverageAccumulatorValue(
    feedbackContext.correction.function_seed_totals,
    feedbackContext.correction.function_seed_counts,
    primaryFunction,
  );

  if (materialAverage === null && functionAverage === null) {
    return 1;
  }

  const resolvedAverage = materialAverage !== null && functionAverage !== null
    ? ((materialAverage * 0.68) + (functionAverage * 0.32))
    : (materialAverage ?? functionAverage ?? 1);

  return clampNumber(resolvedAverage, 0.42, 1.85);
};

const resolveCorrectionDilutionPercent = ({
  feedbackContext = null,
  materialId = '',
  primaryFunction = '',
} = {}) => {
  if (!feedbackContext?.correction) {
    return null;
  }

  const materialAverage = getAverageAccumulatorValue(
    feedbackContext.correction.material_dilution_totals,
    feedbackContext.correction.material_dilution_counts,
    materialId,
  );
  const functionAverage = getAverageAccumulatorValue(
    feedbackContext.correction.function_dilution_totals,
    feedbackContext.correction.function_dilution_counts,
    primaryFunction,
  );

  const resolvedAverage = materialAverage !== null && functionAverage !== null
    ? ((materialAverage * 0.72) + (functionAverage * 0.28))
    : (materialAverage ?? functionAverage ?? null);

  return normalizeDilutionPercent(resolvedAverage);
};

export const buildComposerCorrectionFeedbackContext = ({
  composerItems = [],
  stageItems = [],
  rawMaterialsById = new Map(),
  referenceLinksMap = new Map(),
  stage = 'middle',
  totalFormulaGrams = null,
} = {}) => {
  const positive = {
    materials: new Map(),
    functions: new Map(),
    effects: new Map(),
    usage: new Map(),
  };
  const negative = {
    materials: new Map(),
    functions: new Map(),
    effects: new Map(),
    usage: new Map(),
  };
  const correction = {
    material_seed_totals: new Map(),
    material_seed_counts: new Map(),
    function_seed_totals: new Map(),
    function_seed_counts: new Map(),
    material_dilution_totals: new Map(),
    material_dilution_counts: new Map(),
    function_dilution_totals: new Map(),
    function_dilution_counts: new Map(),
  };

  const selectedStageItems = (stageItems || []).filter((item) => POSITIVE_STAGE_SELECTION_STATES.has(String(item?.selection_state || '').toLowerCase()));
  const selectedStageItemsByMaterialId = new Map(selectedStageItems.map((item) => [String(item.raw_material_id), item]));
  const activeComposerItems = (composerItems || []).filter((item) => item?.item_id && item.item_type !== 'solvent');

  activeComposerItems.forEach((item) => {
    const materialId = String(item.item_id || '');
    const stageItem = selectedStageItemsByMaterialId.get(materialId);
    if (!stageItem) {
      return;
    }

    const material = rawMaterialsById.get(materialId) || null;
    if (!material) {
      return;
    }

    const profile = resolveMaterialCompositionProfile(material, referenceLinksMap.get(materialId) || null);
    const effectTags = inferEffectTags(profile);
    const stageKey = String(stageItem.stage || stage || 'middle').toLowerCase();
    const recommendedPlan = resolveRecommendedUsagePlan({
      profile,
      materialId,
      stage: stageKey,
      fitScore: Number(stageItem.fit_score || 0),
      totalFormulaGrams,
      feedbackContext: null,
    });
    const actualUsageKey = inferComposerUsageKey(item, totalFormulaGrams);
    const recommendedUsageKey = normalizeFeedbackUsageKey(recommendedPlan.strategy);
    const actualGrams = Number(item.gram_amount ?? item.grams);
    const recommendedGrams = Number(recommendedPlan.recommended_grams);
    const actualDilutionPercent = normalizeDilutionPercent(item.dilution_percent);
    const primaryFunction = String(profile.primary_function || '').toLowerCase();

    if (Number.isFinite(actualGrams) && actualGrams > 0 && Number.isFinite(recommendedGrams) && recommendedGrams > 0) {
      const ratio = clampNumber(actualGrams / recommendedGrams, 0.25, 3.1);
      if (Math.abs(ratio - 1) >= 0.12) {
        bumpAverageAccumulator(correction.material_seed_totals, correction.material_seed_counts, materialId, ratio, 1);
        bumpAverageAccumulator(correction.function_seed_totals, correction.function_seed_counts, primaryFunction, ratio, 0.75);
      }
    }

    if (actualDilutionPercent) {
      bumpAverageAccumulator(correction.material_dilution_totals, correction.material_dilution_counts, materialId, actualDilutionPercent, 1);
      bumpAverageAccumulator(correction.function_dilution_totals, correction.function_dilution_counts, primaryFunction, actualDilutionPercent, 0.7);
    }

    if (actualUsageKey !== recommendedUsageKey) {
      accumulateFeedbackSignals({
        target: positive,
        materialId,
        profile,
        effectTags,
        usageKey: actualUsageKey,
        weight: 1.05,
      });
      accumulateFeedbackSignals({
        target: negative,
        materialId,
        profile,
        effectTags,
        usageKey: recommendedUsageKey,
        weight: 0.9,
      });
    }
  });

  const signalStrength = [
    positive.materials.size,
    positive.functions.size,
    positive.effects.size,
    positive.usage.size,
    correction.material_seed_counts.size,
    correction.material_dilution_counts.size,
  ].reduce((sum, value) => sum + value, 0);

  return {
    positive,
    negative,
    correction,
    signal_strength: signalStrength,
    has_feedback: signalStrength > 0,
  };
};

const inferFallbackArchitectureRole = (candidate) => {
  const primaryRole = String(candidate?.primary_function || '').toLowerCase();
  const usageStrategy = String(candidate?.recommended_usage_strategy || '').toLowerCase();
  const effectTags = Array.isArray(candidate?.effect_tags) ? candidate.effect_tags : [];

  if (effectTags.length && usageStrategy !== 'direct') {
    return 'effect';
  }
  if (['diffuser', 'modifier'].includes(primaryRole)) {
    return 'lift';
  }
  if (['bridge', 'blender'].includes(primaryRole)) {
    return 'bridge';
  }
  if (['hero', 'fixative', 'linear_substrate'].includes(primaryRole) && usageStrategy === 'direct') {
    return 'body';
  }
  return 'support';
};

export const getArchitectureRoleKey = ({ candidate = null, stage = 'middle' } = {}) => {
  const rankOrder = Number(candidate?.rank_order);
  const stageSlots = STAGE_ARCHITECTURE_SLOTS[stage] || STAGE_ARCHITECTURE_SLOTS.middle;

  if (Number.isFinite(rankOrder) && rankOrder >= 0 && rankOrder < stageSlots.length) {
    return stageSlots[rankOrder];
  }

  return inferFallbackArchitectureRole(candidate);
};

export const getArchitectureRoleLabel = ({ candidate = null, stage = 'middle' } = {}) => {
  const roleKey = getArchitectureRoleKey({ candidate, stage });
  return ARCHITECTURE_ROLE_LABELS[roleKey] || 'Support';
};

const resolveSeedPercentageEstimate = ({ profile, stage, fitScore }) => {
  const stageBase = STAGE_SEED_PERCENT[stage] ?? 8;
  const roleMultiplier = FUNCTION_SEED_MULTIPLIER[profile.primary_function] ?? 1;
  const fitBoost = Number.isFinite(Number(fitScore))
    ? Math.min(1.14, Math.max(0.9, 0.94 + (Number(fitScore) * 0.012)))
    : 1;
  const impactRatio = profile.impact === null
    ? 1
    : normalizeLifecycleRatio(1.08 - (Math.min(profile.impact, 100) / 250), 0.62, 1.08);
  const lifeRatio = profile.life_hours === null
    ? 1
    : normalizeLifecycleRatio(1.06 - (Math.min(profile.life_hours, 240) / 420), 0.62, 1.08);

  return Number((stageBase * roleMultiplier * fitBoost * impactRatio * lifeRatio).toFixed(3));
};

const resolveUsageCapPercent = (profile) => {
  const guidanceCaps = [
    Number(profile?.use_level_typical_percent) > 0 ? Number(profile.use_level_typical_percent) * 0.82 : null,
    Number(profile?.use_level_max_percent) > 0 ? Number(profile.use_level_max_percent) * 0.68 : null,
    Number(profile?.ifra_limit_percent) > 0 ? Number(profile.ifra_limit_percent) * 0.62 : null,
  ].filter((value) => Number.isFinite(value) && value > 0);

  if (guidanceCaps.length) {
    return Math.max(Math.min(...guidanceCaps), 0.003);
  }

  const impact = Number(profile?.impact);
  const lifeHours = Number(profile?.life_hours);
  const primaryFunction = String(profile?.primary_function || '').toLowerCase();
  const potencyScore = (
    (Number.isFinite(impact) ? Math.max(0, (impact - 72) / 18) : 0)
    + (Number.isFinite(lifeHours) ? Math.max(0, (lifeHours - 90) / 70) : 0)
    + (primaryFunction === 'modifier' ? 0.8 : 0)
    + (primaryFunction === 'fixative' ? 0.55 : 0)
    + (primaryFunction === 'diffuser' ? 0.25 : 0)
  );

  if (potencyScore >= 2.2) {
    return 0.035;
  }
  if (potencyScore >= 1.45) {
    return 0.12;
  }
  if (potencyScore >= 0.85) {
    return 0.38;
  }

  return null;
};

export const resolveRecommendedUsagePlan = ({
  profile,
  materialId = '',
  stage,
  fitScore,
  totalFormulaGrams = 3.2,
  feedbackContext = null,
} = {}) => {
  if (!profile) {
    return {
      strategy: 'direct',
      label: 'Direct dose',
      dilution_percent: null,
      target_effective_percent: null,
      target_gross_percent: null,
      recommended_grams: null,
      rationale: '',
      learning_seed_multiplier: 1,
      learning_dilution_preference: null,
    };
  }

  const seedCorrectionMultiplier = resolveCorrectionSeedMultiplier({
    feedbackContext,
    materialId,
    primaryFunction: String(profile.primary_function || '').toLowerCase(),
  });
  const desiredPercent = resolveSeedPercentageEstimate({ profile, stage, fitScore }) * seedCorrectionMultiplier;
  const usageCap = resolveUsageCapPercent(profile);
  const primaryFunction = String(profile.primary_function || '').toLowerCase();
  const traceRole = TRACE_ROLE_SET.has(primaryFunction);
  const effectivePercent = usageCap
    ? Math.min(desiredPercent, usageCap)
    : desiredPercent;
  const safeEffectivePercent = Math.max(effectivePercent, usageCap && usageCap <= 0.02 ? 0.003 : 0.012);

  let dilutionPercent = null;
  if (usageCap !== null) {
    if (usageCap <= 0.03) {
      dilutionPercent = 1;
    } else if (usageCap <= 0.12) {
      dilutionPercent = 5;
    } else if (usageCap <= 0.45) {
      dilutionPercent = 10;
    } else if (usageCap <= 1) {
      dilutionPercent = 20;
    }
  } else if (traceRole && desiredPercent <= 1.1) {
    dilutionPercent = 10;
  }

  const correctionDilutionPercent = resolveCorrectionDilutionPercent({
    feedbackContext,
    materialId,
    primaryFunction,
  });
  if (correctionDilutionPercent && (dilutionPercent || seedCorrectionMultiplier <= 0.82 || traceRole)) {
    dilutionPercent = correctionDilutionPercent;
  }

  const dilutionFactor = dilutionPercent ? (dilutionPercent / 100) : 1;
  const grossPercent = Math.max(safeEffectivePercent / dilutionFactor, dilutionPercent ? 0.35 : 0.08);
  const recommendedGrams = Number(Math.max((grossPercent / 100) * totalFormulaGrams, 0.03).toFixed(3));

  let strategy = 'direct';
  let label = 'Direct dose';
  let rationale = '';

  if (dilutionPercent === 1) {
    strategy = usageCap !== null && usageCap <= 0.02 ? 'micro_trace_dilution' : 'trace_dilution';
    label = 'Use as 1% dilution';
    rationale = 'This material behaves more safely as a micro-dose accent.';
  } else if (dilutionPercent === 5) {
    strategy = 'trace_dilution';
    label = 'Use as 5% dilution';
    rationale = 'This candidate is strong enough to work better as a trace accent.';
  } else if (dilutionPercent === 10 || dilutionPercent === 20) {
    strategy = 'accent_dilution';
    label = `Use as ${dilutionPercent}% dilution`;
    rationale = 'This candidate reads more naturally when staged through a pre-dilution.';
  } else if (usageCap !== null && usageCap <= 0.08) {
    strategy = 'micro_trace';
    label = 'Use in micro-dose';
    rationale = 'This candidate should stay at trace level in the formula.';
  } else if (traceRole && safeEffectivePercent <= 0.35) {
    strategy = 'trace';
    label = 'Use as trace accent';
    rationale = 'This candidate works better as a narrow accent than as a body material.';
  }

  return {
    strategy,
    label,
    dilution_percent: dilutionPercent,
    target_effective_percent: Number(safeEffectivePercent.toFixed(4)),
    target_gross_percent: Number(grossPercent.toFixed(4)),
    recommended_grams: recommendedGrams,
    rationale,
    learning_seed_multiplier: Number(seedCorrectionMultiplier.toFixed(4)),
    learning_dilution_preference: correctionDilutionPercent,
  };
};

const buildLearningSignals = ({
  usagePlan = null,
  feedbackBonus = 0,
} = {}) => {
  const signals = [];
  const seedMultiplier = Number(usagePlan?.learning_seed_multiplier || 1);
  const dilutionPreference = Number(usagePlan?.learning_dilution_preference || 0);

  if (dilutionPreference > 0) {
    signals.push(`Learned: prefer ${dilutionPreference}% dilution`);
  }
  if (seedMultiplier <= 0.88) {
    signals.push('Learned: leaner dose');
  } else if (seedMultiplier >= 1.12) {
    signals.push('Learned: fuller dose');
  }
  if (Number(feedbackBonus) >= 0.85) {
    signals.push('Learned: matches your keep pattern');
  }

  return signals.slice(0, 2);
};

const buildGuidancePenalty = ({ profile, stage, fitScore }) => {
  const estimatedSeedPercentage = resolveSeedPercentageEstimate({ profile, stage, fitScore });
  const effectivePercentage = estimatedSeedPercentage * getDilutionFactor(profile.material?.dilution_percentage);
  const advisories = buildGuidanceLimitAdvisories({
    referenceProfile: profile.reference_profile,
    effectivePercentage,
  });
  const penalty = advisories.reduce((sum, advisory) => {
    if (advisory.type === 'ifra') {
      return sum + 3.6;
    }
    if (advisory.type === 'max') {
      return sum + 2.2;
    }
    if (advisory.type === 'typical') {
      return sum + 0.9;
    }
    return sum;
  }, 0);

  return {
    estimated_seed_percentage: estimatedSeedPercentage,
    effective_percentage: Number(effectivePercentage.toFixed(3)),
    advisories,
    penalty: Number(penalty.toFixed(3)),
  };
};

const buildScoreBreakdown = ({
  stage,
  stageScore,
  classFit,
  functionFit,
  roleFit,
  placementFit,
  impactFit,
  lifeFit,
  answerFit,
  targetKeywordFit,
  briefFit,
  dataBonus,
  warningPenalty,
  guidancePenalty,
  feedbackBonus,
  fitScore,
  profile,
  targetProfile,
  guidanceWarnings,
}) => ({
  stage,
  total_score: fitScore,
  stage_natural_score: Number(stageScore.toFixed(2)),
  class_fit_score: toPercentScore(classFit),
  function_fit_score: toPercentScore(Math.min(functionFit, 1)),
  role_fit_score: toPercentScore(Math.min(roleFit, 1)),
  placement_fit_score: toPercentScore(Math.max(0, placementFit)),
  impact_fit_score: toPercentScore(Math.max(0, impactFit)),
  life_fit_score: toPercentScore(lifeFit),
  keyword_fit_score: Number((answerFit + (targetKeywordFit * 1.1) + (briefFit * 0.08)).toFixed(2)),
  guidance_confidence_score: Math.round(Math.min(profile.source_confidence, 5) * 20),
  warning_penalty: Number(warningPenalty.toFixed(2)),
  guidance_penalty: Number(guidancePenalty.toFixed(2)),
  feedback_bonus: Number((feedbackBonus || 0).toFixed(2)),
  estimated_seed_percentage: guidanceWarnings?.estimated_seed_percentage ?? null,
  estimated_effective_percentage: guidanceWarnings?.effective_percentage ?? null,
  guidance_advisories: guidanceWarnings?.advisories || [],
  target_letters: Array.isArray(targetProfile?.preferred_letters) ? targetProfile.preferred_letters : [],
  target_functions: Array.isArray(targetProfile?.preferred_functions) ? targetProfile.preferred_functions : [],
  matched_primary_function: profile.primary_function || null,
  matched_secondary_function: profile.secondary_function || null,
  matched_life_hours: profile.life_hours,
  matched_impact: profile.impact,
  matched_pyramid_placement: profile.pyramid_placement,
});

const buildFeedbackAlignmentScore = ({
  profile,
  materialId,
  effectTags = [],
  usagePlan = null,
  feedbackContext = null,
} = {}) => {
  if (!feedbackContext?.has_feedback) {
    return 0;
  }

  const usageKey = normalizeFeedbackUsageKey(usagePlan?.strategy);
  const primaryFunction = String(profile?.primary_function || '').toLowerCase();
  const secondaryFunction = String(profile?.secondary_function || '').toLowerCase();
  const positive = feedbackContext.positive || {};
  const negative = feedbackContext.negative || {};

  const materialBonus = getFeedbackMapScore(positive.materials, materialId, 0.7, 1.15)
    - getFeedbackMapScore(negative.materials, materialId, 0.9, 1.35);
  const functionBonus = getFeedbackMapScore(positive.functions, primaryFunction, 0.5, 1.1)
    + getFeedbackMapScore(positive.functions, secondaryFunction, 0.22, 0.45)
    - getFeedbackMapScore(negative.functions, primaryFunction, 0.62, 1.2)
    - getFeedbackMapScore(negative.functions, secondaryFunction, 0.28, 0.55);
  const usageBonus = getFeedbackMapScore(positive.usage, usageKey, 0.55, 0.95)
    - getFeedbackMapScore(negative.usage, usageKey, 0.62, 1.05);
  const effectBonus = effectTags.reduce((sum, tag) => (
    sum
    + getFeedbackMapScore(positive.effects, tag, 0.24, 0.42)
    - getFeedbackMapScore(negative.effects, tag, 0.3, 0.5)
  ), 0);

  return Number(clampNumber(materialBonus + functionBonus + usageBonus + effectBonus, -2.4, 2.8).toFixed(4));
};

export const scoreMaterialForStage = ({
  profile,
  materialId = '',
  stage,
  answers = {},
  briefText = '',
  targetProfile = null,
  feedbackContext = null,
}) => {
  const weights = STAGE_WEIGHT[stage] || STAGE_WEIGHT.middle;
  const stageScore = (
    (profile.stage_scores.top * weights.top)
    + (profile.stage_scores.middle * weights.middle)
    + (profile.stage_scores.base * weights.base)
  );

  const answerKeywords = getStageAnswerKeywords(answers);
  const targetKeywords = getTargetProfileKeywords(targetProfile);
  const inferredTheme = inferThemeRecipe({ targetProfile, briefText });
  const answerFit = keywordScore(profile.descriptors_text, answerKeywords);
  const targetKeywordFit = keywordScore(profile.descriptors_text, targetKeywords);
  const briefFit = briefText ? keywordScore(profile.descriptors_text, briefText.toLowerCase().split(/\s+/)) : 0;
  const classShareMap = buildClassShareMap(profile.class_distribution);
  const preferredLetters = Array.isArray(targetProfile?.preferred_letters)
    ? targetProfile.preferred_letters.map((value) => String(value || '').toUpperCase()).filter(Boolean)
    : [];
  const preferredFunctions = Array.isArray(targetProfile?.preferred_functions)
    ? targetProfile.preferred_functions.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const preferredFunctionSet = new Set(preferredFunctions);
  const classFit = preferredLetters.reduce(
    (sum, letter) => sum + (classShareMap.get(letter) || 0),
    0,
  ) / 100;
  const functionFit = (
    (preferredFunctionSet.has(String(profile.primary_function || '').toLowerCase()) ? 1 : 0)
    + (preferredFunctionSet.has(String(profile.secondary_function || '').toLowerCase()) ? 0.45 : 0)
  );
  const functionPriority = STAGE_FUNCTION_PRIORITIES[stage] || STAGE_FUNCTION_PRIORITIES.middle;
  const primaryFunction = String(profile.primary_function || '').toLowerCase();
  const secondaryFunction = String(profile.secondary_function || '').toLowerCase();
  const primaryRoleIndex = functionPriority.indexOf(primaryFunction);
  const secondaryRoleIndex = functionPriority.indexOf(secondaryFunction);
  const roleFit = (() => {
    if (primaryRoleIndex >= 0) {
      return Math.max(0.2, 1 - (primaryRoleIndex * 0.14));
    }
    if (secondaryRoleIndex >= 0) {
      return Math.max(0.15, 0.72 - (secondaryRoleIndex * 0.12));
    }
    return 0;
  })();
  const placementFit = (() => {
    const placement = String(profile.pyramid_placement || '').toLowerCase();
    if (!placement) {
      return 0;
    }

    return STAGE_PLACEMENT_FIT[stage]?.[placement] ?? 0;
  })();
  const impactBand = normalizeBand(targetProfile?.impact_band);
  const impactFit = (() => {
    if (profile.impact === null || !impactBand) {
      return 0;
    }

    if (impactBand === 'low') {
      return profile.impact <= 40 ? 1 : profile.impact <= 60 ? 0.45 : -0.25;
    }

    if (impactBand === 'high') {
      return profile.impact >= 65 ? 1 : profile.impact >= 50 ? 0.45 : -0.2;
    }

    return profile.impact >= 35 && profile.impact <= 75 ? 0.9 : 0.2;
  })();
  const lifeRange = Array.isArray(targetProfile?.life_range_hours) ? targetProfile.life_range_hours : null;
  const lifeFit = (() => {
    if (profile.life_hours === null || !lifeRange?.length) {
      return 0;
    }

    const [minLife, maxLife] = lifeRange;
    if (profile.life_hours >= minLife && profile.life_hours <= maxLife) {
      return 1;
    }

    const distance = profile.life_hours < minLife
      ? minLife - profile.life_hours
      : profile.life_hours - maxLife;
    return Math.max(0, 1 - (distance / 72));
  })();
  const dataBonus = Math.min(profile.source_confidence, 5) * 0.4;
  const warningPenalty = profile.warning_flags.length * 0.35;
  const guidanceWarnings = buildGuidancePenalty({
    profile,
    stage,
    fitScore: stageScore + (answerFit * 1.1) + (targetKeywordFit * 1.1),
  });
  const usagePlan = resolveRecommendedUsagePlan({
    profile,
    materialId,
    stage,
    fitScore: stageScore + (answerFit * 1.1) + (targetKeywordFit * 1.1),
    feedbackContext,
  });
  const effectTags = inferEffectTags(profile, targetProfile);
  const themeRoleBonus = inferredTheme.recipe?.preferred_roles?.includes(inferFallbackArchitectureRole({
    ...profile,
    recommended_usage_strategy: usagePlan.strategy,
    effect_tags: effectTags,
  })) ? 0.45 : 0;
  const themeEffectBonus = (inferredTheme.recipe?.required_effects || []).some((tag) => effectTags.includes(tag)) ? 0.7 : 0;
  const feedbackBonus = buildFeedbackAlignmentScore({
    profile,
    materialId,
    effectTags,
    usagePlan,
    feedbackContext,
  });
  const learningSignals = buildLearningSignals({
    usagePlan,
    feedbackBonus,
  });
  const structureBonus = (classFit * 3.1) + (functionFit * 1.2) + (roleFit * 1.8) + (placementFit * 1.4) + (impactFit * 1.1) + (lifeFit * 1.2);
  const usageBonus = usagePlan.strategy === 'direct'
    ? 0
    : usagePlan.strategy === 'accent_dilution'
      ? 0.4
      : usagePlan.strategy === 'trace_dilution' || usagePlan.strategy === 'trace'
        ? 0.8
        : 1.05;
  const fitScore = Number((stageScore + structureBonus + (answerFit * 0.9) + (targetKeywordFit * 1.1) + (briefFit * 0.08) + dataBonus + usageBonus + themeRoleBonus + themeEffectBonus + feedbackBonus - warningPenalty - guidanceWarnings.penalty).toFixed(4));
  const scoreBreakdown = buildScoreBreakdown({
    stage,
    stageScore,
    classFit,
    functionFit,
    roleFit,
    placementFit,
    impactFit,
    lifeFit,
    answerFit,
    targetKeywordFit,
    briefFit,
    dataBonus,
    warningPenalty,
    guidancePenalty: guidanceWarnings.penalty,
    feedbackBonus,
    fitScore,
    profile,
    targetProfile,
    guidanceWarnings,
  });

  const reasons = [];
  if (classFit >= 0.45 && preferredLetters.length) {
    reasons.push('Aligned with the stage family profile');
  }
  if (roleFit >= 0.75) {
    reasons.push(`Behaves like a strong ${stage} stage role`);
  }
  if (answerFit > 0) {
    reasons.push('Matches the chosen stage character');
  }
  if (targetKeywordFit > 0) {
    reasons.push('Supports the selected perfumer intent');
  }
  if (inferredTheme.key && themeEffectBonus > 0) {
    reasons.push(`Supports the ${inferredTheme.key} accord recipe`);
  }
  if (feedbackBonus >= 0.85) {
    reasons.push('Aligns with the formula moves you kept in the composer');
  } else if (feedbackBonus <= -0.85) {
    reasons.push('Avoids patterns the composer has been moving away from');
  }
  if (usagePlan.rationale) {
    reasons.push(usagePlan.rationale);
  }
  if (effectTags.length) {
    reasons.push(`Adds ${effectTags[0].replace(/_/g, ' ')} detail`);
  }
  if ((profile.stage_scores[stage] || 0) >= 3) {
    reasons.push(`Naturally leans toward ${stage} placement`);
  }
  if (functionFit >= 1) {
    reasons.push(`Supports ${normalizeFunctionLabel(profile.primary_function)} role`);
  }
  if (profile.primary_function) {
    reasons.push(`Works as ${normalizeFunctionLabel(profile.primary_function)}`);
  }
  if (profile.life_hours !== null) {
    reasons.push(`${Math.round(profile.life_hours)}h life signal`);
  }
  if (guidanceWarnings.advisories.some((advisory) => advisory.type === 'ifra')) {
    reasons.push('IFRA guidance is under pressure');
  } else if (guidanceWarnings.advisories.some((advisory) => advisory.type === 'max')) {
    reasons.push('Near max guidance pressure');
  } else if (guidanceWarnings.advisories.some((advisory) => advisory.type === 'typical')) {
    reasons.push('Above typical guidance range');
  }

  const warningText = [
    ...profile.warning_flags,
    ...guidanceWarnings.advisories.map((advisory) => advisory.label),
  ].filter(Boolean).join(', ');

  return {
    fit_score: fitScore,
    recommendation_reason: reasons.slice(0, 3).join(' - '),
    warning: warningText || null,
    primary_function: profile.primary_function,
    secondary_function: profile.secondary_function,
    recommended_usage_strategy: usagePlan.strategy,
    recommended_usage_label: usagePlan.label,
    recommended_dilution_percent: usagePlan.dilution_percent,
    recommended_effective_percent: usagePlan.target_effective_percent,
    recommended_gross_percent: usagePlan.target_gross_percent,
    recommended_seed_grams: usagePlan.recommended_grams,
    effect_tags: effectTags,
    learning_signals: learningSignals,
    inferred_theme_key: inferredTheme.key,
    inferred_theme_confidence: inferredTheme.confidence,
    score_breakdown: scoreBreakdown,
    guidance_advisories: guidanceWarnings.advisories,
  };
};

export const explainMaterialForStage = ({
  material,
  referenceLink = null,
  stage,
  answers = {},
  briefText = '',
  targetProfile = null,
  feedbackContext = null,
}) => {
  const profile = resolveMaterialCompositionProfile(material, referenceLink);
  const score = scoreMaterialForStage({
    profile,
    materialId: material?.id || '',
    stage,
    answers,
    briefText,
    targetProfile,
    feedbackContext,
  });

  return {
    profile,
    ...score,
  };
};

export const buildStageDecisionAssist = ({
  items = [],
  explanationMap = new Map(),
} = {}) => {
  const rankedItems = [...items]
    .filter((item) => item?.raw_material_id)
    .sort((left, right) => Number(right.fit_score || 0) - Number(left.fit_score || 0));
  const selectedItems = rankedItems.filter((item) => item.selection_state === 'selected' || item.selection_state === 'manual');
  const activeItems = selectedItems.length ? selectedItems : rankedItems;

  const dominantLetters = new Map();
  activeItems.forEach((item) => {
    const explanation = explanationMap.get(item.raw_material_id);
    const distribution = explanation?.profile?.class_distribution || [];
    distribution.forEach((entry) => {
      const letter = String(entry?.letter || '').toUpperCase();
      const share = Number(entry?.share || 0);
      if (!letter || share <= 0) {
        return;
      }
      dominantLetters.set(letter, (dominantLetters.get(letter) || 0) + share);
    });
  });

  const dominantClass = [...dominantLetters.entries()]
    .sort((left, right) => right[1] - left[1])[0] || null;
  const roleCounts = new Map();
  activeItems.forEach((item) => {
    const roleKey = String(item.primary_function || item.role || 'support').toLowerCase();
    roleCounts.set(roleKey, (roleCounts.get(roleKey) || 0) + 1);
  });

  const duplicatePairs = [];
  for (let leftIndex = 0; leftIndex < activeItems.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < activeItems.length; rightIndex += 1) {
      const leftItem = activeItems[leftIndex];
      const rightItem = activeItems[rightIndex];
      const leftExplanation = explanationMap.get(leftItem.raw_material_id);
      const rightExplanation = explanationMap.get(rightItem.raw_material_id);
      if (!leftExplanation?.profile || !rightExplanation?.profile) {
        continue;
      }

      const overlap = computeDistributionOverlap(
        leftExplanation.profile.class_distribution,
        rightExplanation.profile.class_distribution,
      );
      const samePrimaryFunction = leftItem.primary_function && leftItem.primary_function === rightItem.primary_function;
      const fitGap = Math.abs(Number(leftItem.fit_score || 0) - Number(rightItem.fit_score || 0));

      if (overlap >= 0.62 && samePrimaryFunction && fitGap <= 2.5) {
        const keepItem = Number(leftItem.fit_score || 0) >= Number(rightItem.fit_score || 0) ? leftItem : rightItem;
        const dropItem = keepItem === leftItem ? rightItem : leftItem;
        duplicatePairs.push({
          keep_item_id: keepItem.raw_material_id,
          keep_name: keepItem.expand?.raw_material_id?.name || 'Unknown material',
          drop_item_id: dropItem.raw_material_id,
          drop_name: dropItem.expand?.raw_material_id?.name || 'Unknown material',
          overlap_score: Math.round(overlap * 100),
          reason: 'These two candidates occupy a very similar class profile and function role for this stage.',
        });
      }
    }
  }

  const anchorItem = activeItems[0] || null;
  const suggestions = [];
  const sameRoleDominantEntry = [...roleCounts.entries()].sort((left, right) => right[1] - left[1])[0] || null;
  const anchorOverlapAverage = anchorItem
    ? averageOverlapWithAnchor(activeItems, anchorItem, explanationMap)
    : 0;

  if (anchorItem) {
    suggestions.push({
      type: 'anchor',
      title: `Keep ${anchorItem.expand?.raw_material_id?.name || 'this material'} as the stage anchor`,
      message: 'It currently leads the fit score for this stage and gives the clearest alignment to the active target profile.',
    });
  }

  duplicatePairs.slice(0, 2).forEach((pair) => {
    suggestions.push({
      type: 'dedupe',
      title: `Consider keeping ${pair.keep_name} and dropping ${pair.drop_name}`,
      message: `${pair.reason} Overlap is ${pair.overlap_score}%, so carrying both may add redundancy more than contrast.`,
    });
  });

  if (dominantClass && dominantClass[1] >= Math.max(activeItems.length * 65, 140)) {
    suggestions.push({
      type: 'class_balance',
      title: `Stage is leaning heavily toward class ${dominantClass[0]}`,
      message: 'Consider retaining one strong anchor from this class and using another candidate with a different class signature for contrast and transition quality.',
    });
  }

  if (sameRoleDominantEntry && sameRoleDominantEntry[1] >= 3) {
    suggestions.push({
      type: 'role_balance',
      title: `Too many ${normalizeFunctionLabel(sameRoleDominantEntry[0])} candidates are clustered here`,
      message: 'Try keeping one anchor in this role and one contrasting support role so the stage has more shape and less redundancy.',
    });
  }

  if (anchorItem && anchorOverlapAverage >= 0.58) {
    suggestions.push({
      type: 'contrast',
      title: 'Contrast opportunity detected for this stage',
      message: 'Most current candidates overlap strongly with the leading anchor. Consider keeping one lower-overlap option to improve nuance and transition quality.',
    });
  }

  return {
    anchorItem,
    duplicatePairs,
    dominantClassLetter: dominantClass?.[0] || null,
    suggestions,
  };
};

const averageOverlapWithAnchor = (items, anchorItem, explanationMap) => {
  const anchorExplanation = explanationMap.get(anchorItem?.raw_material_id);
  if (!anchorExplanation?.profile) {
    return 0;
  }

  const overlaps = items
    .filter((item) => item.raw_material_id !== anchorItem.raw_material_id)
    .map((item) => {
      const explanation = explanationMap.get(item.raw_material_id);
      if (!explanation?.profile) {
        return null;
      }

      return computeDistributionOverlap(
        anchorExplanation.profile.class_distribution,
        explanation.profile.class_distribution,
      );
    })
    .filter((value) => value !== null);

  if (!overlaps.length) {
    return 0;
  }

  return overlaps.reduce((sum, value) => sum + value, 0) / overlaps.length;
};

const getDominantClassLetter = (profile) => {
  const rankedDistribution = [...(profile?.class_distribution || [])]
    .map((entry) => ({
      letter: String(entry?.letter || '').toUpperCase(),
      share: Number(entry?.share || 0),
    }))
    .filter((entry) => entry.letter && entry.share > 0)
    .sort((left, right) => right.share - left.share);

  return rankedDistribution[0]?.letter || null;
};

const candidateMatchesSlot = (candidate, slot, preferredEffectTags = []) => {
  const primaryRole = String(candidate.primary_function || '').toLowerCase() || 'support';
  const usageStrategy = String(candidate.recommended_usage_strategy || '').toLowerCase();
  const effectTags = Array.isArray(candidate.effect_tags) ? candidate.effect_tags : [];
  const hasPreferredEffect = preferredEffectTags.some((tag) => effectTags.includes(tag));

  if (slot === 'anchor') {
    return candidate.fit_score > 0;
  }
  if (slot === 'lift') {
    return ['diffuser', 'modifier', 'hero'].includes(primaryRole);
  }
  if (slot === 'body') {
    return ['hero', 'support', 'fixative', 'linear_substrate'].includes(primaryRole) && usageStrategy === 'direct';
  }
  if (slot === 'bridge') {
    return ['bridge', 'blender', 'support'].includes(primaryRole);
  }
  if (slot === 'effect') {
    return effectTags.length > 0 && (usageStrategy !== 'direct' || hasPreferredEffect);
  }
  if (slot === 'support') {
    return ['support', 'blender', 'fixative'].includes(primaryRole);
  }
  if (slot === 'contrast') {
    return true;
  }

  return false;
};

const buildArchitectureAdjustedScore = ({
  candidate,
  selected,
  roleCounts,
  classCounts,
  effectCounts,
  slot,
  preferredEffectTags = [],
  themeRecipe = null,
}) => {
  const primaryRole = String(candidate.primary_function || '').toLowerCase() || 'support';
  const dominantClass = getDominantClassLetter(candidate.profile);
  const roleCount = roleCounts.get(primaryRole) || 0;
  const classCount = dominantClass ? (classCounts.get(dominantClass) || 0) : 0;
  const candidateRoleKey = inferFallbackArchitectureRole(candidate);
  const effectPenalty = (candidate.effect_tags || []).reduce(
    (sum, tag) => sum + ((effectCounts.get(tag) || 0) * 0.9),
    0,
  );
  const overlapPenalty = selected.reduce((penalty, current) => {
    const overlap = computeDistributionOverlap(
      candidate.profile?.class_distribution,
      current.profile?.class_distribution,
    );

    return penalty + Math.max(0, overlap - 0.38) * 2.4;
  }, 0);
  const rolePenalty = roleCount * 1.15;
  const classPenalty = classCount * 0.7;
  const missingContrastBonus = selected.length > 0 && overlapPenalty < 0.35 ? 0.8 : 0;
  const specialEffectBonus = (
    Array.isArray(candidate.effect_tags)
    && candidate.effect_tags.length > 0
    && candidate.recommended_usage_strategy !== 'direct'
    && selected.length >= 2
  ) ? 1.15 : 0;
  const preferredEffectBonus = preferredEffectTags.some((tag) => (candidate.effect_tags || []).includes(tag))
    ? 1.35
    : 0;
  const themeRoleBonus = (themeRecipe?.preferred_roles || []).includes(candidateRoleKey) ? 0.85 : 0;
  const themeRequiredEffectBonus = (themeRecipe?.required_effects || []).some((tag) => (candidate.effect_tags || []).includes(tag))
    ? 1.05
    : 0;
  const slotBonus = slot === 'effect'
    ? 0.95
    : slot === 'bridge'
      ? 0.55
      : slot === 'body'
        ? 0.35
        : slot === 'lift'
          ? 0.5
          : 0;

  return candidate.fit_score
    - overlapPenalty
    - rolePenalty
    - classPenalty
    - effectPenalty
    + missingContrastBonus
    + specialEffectBonus
    + preferredEffectBonus
    + themeRoleBonus
    + themeRequiredEffectBonus
    + slotBonus;
};

const isLoudDirectCandidate = (candidate) => (
  String(candidate?.recommended_usage_strategy || '').toLowerCase() === 'direct'
  && (
    Number(candidate?.profile?.impact || 0) >= 75
    || Number(candidate?.profile?.life_hours || 0) >= 120
  )
);

const applyThemeRecipeCorrections = ({ selected, sortedCandidates, stage, themeRecipe = null }) => {
  if (!themeRecipe) {
    return selected;
  }

  const nextSelected = [...selected];
  const selectedEffectTags = new Set(nextSelected.flatMap((candidate) => candidate.effect_tags || []));
  const requiredEffects = themeRecipe.required_effects || [];
  const missingRequiredEffects = requiredEffects.filter((tag) => !selectedEffectTags.has(tag));

  missingRequiredEffects.forEach((missingEffectTag) => {
    const replacementCandidate = sortedCandidates.find((candidate) => (
      !nextSelected.some((entry) => entry.raw_material_id === candidate.raw_material_id)
      && (candidate.effect_tags || []).includes(missingEffectTag)
      && String(candidate.recommended_usage_strategy || '').toLowerCase() !== 'direct'
    ));

    if (!replacementCandidate) {
      return;
    }

    const replaceIndex = nextSelected.findIndex((candidate, index) => (
      index > 0
      && !requiredEffects.some((tag) => (candidate.effect_tags || []).includes(tag))
      && getArchitectureRoleKey({ candidate, stage }) !== 'anchor'
    ));

    if (replaceIndex >= 0) {
      nextSelected.splice(replaceIndex, 1, replacementCandidate);
    }
  });

  return nextSelected;
};

const buildDiversityAwareRecommendations = ({ candidates = [], limit = 8, stage = 'middle', targetProfile = null, briefText = '' }) => {
  const sortedCandidates = [...candidates].sort((left, right) => right.fit_score - left.fit_score);
  if (!sortedCandidates.length) {
    return [];
  }

  const anchor = sortedCandidates[0];
  const architectureSlots = STAGE_ARCHITECTURE_SLOTS[stage] || STAGE_ARCHITECTURE_SLOTS.middle;
  const preferredEffectTags = inferPreferredEffectTags(targetProfile);
  const inferredTheme = inferThemeRecipe({ targetProfile, briefText });
  const themeRecipe = inferredTheme.recipe;
  const selected = [];
  const roleCounts = new Map();
  const classCounts = new Map();
  const effectCounts = new Map();

  const addCandidate = (candidate) => {
    if (!candidate || selected.some((entry) => entry.raw_material_id === candidate.raw_material_id)) {
      return false;
    }

    selected.push(candidate);
    const bestRole = String(candidate.primary_function || '').toLowerCase() || 'support';
    const bestClass = getDominantClassLetter(candidate.profile);
    roleCounts.set(bestRole, (roleCounts.get(bestRole) || 0) + 1);
    if (bestClass) {
      classCounts.set(bestClass, (classCounts.get(bestClass) || 0) + 1);
    }
    (candidate.effect_tags || []).forEach((tag) => {
      effectCounts.set(tag, (effectCounts.get(tag) || 0) + 1);
    });

    return true;
  };

  addCandidate(anchor);

  architectureSlots.forEach((slot) => {
    if (selected.length >= limit) {
      return;
    }

    let bestCandidate = null;
    let bestAdjustedScore = Number.NEGATIVE_INFINITY;

    sortedCandidates.forEach((candidate) => {
      if (selected.some((entry) => entry.raw_material_id === candidate.raw_material_id)) {
        return;
      }

      if (!candidateMatchesSlot(candidate, slot, preferredEffectTags)) {
        return;
      }

      const adjustedScore = buildArchitectureAdjustedScore({
        candidate,
        selected,
        roleCounts,
        classCounts,
        effectCounts,
        slot,
        preferredEffectTags,
        themeRecipe,
      });

      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestCandidate = candidate;
      }
    });

    if (bestCandidate) {
      addCandidate(bestCandidate);
    }
  });

  while (selected.length < limit && selected.length < sortedCandidates.length) {
    let bestCandidate = null;
    let bestAdjustedScore = Number.NEGATIVE_INFINITY;

    sortedCandidates.forEach((candidate) => {
      if (selected.some((entry) => entry.raw_material_id === candidate.raw_material_id)) {
        return;
      }

      const adjustedScore = buildArchitectureAdjustedScore({
        candidate,
        selected,
        roleCounts,
        classCounts,
        effectCounts,
        slot: 'contrast',
        preferredEffectTags,
        themeRecipe,
      });

      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestCandidate = candidate;
      }
    });

    if (!bestCandidate) {
      break;
    }

    addCandidate(bestCandidate);
  }

  const loudDirectLimit = themeRecipe?.loud_direct_limit ?? 2;
  let loudDirectCount = 0;
  const negativeRuleBalanced = selected.filter((candidate) => {
    if (!isLoudDirectCandidate(candidate)) {
      return true;
    }

    loudDirectCount += 1;
    return loudDirectCount <= loudDirectLimit;
  });

  const correctedSelection = applyThemeRecipeCorrections({
    selected: negativeRuleBalanced,
    sortedCandidates,
    stage,
    themeRecipe,
  });

  const backfilledSelection = [...correctedSelection];
  sortedCandidates.forEach((candidate) => {
    if (backfilledSelection.length >= limit) {
      return;
    }

    if (backfilledSelection.some((entry) => entry.raw_material_id === candidate.raw_material_id)) {
      return;
    }

    backfilledSelection.push(candidate);
  });

  return backfilledSelection.slice(0, limit);
};

export const rankMaterialRecommendations = ({
  materials = [],
  referenceLinksMap = new Map(),
  stage,
  answers = {},
  briefText = '',
  limit = 8,
  targetProfile = null,
  feedbackContext = null,
}) => {
  const scoredCandidates = materials
    .filter((material) => material?.id && material.type !== 'solvent')
    .map((material) => {
      const profile = resolveMaterialCompositionProfile(material, referenceLinksMap.get(material.id) || null);
      const score = scoreMaterialForStage({
        profile,
        materialId: material.id,
        stage,
        answers,
        briefText,
        targetProfile,
        feedbackContext,
      });

      return {
        raw_material_id: material.id,
        material,
        profile,
        ...score,
      };
    })
    .filter((item) => item.fit_score > 0)
    .sort((left, right) => right.fit_score - left.fit_score)
    .slice(0, Math.max(limit * 3, limit));

  return buildDiversityAwareRecommendations({
    candidates: scoredCandidates,
    limit,
    stage,
    targetProfile,
    briefText,
  }).map((item, index) => ({
    ...item,
    rank_order: index,
  }));
};
