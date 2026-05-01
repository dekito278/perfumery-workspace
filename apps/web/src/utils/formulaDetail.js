import { calculatePercentages } from '@/utils/formulaCalculations.js';

export const roundToThree = (value) => Math.round(Number(value || 0) * 1000) / 1000;

export const buildPacedRevisionVersion = (currentVersion) => {
  const normalized = String(currentVersion || '').trim();
  if (!normalized) {
    return 'PACED';
  }

  if (/paced/i.test(normalized)) {
    return `${normalized}-R2`;
  }

  return `${normalized}-PACED`;
};

export const buildPacedRevisionItems = (items, recommendations) => {
  const recommendationMap = new Map((recommendations || []).map((recommendation) => [recommendation.itemId, recommendation]));
  const adjustedItems = (items || []).map((item, index) => {
    const recommendation = recommendationMap.get(item.item_id);
    const currentGrams = Number(item.gram_amount || item.grams || 0);
    let nextGrams = currentGrams;

    if (recommendation?.action === 'increase') {
      nextGrams += Number(recommendation.delta || 0);
    } else if (recommendation?.action === 'decrease') {
      nextGrams = Math.max(currentGrams - Number(recommendation.delta || 0), 0);
    }

    return {
      ...item,
      gram_amount: roundToThree(nextGrams),
      grams: roundToThree(nextGrams),
      sort_order: item.sort_order ?? index,
    };
  }).filter((item) => Number(item.gram_amount || 0) > 0);

  const totalGrams = adjustedItems.reduce((sum, item) => sum + Number(item.gram_amount || 0), 0);
  const itemsWithPercentages = totalGrams > 0 ? calculatePercentages(adjustedItems, totalGrams) : adjustedItems;

  return itemsWithPercentages.map((item, index) => ({
    item_type: item.item_type,
    item_id: item.item_id,
    percentage: Number(item.percentage || 0),
    sort_order: item.sort_order ?? index,
    grams: roundToThree(item.gram_amount || item.grams || 0),
    dilution_percent: item.dilution_percentage ?? item.dilution_percent ?? null,
    dilution_solvent_id: item.dilution_solvent_id || null,
    concentrate_amount: item.concentrate_amount ?? null,
  }));
};

export const normalizeFormulaItemType = (item, itemDetails) => {
  if (item?.item_type === 'accord') {
    return 'accord';
  }

  if (itemDetails?.type === 'solvent' || itemDetails?.item_type === 'solvent' || item?.item_type === 'solvent') {
    return 'solvent';
  }

  return 'raw_material';
};

export const getCompositionGroupLabel = (item) => {
  if (item?.item_type === 'solvent') {
    return item.name || 'Solvent';
  }

  return item?.component_family || item?.scent_family || item?.category || 'Material';
};
