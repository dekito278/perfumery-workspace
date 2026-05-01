import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { calculatePercentages } from '@/utils/formulaCalculations.js';
import { buildFallbackReferenceProfileFromRawMaterial } from '@/utils/referenceGuidance.js';
import { deriveScentFamilyFromCategory } from '@/utils/rawMaterialCategoryMeta.js';
import { buildReferenceAdvisories } from '@/utils/formulaWorkbookSimulation.js';
import { normalizeFormulaItemType, getCompositionGroupLabel } from '@/utils/formulaDetail.js';
import { calculateIngredientCost } from '@/utils/pricingUtils.js';

const buildUnknownFormulaItem = (item, isDiluted, dilutionPercentage) => ({
  ...item,
  item_type: normalizeFormulaItemType(item, null),
  name: 'Unknown',
  workbook_code: null,
  unit: 'g',
  gram_amount: item.grams || item.percentage || 0,
  unit_price: 0,
  ingredient_cost: 0,
  category: null,
  component_family: null,
  scent_family: null,
  is_diluted: isDiluted,
  dilution_percentage: dilutionPercentage,
  dilution_solvent_name: null,
  reference_link: null,
  reference_profile: null,
});

const enrichFormulaItem = ({ item, rawMaterialsById, referenceLinksMap, referenceMaps, resolveFormulaItemReference }) => {
  let itemDetails = resolveFormulaItemReference(item, referenceMaps);
  let unitPrice = 0;
  let category = null;
  let componentFamily = null;
  let isDiluted = Boolean(item.dilution_percent && item.dilution_solvent_id);
  let dilutionPercentage = item.dilution_percent || null;
  let dilutionSolventName = null;

  if (item.item_type === 'raw_material' || item.item_type === 'solvent') {
    itemDetails = itemDetails || rawMaterialsById.get(item.item_id) || null;
    if (!itemDetails) {
      return buildUnknownFormulaItem(item, isDiluted, dilutionPercentage);
    }

    unitPrice = itemDetails.cost_per_unit || 0;
    category = itemDetails.category || null;
    componentFamily = itemDetails.scent_family || deriveScentFamilyFromCategory(itemDetails.category, '') || null;
    if (!isDiluted) {
      isDiluted = itemDetails.is_diluted || false;
      dilutionPercentage = itemDetails.dilution_percentage || null;
    }
    if (item.dilution_solvent_id) {
      const dilutionSolvent = rawMaterialsById.get(item.dilution_solvent_id) || null;
      dilutionSolventName = dilutionSolvent?.name || null;
    }
  } else if (item.item_type === 'accord') {
    unitPrice = itemDetails?.cost_per_unit || 0;
    category = itemDetails?.category || 'accord';
    componentFamily = 'accord';
  }

  const normalizedItemType = normalizeFormulaItemType(item, itemDetails);
  const gramAmount = item.grams || item.percentage || 0;

  return {
    ...item,
    item_type: normalizedItemType,
    name: itemDetails?.name || 'Unknown',
    workbook_code: itemDetails?.workbook_code || null,
    unit: itemDetails?.unit || 'g',
    gram_amount: gramAmount,
    unit_price: unitPrice,
    ingredient_cost: calculateIngredientCost(gramAmount, unitPrice),
    category,
    component_family: componentFamily,
    scent_family: componentFamily,
    is_diluted: isDiluted,
    dilution_percentage: dilutionPercentage,
    dilution_solvent_name: dilutionSolventName,
    reference_link: referenceLinksMap.get(item.item_id) || null,
    reference_profile:
      referenceLinksMap.get(item.item_id)?.reference_profile
      || buildFallbackReferenceProfileFromRawMaterial(itemDetails)
      || null,
  };
};

export const buildFormulaDetailItems = ({
  items,
  rawMaterialsById,
  referenceLinksMap,
  referenceMaps,
  resolveFormulaItemReference,
}) => {
  const enrichedItems = items.map((item) => enrichFormulaItem({
    item,
    rawMaterialsById,
    referenceLinksMap,
    referenceMaps,
    resolveFormulaItemReference,
  }));

  const totalGrams = calculateTotalAmount(enrichedItems);
  const itemsWithPercentages = totalGrams > 0 ? calculatePercentages(enrichedItems, totalGrams) : enrichedItems;

  return itemsWithPercentages.map((item) => ({
    ...item,
    ...buildReferenceAdvisories(item),
  }));
};

export const buildFormulaReferenceAdvisorySummary = (items, showAllReferenceAlerts) => {
  const advisories = items
    .filter((item) => item.advisories?.length)
    .flatMap((item) => item.advisories.map((advisory) => ({
      ...advisory,
      itemName: item.name,
      itemId: item.item_id,
      referenceCode: item.reference_profile?.reference_code || null,
      effectivePercentage: item.effectivePercentage,
      dilutionPercentage: item.dilution_percentage,
    })));

  return {
    formulaReferenceAdvisories: advisories,
    ifraAdvisoryCount: advisories.filter((item) => item.type === 'ifra').length,
    maxUseAdvisoryCount: advisories.filter((item) => item.type === 'max').length,
    typicalUseAdvisoryCount: advisories.filter((item) => item.type === 'typical').length,
    totalReferenceAlertCount: advisories.length,
    visibleReferenceAdvisories: showAllReferenceAlerts ? advisories : advisories.slice(0, 4),
  };
};

export const buildCompactCompositionRows = (items, limit = 6) => {
  const grouped = items.reduce((accumulator, item) => {
    const label = getCompositionGroupLabel(item);
    const current = accumulator.get(label) || {
      label,
      percentage: 0,
      grams: 0,
      count: 0,
    };

    current.percentage += Number(item.percentage || 0);
    current.grams += Number(item.gram_amount || 0);
    current.count += 1;
    accumulator.set(label, current);
    return accumulator;
  }, new Map());

  const compactRows = [...grouped.values()]
    .sort((left, right) => right.percentage - left.percentage)
    .slice(0, limit);

  return {
    compactCompositionRows: compactRows,
    hiddenCompositionGroupCount: Math.max(0, grouped.size - compactRows.length),
  };
};

export const buildWorkbookBoardStats = ({
  itemCount,
  totalCost,
  totalReferenceAlertCount,
  workbookSimulation,
}) => ([
  { label: 'Guidance-backed', value: `${workbookSimulation.guidanceBackedCount}/${itemCount}` },
  { label: 'Workbook link', value: workbookSimulation.linkedProfileCount },
  { label: 'Manual guidance', value: workbookSimulation.fallbackGuidanceCount },
  { label: 'Missing', value: workbookSimulation.missingGuidanceCount },
  { label: 'Reference alerts', value: totalReferenceAlertCount },
  { label: 'Material cost', value: totalCost },
]);
