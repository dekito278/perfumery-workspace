import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculatePercentages, validateFormulaItems } from '@/utils/formulaCalculations.js';
import { ensureReferenceLinksForRawMaterials } from '@/services/materialReferenceService.js';
import { buildFallbackReferenceProfileFromRawMaterial } from '@/utils/referenceGuidance.js';
import { buildWorkbookSimulation } from '@/utils/formulaWorkbookSimulation.js';
import { extractWorkbookClassDistribution } from '@/utils/workbookAbcClassification.js';
import { resolveRawMaterialGuidanceSnapshot } from '@/utils/rawMaterialGuidanceResolver.js';

export const composerSectionClass = 'rounded-[28px] border border-[#e6deca] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,246,239,0.98)_100%)] p-4 shadow-sm sm:p-6';

export const createFormulaItemRowKey = () => `formula-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createEmptyFormulaItem = () => ({
  row_key: createFormulaItemRowKey(),
  item_id: '',
  gram_amount: '',
  dilution_percent: '',
  dilution_solvent_id: '',
  dilution_solvent_name: '',
  item_type: '',
});

export const getActiveFormulaItems = (items) =>
  items.filter((item) => item.item_id || item.gram_amount || item.dilution_percent || item.dilution_solvent_id);

const pickPreferredPositiveNumber = (primaryValue, fallbackValue) => {
  const primaryNumber = Number(primaryValue);
  if (Number.isFinite(primaryNumber) && primaryNumber > 0) {
    return primaryNumber;
  }

  const fallbackNumber = Number(fallbackValue);
  if (Number.isFinite(fallbackNumber) && fallbackNumber > 0) {
    return fallbackNumber;
  }

  if (primaryValue === null || primaryValue === undefined || primaryValue === '') {
    return fallbackValue ?? null;
  }

  return primaryValue;
};

const hasEmptyFormulaItem = (items) =>
  items.some((item) => !item.item_id && !item.gram_amount && !item.dilution_percent && !item.dilution_solvent_id);

const withRowKey = (item) => ({
  ...item,
  row_key: item?.row_key || createFormulaItemRowKey(),
});

export const ensureFormulaComposerRow = (items) => {
  const normalizedItems = (items || []).map(withRowKey);
  return hasEmptyFormulaItem(normalizedItems) ? normalizedItems : [...normalizedItems, createEmptyFormulaItem()];
};

export const normalizeFormulaItems = (items) => [
  createEmptyFormulaItem(),
  ...getActiveFormulaItems(items || []).map(withRowKey),
];

export const mapComposerItemsForSubmit = (items) => (
  items.map((item) => ({
    item_type: item.item_type,
    item_id: item.item_id,
    percentage: item.percentage,
    grams: parseFloat(item.gram_amount),
    dilution_percent: item.dilution_percent ? parseFloat(item.dilution_percent) : null,
    dilution_solvent_id: item.dilution_solvent_id || null,
    concentrate_amount: item.dilution_percent
      ? Number(((parseFloat(item.gram_amount) * parseFloat(item.dilution_percent)) / 100).toFixed(3))
      : null,
  }))
);

export const validateComposerFields = ({ name, code, formulaItems, activeFormulaItems }) => {
  const errors = {};

  if (!name.trim()) {
    errors.name = 'Formula name is required';
  }
  if (!code.trim()) {
    errors.code = 'Formula code is required';
  }

  const ingredientErrors = validateFormulaItems(activeFormulaItems);
  if (ingredientErrors.length > 0) {
    errors.ingredients = ingredientErrors.join(', ');
  }

  const materialIds = new Set();
  formulaItems.forEach((item, index) => {
    if (item.item_id && materialIds.has(item.item_id)) {
      errors[`item_${index}`] = 'Duplicate material';
    } else if (item.item_id) {
      materialIds.add(item.item_id);
    }
  });

  return errors;
};

const resolveFormulaItemGuidance = ({ item, rawMaterialsById, referenceLinksMap }) => {
  const rawMaterial = rawMaterialsById.get(item?.item_id) || null;
  const referenceLink = referenceLinksMap.get(item?.item_id) || null;
  const guidance = resolveRawMaterialGuidanceSnapshot(rawMaterial, referenceLink);
  const referenceProfile = guidance.referenceProfile || buildFallbackReferenceProfileFromRawMaterial(rawMaterial);
  const classDistribution = extractWorkbookClassDistribution(referenceProfile);
  const primaryClass = classDistribution[0] || null;

  const resolvedValues = {
    workbook_code: referenceProfile?.reference_code || rawMaterial?.workbook_code || '',
    cas_number: referenceProfile?.cas_no || rawMaterial?.cas_number || '',
    ifra_limit: referenceProfile?.ifra_limit_percent ?? rawMaterial?.ifra_limit ?? null,
    reference_abc_primary_family: primaryClass?.familyName
      || referenceProfile?.abc_primary_family
      || rawMaterial?.reference_abc_primary_family
      || '',
    reference_impact: pickPreferredPositiveNumber(
      referenceProfile?.impact,
      rawMaterial?.reference_impact
    ),
    reference_life_hours: pickPreferredPositiveNumber(
      referenceProfile?.life_hours,
      rawMaterial?.reference_life_hours
    ),
    reference_use_level_typical_percent: referenceProfile?.use_level_typical_percent ?? rawMaterial?.reference_use_level_typical_percent ?? null,
    reference_use_level_max_percent: referenceProfile?.use_level_max_percent ?? rawMaterial?.reference_use_level_max_percent ?? null,
  };

  const missingGuidance = !referenceProfile;
  const missingImpact = resolvedValues.reference_impact === null || resolvedValues.reference_impact === undefined || Number(resolvedValues.reference_impact) <= 0;
  const missingLife = resolvedValues.reference_life_hours === null || resolvedValues.reference_life_hours === undefined || Number(resolvedValues.reference_life_hours) <= 0;
  const missingClass = !classDistribution.length && !resolvedValues.reference_abc_primary_family;
  const missingCas = !String(resolvedValues.cas_number || '').trim();
  const missingIfra = resolvedValues.ifra_limit === null || resolvedValues.ifra_limit === undefined;

  return {
    rawMaterial,
    referenceProfile,
    classDistribution,
    resolvedValues,
    missingGuidance,
    missingImpact,
    missingLife,
    missingClass,
    missingCas,
    missingIfra,
    hasWarning: missingGuidance || missingImpact || missingLife || missingClass || missingCas || missingIfra,
  };
};

export const useFormulaComposer = ({
  rawMaterials,
  calculateTotalAmount,
  validateGramAmount,
}) => {
  const [formulaItems, setFormulaItems] = useState([createEmptyFormulaItem()]);
  const [referenceLinksMap, setReferenceLinksMap] = useState(new Map());
  const [focusRowIndex, setFocusRowIndex] = useState(0);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [materialLibraryQuery, setMaterialLibraryQuery] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const activeRowIndexRef = useRef(0);
  const formulaItemsRef = useRef(formulaItems);

  useEffect(() => {
    activeRowIndexRef.current = activeRowIndex;
  }, [activeRowIndex]);

  useEffect(() => {
    formulaItemsRef.current = formulaItems;
  }, [formulaItems]);

  const replaceFormulaItems = useCallback((items, { normalize = true } = {}) => {
    const nextItems = normalize ? normalizeFormulaItems(items) : ensureFormulaComposerRow(items);
    formulaItemsRef.current = nextItems;
    setFormulaItems(nextItems);
    activeRowIndexRef.current = 0;
    setActiveRowIndex(0);
    setFocusRowIndex(0);
    setValidationErrors({});
  }, []);

  const buildItemWithMaterial = (baseItem, itemId, materialOverride = null) => {
    const material = materialOverride || rawMaterials.find((row) => row.id === itemId);

    return {
      ...baseItem,
      row_key: baseItem?.row_key || createFormulaItemRowKey(),
      item_id: itemId,
      item_type: material ? (material.type === 'solvent' ? 'solvent' : 'raw_material') : '',
    };
  };

  const removeFormulaItem = (index) => {
    const remainingItems = formulaItems.filter((_, itemIndex) => itemIndex !== index);
    const nextItems = normalizeFormulaItems(remainingItems);
    formulaItemsRef.current = nextItems;
    setFormulaItems(nextItems);
    setActiveRowIndex((current) => {
      if (current === index) {
        return 0;
      }
      return Math.max(0, current > index ? current - 1 : current);
    });
    setValidationErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[`item_${index}`];
      return nextErrors;
    });
  };

  const updateItem = (index, itemId, materialOverride = null) => {
    setFormulaItems((currentItems) => {
      const updated = [...currentItems];
      const previousItem = updated[index] || createEmptyFormulaItem();
      const wasComposerRow = index === 0
        && !previousItem.item_id
        && !previousItem.gram_amount
        && !previousItem.dilution_percent
        && !previousItem.dilution_solvent_id;

      updated[index] = buildItemWithMaterial(previousItem, itemId, materialOverride);
      const nextItems = wasComposerRow
        ? normalizeFormulaItems(updated)
        : ensureFormulaComposerRow(updated);
      formulaItemsRef.current = nextItems;
      return nextItems;
    });
    const nextActiveRowIndex = index === 0 ? 0 : index;
    activeRowIndexRef.current = nextActiveRowIndex;
    setActiveRowIndex(nextActiveRowIndex);
    if (index === 0) {
      setFocusRowIndex(0);
    }
  };

  const handleLibrarySelect = (itemId) => {
    const rowIndex = Math.min(activeRowIndexRef.current, Math.max(formulaItemsRef.current.length - 1, 0));
    const currentRowItemId = formulaItemsRef.current[rowIndex]?.item_id;
    const alreadyAddedInAnotherRow = formulaItemsRef.current.some(
      (item, index) => index !== rowIndex && item.item_id === itemId
    );

    if (alreadyAddedInAnotherRow && currentRowItemId !== itemId) {
      return;
    }

    updateItem(rowIndex, itemId);
  };

  const handleLibraryDoubleClick = (itemId) => {
    const rowIndex = Math.min(activeRowIndexRef.current, Math.max(formulaItemsRef.current.length - 1, 0));
    const currentRowItemId = formulaItemsRef.current[rowIndex]?.item_id;
    const alreadyAddedInAnotherRow = formulaItemsRef.current.some(
      (item, index) => index !== rowIndex && item.item_id === itemId
    );

    if (alreadyAddedInAnotherRow && currentRowItemId !== itemId) {
      return;
    }

    setFormulaItems((currentItems) => {
      const nextItems = [...currentItems];
      const targetRowIndex = Math.min(activeRowIndexRef.current, Math.max(nextItems.length - 1, 0));
      nextItems[targetRowIndex] = buildItemWithMaterial(nextItems[targetRowIndex] || createEmptyFormulaItem(), itemId);

      const committedItem = nextItems[targetRowIndex];
      const remainingItems = nextItems.filter((_, itemIndex) => itemIndex !== targetRowIndex);
      const normalizedItems = [createEmptyFormulaItem(), committedItem, ...getActiveFormulaItems(remainingItems).map(withRowKey)];

      formulaItemsRef.current = normalizedItems;
      activeRowIndexRef.current = 0;
      setActiveRowIndex(0);
      setFocusRowIndex(0);
      return normalizedItems;
    });
  };

  const updateGramAmount = (index, gramAmount) => {
    const updated = [...formulaItems];
    updated[index].gram_amount = gramAmount;
    formulaItemsRef.current = updated;
    setFormulaItems(updated);
    activeRowIndexRef.current = index;
    setActiveRowIndex(index);

    const error = validateGramAmount(gramAmount);
    setValidationErrors((current) => {
      const nextErrors = { ...current };
      if (error) {
        nextErrors[`item_${index}`] = error;
      } else {
        delete nextErrors[`item_${index}`];
      }
      return nextErrors;
    });
  };

  const updateDilutionConfig = (index, field, value) => {
    const updated = [...formulaItems];

    if (field === 'clear_dilution') {
      updated[index].dilution_percent = '';
      updated[index].dilution_solvent_id = '';
      updated[index].dilution_solvent_name = '';
    } else {
      updated[index][field] = value;
    }

    if (field === 'dilution_solvent_id') {
      const solvent = rawMaterials.find((material) => material.id === value);
      updated[index].dilution_solvent_name = solvent?.name || '';
    }

    if (field === 'dilution_percent' && (value === '' || Number(value) <= 0)) {
      updated[index].dilution_percent = '';
      updated[index].dilution_solvent_id = '';
      updated[index].dilution_solvent_name = '';
    }

    formulaItemsRef.current = updated;
    setFormulaItems(updated);
    activeRowIndexRef.current = index;
    setActiveRowIndex(index);
    setValidationErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.ingredients;
      delete nextErrors[`item_${index}`];
      return nextErrors;
    });
  };

  const applyPaceRecommendation = (recommendation) => {
    if (!recommendation?.itemId) {
      return -1;
    }

    const targetGramAmount = String(Math.round(Number(recommendation.target || 0) * 1000) / 1000);
    let updatedIndex = -1;

    setFormulaItems((currentItems) => {
      const nextItems = currentItems.map((item, index) => {
        if (item.item_id !== recommendation.itemId) {
          return item;
        }

        updatedIndex = index;
        return {
          ...item,
          gram_amount: targetGramAmount,
        };
      });

      formulaItemsRef.current = nextItems;
      return nextItems;
    });

    if (updatedIndex >= 0) {
      activeRowIndexRef.current = updatedIndex;
      setActiveRowIndex(updatedIndex);
      setValidationErrors((current) => {
        const nextErrors = { ...current };
        delete nextErrors[`item_${updatedIndex}`];
        return nextErrors;
      });
    }

    return updatedIndex;
  };

  const activeFormulaItems = useMemo(() => getActiveFormulaItems(formulaItems), [formulaItems]);
  const totalGrams = useMemo(() => calculateTotalAmount(activeFormulaItems), [activeFormulaItems, calculateTotalAmount]);
  const itemsWithPercentages = useMemo(
    () => (totalGrams > 0 ? calculatePercentages(activeFormulaItems, totalGrams) : []),
    [activeFormulaItems, totalGrams]
  );
  const rawMaterialsById = useMemo(
    () => new Map(rawMaterials.map((material) => [material.id, material])),
    [rawMaterials]
  );
  const selectedRawMaterialIds = useMemo(
    () => [...new Set(activeFormulaItems.map((item) => item.item_id).filter(Boolean))],
    [activeFormulaItems]
  );
  const selectedRawMaterialIdsSet = useMemo(
    () => new Set(selectedRawMaterialIds),
    [selectedRawMaterialIds]
  );
  const filteredLibraryMaterials = useMemo(() => {
    const normalizedQuery = materialLibraryQuery.trim().toLowerCase();
    const sortedRawMaterials = [...rawMaterials].sort((a, b) => a.name.localeCompare(b.name));

    if (!normalizedQuery) {
      return sortedRawMaterials;
    }

    return sortedRawMaterials.filter((material) =>
      material.name.toLowerCase().includes(normalizedQuery)
    );
  }, [materialLibraryQuery, rawMaterials]);

  useEffect(() => {
    let active = true;

    const loadReferenceLinks = async () => {
      if (!selectedRawMaterialIds.length) {
        if (active) {
          setReferenceLinksMap(new Map());
        }
        return;
      }

      try {
        const selectedMaterials = selectedRawMaterialIds
          .map((materialId) => rawMaterialsById.get(materialId))
          .filter(Boolean);
        const nextMap = await ensureReferenceLinksForRawMaterials(selectedMaterials);
        if (active) {
          setReferenceLinksMap(nextMap);
        }
      } catch (error) {
        if (active) {
          setReferenceLinksMap(new Map());
        }
      }
    };

    loadReferenceLinks();

    return () => {
      active = false;
    };
  }, [selectedRawMaterialIds, rawMaterialsById]);

  const workbookSimulation = useMemo(() => buildWorkbookSimulation({
    items: itemsWithPercentages,
    rawMaterialsById,
    referenceLinksMap,
  }), [itemsWithPercentages, rawMaterialsById, referenceLinksMap]);

  const simulationRowsByItemId = useMemo(
    () => new Map(workbookSimulation.rows.map((row) => [row.item_id, row])),
    [workbookSimulation.rows]
  );

  const getItemGuidanceDetails = (item) => resolveFormulaItemGuidance({
    item,
    rawMaterialsById,
    referenceLinksMap,
  });

  const getItemGuidanceStatus = (item) => getItemGuidanceDetails(item);

  const activeItemInsight = useMemo(() => {
    const activeItem = formulaItems[activeRowIndex];
    if (!activeItem?.item_id) {
      return null;
    }

    const guidanceDetails = getItemGuidanceDetails(activeItem);
    const simulationRow = simulationRowsByItemId.get(activeItem.item_id) || null;

    return {
      name: guidanceDetails.rawMaterial?.name || 'Unknown material',
      guidanceSource: simulationRow?.guidanceSource || (guidanceDetails.referenceProfile ? 'raw_material_fallback' : 'none'),
      referenceCode: guidanceDetails.referenceProfile?.reference_code || null,
      impact: simulationRow?.impact ?? guidanceDetails.resolvedValues.reference_impact ?? null,
      lifeHours: simulationRow?.lifeHours ?? guidanceDetails.resolvedValues.reference_life_hours ?? null,
      baseImpact: simulationRow?.baseImpact ?? guidanceDetails.resolvedValues.reference_impact ?? null,
      baseLifeHours: simulationRow?.baseLifeHours ?? guidanceDetails.resolvedValues.reference_life_hours ?? null,
      blendedImpact: simulationRow?.blendedImpact ?? null,
      blendedLifeHours: simulationRow?.blendedLifeHours ?? null,
      effectivePercentage: simulationRow?.effectivePercentage ?? null,
      impactContribution: simulationRow?.impactContribution ?? null,
      lifeContribution: simulationRow?.lifeContribution ?? null,
      dilutionFactor: simulationRow?.dilutionFactor ?? null,
      dilutionSolventName: simulationRow?.dilutionSolvent?.name || null,
      dilutionSolventBehaviour: simulationRow?.dilutionSolventBehaviour?.key || null,
      dilutionSolventImpact: simulationRow?.dilutionSolventImpact ?? null,
      dilutionSolventLifeHours: simulationRow?.dilutionSolventLifeHours ?? null,
    };
  }, [activeRowIndex, formulaItems, rawMaterialsById, referenceLinksMap, simulationRowsByItemId]);

  const activeReferenceProfileDetails = useMemo(() => {
    const activeItem = formulaItems[activeRowIndex];
    if (!activeItem?.item_id) {
      return null;
    }

    return getItemGuidanceDetails(activeItem);
  }, [activeRowIndex, formulaItems, rawMaterialsById, referenceLinksMap]);

  return {
    formulaItems,
    setFormulaItems,
    replaceFormulaItems,
    referenceLinksMap,
    focusRowIndex,
    setFocusRowIndex,
    activeRowIndex,
    setActiveRowIndex,
    materialLibraryQuery,
    setMaterialLibraryQuery,
    validationErrors,
    setValidationErrors,
    removeFormulaItem,
    updateItem,
    updateGramAmount,
    updateDilutionConfig,
    handleLibrarySelect,
    handleLibraryDoubleClick,
    applyPaceRecommendation,
    activeFormulaItems,
    totalGrams,
    itemsWithPercentages,
    rawMaterialsById,
    selectedRawMaterialIds,
    selectedRawMaterialIdsSet,
    filteredLibraryMaterials,
    getItemGuidanceStatus,
    getItemGuidanceDetails,
    activeItemInsight,
    activeReferenceProfileDetails,
  };
};
