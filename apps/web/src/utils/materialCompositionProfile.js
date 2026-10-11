import { resolveRawMaterialGuidanceSnapshot } from '@/utils/rawMaterialGuidanceResolver.js';

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

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
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

  // A row the catalogue DECLARES a solvent is a solvent, whatever its prose says. The functions above are
  // read out of free text -- function_labels, perfume_uses, notes, description -- and that text describes
  // what a material does in a blend, so a diluent whose datasheet mentions "fixative" or "blending" came
  // back as one. Measured over the studio's own rows: of the 23 with type 'solvent', only 4 were called
  // solvent; the rest were support (11), fixative (5) and blender (3), and three of them sit in live
  // formulas -- Benzyl Benzoate as a fixative, Triethyl Citrate and Benzyl Alcohol as blenders.
  //
  // That is not cosmetic. primary_function has two readers and both are in the PACE engine:
  // FUNCTION_PRIORITY_BY_OBJECTIVE pays a fixative +8 towards longevity and a blender +7 towards
  // balance, so a diluent was being ranked as the material most worth adding to make a perfume last.
  // The text-derived role is kept as the secondary, where it is description rather than priority.
  const declaredSolvent = [material?.type, material?.item_type]
    .some((value) => normalizeText(value) === 'solvent');
  const textFunctions = functionSignals.length
    ? functionSignals
    : inferFallbackFunctions(stageScores, combinedText, impact, lifeHours);
  const normalizedFunctions = declaredSolvent
    ? ['solvent', ...textFunctions.filter((entry) => entry !== 'solvent')]
    : textFunctions;

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
