import { resolveMaterialCompositionProfile } from '@/utils/materialCompositionProfile.js';
import { buildGuidanceLimitAdvisories, getDilutionFactor } from '@/utils/rawMaterialGuidanceAdvisories.js';

const STAGE_GRAM_BASE = {
  top: 0.54,
  middle: 0.96,
  base: 0.82,
};

const ROLE_GRAM_MULTIPLIER = {
  hero: 1.2,
  support: 1.05,
  bridge: 0.92,
  blender: 0.9,
  modifier: 0.82,
  diffuser: 0.72,
  fixative: 0.88,
  linear_substrate: 1.08,
};

const clamp = (value, min, max) => Math.min(Math.max(Number(value || 0), min), max);

const resolveSeedGramAmount = (item, material, referenceLink = null) => {
  const stageBase = STAGE_GRAM_BASE[item.stage] ?? 1;
  const roleMultiplier = ROLE_GRAM_MULTIPLIER[item.role] ?? 1;
  const rankOrder = Number(item.rank_order);
  const rankBoost = Number.isFinite(rankOrder)
    ? Math.max(0.76, 1.08 - (rankOrder * 0.035))
    : 1;
  const manualBoost = item.selection_state === 'manual' ? 1.08 : 1;
  const fitScore = Number(item.fit_score);
  const fitBoost = Number.isFinite(fitScore)
    ? Math.min(1.16, Math.max(0.9, 0.92 + (fitScore * 0.018)))
    : 1;
  const profile = material ? resolveMaterialCompositionProfile(material, referenceLink) : null;
  const impactRatio = profile?.impact === null || profile?.impact === undefined
    ? 1
    : clamp(1.08 - (Math.min(Number(profile.impact), 100) / 240), 0.62, 1.06);
  const lifeRatio = profile?.life_hours === null || profile?.life_hours === undefined
    ? 1
    : clamp(1.04 - (Math.min(Number(profile.life_hours), 240) / 420), 0.6, 1.04);
  const dilutionRatio = material?.is_diluted
    ? clamp(0.92 + ((100 - Number(material?.dilution_percentage || 100)) / 400), 0.84, 1.08)
    : 1;
  let seededGrams = stageBase * roleMultiplier * rankBoost * manualBoost * fitBoost * impactRatio * lifeRatio * dilutionRatio;

  if (profile?.reference_profile) {
    const estimatedEffectivePercentage = Math.max(
      0.15,
      ((seededGrams / 3.2) * 100) * getDilutionFactor(material?.dilution_percentage),
    );
    const advisories = buildGuidanceLimitAdvisories({
      referenceProfile: profile.reference_profile,
      effectivePercentage: estimatedEffectivePercentage,
    });
    const guidanceRatio = advisories.reduce((ratio, advisory) => {
      if (advisory.type === 'ifra') {
        return ratio * 0.48;
      }
      if (advisory.type === 'max') {
        return ratio * 0.68;
      }
      if (advisory.type === 'typical') {
        return ratio * 0.86;
      }
      return ratio;
    }, 1);
    seededGrams *= guidanceRatio;
  }

  return String(Math.round(Math.max(seededGrams, 0.03) * 1000) / 1000);
};

export const buildComposerItemsFromProjectStageItems = (stageItems = [], rawMaterials = [], referenceLinksMap = new Map()) => {
  const rawMaterialsById = new Map((rawMaterials || []).map((material) => [material.id, material]));

  return (stageItems || [])
    .filter((item) => item?.raw_material_id || item?.expand?.raw_material_id?.id)
    .sort((left, right) => {
      const stageOrder = { top: 0, middle: 1, base: 2 };
      const leftStage = stageOrder[left.stage] ?? 99;
      const rightStage = stageOrder[right.stage] ?? 99;
      if (leftStage !== rightStage) {
        return leftStage - rightStage;
      }
      return Number(left.rank_order || 0) - Number(right.rank_order || 0);
    })
    .map((item) => {
      const materialId = item.raw_material_id || item.expand?.raw_material_id?.id;
      const material = rawMaterialsById.get(materialId) || item.expand?.raw_material_id || null;

      return {
        item_id: materialId,
        gram_amount: item.selection_state === 'selected' || item.selection_state === 'manual'
          ? resolveSeedGramAmount(item, material, referenceLinksMap.get(materialId) || null)
          : '',
        dilution_percent: '',
        dilution_solvent_id: '',
        dilution_solvent_name: '',
        item_type: material?.type === 'solvent' ? 'solvent' : 'raw_material',
        stage: item.stage || null,
        source_role: item.role || null,
      };
    });
};

export const buildComposerItemsFromMaterialIds = (materialIds = [], rawMaterials = []) => {
  const rawMaterialsById = new Map((rawMaterials || []).map((material) => [material.id, material]));

  return [...new Set((materialIds || []).filter(Boolean))]
    .map((materialId) => {
      const material = rawMaterialsById.get(materialId) || null;
      if (!material) {
        return null;
      }

      return {
        item_id: materialId,
        gram_amount: '1',
        dilution_percent: '',
        dilution_solvent_id: '',
        dilution_solvent_name: '',
        item_type: material.type === 'solvent' ? 'solvent' : 'raw_material',
        source_role: null,
        stage: null,
      };
    })
    .filter(Boolean);
};
