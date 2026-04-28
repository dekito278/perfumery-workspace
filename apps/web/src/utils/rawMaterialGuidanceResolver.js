import { deriveTopMiddleBaseTendency } from '@/utils/canonicalReferenceProfile.js';
import { buildFallbackReferenceProfileFromRawMaterial } from '@/utils/referenceGuidance.js';
import { extractWorkbookClassDistribution } from '@/utils/workbookAbcClassification.js';

const TOP_LETTERS = new Set(['A', 'B', 'C', 'F', 'G', 'H', 'K']);
const MIDDLE_LETTERS = new Set(['D', 'E', 'I', 'J', 'L', 'M', 'N', 'O', 'P', 'R', 'S']);
const BASE_LETTERS = new Set(['Q', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']);
const VALID_PYRAMID_PLACEMENTS = new Set(['top', 'middle', 'base']);

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const normalizeOptionalText = (value) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const keywordScore = (text, keywords) => keywords.reduce(
  (sum, keyword) => sum + (text.includes(keyword) ? 1 : 0),
  0,
);

const buildDescriptorText = (material, referenceProfile) => normalizeText([
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

const sumDistributionShare = (classDistribution, letters) => (
  (classDistribution || [])
    .filter((entry) => letters.has(String(entry?.letter || '').toUpperCase()))
    .reduce((sum, entry) => sum + Number(entry?.share || 0), 0)
);

const inferPlacementFromDistribution = (classDistribution, lifeHours) => {
  const normalizedDistribution = (classDistribution || []).map((entry) => ({
    letter: String(entry?.letter || '').toUpperCase(),
    share: Number(entry?.share || 0),
  }));

  return deriveTopMiddleBaseTendency({
    lifeHours,
    distribution: normalizedDistribution,
  });
};

export const resolveReferenceProfileWithSource = (material, referenceLink = null) => {
  const linkedReferenceProfile = referenceLink?.reference_profile || null;
  const fallbackReferenceProfile = linkedReferenceProfile
    ? null
    : buildFallbackReferenceProfileFromRawMaterial(material);
  const referenceProfile = linkedReferenceProfile || fallbackReferenceProfile;
  const guidanceSource = linkedReferenceProfile
    ? 'linked_profile'
    : fallbackReferenceProfile
      ? 'raw_material_fallback'
      : 'none';

  return {
    referenceProfile,
    guidanceSource,
  };
};

export const resolvePyramidPlacement = ({
  material = null,
  referenceProfile = null,
  classDistribution = [],
  lifeHours = null,
} = {}) => {
  const tendency = normalizeText(
    referenceProfile?.top_middle_base_tendency
    || referenceProfile?.canonical_profile?.top_middle_base_tendency,
  );
  if (VALID_PYRAMID_PLACEMENTS.has(tendency)) {
    return tendency;
  }

  const explicitPlacement = normalizeText(material?.pyramid_placement);
  if (VALID_PYRAMID_PLACEMENTS.has(explicitPlacement)) {
    return explicitPlacement;
  }

  const inferredPlacement = inferPlacementFromDistribution(classDistribution, lifeHours);
  if (VALID_PYRAMID_PLACEMENTS.has(inferredPlacement)) {
    return inferredPlacement;
  }

  return null;
};

export const buildStageScoresFromGuidance = ({
  material = null,
  referenceProfile = null,
  classDistribution = [],
  pyramidPlacement = null,
  impact = null,
  lifeHours = null,
  descriptorText = '',
} = {}) => {
  const family = normalizeText(
    referenceProfile?.abc_primary_family
    || material?.reference_abc_primary_family
    || material?.scent_family,
  );
  const category = normalizeText(material?.category);
  const topShare = sumDistributionShare(classDistribution, TOP_LETTERS);
  const middleShare = sumDistributionShare(classDistribution, MIDDLE_LETTERS);
  const baseShare = sumDistributionShare(classDistribution, BASE_LETTERS);

  let top = topShare * 0.05;
  let middle = middleShare * 0.05;
  let base = baseShare * 0.05;

  if (pyramidPlacement === 'top') {
    top += 3;
    middle += 0.6;
  } else if (pyramidPlacement === 'middle') {
    middle += 3;
    top += 0.4;
    base += 0.4;
  } else if (pyramidPlacement === 'base') {
    base += 3;
    middle += 0.6;
  }

  top += keywordScore(descriptorText, ['citrus', 'bergamot', 'lemon', 'aldehyd', 'sparkle', 'green', 'aromatic', 'fresh', 'airy', 'lift']) * 0.85;
  middle += keywordScore(descriptorText, ['rose', 'jasmine', 'floral', 'fruit', 'spice', 'heart', 'tea', 'petal', 'muguet']) * 0.85;
  base += keywordScore(descriptorText, ['amber', 'musk', 'patchouli', 'cedar', 'sandal', 'resin', 'wood', 'oud', 'drydown', 'balsam']) * 0.85;

  if (family.includes('citrus') || family.includes('green') || family.includes('herb')) {
    top += 1.25;
  }
  if (family.includes('floral') || family.includes('fruit') || family.includes('spice') || family.includes('rose')) {
    middle += 1.25;
  }
  if (family.includes('amber') || family.includes('wood') || family.includes('musk') || family.includes('resin') || family.includes('earthy')) {
    base += 1.25;
  }

  if (category.includes('citrus') || category.includes('green')) {
    top += 0.9;
  }
  if (category.includes('floral') || category.includes('fruity') || category.includes('spicy')) {
    middle += 0.9;
  }
  if (category.includes('woody') || category.includes('amber') || category.includes('musk') || category.includes('resin')) {
    base += 0.9;
  }

  if (lifeHours !== null) {
    if (lifeHours <= 8) {
      top += 1.5;
    } else if (lifeHours >= 36) {
      base += 1.5;
    } else {
      middle += 1.2;
    }
  }

  if (impact !== null) {
    if (impact >= 70) {
      top += 0.45;
      middle += 0.45;
    } else if (impact <= 35) {
      base += 0.3;
    }
  }

  return {
    top: Number(top.toFixed(4)),
    middle: Number(middle.toFixed(4)),
    base: Number(base.toFixed(4)),
  };
};

export const resolveRawMaterialGuidanceSnapshot = (material, referenceLink = null) => {
  const { referenceProfile, guidanceSource } = resolveReferenceProfileWithSource(material, referenceLink);
  const classDistribution = referenceProfile ? extractWorkbookClassDistribution(referenceProfile) : [];
  const descriptorText = buildDescriptorText(material, referenceProfile);
  const impact = toFiniteNumber(referenceProfile?.impact ?? material?.reference_impact);
  const lifeHours = toFiniteNumber(referenceProfile?.life_hours ?? material?.reference_life_hours);
  const ifraLimitPercent = toFiniteNumber(referenceProfile?.ifra_limit_percent ?? material?.ifra_limit);
  const useLevelTypicalPercent = toFiniteNumber(referenceProfile?.use_level_typical_percent ?? material?.reference_use_level_typical_percent);
  const useLevelMaxPercent = toFiniteNumber(referenceProfile?.use_level_max_percent ?? material?.reference_use_level_max_percent);
  const family = normalizeOptionalText(
    referenceProfile?.abc_primary_family
    || material?.reference_abc_primary_family
    || material?.scent_family,
  );
  const pyramidPlacement = resolvePyramidPlacement({
    material,
    referenceProfile,
    classDistribution,
    lifeHours,
  });
  const stageScores = buildStageScoresFromGuidance({
    material,
    referenceProfile,
    classDistribution,
    pyramidPlacement,
    impact,
    lifeHours,
    descriptorText,
  });

  return {
    material,
    referenceProfile,
    guidanceSource,
    classDistribution,
    descriptorText,
    family,
    impact,
    lifeHours,
    ifraLimitPercent,
    useLevelTypicalPercent,
    useLevelMaxPercent,
    pyramidPlacement,
    stageScores,
  };
};
