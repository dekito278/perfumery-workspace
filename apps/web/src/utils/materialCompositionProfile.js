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

const getStageAnswerKeywords = (answers = {}) => Object.values(answers)
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
  impactFit,
  lifeFit,
  answerFit,
  briefFit,
  dataBonus,
  warningPenalty,
  guidancePenalty,
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
  impact_fit_score: toPercentScore(Math.max(0, impactFit)),
  life_fit_score: toPercentScore(lifeFit),
  keyword_fit_score: Number((answerFit + (briefFit * 0.08)).toFixed(2)),
  guidance_confidence_score: Math.round(Math.min(profile.source_confidence, 5) * 20),
  warning_penalty: Number(warningPenalty.toFixed(2)),
  guidance_penalty: Number(guidancePenalty.toFixed(2)),
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

export const scoreMaterialForStage = ({
  profile,
  stage,
  answers = {},
  briefText = '',
  targetProfile = null,
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
    fitScore: stageScore + (answerFit * 1.1),
  });
  const structureBonus = (classFit * 3.4) + (functionFit * 1.5) + (impactFit * 1.1) + (lifeFit * 1.2);
  const fitScore = Number((stageScore + structureBonus + (answerFit * 1.1) + (briefFit * 0.08) + dataBonus - warningPenalty - guidanceWarnings.penalty).toFixed(4));
  const scoreBreakdown = buildScoreBreakdown({
    stage,
    stageScore,
    classFit,
    functionFit,
    impactFit,
    lifeFit,
    answerFit,
    briefFit,
    dataBonus,
    warningPenalty,
    guidancePenalty: guidanceWarnings.penalty,
    fitScore,
    profile,
    targetProfile,
    guidanceWarnings,
  });

  const reasons = [];
  if (classFit >= 0.45 && preferredLetters.length) {
    reasons.push('Aligned with the stage family profile');
  }
  if (answerFit > 0) {
    reasons.push('Matches the chosen stage character');
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
}) => {
  const profile = resolveMaterialCompositionProfile(material, referenceLink);
  const score = scoreMaterialForStage({
    profile,
    stage,
    answers,
    briefText,
    targetProfile,
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

export const rankMaterialRecommendations = ({
  materials = [],
  referenceLinksMap = new Map(),
  stage,
  answers = {},
  briefText = '',
  limit = 8,
  targetProfile = null,
}) => materials
  .filter((material) => material?.id && material.type !== 'solvent')
  .map((material) => {
    const profile = resolveMaterialCompositionProfile(material, referenceLinksMap.get(material.id) || null);
    const score = scoreMaterialForStage({
      profile,
      stage,
      answers,
      briefText,
      targetProfile,
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
