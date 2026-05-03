import { getReferenceMatchStatusMap } from '@/services/materialReferenceService.js';
import { buildFallbackReferenceProfileFromRawMaterial } from '@/utils/referenceGuidance.js';
import { resolveRawMaterialGuidanceSnapshot } from '@/utils/rawMaterialGuidanceResolver.js';
import { extractWorkbookClassDistribution } from '@/utils/workbookAbcClassification.js';

const hasPositiveNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
};

const positiveOrNull = (value) => (hasPositiveNumber(value) ? Number(value) : null);

export const getResolvedGuidanceValues = (material = {}) => {
  const resolved = material.guidance_resolved_values || {};
  const profile = material.guidance_reference_profile || {};
  const snapshot = resolveRawMaterialGuidanceSnapshot(material, material.reference_link || null);

  return {
    workbook_code: resolved.workbook_code || profile.reference_code || snapshot.referenceProfile?.reference_code || material.workbook_code || null,
    cas_number: resolved.cas_number || profile.cas_no || profile.cas_number || snapshot.referenceProfile?.cas_no || snapshot.referenceProfile?.cas_number || material.cas_number || null,
    ifra_limit: positiveOrNull(resolved.ifra_limit ?? profile.ifra_limit_percent ?? snapshot.ifraLimitPercent ?? material.ifra_limit),
    reference_abc_primary_family: resolved.reference_abc_primary_family || profile.abc_primary_family || snapshot.family || material.reference_abc_primary_family || material.scent_family || null,
    reference_impact: positiveOrNull(resolved.reference_impact ?? profile.impact ?? snapshot.impact ?? material.reference_impact),
    reference_life_hours: positiveOrNull(resolved.reference_life_hours ?? profile.life_hours ?? snapshot.lifeHours ?? material.reference_life_hours),
    reference_use_level_typical_percent: positiveOrNull(resolved.reference_use_level_typical_percent ?? profile.use_level_typical_percent ?? snapshot.useLevelTypicalPercent ?? material.reference_use_level_typical_percent),
    reference_use_level_max_percent: positiveOrNull(resolved.reference_use_level_max_percent ?? profile.use_level_max_percent ?? snapshot.useLevelMaxPercent ?? material.reference_use_level_max_percent),
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
      workbook_code: referenceProfile?.reference_code || material.workbook_code || null,
      cas_number: referenceProfile?.cas_no || referenceProfile?.cas_number || material.cas_number || null,
      ifra_limit: positiveOrNull(referenceProfile?.ifra_limit_percent ?? snapshot.ifraLimitPercent ?? material.ifra_limit),
      reference_abc_primary_family: referenceProfile?.abc_primary_family || snapshot.family || material.reference_abc_primary_family || classDistribution.primaryFamily || null,
      reference_impact: positiveOrNull(referenceProfile?.impact ?? snapshot.impact ?? material.reference_impact),
      reference_life_hours: positiveOrNull(referenceProfile?.life_hours ?? snapshot.lifeHours ?? material.reference_life_hours),
      reference_use_level_typical_percent: positiveOrNull(referenceProfile?.use_level_typical_percent ?? snapshot.useLevelTypicalPercent ?? material.reference_use_level_typical_percent),
      reference_use_level_max_percent: positiveOrNull(referenceProfile?.use_level_max_percent ?? snapshot.useLevelMaxPercent ?? material.reference_use_level_max_percent),
    };

    return {
      ...material,
      guidance_reference_profile: referenceProfile,
      guidance_resolved_values: resolvedValues,
    };
  });
};
