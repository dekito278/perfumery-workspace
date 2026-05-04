import { getResolvedGuidanceNumber, getResolvedGuidanceValues } from '@/utils/mobileRawMaterialGuidance.js';

const ODOR_KEYS = ['floral', 'citrus', 'woody', 'musky', 'sweet', 'fresh', 'spicy', 'amber'];

const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const numberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const getDilutionMedium = (item) => item.dilution_medium || item.medium || item.solvent_name || 'DPG';

export const getDilutionLabel = (item = {}) => {
  const concentration = getItemConcentration(item);
  const medium = titleCase(getDilutionMedium(item));

  if (concentration >= 99.99 || (item.dilution_type || 'neat') === 'neat') {
    return 'Neat';
  }

  if (!concentration) {
    return 'Set dilution';
  }

  return `${Number(concentration.toFixed(2)).toString()}% ${medium}`;
};

export const getImpactLabel = (score = null) => {
  if (!Number.isFinite(Number(score))) return 'No data';
  if (score >= 75) return 'High';
  if (score >= 45) return 'Medium';
  if (score > 0) return 'Low';
  return 'None';
};

export const getLifetimeLabel = (score = null) => {
  if (!Number.isFinite(Number(score))) return 'No data';
  if (score >= 70) return 'Long';
  if (score >= 40) return 'Medium';
  if (score > 0) return 'Short';
  return 'Unknown';
};

const inferOdorProfile = (material = {}) => {
  const resolved = getResolvedGuidanceValues(material);
  const text = [
    material.name,
    material.category,
    resolved.reference_abc_primary_family,
    material.reference_abc_secondary_family,
    material.odour_description,
    material.guidance_reference_profile?.brief_description,
    material.guidance_reference_profile?.odour_description,
    material.guidance_reference_profile?.odour_profile,
  ].filter(Boolean).join(' ').toLowerCase();

  return ODOR_KEYS.reduce((profile, key) => {
    profile[key] = text.includes(key) ? 1 : 0;
    return profile;
  }, {});
};

export const getItemConcentration = (item) => {
  if ((item.dilution_type || 'neat') === 'neat') return 100;
  return clamp(numberOrZero(item.concentration_percent || item.dilution_percent), 0, 100);
};

export const enrichCompositionItems = (items = [], totalGrams = 0, materialsById = new Map()) =>
  items.map((item) => {
    const material = materialsById.get(item.item_id) || {};
    const resolved = getResolvedGuidanceValues(material);
    const gram = numberOrZero(item.gram_amount ?? item.grams);
    const formulaPercent = totalGrams > 0 ? (gram / totalGrams) * 100 : numberOrZero(item.percentage);
    const concentrationPercent = getItemConcentration(item);
    const actualActiveGram = (gram * concentrationPercent) / 100;
    const actualActivePercent = (formulaPercent * concentrationPercent) / 100;
    const impactValue = numberOrNull(getResolvedGuidanceNumber(material, 'reference_impact') ?? item.impactValue ?? material.impact_value);
    const lifetimeValue = numberOrNull(getResolvedGuidanceNumber(material, 'reference_life_hours') ?? item.lifetimeValue ?? material.lifetime_value);
    const hasGuidanceData = Boolean(
      resolved.workbook_code
      || resolved.reference_abc_primary_family
      || impactValue !== null
      || lifetimeValue !== null
    );
    const warnings = [
      concentrationPercent <= 0 ? 'Missing concentration' : null,
      (item.dilution_type || 'neat') !== 'neat' && !numberOrZero(item.concentration_percent || item.dilution_percent) ? 'Dilution needs %' : null,
      actualActivePercent > 25 ? 'Over active' : null,
      !hasGuidanceData ? 'Missing workbook guidance' : null,
    ].filter(Boolean);

    return {
      ...item,
      material,
      materialName: material.name || item.materialName || 'Material',
      category: material.category || item.category || 'Uncategorized',
      role: item.role || resolved.reference_abc_primary_family || item.item_type || 'modifier',
      gram,
      formulaPercent,
      concentrationPercent,
      dilutionMedium: getDilutionMedium(item),
      dilutionLabel: getDilutionLabel(item),
      actualActiveGram,
      actualActivePercent,
      impactValue,
      lifetimeValue,
      hasGuidanceData,
      odorProfile: material.odorProfile || inferOdorProfile(material),
      warnings,
      notes: item.notes || '',
    };
  });

export const buildFormulaInsight = (compositionItems = [], guidanceSources = []) => {
  const totalPercent = compositionItems.reduce((sum, item) => sum + numberOrZero(item.formulaPercent), 0);
  const totalGrams = compositionItems.reduce((sum, item) => sum + numberOrZero(item.gram), 0);
  const totalActualActiveGrams = compositionItems.reduce((sum, item) => sum + numberOrZero(item.actualActiveGram), 0);
  const totalActualActive = compositionItems.reduce((sum, item) => sum + numberOrZero(item.actualActivePercent), 0);
  const impactRows = compositionItems.filter((item) => Number.isFinite(Number(item.impactValue)) && Number(item.actualActivePercent || 0) > 0);
  const lifetimeRows = compositionItems.filter((item) => Number.isFinite(Number(item.lifetimeValue)) && Number(item.actualActivePercent || 0) > 0);
  const impactWeight = impactRows.reduce((sum, item) => sum + numberOrZero(item.actualActivePercent), 0);
  const lifetimeWeight = lifetimeRows.reduce((sum, item) => sum + numberOrZero(item.actualActivePercent), 0);
  const impactScore = impactWeight > 0
    ? clamp(impactRows.reduce((sum, item) => sum + Number(item.impactValue) * numberOrZero(item.actualActivePercent), 0) / impactWeight)
    : null;
  const lifetimeScore = lifetimeWeight > 0
    ? clamp(lifetimeRows.reduce((sum, item) => sum + Number(item.lifetimeValue) * numberOrZero(item.actualActivePercent), 0) / lifetimeWeight)
    : null;
  const topMiddleBaseRaw = compositionItems.reduce((acc, item) => {
    const role = String(item.role || '').toLowerCase();
    const bucket = role.includes('top') || role.includes('citrus') || role.includes('fresh')
      ? 'top'
      : role.includes('base') || role.includes('woody') || role.includes('musk') || role.includes('amber')
        ? 'base'
        : 'middle';
    acc[bucket] += item.actualActivePercent || 0;
    return acc;
  }, { top: 0, middle: 0, base: 0 });
  const topMiddleBaseDistribution = Object.fromEntries(
    Object.entries(topMiddleBaseRaw).map(([key, value]) => [key, totalActualActive > 0 ? (value / totalActualActive) * 100 : 0])
  );
  const odorProfileGraph = ODOR_KEYS.map((key) => ({
    key,
    label: key[0].toUpperCase() + key.slice(1),
    value: clamp(totalActualActive > 0
      ? (compositionItems.reduce((sum, item) => sum + (item.odorProfile?.[key] || 0) * (item.actualActivePercent || 0), 0) / totalActualActive) * 100
      : 0),
  })).sort((a, b) => b.value - a.value);
  const dominantNotes = odorProfileGraph.filter((entry) => entry.value > 0).slice(0, 3);
  const itemWarnings = compositionItems.flatMap((item) => item.warnings.map((warning) => `${item.materialName}: ${warning}`));
  const totalWarning = Math.abs(totalPercent - 100) > 0.25 ? [`Formula total ${totalPercent.toFixed(1)}%`] : [];
  const warnings = [...totalWarning, ...itemWarnings];
  const dominantTmb = Object.entries(topMiddleBaseDistribution).sort((a, b) => b[1] - a[1])[0];
  const balanceStatus = !compositionItems.length
    ? 'Needs adjustment'
    : warnings.length
      ? 'Needs adjustment'
      : dominantTmb?.[1] > 55
        ? `${titleCase(dominantTmb[0])}-heavy`
        : 'Balanced';
  const recommendation = balanceStatus === 'Balanced'
    ? 'Distribution is ready for validation.'
    : balanceStatus.includes('Base')
      ? 'Reduce heavy base materials or increase fresh top notes.'
      : balanceStatus.includes('Top')
        ? 'Add middle or base support for better persistence.'
        : 'Review dilution, missing metadata, or unbalanced material roles.';

  return {
    totalPercent,
    totalGrams,
    totalActualActiveGrams,
    totalActualActive,
    hasImpactData: impactScore !== null,
    impactScore,
    impactLabel: getImpactLabel(impactScore),
    hasLifetimeData: lifetimeScore !== null,
    lifetimeScore,
    lifetimeLabel: getLifetimeLabel(lifetimeScore),
    balanceStatus,
    recommendation,
    topMiddleBaseDistribution,
    odorProfileGraph,
    dominantNotes,
    warnings,
    documentGroup: {
      status: guidanceSources.length ? 'Imported' : 'Not connected',
      count: guidanceSources.length,
      updatedAt: guidanceSources[0]?.updatedAt,
    },
    guidanceSources,
  };
};

export const createGuidanceSource = ({ url, sourceType, notes, imported }) => ({
  id: `${Date.now()}`,
  url,
  sourceType,
  notes,
  imported,
  status: 'Imported',
  updatedAt: new Date().toISOString(),
});
