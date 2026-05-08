import { resolvePyramidPlacement, resolveRawMaterialGuidanceSnapshot } from '@/utils/rawMaterialGuidanceResolver.js';
import { buildGuidanceLimitAdvisories, getDilutionFactor } from '@/utils/rawMaterialGuidanceAdvisories.js';
import { extractWorkbookClassDistribution } from '@/utils/workbookAbcClassification.js';

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const clamp = (value, min = 0, max = 100) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(Math.max(numericValue, min), max);
};

const toScore = (value, inputMin, inputMax) => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (inputMax <= inputMin) {
    return clamp(value);
  }

  return clamp(((Number(value) - inputMin) / (inputMax - inputMin)) * 100);
};

const average = (values) => {
  const filteredValues = values.filter((value) => Number.isFinite(value));
  if (!filteredValues.length) {
    return 0;
  }

  return filteredValues.reduce((sum, value) => sum + value, 0) / filteredValues.length;
};

const getGuidanceSourceKey = (referenceProfile, guidanceSource) => {
  if (!referenceProfile || guidanceSource === 'none') {
    return 'missing';
  }

  const sourceKind = normalizeText(referenceProfile.source_kind);
  const snapshotKeys = Object.keys(referenceProfile.source_snapshots || {}).map(normalizeText);
  const provenanceKinds = Object.values(referenceProfile.field_resolution || {})
    .map((entry) => normalizeText(entry?.source_kind || entry?.source_priority_winner))
    .filter(Boolean);
  const sourceSignals = [sourceKind, ...snapshotKeys, ...provenanceKinds].join(' ');

  if (sourceSignals.includes('perfumersworld') || sourceSignals.includes('approved_pw')) {
    return 'perfumersworld';
  }

  if (sourceSignals.includes('tgsc')) {
    return 'tgsc';
  }

  if (sourceSignals.includes('scentree')) {
    return 'scentree';
  }

  if (sourceKind === 'library' || sourceKind === 'reference_profile') {
    return 'reference';
  }

  return 'manual';
};

const getGuidanceSourceLabel = (sourceKey) => ({
  perfumersworld: 'PerfumersWorld',
  tgsc: 'TGSC',
  scentree: 'ScenTree',
  reference: 'Reference',
  manual: 'Manual',
  missing: 'Missing',
}[sourceKey] || 'Guidance');

export const inferReferencePyramidPlacement = (lifeHours) => {
  return resolvePyramidPlacement({
    lifeHours: toFiniteNumber(lifeHours),
  });
};

export const getFormulaItemDilutionFactor = (item) => {
  return getDilutionFactor(item?.dilution_percent ?? item?.dilution_percentage);
};

const resolveFormulaItemDilutionSolvent = (item, rawMaterialsById) => {
  const solventId = String(item?.dilution_solvent_id || '').trim();
  if (solventId && rawMaterialsById?.has(solventId)) {
    return rawMaterialsById.get(solventId) || null;
  }

  const solventName = normalizeText(item?.dilution_solvent_name);
  if (!solventName || !rawMaterialsById?.values) {
    return null;
  }

  for (const material of rawMaterialsById.values()) {
    if (material?.type !== 'solvent') {
      continue;
    }

    if (normalizeText(material?.name) === solventName) {
      return material;
    }
  }

  return null;
};

const inferSolventBehaviourProfile = (solvent) => {
  const configuredImpactShift = toFiniteNumber(solvent?.solvent_impact_shift_percent);
  const configuredLifeShift = toFiniteNumber(solvent?.solvent_life_shift_percent);
  if (configuredImpactShift !== null || configuredLifeShift !== null) {
    return {
      key: 'custom',
      impact_shift: (configuredImpactShift ?? 0) / 100,
      life_shift: (configuredLifeShift ?? 0) / 100,
    };
  }

  const solventName = normalizeText(solvent?.name);
  const solventCategory = normalizeText(solvent?.category);
  const solventDescriptor = `${solventName} ${solventCategory}`.trim();

  if (!solventDescriptor) {
    return {
      key: 'neutral',
      impact_shift: 0,
      life_shift: 0,
    };
  }

  if (/(triethyl citrate|^tec\b|\btc\b)/i.test(solventDescriptor)) {
    return {
      key: 'tec',
      impact_shift: -0.12,
      life_shift: 0.05,
    };
  }

  if (/(dipropylene glycol|\bdpg\b)/i.test(solventDescriptor)) {
    return {
      key: 'dpg',
      impact_shift: -0.18,
      life_shift: 0.12,
    };
  }

  if (/(diethyl phthalate|\bdep\b)/i.test(solventDescriptor)) {
    return {
      key: 'dep',
      impact_shift: -0.09,
      life_shift: 0.08,
    };
  }

  if (/(ethanol|alcohol|sda[-\s]*40|isopropyl myristate|\bipm\b)/i.test(solventDescriptor)) {
    return {
      key: 'volatile',
      impact_shift: 0.14,
      life_shift: -0.16,
    };
  }

  return {
    key: 'neutral',
    impact_shift: -0.04,
    life_shift: 0.03,
  };
};

const blendAvailableMetric = (primaryValue, primaryShare, secondaryValue, secondaryShare) => {
  const pairs = [
    [toFiniteNumber(primaryValue), Math.max(Number(primaryShare) || 0, 0)],
    [toFiniteNumber(secondaryValue), Math.max(Number(secondaryShare) || 0, 0)],
  ].filter(([value, share]) => value !== null && share > 0);

  if (!pairs.length) {
    return toFiniteNumber(primaryValue) ?? toFiniteNumber(secondaryValue);
  }

  const totalShare = pairs.reduce((sum, [, share]) => sum + share, 0);
  if (totalShare <= 0) {
    return pairs[0]?.[0] ?? null;
  }

  const blendedValue = pairs.reduce((sum, [value, share]) => sum + (value * share), 0) / totalShare;
  return Number(blendedValue.toFixed(4));
};

const applySolventCalibration = (value, carrierShare, shift, floor = 0) => {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) {
    return null;
  }

  const share = Math.min(Math.max(Number(carrierShare) || 0, 0), 0.99);
  const modifier = 1 + (share * Number(shift || 0));
  return Number(Math.max(floor, numericValue * modifier).toFixed(4));
};

const resolveActualizedRowMetrics = ({
  item,
  rawMaterialsById,
  guidance,
  listedPercentage,
  listedGrams,
} = {}) => {
  const dilutionFactor = getFormulaItemDilutionFactor(item);
  const carrierShare = Math.max(0, 1 - dilutionFactor);
  const effectivePercentage = listedPercentage * dilutionFactor;
  const effectiveActiveGrams = listedGrams * dilutionFactor;
  const baseImpact = toFiniteNumber(guidance?.impact);
  const baseLifeHours = toFiniteNumber(guidance?.lifeHours);
  const dilutionSolvent = carrierShare > 0
    ? resolveFormulaItemDilutionSolvent(item, rawMaterialsById)
    : null;
  const solventGuidance = dilutionSolvent
    ? resolveRawMaterialGuidanceSnapshot(dilutionSolvent, null)
    : null;
  const solventBehaviour = inferSolventBehaviourProfile(dilutionSolvent);
  const solventImpact = toFiniteNumber(solventGuidance?.impact);
  const solventLifeHours = toFiniteNumber(solventGuidance?.lifeHours);
  const blendedImpact = carrierShare > 0
    ? blendAvailableMetric(baseImpact, dilutionFactor, solventImpact, carrierShare)
    : baseImpact;
  const blendedLifeHours = carrierShare > 0
    ? blendAvailableMetric(baseLifeHours, dilutionFactor, solventLifeHours, carrierShare)
    : baseLifeHours;
  const actualImpact = carrierShare > 0
    ? applySolventCalibration(blendedImpact, carrierShare, solventBehaviour.impact_shift)
    : blendedImpact;
  const actualLifeHours = carrierShare > 0
    ? applySolventCalibration(blendedLifeHours, carrierShare, solventBehaviour.life_shift)
    : blendedLifeHours;
  const impactContribution = actualImpact === null ? null : (listedPercentage / 100) * actualImpact;
  const odourWeight = impactContribution ?? effectivePercentage ?? effectiveActiveGrams;
  const lifeContribution = actualLifeHours === null ? null : (listedPercentage / 100) * actualLifeHours;
  const weightedLifeContribution = impactContribution === null || actualLifeHours === null
    ? null
    : impactContribution * actualLifeHours;

  return {
    dilutionFactor,
    effectivePercentage,
    effectiveActiveGrams,
    baseImpact,
    baseLifeHours,
    actualImpact,
    actualLifeHours,
    blendedImpact,
    blendedLifeHours,
    solventGuidance,
    solventBehaviour,
    dilutionSolvent,
    solventImpact,
    solventLifeHours,
    impactContribution,
    odourWeight,
    lifeContribution,
    weightedLifeContribution,
  };
};

export const buildReferenceAdvisories = (item) => {
  const referenceProfile = item?.reference_profile;
  if (!referenceProfile || item?.item_type !== 'raw_material') {
    return {
      effectivePercentage: null,
      advisories: [],
    };
  }

  const listedPercentage = Number(item?.percentage || 0);
  const dilutionFactor = getFormulaItemDilutionFactor(item);
  const effectivePercentage = listedPercentage * dilutionFactor;
  const advisories = buildGuidanceLimitAdvisories({
    referenceProfile,
    effectivePercentage,
  });

  return {
    effectivePercentage,
    advisories,
  };
};

const buildClassWeightMap = (rows) => {
  const classWeightMap = new Map();

  rows.forEach((row) => {
    const rowWeight = Number(row.odourWeight || 0);
    if (!rowWeight) {
      return;
    }

    (row.classDistribution || []).forEach((entry) => {
      const classIndex = Number(entry.classIndex || 0);
      const share = Number(entry.share || 0);
      if (!classIndex || share <= 0) {
        return;
      }

      classWeightMap.set(classIndex, (classWeightMap.get(classIndex) || 0) + (rowWeight * share) / 100);
    });
  });

  return classWeightMap;
};

const buildNormalizedClassShareMap = (rows) => {
  const classWeightMap = buildClassWeightMap(rows);
  const totalWeight = [...classWeightMap.values()].reduce((sum, value) => sum + value, 0);

  if (totalWeight <= 0) {
    return new Map();
  }

  return new Map(
    [...classWeightMap.entries()].map(([classIndex, weight]) => [classIndex, weight / totalWeight])
  );
};

const buildBridgeScore = (leftRows, rightRows) => {
  const leftShares = buildNormalizedClassShareMap(leftRows);
  const rightShares = buildNormalizedClassShareMap(rightRows);

  if (!leftShares.size || !rightShares.size) {
    return 0;
  }

  const classIndexes = new Set([...leftShares.keys(), ...rightShares.keys()]);
  let overlap = 0;

  classIndexes.forEach((classIndex) => {
    overlap += Math.min(leftShares.get(classIndex) || 0, rightShares.get(classIndex) || 0);
  });

  return clamp(overlap * 100);
};

const buildContributorDiversityScore = (rows) => {
  const positiveRows = rows.filter((row) => Number(row.odourWeight || 0) > 0);
  const totalWeight = positiveRows.reduce((sum, row) => sum + Number(row.odourWeight || 0), 0);

  if (!positiveRows.length || totalWeight <= 0) {
    return 0;
  }

  const concentration = positiveRows.reduce((sum, row) => {
    const share = Number(row.odourWeight || 0) / totalWeight;
    return sum + (share * share);
  }, 0);

  return clamp((1 - concentration) * 125);
};

const buildPhaseContributors = (rows, pyramidPlacement) => (
  rows
    .filter((row) => row.pyramidPlacement === pyramidPlacement)
    .sort((left, right) => Number(right.odourWeight || 0) - Number(left.odourWeight || 0))
    .slice(0, 3)
    .map((row) => ({
      itemId: row.item_id,
      name: row.name,
      weight: Number(row.odourWeight || 0),
      effectivePercentage: Number(row.effectivePercentage || 0),
      guidanceSource: row.guidanceSource,
      referenceCode: row.reference_profile?.reference_code || null,
    }))
);

const buildDominantClass = (rows) => {
  const classWeightMap = buildClassWeightMap(rows);
  const totalWeight = [...classWeightMap.values()].reduce((sum, value) => sum + value, 0);

  if (totalWeight <= 0) {
    return null;
  }

  let dominantEntry = null;
  rows.forEach((row) => {
    (row.classDistribution || []).forEach((entry) => {
      const weight = classWeightMap.get(Number(entry.classIndex || 0)) || 0;
      if (!weight) {
        return;
      }

      if (!dominantEntry || weight > dominantEntry.weight) {
        dominantEntry = {
          classIndex: entry.classIndex,
          familyName: entry.familyName,
          letter: entry.letter,
          weight,
          sharePercent: (weight / totalWeight) * 100,
        };
      }
    });
  });

  return dominantEntry;
};

const buildPaceAnalysis = ({
  rows,
  eligibleItemCount,
  missingGuidanceCount,
  coveragePercent,
  impactEstimate,
  odourWeightedLifeHours,
  topPercent,
  middlePercent,
  basePercent,
  advisories,
  ifraAdvisories,
}) => {
  const topRows = rows.filter((row) => row.pyramidPlacement === 'top');
  const middleRows = rows.filter((row) => row.pyramidPlacement === 'middle');
  const baseRows = rows.filter((row) => row.pyramidPlacement === 'base');
  const allRows = rows.filter((row) => Number(row.odourWeight || 0) > 0);
  const totalImpactContribution = allRows.reduce((sum, row) => sum + Number(row.impactContribution || 0), 0);
  const topImpactContribution = topRows.reduce((sum, row) => sum + Number(row.impactContribution || 0), 0);
  const openingImpactShare = totalImpactContribution > 0 ? (topImpactContribution / totalImpactContribution) * 100 : topPercent;
  const impactSignal = toScore(impactEstimate, 0, 12);
  const lifeSignal = toScore(odourWeightedLifeHours, 0, 240);
  const contributorDiversityScore = buildContributorDiversityScore(allRows);
  const topMiddleBridgeScore = buildBridgeScore(topRows, middleRows);
  const middleBaseBridgeScore = buildBridgeScore(middleRows, baseRows);
  const bridgeQualityScore = average([topMiddleBridgeScore, middleBaseBridgeScore]);
  const balancePenalty = (
    Math.abs(topPercent - 26)
    + Math.abs(middlePercent - 34)
    + Math.abs(basePercent - 40)
  ) / 3;
  const balanceScore = clamp(100 - (balancePenalty * 2.2));
  const referencePenalty = clamp(missingGuidanceCount * 6, 0, 24);
  const advisoryPenalty = clamp(advisories.length * 4, 0, 24);

  const openingScore = clamp((topPercent * 0.62) + (openingImpactShare * 0.38));
  const heartScore = clamp((middlePercent * 0.72) + (topMiddleBridgeScore * 0.28));
  const drydownScore = clamp((basePercent * 0.7) + (lifeSignal * 0.3));
  const diffusionScore = clamp((impactSignal * 0.45) + (((topPercent + (middlePercent * 0.6)) / 1.6) * 0.35) + (coveragePercent * 0.2));
  const tenacityScore = clamp((lifeSignal * 0.58) + (basePercent * 0.42));
  const harmonyScore = clamp((balanceScore * 0.52) + (contributorDiversityScore * 0.28) + (bridgeQualityScore * 0.2) - advisoryPenalty);
  const smoothnessScore = clamp((bridgeQualityScore * 0.5) + (balanceScore * 0.2) + (contributorDiversityScore * 0.15) + ((100 - referencePenalty) * 0.15) - (ifraAdvisories.length * 8));

  const dominantClass = buildDominantClass(allRows);
  const topContributor = allRows
    .filter((row) => Number(row.odourWeight || 0) > 0)
    .sort((left, right) => Number(right.odourWeight || 0) - Number(left.odourWeight || 0))[0] || null;
  const warningMap = new Map();
  const pushWarning = (warning) => {
    const key = `${warning.type}:${warning.code}`;
    if (!warningMap.has(key)) {
      warningMap.set(key, warning);
    }
  };

  advisories.forEach((advisory) => {
    if (advisory.type === 'ifra') {
      pushWarning({
        code: `ifra-${advisory.itemId}`,
        type: 'overload',
        severity: 'danger',
        title: `${advisory.itemName} exceeds IFRA guidance`,
        message: advisory.message,
      });
    } else if (advisory.type === 'max') {
      pushWarning({
        code: `max-${advisory.itemId}`,
        type: 'overload',
        severity: 'warning',
        title: `${advisory.itemName} exceeds max guidance`,
        message: advisory.message,
      });
    }
  });

  if (topContributor && Number(topContributor.effectivePercentage || 0) >= 25) {
    pushWarning({
      code: 'dominant-contributor',
      type: 'overload',
      severity: 'warning',
      title: `${topContributor.name} may dominate the formula`,
      message: `One contributor is carrying ${topContributor.effectivePercentage.toFixed(1)}% effective load, which can flatten nuance and reduce blend flexibility.`,
    });
  }

  if (dominantClass && dominantClass.sharePercent >= 42) {
    pushWarning({
      code: 'dominant-class',
      type: 'overload',
      severity: 'warning',
      title: `${dominantClass.familyName} is over-represented`,
      message: `${dominantClass.familyName} currently holds ${dominantClass.sharePercent.toFixed(1)}% of the odour-weighted class profile.`,
    });
  }

  if (bridgeQualityScore < 35) {
    pushWarning({
      code: 'weak-bridge',
      type: 'conflict',
      severity: 'warning',
      title: 'Bridge quality is weak',
      message: 'Top, heart, and drydown sections share too little common material language, so the transition may feel abrupt.',
    });
  }

  if (middlePercent < 18) {
    pushWarning({
      code: 'thin-heart',
      type: 'conflict',
      severity: 'warning',
      title: 'Heart development looks thin',
      message: 'Middle structure is underweighted, so the formula may jump from opening to drydown without enough body.',
    });
  }

  if (topPercent > 45 || basePercent > 55) {
    pushWarning({
      code: 'phase-imbalance',
      type: 'conflict',
      severity: 'warning',
      title: 'Pyramid balance is stretched',
      message: 'One phase is pulling too much load, which can reduce harmony and make the progression feel lopsided.',
    });
  }

  if (missingGuidanceCount > 0) {
    pushWarning({
      code: 'missing-guidance',
      type: 'guidance',
      severity: 'info',
      title: 'Some materials still need guidance',
      message: `${missingGuidanceCount} of ${eligibleItemCount} materials are still running without normalized guidance, so PACE confidence is reduced.`,
    });
  }

  const warnings = [...warningMap.values()];
  const overloadWarnings = warnings.filter((warning) => warning.type === 'overload');
  const conflictWarnings = warnings.filter((warning) => warning.type === 'conflict');
  const guidanceWarnings = warnings.filter((warning) => warning.type === 'guidance');
  const scores = [
    { key: 'opening', label: 'Opening', value: openingScore },
    { key: 'heart', label: 'Heart', value: heartScore },
    { key: 'drydown', label: 'Drydown', value: drydownScore },
    { key: 'diffusion', label: 'Diffusion', value: diffusionScore },
    { key: 'tenacity', label: 'Tenacity', value: tenacityScore },
    { key: 'harmony', label: 'Harmony', value: harmonyScore },
    { key: 'smoothness', label: 'Smoothness', value: smoothnessScore },
    { key: 'bridgeQuality', label: 'Bridge Quality', value: bridgeQualityScore },
  ];
  const strongestAxis = [...scores].sort((left, right) => right.value - left.value)[0] || null;
  const weakestAxis = [...scores].sort((left, right) => left.value - right.value)[0] || null;

  return {
    openingScore,
    heartScore,
    drydownScore,
    diffusionScore,
    tenacityScore,
    harmonyScore,
    smoothnessScore,
    bridgeQualityScore,
    topMiddleBridgeScore,
    middleBaseBridgeScore,
    contributorDiversityScore,
    balanceScore,
    impactSignal,
    lifeSignal,
    warnings,
    overloadWarnings,
    conflictWarnings,
    guidanceWarnings,
    warningCount: warnings.length,
    openingContributors: buildPhaseContributors(allRows, 'top'),
    heartContributors: buildPhaseContributors(allRows, 'middle'),
    drydownContributors: buildPhaseContributors(allRows, 'base'),
    strongestAxis,
    weakestAxis,
    dominantClass,
    scores,
  };
};

export const buildWorkbookSimulation = ({ items, rawMaterialsById, referenceLinksMap }) => {
  const eligibleItems = (items || []).filter((item) => (
    (item?.item_type === 'raw_material' || item?.item_type === 'solvent')
    && item?.item_id
  ));

  const rows = eligibleItems.map((item) => {
    const rawMaterial = rawMaterialsById?.get(item.item_id) || null;
    const referenceLink = referenceLinksMap?.get(item.item_id) || null;
    const guidance = resolveRawMaterialGuidanceSnapshot(rawMaterial, referenceLink);
    const referenceProfile = guidance.referenceProfile;
    const guidanceSource = guidance.guidanceSource;
    const guidanceSourceKey = getGuidanceSourceKey(referenceProfile, guidanceSource);
    const listedPercentage = Number(item.percentage || 0);
    const listedGrams = Number(item.gram_amount ?? item.grams ?? 0);
    const actualizedMetrics = resolveActualizedRowMetrics({
      item,
      rawMaterialsById,
      guidance,
      listedPercentage,
      listedGrams,
    });
    const pyramidPlacement = guidance.pyramidPlacement;
    const classDistribution = guidance.classDistribution.length
      ? guidance.classDistribution
      : extractWorkbookClassDistribution(referenceProfile);
    const advisoryPayload = buildReferenceAdvisories({
      ...item,
      reference_profile: referenceProfile,
      dilution_percentage: item.dilution_percentage ?? item.dilution_percent ?? null,
    });

    return {
      ...item,
      name: rawMaterial?.name || item.name || 'Unknown material',
      raw_material: rawMaterial,
      reference_link: referenceLink,
      reference_profile: referenceProfile,
      guidanceSource,
      guidanceSourceKey,
      guidanceSourceLabel: getGuidanceSourceLabel(guidanceSourceKey),
      listedPercentage,
      listedGrams,
      dilutionFactor: actualizedMetrics.dilutionFactor,
      effectivePercentage: actualizedMetrics.effectivePercentage,
      effectiveActiveGrams: actualizedMetrics.effectiveActiveGrams,
      impact: actualizedMetrics.actualImpact,
      lifeHours: actualizedMetrics.actualLifeHours,
      baseImpact: actualizedMetrics.baseImpact,
      baseLifeHours: actualizedMetrics.baseLifeHours,
      blendedImpact: actualizedMetrics.blendedImpact,
      blendedLifeHours: actualizedMetrics.blendedLifeHours,
      impactContribution: actualizedMetrics.impactContribution,
      odourWeight: actualizedMetrics.odourWeight,
      lifeContribution: actualizedMetrics.lifeContribution,
      weightedLifeContribution: actualizedMetrics.weightedLifeContribution,
      dilutionSolvent: actualizedMetrics.dilutionSolvent,
      dilutionSolventGuidance: actualizedMetrics.solventGuidance,
      dilutionSolventBehaviour: actualizedMetrics.solventBehaviour,
      dilutionSolventImpact: actualizedMetrics.solventImpact,
      dilutionSolventLifeHours: actualizedMetrics.solventLifeHours,
      pyramidPlacement,
      classDistribution,
      effectivePercentageForAdvisory: advisoryPayload.effectivePercentage,
      advisories: advisoryPayload.advisories,
    };
  });

  const guidanceRows = rows.filter((row) => row.reference_profile);
  const linkedProfileCount = rows.filter((row) => row.guidanceSource === 'linked_profile').length;
  const fallbackGuidanceCount = rows.filter((row) => row.guidanceSource === 'raw_material_fallback').length;
  const missingGuidanceCount = rows.filter((row) => row.guidanceSource === 'none').length;
  const guidanceSourceCounts = guidanceRows.reduce((counts, row) => ({
    ...counts,
    [row.guidanceSourceKey]: Number(counts[row.guidanceSourceKey] || 0) + 1,
  }), {});
  const hasImpactData = guidanceRows.some((row) => row.impact !== null);
  const hasLifeData = guidanceRows.some((row) => row.lifeHours !== null);
  const totalImpactContribution = guidanceRows.reduce((sum, row) => sum + (row.impactContribution || 0), 0);
  const totalWeightedLifeContribution = guidanceRows.reduce((sum, row) => sum + (row.weightedLifeContribution || 0), 0);
  const totalLifeContribution = guidanceRows.reduce((sum, row) => sum + (row.lifeContribution || 0), 0);
  const totalPyramidOdourWeight = guidanceRows.reduce((sum, row) => sum + (row.odourWeight || 0), 0);
  const topAmount = guidanceRows
    .filter((row) => row.pyramidPlacement === 'top')
    .reduce((sum, row) => sum + (row.odourWeight || 0), 0);
  const middleAmount = guidanceRows
    .filter((row) => row.pyramidPlacement === 'middle')
    .reduce((sum, row) => sum + (row.odourWeight || 0), 0);
  const baseAmount = guidanceRows
    .filter((row) => row.pyramidPlacement === 'base')
    .reduce((sum, row) => sum + (row.odourWeight || 0), 0);

  const advisories = guidanceRows.flatMap((row) => row.advisories.map((advisory) => ({
    ...advisory,
    itemName: row.name,
    itemId: row.item_id,
    referenceCode: row.reference_profile?.reference_code || null,
    effectivePercentage: row.effectivePercentageForAdvisory,
    guidanceSource: row.guidanceSource,
  })));

  const topImpactContributors = guidanceRows
    .filter((row) => row.impactContribution !== null && row.impactContribution !== undefined)
    .sort((left, right) => Number(right.impactContribution || 0) - Number(left.impactContribution || 0))
    .slice(0, 5);
  const coveragePercent = eligibleItems.length ? (guidanceRows.length / eligibleItems.length) * 100 : 0;
  const impactEstimate = hasImpactData ? (totalImpactContribution || 0) : null;
  const simpleLifeHours = hasLifeData ? (totalLifeContribution || 0) : null;
  const odourWeightedLifeHours = totalImpactContribution > 0 ? totalWeightedLifeContribution / totalImpactContribution : null;
  const topPercent = totalPyramidOdourWeight > 0 ? (topAmount / totalPyramidOdourWeight) * 100 : 0;
  const middlePercent = totalPyramidOdourWeight > 0 ? (middleAmount / totalPyramidOdourWeight) * 100 : 0;
  const basePercent = totalPyramidOdourWeight > 0 ? (baseAmount / totalPyramidOdourWeight) * 100 : 0;
  const pace = buildPaceAnalysis({
    rows: guidanceRows,
    eligibleItemCount: eligibleItems.length,
    missingGuidanceCount,
    coveragePercent,
    impactEstimate,
    odourWeightedLifeHours,
    topPercent,
    middlePercent,
    basePercent,
    advisories,
    ifraAdvisories: advisories.filter((advisory) => advisory.type === 'ifra'),
  });

  return {
    eligibleItemCount: eligibleItems.length,
    linkedItemCount: guidanceRows.length,
    guidanceBackedCount: guidanceRows.length,
    linkedProfileCount,
    fallbackGuidanceCount,
    guidanceSourceCounts,
    perfumersWorldGuidanceCount: guidanceSourceCounts.perfumersworld || 0,
    tgscGuidanceCount: guidanceSourceCounts.tgsc || 0,
    scentreeGuidanceCount: guidanceSourceCounts.scentree || 0,
    manualGuidanceCount: guidanceSourceCounts.manual || 0,
    referenceGuidanceCount: guidanceSourceCounts.reference || 0,
    missingGuidanceCount,
    hasImpactData,
    hasLifeData,
    coveragePercent,
    impactEstimate,
    simpleLifeHours,
    odourWeightedLifeHours,
    topAmount,
    middleAmount,
    baseAmount,
    topPercent,
    middlePercent,
    basePercent,
    advisories,
    ifraAdvisories: advisories.filter((advisory) => advisory.type === 'ifra'),
    maxUseAdvisories: advisories.filter((advisory) => advisory.type === 'max'),
    typicalUseAdvisories: advisories.filter((advisory) => advisory.type === 'typical'),
    topImpactContributors,
    pace,
    warningCount: pace.warningCount,
    performanceWarnings: pace.warnings,
    rows,
  };
};
