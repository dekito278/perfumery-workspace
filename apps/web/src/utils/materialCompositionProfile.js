import { buildFallbackReferenceProfileFromRawMaterial } from '@/utils/referenceGuidance.js';

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

const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeFunctionLabel = (label) => String(label || '').replace(/_/g, ' ').trim();

const inferFunctionsFromText = (functionText) => {
  const matches = FUNCTION_PATTERNS
    .filter((entry) => entry.pattern.test(functionText))
    .map((entry) => entry.key);

  return [...new Set(matches)];
};

const inferStageScores = ({ combinedText, family, impact, lifeHours, category, pyramidPlacement }) => {
  let top = 0;
  let middle = 0;
  let base = 0;

  if (pyramidPlacement === 'top') {
    top += 2.5;
  } else if (pyramidPlacement === 'middle') {
    middle += 2.5;
  } else if (pyramidPlacement === 'base') {
    base += 2.5;
  }

  top += keywordScore(combinedText, ['citrus', 'bergamot', 'lemon', 'aldehyd', 'sparkle', 'green', 'aromatic', 'fresh', 'airy', 'top']);
  middle += keywordScore(combinedText, ['rose', 'jasmine', 'floral', 'fruit', 'spice', 'heart', 'tea', 'petal', 'middle']);
  base += keywordScore(combinedText, ['amber', 'musk', 'patchouli', 'cedar', 'sandal', 'resin', 'wood', 'oud', 'base', 'drydown']);

  if (family.includes('citrus') || family.includes('green')) {
    top += 2;
  }
  if (family.includes('floral') || family.includes('fruit') || family.includes('spicy')) {
    middle += 2;
  }
  if (family.includes('amber') || family.includes('wood') || family.includes('musk') || family.includes('resin')) {
    base += 2;
  }

  if (category.includes('citrus') || category.includes('green')) {
    top += 1.5;
  }
  if (category.includes('floral') || category.includes('fruity') || category.includes('spicy')) {
    middle += 1.5;
  }
  if (category.includes('woody') || category.includes('amber') || category.includes('musk') || category.includes('resin')) {
    base += 1.5;
  }

  if (lifeHours !== null) {
    if (lifeHours <= 10) {
      top += 2.5;
    } else if (lifeHours <= 48) {
      middle += 1.75;
    } else {
      base += 3;
    }
  }

  if (impact !== null) {
    if (impact >= 70) {
      top += 0.75;
      middle += 0.75;
    }
    if (impact <= 35) {
      base += 0.5;
    }
  }

  return { top, middle, base };
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
  const referenceProfile = referenceLink?.reference_profile || buildFallbackReferenceProfileFromRawMaterial(material);
  const family = normalizeText(
    referenceProfile?.abc_primary_family
    || material?.reference_abc_primary_family
    || material?.scent_family
  );
  const category = normalizeText(material?.category);
  const impact = toNumber(referenceProfile?.impact ?? material?.reference_impact);
  const lifeHours = toNumber(referenceProfile?.life_hours ?? material?.reference_life_hours);
  const ifraLimit = toNumber(referenceProfile?.ifra_limit_percent ?? material?.ifra_limit);
  const useLevelTypical = toNumber(referenceProfile?.use_level_typical_percent ?? material?.reference_use_level_typical_percent);
  const useLevelMax = toNumber(referenceProfile?.use_level_max_percent ?? material?.reference_use_level_max_percent);
  const combinedText = normalizeText([
    material?.name,
    material?.description,
    material?.notes,
    material?.category,
    material?.scent_family,
    referenceProfile?.name,
    referenceProfile?.category,
    referenceProfile?.classification,
    referenceProfile?.brief_description,
    referenceProfile?.odour_description,
    referenceProfile?.odour_profile,
    referenceProfile?.perfume_uses,
    referenceProfile?.function_labels,
    referenceProfile?.function_raw,
  ].filter(Boolean).join(' | '));

  const functionSignals = inferFunctionsFromText(normalizeText([
    referenceProfile?.function_labels,
    referenceProfile?.function_raw,
    referenceProfile?.perfume_uses,
    material?.notes,
    material?.description,
  ].filter(Boolean).join(' | ')));
  const stageScores = inferStageScores({
    combinedText,
    family,
    impact,
    lifeHours,
    category,
    pyramidPlacement: normalizeText(material?.pyramid_placement),
  });

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

const getStageAnswerKeywords = (answers = {}) => Object.values(answers)
  .flatMap((value) => String(value || '').split(/[_\s-]+/))
  .map((value) => value.toLowerCase())
  .filter(Boolean);

export const scoreMaterialForStage = ({
  profile,
  stage,
  answers = {},
  briefText = '',
}) => {
  const weights = STAGE_WEIGHT[stage] || STAGE_WEIGHT.middle;
  const stageScore = (
    (profile.stage_scores.top * weights.top)
    + (profile.stage_scores.middle * weights.middle)
    + (profile.stage_scores.base * weights.base)
  );

  const answerKeywords = getStageAnswerKeywords(answers);
  const answerFit = keywordScore(profile.descriptors_text, answerKeywords);
  const briefFit = briefText ? keywordScore(profile.descriptors_text, briefText.toLowerCase().split(/\s+/)) : 0;
  const dataBonus = Math.min(profile.source_confidence, 5) * 0.4;
  const warningPenalty = profile.warning_flags.length * 0.35;

  const fitScore = Number((stageScore + (answerFit * 1.4) + (briefFit * 0.08) + dataBonus - warningPenalty).toFixed(4));

  const reasons = [];
  if (answerFit > 0) {
    reasons.push('Matches the chosen stage character');
  }
  if ((profile.stage_scores[stage] || 0) >= 3) {
    reasons.push(`Naturally leans toward ${stage} placement`);
  }
  if (profile.primary_function) {
    reasons.push(`Works as ${normalizeFunctionLabel(profile.primary_function)}`);
  }
  if (profile.life_hours !== null) {
    reasons.push(`${Math.round(profile.life_hours)}h life signal`);
  }

  return {
    fit_score: fitScore,
    recommendation_reason: reasons.slice(0, 3).join(' - '),
    warning: profile.warning_flags.length ? profile.warning_flags.join(', ') : null,
    primary_function: profile.primary_function,
    secondary_function: profile.secondary_function,
  };
};

export const rankMaterialRecommendations = ({
  materials = [],
  referenceLinksMap = new Map(),
  stage,
  answers = {},
  briefText = '',
  limit = 8,
}) => materials
  .filter((material) => material?.id && material.type !== 'solvent')
  .map((material) => {
    const profile = resolveMaterialCompositionProfile(material, referenceLinksMap.get(material.id) || null);
    const score = scoreMaterialForStage({
      profile,
      stage,
      answers,
      briefText,
    });

    return {
      raw_material_id: material.id,
      material,
      profile,
      ...score,
    };
  })
  .sort((left, right) => right.fit_score - left.fit_score)
  .slice(0, limit)
  .map((item, index) => ({
    ...item,
    rank_order: index,
  }));
