const toFiniteNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

export const inferReferencePyramidPlacement = (lifeHours) => {
  const numericLifeHours = toFiniteNumber(lifeHours);
  if (numericLifeHours === null) {
    return null;
  }

  if (numericLifeHours < 12) {
    return 'top';
  }

  if (numericLifeHours < 120) {
    return 'middle';
  }

  return 'base';
};

export const getFormulaItemDilutionFactor = (item) => {
  const dilutionPercent = toFiniteNumber(item?.dilution_percent ?? item?.dilution_percentage);
  if (dilutionPercent === null || dilutionPercent <= 0) {
    return 1;
  }

  return dilutionPercent / 100;
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
  const advisories = [];

  if (
    referenceProfile.use_level_typical_percent !== null
    && referenceProfile.use_level_typical_percent !== undefined
    && effectivePercentage > Number(referenceProfile.use_level_typical_percent || 0)
  ) {
    advisories.push({
      type: 'typical',
      severity: 'info',
      label: 'Above typical use level',
      limit: Number(referenceProfile.use_level_typical_percent),
      message: `Effective concentration ${effectivePercentage.toFixed(2)}% is above the typical reference level of ${Number(referenceProfile.use_level_typical_percent).toFixed(2)}%.`,
    });
  }

  if (
    referenceProfile.use_level_max_percent !== null
    && referenceProfile.use_level_max_percent !== undefined
    && effectivePercentage > Number(referenceProfile.use_level_max_percent || 0)
  ) {
    advisories.push({
      type: 'max',
      severity: 'warning',
      label: 'Above max use level',
      limit: Number(referenceProfile.use_level_max_percent),
      message: `Effective concentration ${effectivePercentage.toFixed(2)}% is above the suggested max reference level of ${Number(referenceProfile.use_level_max_percent).toFixed(2)}%.`,
    });
  }

  if (
    referenceProfile.ifra_limit_percent !== null
    && referenceProfile.ifra_limit_percent !== undefined
    && effectivePercentage > Number(referenceProfile.ifra_limit_percent || 0)
  ) {
    advisories.push({
      type: 'ifra',
      severity: 'danger',
      label: 'Above IFRA reference limit',
      limit: Number(referenceProfile.ifra_limit_percent),
      message: `Effective concentration ${effectivePercentage.toFixed(2)}% is above the reference IFRA limit of ${Number(referenceProfile.ifra_limit_percent).toFixed(2)}%.`,
    });
  }

  return {
    effectivePercentage,
    advisories,
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
    const referenceProfile = referenceLink?.reference_profile || null;
    const listedPercentage = Number(item.percentage || 0);
    const listedGrams = Number(item.gram_amount ?? item.grams ?? 0);
    const dilutionFactor = getFormulaItemDilutionFactor(item);
    const effectivePercentage = listedPercentage * dilutionFactor;
    const effectiveActiveGrams = listedGrams * dilutionFactor;
    const impact = toFiniteNumber(referenceProfile?.impact);
    const lifeHours = toFiniteNumber(referenceProfile?.life_hours);
    const impactContribution = impact === null ? null : (effectivePercentage / 100) * impact;
    const lifeContribution = lifeHours === null ? null : (effectivePercentage / 100) * lifeHours;
    const weightedLifeContribution = impactContribution === null || lifeHours === null
      ? null
      : impactContribution * lifeHours;
    const pyramidPlacement = inferReferencePyramidPlacement(lifeHours);
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
      listedPercentage,
      listedGrams,
      dilutionFactor,
      effectivePercentage,
      effectiveActiveGrams,
      impact,
      lifeHours,
      impactContribution,
      lifeContribution,
      weightedLifeContribution,
      pyramidPlacement,
      effectivePercentageForAdvisory: advisoryPayload.effectivePercentage,
      advisories: advisoryPayload.advisories,
    };
  });

  const linkedRows = rows.filter((row) => row.reference_profile);
  const totalImpactContribution = linkedRows.reduce((sum, row) => sum + (row.impactContribution || 0), 0);
  const totalWeightedLifeContribution = linkedRows.reduce((sum, row) => sum + (row.weightedLifeContribution || 0), 0);
  const totalLifeContribution = linkedRows.reduce((sum, row) => sum + (row.lifeContribution || 0), 0);
  const totalPyramidActive = linkedRows.reduce((sum, row) => sum + (row.effectiveActiveGrams || 0), 0);
  const topAmount = linkedRows
    .filter((row) => row.pyramidPlacement === 'top')
    .reduce((sum, row) => sum + (row.effectiveActiveGrams || 0), 0);
  const middleAmount = linkedRows
    .filter((row) => row.pyramidPlacement === 'middle')
    .reduce((sum, row) => sum + (row.effectiveActiveGrams || 0), 0);
  const baseAmount = linkedRows
    .filter((row) => row.pyramidPlacement === 'base')
    .reduce((sum, row) => sum + (row.effectiveActiveGrams || 0), 0);

  const advisories = linkedRows.flatMap((row) => row.advisories.map((advisory) => ({
    ...advisory,
    itemName: row.name,
    itemId: row.item_id,
    referenceCode: row.reference_profile?.reference_code || null,
    effectivePercentage: row.effectivePercentageForAdvisory,
  })));

  const topImpactContributors = linkedRows
    .filter((row) => row.impactContribution !== null && row.impactContribution !== undefined)
    .sort((left, right) => Number(right.impactContribution || 0) - Number(left.impactContribution || 0))
    .slice(0, 5);

  return {
    eligibleItemCount: eligibleItems.length,
    linkedItemCount: linkedRows.length,
    coveragePercent: eligibleItems.length ? (linkedRows.length / eligibleItems.length) * 100 : 0,
    impactEstimate: totalImpactContribution || 0,
    simpleLifeHours: totalLifeContribution || 0,
    odourWeightedLifeHours: totalImpactContribution > 0 ? totalWeightedLifeContribution / totalImpactContribution : null,
    topAmount,
    middleAmount,
    baseAmount,
    topPercent: totalPyramidActive > 0 ? (topAmount / totalPyramidActive) * 100 : 0,
    middlePercent: totalPyramidActive > 0 ? (middleAmount / totalPyramidActive) * 100 : 0,
    basePercent: totalPyramidActive > 0 ? (baseAmount / totalPyramidActive) * 100 : 0,
    advisories,
    ifraAdvisories: advisories.filter((advisory) => advisory.type === 'ifra'),
    maxUseAdvisories: advisories.filter((advisory) => advisory.type === 'max'),
    typicalUseAdvisories: advisories.filter((advisory) => advisory.type === 'typical'),
    topImpactContributors,
    rows,
  };
};
