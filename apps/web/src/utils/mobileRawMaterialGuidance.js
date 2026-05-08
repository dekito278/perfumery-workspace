import { getReferenceMatchStatusMap } from '@/services/materialReferenceService.js';
import { buildFallbackReferenceProfileFromRawMaterial } from '@/utils/referenceGuidance.js';
import { resolveRawMaterialGuidanceSnapshot } from '@/utils/rawMaterialGuidanceResolver.js';
import { extractWorkbookClassDistribution } from '@/utils/workbookAbcClassification.js';

const hasPositiveNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
};

const positiveOrNull = (value) => (hasPositiveNumber(value) ? Number(value) : null);
const firstPositive = (...values) => {
  const value = values.find((entry) => hasPositiveNumber(entry));
  return positiveOrNull(value);
};
const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || null;

export const getResolvedGuidanceValues = (material = {}) => {
  const resolved = material.guidance_resolved_values || {};
  const profile = material.guidance_reference_profile || {};
  const snapshot = resolveRawMaterialGuidanceSnapshot(material, material.reference_link || null);

  return {
    workbook_code: firstText(material.workbook_code, resolved.workbook_code, profile.reference_code, snapshot.referenceProfile?.reference_code),
    cas_number: firstText(material.cas_number, resolved.cas_number, profile.cas_no, profile.cas_number, snapshot.referenceProfile?.cas_no, snapshot.referenceProfile?.cas_number),
    ifra_limit: firstPositive(material.ifra_limit, resolved.ifra_limit, profile.ifra_limit_percent, snapshot.ifraLimitPercent),
    reference_abc_primary_family: firstText(material.reference_abc_primary_family, material.scent_family, resolved.reference_abc_primary_family, profile.abc_primary_family, snapshot.family),
    reference_impact: firstPositive(material.reference_impact, resolved.reference_impact, profile.impact, snapshot.impact),
    reference_life_hours: firstPositive(material.reference_life_hours, resolved.reference_life_hours, profile.life_hours, snapshot.lifeHours),
    reference_use_level_typical_percent: firstPositive(material.reference_use_level_typical_percent, resolved.reference_use_level_typical_percent, profile.use_level_typical_percent, snapshot.useLevelTypicalPercent),
    reference_use_level_max_percent: firstPositive(material.reference_use_level_max_percent, resolved.reference_use_level_max_percent, profile.use_level_max_percent, snapshot.useLevelMaxPercent),
  };
};

export const getResolvedGuidanceNumber = (material, fieldKey) => {
  return positiveOrNull(getResolvedGuidanceValues(material)[fieldKey]);
};

export const enrichMaterialsWithGuidance = async (materials = []) => {
  const ids = materials.map((material) => material?.id).filter(Boolean);
  if (!ids.length) {
    return materials;
  }

  const referenceStatusMap = await getReferenceMatchStatusMap(ids);

  return materials.map((material) => {
    const referenceProfile = referenceStatusMap.get(material.id)?.reference_profile
      || buildFallbackReferenceProfileFromRawMaterial(material);
    const snapshot = resolveRawMaterialGuidanceSnapshot({
      ...material,
      guidance_reference_profile: referenceProfile,
    }, referenceStatusMap.get(material.id) || null);
    const classDistribution = extractWorkbookClassDistribution(referenceProfile);
    const resolvedValues = {
      workbook_code: firstText(material.workbook_code, referenceProfile?.reference_code),
      cas_number: firstText(material.cas_number, referenceProfile?.cas_no, referenceProfile?.cas_number),
      ifra_limit: firstPositive(material.ifra_limit, referenceProfile?.ifra_limit_percent, snapshot.ifraLimitPercent),
      reference_abc_primary_family: firstText(material.reference_abc_primary_family, material.scent_family, referenceProfile?.abc_primary_family, snapshot.family, classDistribution.primaryFamily),
      reference_impact: firstPositive(material.reference_impact, referenceProfile?.impact, snapshot.impact),
      reference_life_hours: firstPositive(material.reference_life_hours, referenceProfile?.life_hours, snapshot.lifeHours),
      reference_use_level_typical_percent: firstPositive(material.reference_use_level_typical_percent, referenceProfile?.use_level_typical_percent, snapshot.useLevelTypicalPercent),
      reference_use_level_max_percent: firstPositive(material.reference_use_level_max_percent, referenceProfile?.use_level_max_percent, snapshot.useLevelMaxPercent),
    };

    return {
      ...material,
      guidance_reference_profile: referenceProfile,
      guidance_resolved_values: resolvedValues,
    };
  });
};
