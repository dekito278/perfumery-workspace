const STAGE_GRAM_BASE = {
  top: 0.7,
  middle: 1.05,
  base: 1.35,
};

const ROLE_GRAM_MULTIPLIER = {
  hero: 1.35,
  support: 1.1,
  bridge: 0.95,
  blender: 0.95,
  modifier: 0.9,
  diffuser: 0.85,
  fixative: 1.2,
  linear_substrate: 1.25,
};

const resolveSeedGramAmount = (item) => {
  const stageBase = STAGE_GRAM_BASE[item.stage] ?? 1;
  const roleMultiplier = ROLE_GRAM_MULTIPLIER[item.role] ?? 1;
  const rankOrder = Number(item.rank_order);
  const rankBoost = Number.isFinite(rankOrder)
    ? Math.max(0.82, 1.12 - (rankOrder * 0.04))
    : 1;
  const manualBoost = item.selection_state === 'manual' ? 1.08 : 1;
  const fitScore = Number(item.fit_score);
  const fitBoost = Number.isFinite(fitScore)
    ? Math.min(1.12, Math.max(0.9, 0.92 + (fitScore * 0.02)))
    : 1;

  return String(Math.round(stageBase * roleMultiplier * rankBoost * manualBoost * fitBoost * 1000) / 1000);
};

export const buildComposerItemsFromProjectStageItems = (stageItems = [], rawMaterials = []) => {
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
          ? resolveSeedGramAmount(item)
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
