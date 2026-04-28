import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronLeft, Save, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer.jsx';
import FormulaOdourDisplayPanel from '@/components/FormulaOdourDisplayPanel.jsx';
import FormulaComposerPacePanel from '@/components/FormulaComposerPacePanel.jsx';
import FormulaReferenceProfileSidebar from '@/components/FormulaReferenceProfileSidebar.jsx';
import FormulaMetadataDialog from '@/components/FormulaMetadataDialog.jsx';
import FormulaItemTableEditor from '@/components/FormulaItemTableEditor.jsx';
import RawMaterialGuidanceQuickEditDialog from '@/components/RawMaterialGuidanceQuickEditDialog.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useBriefProjects } from '@/hooks/useBriefProjects.js';
import { useIsMobile } from '@/hooks/use-mobile.jsx';
import { calculatePercentages, calculateTotalGrams, validateFormulaItems } from '@/utils/formulaCalculations.js';
import { validateGramAmount } from '@/utils/validation.js';
import { formatGramAmount, formatPercentage } from '@/utils/formatting.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { ensureReferenceLinksForRawMaterials } from '@/services/materialReferenceService.js';
import { buildFallbackReferenceProfileFromRawMaterial } from '@/utils/referenceGuidance.js';
import { buildWorkbookSimulation } from '@/utils/formulaWorkbookSimulation.js';
import { extractWorkbookClassDistribution } from '@/utils/workbookAbcClassification.js';
import { buildComposerItemsFromMaterialIds, buildComposerItemsFromProjectStageItems } from '@/utils/formulaPipeline.js';
import { PACE_PRIORITY_QUERY_KEY, normalizePacePriorityMode } from '@/utils/pacePriority.js';

const createFormulaItemRowKey = () => `formula-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

const createEmptyFormulaItem = () => ({
  row_key: createFormulaItemRowKey(),
  item_id: '',
  gram_amount: '',
  dilution_percent: '',
  dilution_solvent_id: '',
  dilution_solvent_name: '',
  item_type: '',
});

const getActiveFormulaItems = (items) =>
  items.filter((item) => item.item_id || item.gram_amount || item.dilution_percent || item.dilution_solvent_id);

const hasEmptyFormulaItem = (items) =>
  items.some((item) => !item.item_id && !item.gram_amount && !item.dilution_percent && !item.dilution_solvent_id);

const ensureFormulaComposerRow = (items) => (
  hasEmptyFormulaItem(items) ? items : [...items, createEmptyFormulaItem()]
);

const normalizeFormulaItems = (items) => [createEmptyFormulaItem(), ...getActiveFormulaItems(items)];
const composerSectionClass = 'rounded-[28px] border border-[#e6deca] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,246,239,0.98)_100%)] p-4 shadow-sm sm:p-6';
const roundComposerGram = (value) => Math.round(Number(value || 0) * 1000) / 1000;

const CreateFormulaPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { createFormula, loading } = useFormulas();
  const { getBriefs, updateBrief } = useBriefs();
  const { getBriefProjectByBriefId, getBriefProjectStageItems, updateBriefProject } = useBriefProjects();
  const briefId = searchParams.get('briefId') || '';
  const projectId = searchParams.get('projectId') || '';
  const seedMaterialIdsKey = String(searchParams.get('materialIds') || '');
  const seedMaterialIds = useMemo(
    () => [...new Set(
      seedMaterialIdsKey
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    )],
    [seedMaterialIdsKey]
  );
  const pacePriorityMode = normalizePacePriorityMode(searchParams.get(PACE_PRIORITY_QUERY_KEY));
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('perfume');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [formulaItems, setFormulaItems] = useState([createEmptyFormulaItem()]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [referenceLinksMap, setReferenceLinksMap] = useState(new Map());
  const [loadingData, setLoadingData] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const [focusRowIndex, setFocusRowIndex] = useState(0);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [materialLibraryQuery, setMaterialLibraryQuery] = useState('');
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(true);
  const [metadataConfirmed, setMetadataConfirmed] = useState(false);
  const [mobileComposerTab, setMobileComposerTab] = useState('compose');
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const [guidanceEditorOpen, setGuidanceEditorOpen] = useState(false);
  const [guidanceEditorMaterial, setGuidanceEditorMaterial] = useState(null);
  const [briefContext, setBriefContext] = useState(null);
  const [projectContext, setProjectContext] = useState(null);
  const [projectStageItems, setProjectStageItems] = useState([]);
  const isMobile = useIsMobile();
  const activeRowIndexRef = useRef(0);
  const formulaItemsRef = useRef(formulaItems);

  useEffect(() => {
    activeRowIndexRef.current = activeRowIndex;
  }, [activeRowIndex]);

  useEffect(() => {
    formulaItemsRef.current = formulaItems;
  }, [formulaItems]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoadingData(true);
      try {
        const [materialsData, briefs] = await Promise.all([
          getRawMaterialOptions(),
          getBriefs(),
        ]);

        const resolvedBrief = briefId
          ? briefs.find((brief) => brief.id === briefId) || null
          : null;
        let resolvedProject = null;
        let resolvedProjectStageMap = new Map();
        try {
          resolvedProject = projectId
            ? { ...(await getBriefProjectByBriefId(briefId) || {}), id: projectId }
            : (briefId ? await getBriefProjectByBriefId(briefId) : null);
          resolvedProjectStageMap = resolvedProject?.id ? await getBriefProjectStageItems(resolvedProject.id) : new Map();
        } catch (projectError) {
          console.error('Formula create project layer unavailable:', projectError);
        }
        const resolvedProjectStageItems = resolvedProject?.id
          ? ['top', 'middle', 'base']
              .flatMap((stage) => resolvedProjectStageMap.get(stage) || [])
              .filter((item) => item.selection_state === 'selected' || item.selection_state === 'manual')
          : [];

        if (active) {
          setRawMaterials(materialsData);
          setBriefContext(resolvedBrief);
          setProjectContext(resolvedProject);
          setProjectStageItems(resolvedProjectStageItems);

          if (resolvedBrief) {
            setNotes((current) => current || resolvedBrief.mood_story || '');
          }

          if (resolvedBrief) {
            setName((current) => current || `${resolvedBrief.title} formula`);
          }
          if (resolvedProjectStageItems.length) {
            setFormulaItems(normalizeFormulaItems(buildComposerItemsFromProjectStageItems(resolvedProjectStageItems, materialsData)));
          } else if (seedMaterialIds.length) {
            setFormulaItems(normalizeFormulaItems(buildComposerItemsFromMaterialIds(seedMaterialIds, materialsData)));
          }
        }
      } catch (error) {
        toast.error('Failed to load raw materials');
      } finally {
        if (active) {
          setLoadingData(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [briefId, getBriefProjectByBriefId, getBriefProjectStageItems, getBriefs, projectId, seedMaterialIds]);

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
    const nextErrors = { ...validationErrors };
    delete nextErrors[`item_${index}`];
    setValidationErrors(nextErrors);
  };

  const updateItem = (index, itemId) => {
    setFormulaItems((currentItems) => {
      const updated = [...currentItems];
      const previousItem = updated[index] || createEmptyFormulaItem();
      const wasComposerRow = index === 0
        && !previousItem.item_id
        && !previousItem.gram_amount
        && !previousItem.dilution_percent
        && !previousItem.dilution_solvent_id;

      updated[index] = buildItemWithMaterial(previousItem, itemId);
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

  const buildItemWithMaterial = (baseItem, itemId) => {
    const material = rawMaterials.find((row) => row.id === itemId);

    return {
      ...baseItem,
      row_key: baseItem?.row_key || createFormulaItemRowKey(),
      item_id: itemId,
      item_type: material ? (material.type === 'solvent' ? 'solvent' : 'raw_material') : '',
    };
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
      const normalizedItems = [createEmptyFormulaItem(), committedItem, ...getActiveFormulaItems(remainingItems)];

      formulaItemsRef.current = normalizedItems;
      activeRowIndexRef.current = 0;
      setActiveRowIndex(0);
      setFocusRowIndex(0);
      return normalizedItems;
    });
  };

  const handleMobileLibraryPick = (itemId) => {
    handleLibraryDoubleClick(itemId);
    setMobileLibraryOpen(false);
    setMobileComposerTab('compose');
  };

  const handleCommitRow = (index) => {
    setFormulaItems((currentItems) => {
      const committedItem = currentItems[index];

      if (!committedItem?.item_id || parseFloat(committedItem.gram_amount) <= 0) {
        return currentItems;
      }

      const remainingItems = currentItems.filter((_, itemIndex) => itemIndex !== index);
      const normalizedItems = [createEmptyFormulaItem(), committedItem, ...getActiveFormulaItems(remainingItems)];
      formulaItemsRef.current = normalizedItems;
      activeRowIndexRef.current = 0;
      setFocusRowIndex(0);
      setActiveRowIndex(0);
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
    const nextErrors = { ...validationErrors };
    if (error) {
      nextErrors[`item_${index}`] = error;
    } else {
      delete nextErrors[`item_${index}`];
    }
    setValidationErrors(nextErrors);
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
    const nextErrors = { ...validationErrors };
    delete nextErrors.ingredients;
    delete nextErrors[`item_${index}`];
    setValidationErrors(nextErrors);
  };

  const applyPaceRecommendation = (recommendation) => {
    if (!recommendation?.itemId) {
      return;
    }

    const targetGramAmount = String(roundComposerGram(recommendation.target));
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
      toast.success(`${recommendation.title} applied`);
    }
  };

  const handlePacePriorityModeChange = (nextMode) => {
    const normalizedMode = normalizePacePriorityMode(nextMode);
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set(PACE_PRIORITY_QUERY_KEY, normalizedMode);
    setSearchParams(nextSearchParams, { replace: true, preventScrollReset: true });
  };

  const activeFormulaItems = getActiveFormulaItems(formulaItems);
  const totalGrams = calculateTotalGrams(activeFormulaItems);
  const itemsWithPercentages = totalGrams > 0 ? calculatePercentages(activeFormulaItems, totalGrams) : [];
  const rawMaterialsById = useMemo(
    () => new Map(rawMaterials.map((material) => [material.id, material])),
    [rawMaterials]
  );
  const selectedRawMaterialIdsKey = useMemo(
    () => [...new Set(activeFormulaItems.map((item) => item.item_id).filter(Boolean))].sort().join('|'),
    [activeFormulaItems]
  );
  const selectedRawMaterialIds = useMemo(
    () => (selectedRawMaterialIdsKey ? selectedRawMaterialIdsKey.split('|') : []),
    [selectedRawMaterialIdsKey]
  );
  const selectedRawMaterialIdsSet = useMemo(
    () => new Set(selectedRawMaterialIds),
    [selectedRawMaterialIds]
  );
  const sortedRawMaterials = useMemo(
    () => [...rawMaterials].sort((a, b) => a.name.localeCompare(b.name)),
    [rawMaterials]
  );
  const filteredLibraryMaterials = useMemo(() => {
    const normalizedQuery = materialLibraryQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return sortedRawMaterials;
    }

    return sortedRawMaterials.filter((material) =>
      material.name.toLowerCase().includes(normalizedQuery)
    );
  }, [materialLibraryQuery, sortedRawMaterials]);

  const getItemGuidanceStatus = (item) => {
    const rawMaterial = rawMaterialsById.get(item?.item_id) || null;
    const linkedReferenceProfile = referenceLinksMap.get(item?.item_id)?.reference_profile || null;
    const fallbackReferenceProfile = linkedReferenceProfile
      ? null
      : buildFallbackReferenceProfileFromRawMaterial(rawMaterial);
    const referenceProfile = linkedReferenceProfile || fallbackReferenceProfile;
    const classDistribution = extractWorkbookClassDistribution(referenceProfile);
    const primaryClass = classDistribution[0] || null;

    const resolvedValues = {
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
    };

    const missingGuidance = !referenceProfile;
    const missingImpact = resolvedValues.reference_impact === null || resolvedValues.reference_impact === undefined || Number(resolvedValues.reference_impact) <= 0;
    const missingLife = resolvedValues.reference_life_hours === null || resolvedValues.reference_life_hours === undefined || Number(resolvedValues.reference_life_hours) <= 0;
    const missingClass = !classDistribution.length && !resolvedValues.reference_abc_primary_family;
    const missingCas = !String(resolvedValues.cas_number || '').trim();
    const missingIfra = resolvedValues.ifra_limit === null || resolvedValues.ifra_limit === undefined;

    return {
      hasWarning: missingGuidance || missingImpact || missingLife || missingClass || missingCas || missingIfra,
      missingGuidance,
      missingImpact,
      missingLife,
      missingClass,
      missingCas,
      missingIfra,
      rawMaterial,
    };
  };

  const getItemGuidanceDetails = (item) => {
    const guidanceStatus = getItemGuidanceStatus(item);
    const linkedReferenceProfile = referenceLinksMap.get(item?.item_id)?.reference_profile || null;
    const fallbackReferenceProfile = linkedReferenceProfile
      ? null
      : buildFallbackReferenceProfileFromRawMaterial(guidanceStatus.rawMaterial);
    const referenceProfile = linkedReferenceProfile || fallbackReferenceProfile;
    const classDistribution = extractWorkbookClassDistribution(referenceProfile);
    const primaryClass = classDistribution[0] || null;

    return {
      ...guidanceStatus,
      referenceProfile,
      classDistribution,
      resolvedValues: {
        workbook_code: referenceProfile?.reference_code || guidanceStatus.rawMaterial?.workbook_code || '',
        cas_number: referenceProfile?.cas_no || guidanceStatus.rawMaterial?.cas_number || '',
        ifra_limit: referenceProfile?.ifra_limit_percent ?? guidanceStatus.rawMaterial?.ifra_limit ?? null,
        reference_abc_primary_family: primaryClass?.familyName
          || referenceProfile?.abc_primary_family
          || guidanceStatus.rawMaterial?.reference_abc_primary_family
          || '',
        reference_impact: pickPreferredPositiveNumber(
          referenceProfile?.impact,
          guidanceStatus.rawMaterial?.reference_impact
        ),
        reference_life_hours: pickPreferredPositiveNumber(
          referenceProfile?.life_hours,
          guidanceStatus.rawMaterial?.reference_life_hours
        ),
        reference_use_level_typical_percent: referenceProfile?.use_level_typical_percent ?? guidanceStatus.rawMaterial?.reference_use_level_typical_percent ?? null,
        reference_use_level_max_percent: referenceProfile?.use_level_max_percent ?? guidanceStatus.rawMaterial?.reference_use_level_max_percent ?? null,
      },
    };
  };

  const handleOpenGuidanceEditor = (item) => {
    const guidanceDetails = getItemGuidanceDetails(item);
    if (!guidanceDetails.rawMaterial) {
      return;
    }

    setGuidanceEditorMaterial({
      ...guidanceDetails.rawMaterial,
      guidance_resolved_values: guidanceDetails.resolvedValues,
    });
    setGuidanceEditorOpen(true);
  };

  const handleGuidanceSaved = (updatedMaterial) => {
    setRawMaterials((current) => current.map((material) => (
      material.id === updatedMaterial.id ? updatedMaterial : material
    )));
    setGuidanceEditorMaterial(updatedMaterial);
  };

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
      impact: guidanceDetails.resolvedValues.reference_impact ?? null,
      lifeHours: guidanceDetails.resolvedValues.reference_life_hours ?? null,
      effectivePercentage: simulationRow?.effectivePercentage ?? null,
      impactContribution: simulationRow?.impactContribution ?? null,
      lifeContribution: simulationRow?.lifeContribution ?? null,
    };
  }, [activeRowIndex, formulaItems, getItemGuidanceDetails, simulationRowsByItemId]);
  const activeReferenceProfileDetails = useMemo(() => {
    const activeItem = formulaItems[activeRowIndex];
    if (!activeItem?.item_id) {
      return null;
    }

    return getItemGuidanceDetails(activeItem);
  }, [activeRowIndex, formulaItems, getItemGuidanceDetails]);

  const validateForm = () => {
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

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix validation errors');
      return;
    }

    try {
      const itemsForSubmit = itemsWithPercentages.map((item) => ({
        item_type: item.item_type,
        item_id: item.item_id,
        percentage: item.percentage,
        grams: parseFloat(item.gram_amount),
        dilution_percent: item.dilution_percent ? parseFloat(item.dilution_percent) : null,
        dilution_solvent_id: item.dilution_solvent_id || null,
        concentrate_amount: item.dilution_percent
          ? Number(((parseFloat(item.gram_amount) * parseFloat(item.dilution_percent)) / 100).toFixed(3))
          : null,
      }));

      const createdFormula = await createFormula({
        name,
        code,
        category,
        version: version || null,
        status,
        notes: notes || null,
      }, itemsForSubmit);

      if (briefContext && briefContext.formula_id !== createdFormula.id) {
        await updateBrief(briefContext.id, {
          ...briefContext,
          formula_id: createdFormula.id,
        });
      }

      if (projectContext?.id) {
        try {
          await updateBriefProject(projectContext.id, {
            status: 'ready_for_formula',
            current_stage: 'formula',
          });
        } catch (projectError) {
          console.error('Failed to update project after formula creation:', projectError);
        }
      }

      toast.success('Formula created successfully');
      navigate(`/formulas/${createdFormula.id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to create formula');
    }
  };

  const hasErrors = Object.keys(validationErrors).length > 0;
  const handleMetadataConfirm = () => {
    const nextErrors = {};

    if (!name.trim()) {
      nextErrors.name = 'Formula name is required';
    }
    if (!code.trim()) {
      nextErrors.code = 'Formula code is required';
    }

    setValidationErrors((current) => {
      const updatedErrors = { ...current };
      delete updatedErrors.name;
      delete updatedErrors.code;
      return {
        ...updatedErrors,
        ...nextErrors,
      };
    });

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setMetadataConfirmed(true);
    setMetadataDialogOpen(false);
  };

  const renderMaterialLibraryList = ({ mobile = false } = {}) => (
    <div className={mobile ? 'space-y-2' : 'space-y-1.5'}>
      {filteredLibraryMaterials.map((material) => {
        const currentRowItemId = formulaItems[activeRowIndex]?.item_id;
        const selectedInFormula = selectedRawMaterialIdsSet.has(material.id);
        const selectedInActiveRow = currentRowItemId === material.id;
        const disableLibraryPick = selectedInFormula;

        return (
          <button
            key={material.id}
            type="button"
            onClick={() => (mobile ? handleMobileLibraryPick(material.id) : handleLibrarySelect(material.id))}
            onDoubleClick={mobile ? undefined : () => handleLibraryDoubleClick(material.id)}
            disabled={disableLibraryPick}
            className={`flex w-full min-w-0 flex-col items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
              disableLibraryPick
                ? 'cursor-not-allowed border-[#e7dfcf] bg-[#f3eee4] text-muted-foreground opacity-70'
                : 'border-transparent bg-white hover:border-[#decda6] hover:bg-[#fff9ec]'
            }`}
          >
            <div className="min-w-0 w-full">
              <div className="break-words text-sm font-medium leading-snug">{material.name}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {material.type === 'solvent' ? 'Solvent' : 'Raw material'}
                {material.unit ? ` - ${material.unit}` : ''}
              </div>
            </div>
            <div className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
              disableLibraryPick
                ? 'bg-[#e4dccb] text-[#8b7d63]'
                : 'bg-[#f6efe0] text-[#7d6942]'
            }`}>
              {selectedInActiveRow
                ? 'Selected'
                : selectedInFormula
                  ? 'Added'
                  : mobile
                    ? 'Tap to add'
                    : `Row ${activeRowIndex + 1}`}
            </div>
          </button>
        );
      })}
      {filteredLibraryMaterials.length === 0 ? (
        <div className="rounded-xl bg-white px-3 py-4 text-sm text-muted-foreground">
          No raw materials found.
        </div>
      ) : null}
    </div>
  );

  const handleMetadataDialogChange = (open) => {
    if (open) {
      setMetadataDialogOpen(true);
      return;
    }

    if (!metadataConfirmed) {
      navigate(briefContext ? `/briefs/${briefContext.id}` : '/formulas');
      return;
    }

    setMetadataDialogOpen(false);
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Create Formula - Perfumer Studio</title>
        <meta
          name="description"
          content="Build a formula on a dedicated page with ingredient composition on the left and a live workbook odour display on the right."
        />
      </Helmet>

      <div className="page-container">
        <FormulaMetadataDialog
          open={metadataDialogOpen}
          onOpenChange={handleMetadataDialogChange}
          name={name}
          code={code}
          category={category}
          version={version}
          status={status}
          notes={notes}
          onNameChange={setName}
          onCodeChange={setCode}
          onCategoryChange={setCategory}
          onVersionChange={setVersion}
          onStatusChange={setStatus}
          onNotesChange={setNotes}
          validationErrors={validationErrors}
          onConfirm={handleMetadataConfirm}
        />

        <div className="mb-4 shrink-0">
          <Button
            variant="ghost"
            onClick={() => navigate(briefContext ? `/briefs/${briefContext.id}` : '/formulas')}
            className="gap-2 mb-4 h-9"
          >
            <ChevronLeft className="w-4 h-4" />
            {briefContext ? 'Back to brief board' : 'Back to formulas'}
          </Button>
        </div>

        <div className={`mb-3 shrink-0 px-3 py-3 sm:px-4 lg:mb-3 ${composerSectionClass}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Formula Composer
              </div>
              <h1 className="mt-1 text-xl font-bold tracking-[-0.02em] sm:text-2xl">
                {metadataConfirmed ? name || 'Create formula' : 'Create formula'}
              </h1>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMetadataDialogOpen(true)}
                className="h-10 w-full rounded-2xl px-4 sm:w-auto"
              >
                Edit formula info
              </Button>
              <Button
                type="submit"
                form="create-formula-form"
                disabled={loading || hasErrors || activeFormulaItems.length === 0 || !metadataConfirmed}
                className="h-10 w-full rounded-2xl gap-2 px-5 sm:w-auto"
              >
                <Save className="h-4 w-4" />
                {loading ? 'Creating...' : 'Create formula'}
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 md:hidden">
            <div className="rounded-full border border-[#d9def0] bg-[#f3f5fb] px-3 py-1.5 text-xs font-semibold text-[#26314e]">
              {code || 'Code not set'}
            </div>
            <div className="rounded-full border border-[#ddd3bf] bg-[#fbf8f0] px-3 py-1.5 text-xs font-semibold capitalize text-[#433821]">
              {status}
            </div>
            <div className="rounded-full border border-[#dce6d1] bg-[#f3f8ee] px-3 py-1.5 text-xs font-semibold capitalize text-[#31451f]">
              {category}
            </div>
          </div>

          <div className="mt-3 hidden gap-2 md:grid md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-[16px] border border-[#e5dcc7] bg-[linear-gradient(135deg,#fff9ec_0%,#f8f1dc_100%)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b7650]">Name</div>
              <div className="mt-1 text-sm font-semibold text-[#443822]">{name || 'Untitled formula'}</div>
            </div>
            <div className="rounded-[16px] border border-[#d9def0] bg-[linear-gradient(135deg,#f6f8ff_0%,#edf2ff_100%)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#61709a]">Code</div>
              <div className="mt-1 text-sm font-semibold text-[#26314e]">{code || 'Code not set'}</div>
            </div>
            <div className="rounded-[16px] border border-[#dce6d1] bg-[linear-gradient(135deg,#f4f9ee_0%,#edf6e3_100%)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f8454]">Category</div>
              <div className="mt-1 text-sm font-semibold capitalize text-[#31451f]">{category}</div>
            </div>
            <div className="rounded-[16px] border border-[#ead7cf] bg-[linear-gradient(135deg,#fff6f2_0%,#fcedea_100%)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9a6d5d]">Version</div>
              <div className="mt-1 text-sm font-semibold text-[#4e2c26]">{version || 'Not set'}</div>
            </div>
            <div className="rounded-[16px] border border-[#ddd3bf] bg-[linear-gradient(135deg,#fbf8f0_0%,#f4ede0_100%)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7b6a4a]">Status</div>
              <div className="mt-1 text-sm font-semibold capitalize text-[#433821]">{status}</div>
            </div>
          </div>

          <div className="mt-3 hidden rounded-[16px] border border-[#ddd3bf] bg-white px-4 py-3 md:block">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7b6a4a]">Notes</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {notes || 'No notes yet'}
            </div>
          </div>
        </div>

        {briefContext || projectContext || seedMaterialIds.length ? (
          <div className={`mb-4 space-y-4 ${composerSectionClass}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Composition context
                </div>
                <h2 className="mt-2 text-lg font-semibold">
                  {projectStageItems.length ? 'Compose from project stages' : seedMaterialIds.length ? 'Compose from shortlisted materials' : 'Compose from brief intent'}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {projectStageItems.length
                      ? 'This formula starts from project stage picks. Use the library below only to refine or rebalance the selected structure.'
                      : seedMaterialIds.length
                        ? 'This formula starts from shortlisted materials chosen in the library workspace. Use the composer below to refine the structure.'
                        : 'This formula is linked to a brief. Keep the composition anchored to the story, audience, and performance target below.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {briefContext ? (
                  <Button variant="outline" className="rounded-2xl" onClick={() => navigate(`/briefs/${briefContext.id}`)}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Open brief board
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {briefContext ? (
                <div className="rounded-[22px] border bg-white/85 p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="rounded-full">{briefContext.title}</Badge>
                    {briefContext.status ? <Badge variant="outline" className="rounded-full capitalize">{briefContext.status}</Badge> : null}
                  </div>
                  {briefContext.mood_story ? (
                    <p className="mt-3 text-sm text-muted-foreground">{briefContext.mood_story}</p>
                  ) : null}
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    {briefContext.audience_usage ? <div>Audience: {briefContext.audience_usage}</div> : null}
                    {briefContext.performance_target ? <div>Performance: {briefContext.performance_target}</div> : null}
                    {briefContext.budget_direction ? <div>Budget: {briefContext.budget_direction}</div> : null}
                  </div>
                </div>
              ) : null}

              <div className="rounded-[22px] border bg-white/85 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold">Formula source</div>
                  <Badge variant="outline" className="rounded-full">
                    {projectStageItems.length ? 'Stage preload' : seedMaterialIds.length ? 'Shortlist preload' : 'Direct composition'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {projectStageItems.length
                    ? `${projectStageItems.length} stage-selected materials were loaded into the composer as a starting structure.`
                    : seedMaterialIds.length
                      ? `${seedMaterialIds.length} shortlisted materials were loaded into the composer as a starting structure.`
                      : 'No preload source was selected. You can still compose directly from the raw material library.'}
                </p>
              </div>

              {projectContext ? (
                <div className="rounded-[22px] border bg-white/85 p-4 lg:col-span-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold">Project stage summary</div>
                    <Badge variant="outline" className="rounded-full capitalize">
                      {projectContext.current_stage || 'top'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {projectStageItems.length
                      ? `${projectStageItems.length} selected stage materials were loaded into the composer.`
                      : 'No stage materials have been selected yet in the project board.'}
                  </p>
                  {projectStageItems.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['top', 'middle', 'base'].map((stage) => {
                        const stageCount = projectStageItems.filter((item) => item.stage === stage).length;
                        return (
                          <Badge key={stage} variant="secondary" className="rounded-full capitalize">
                            {stage} {stageCount}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {loadingData ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.72fr)] 2xl:grid-cols-[minmax(0,1.85fr)_minmax(380px,0.68fr)]">
            <div className="space-y-4">
              <Skeleton className="h-[640px] w-full rounded-[28px]" />
            </div>
            <Skeleton className="h-[640px] w-full rounded-[28px]" />
          </div>
        ) : (
          <>
            {isMobile ? (
              <>
                <form id="create-formula-form" onSubmit={handleSubmit} className="space-y-4">
                  <Tabs value={mobileComposerTab} onValueChange={setMobileComposerTab} className="space-y-4">
                    <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-[#f3ecdd] p-1">
                      <TabsTrigger value="compose" className="rounded-xl py-2 text-xs">Compose</TabsTrigger>
                      <TabsTrigger value="workbook" className="rounded-xl py-2 text-xs">Workbook</TabsTrigger>
                      <TabsTrigger value="info" className="rounded-xl py-2 text-xs">Info</TabsTrigger>
                    </TabsList>

                    <TabsContent value="compose" className="mt-0">
                      <section className={composerSectionClass}>
                        <h2 className="text-lg font-semibold">Formula composition</h2>

                        <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                          <div className="rounded-full border border-[#e5dcc7] bg-[#fcf8ef] px-3 py-1.5 text-xs font-semibold text-[#443822]">
                            Rows {activeFormulaItems.length}
                          </div>
                          <div className="rounded-full border border-[#dce6d1] bg-[#f3f8ee] px-3 py-1.5 text-xs font-semibold text-[#31451f]">
                            Workbook linked {referenceLinksMap.size}
                          </div>
                          <div className="rounded-full border border-[#d9def0] bg-[#f3f5fb] px-3 py-1.5 text-xs font-semibold text-[#26314e]">
                            Total {formatGramAmount(totalGrams)}
                          </div>
                        </div>

                        {validationErrors.ingredients ? (
                          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3">
                            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                            <p className="text-xs text-destructive">{validationErrors.ingredients}</p>
                          </div>
                        ) : null}

                        <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] border border-[#ddd3bf] bg-[#fcfaf4] px-4 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b6d4f]">
                            Material library
                          </div>
                          <Button type="button" className="rounded-xl" onClick={() => setMobileLibraryOpen(true)}>
                            Add material
                          </Button>
                        </div>

                        <div className="mt-4 max-h-[25rem] overflow-y-auto pr-1">
                          <FormulaItemTableEditor
                            items={formulaItems}
                            rawMaterials={rawMaterials}
                            focusRowIndex={focusRowIndex}
                            activeRowIndex={activeRowIndex}
                            onAutoFocusHandled={() => setFocusRowIndex(null)}
                            onActivateRow={setActiveRowIndex}
                            onItemChange={updateItem}
                            onGramAmountChange={updateGramAmount}
                            onDilutionChange={updateDilutionConfig}
                            onRemove={removeFormulaItem}
                          validationErrors={validationErrors}
                          getGuidanceStatus={getItemGuidanceStatus}
                          onOpenGuidanceEditor={handleOpenGuidanceEditor}
                          activeItemInsight={activeItemInsight}
                        />
                        </div>

                        <div className="mt-4">
                          <FormulaComposerPacePanel
                            items={itemsWithPercentages}
                            rawMaterialsById={rawMaterialsById}
                            referenceLinksMap={referenceLinksMap}
                            onApplyRecommendation={applyPaceRecommendation}
                            priorityMode={pacePriorityMode}
                            onPriorityModeChange={handlePacePriorityModeChange}
                          />
                        </div>
                      </section>
                    </TabsContent>

                    <TabsContent value="workbook" className="mt-0">
                      <FormulaOdourDisplayPanel
                        items={itemsWithPercentages}
                        rawMaterialsById={rawMaterialsById}
                        referenceLinksMap={referenceLinksMap}
                        isVisible={mobileComposerTab === 'workbook'}
                      />
                    </TabsContent>

                    <TabsContent value="info" className="mt-0">
                      <section className={composerSectionClass}>
                        <h2 className="text-lg font-semibold">Formula info</h2>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-[16px] border border-[#e5dcc7] bg-[linear-gradient(135deg,#fff9ec_0%,#f8f1dc_100%)] px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b7650]">Name</div>
                            <div className="mt-1 text-sm font-semibold text-[#443822]">{name || 'Untitled formula'}</div>
                          </div>
                          <div className="rounded-[16px] border border-[#d9def0] bg-[linear-gradient(135deg,#f6f8ff_0%,#edf2ff_100%)] px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#61709a]">Code</div>
                            <div className="mt-1 text-sm font-semibold text-[#26314e]">{code || 'Code not set'}</div>
                          </div>
                          <div className="rounded-[16px] border border-[#dce6d1] bg-[linear-gradient(135deg,#f4f9ee_0%,#edf6e3_100%)] px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f8454]">Category</div>
                            <div className="mt-1 text-sm font-semibold capitalize text-[#31451f]">{category}</div>
                          </div>
                          <div className="rounded-[16px] border border-[#ead7cf] bg-[linear-gradient(135deg,#fff6f2_0%,#fcedea_100%)] px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9a6d5d]">Version</div>
                            <div className="mt-1 text-sm font-semibold text-[#4e2c26]">{version || 'Not set'}</div>
                          </div>
                          <div className="rounded-[16px] border border-[#ddd3bf] bg-[linear-gradient(135deg,#fbf8f0_0%,#f4ede0_100%)] px-3 py-2 sm:col-span-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7b6a4a]">Status</div>
                            <div className="mt-1 text-sm font-semibold capitalize text-[#433821]">{status}</div>
                          </div>
                          <div className="rounded-[16px] border border-[#ddd3bf] bg-white px-3 py-3 sm:col-span-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7b6a4a]">Notes</div>
                            <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                              {notes || 'No notes yet'}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <FormulaReferenceProfileSidebar details={activeReferenceProfileDetails} />
                        </div>
                      </section>
                    </TabsContent>
                  </Tabs>
                </form>

                <Drawer open={mobileLibraryOpen} onOpenChange={setMobileLibraryOpen}>
                  <DrawerContent className="max-h-[85vh] rounded-t-[24px] border-[#ddd3bf] bg-[#fcfaf4]">
                    <DrawerHeader className="text-left">
                      <DrawerTitle>Material library</DrawerTitle>
                      <DrawerDescription>
                        Tap sekali untuk langsung menambahkan material ke formula dan pindah ke row berikutnya.
                      </DrawerDescription>
                    </DrawerHeader>
                    <div className="border-b border-[#e7decb] px-4 pb-3">
                      <Input
                        value={materialLibraryQuery}
                        onChange={(event) => setMaterialLibraryQuery(event.target.value)}
                        placeholder="Find raw material..."
                        className="h-10 rounded-xl border-[#ddd3bf] bg-white text-sm"
                      />
                    </div>
                    <div className="overflow-y-auto px-4 py-4">
                      {renderMaterialLibraryList({ mobile: true })}
                    </div>
                  </DrawerContent>
                </Drawer>

                <div className="sticky bottom-3 z-20 mt-4 md:hidden">
                  <div className="rounded-[22px] border border-[#ddd3bf] bg-white/95 p-2 shadow-lg backdrop-blur">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setMetadataDialogOpen(true);
                          setMobileComposerTab('info');
                        }}
                        className="h-11 rounded-2xl"
                      >
                        Edit info
                      </Button>
                      <Button
                        type="submit"
                        form="create-formula-form"
                        disabled={loading || hasErrors || activeFormulaItems.length === 0 || !metadataConfirmed}
                        className="h-11 rounded-2xl gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {loading ? 'Creating...' : 'Create'}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.72fr)] 2xl:grid-cols-[minmax(0,1.85fr)_minmax(380px,0.68fr)]">
            <form id="create-formula-form" onSubmit={handleSubmit} className="space-y-4">
              <section className={composerSectionClass}>
                        <h2 className="text-lg font-semibold">Formula composition</h2>

                <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                  <div className="rounded-full border border-[#e5dcc7] bg-[#fcf8ef] px-3 py-1.5 text-xs font-semibold text-[#443822]">
                    Rows {activeFormulaItems.length}
                  </div>
                  <div className="rounded-full border border-[#dce6d1] bg-[#f3f8ee] px-3 py-1.5 text-xs font-semibold text-[#31451f]">
                    Workbook linked {referenceLinksMap.size}
                  </div>
                  <div className="rounded-full border border-[#d9def0] bg-[#f3f5fb] px-3 py-1.5 text-xs font-semibold text-[#26314e]">
                    Total {formatGramAmount(totalGrams)}
                  </div>
                </div>

                {validationErrors.ingredients ? (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3">
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                    <p className="text-xs text-destructive">{validationErrors.ingredients}</p>
                  </div>
                ) : null}

                <div className="mt-4 rounded-[18px] border border-[#ddd3bf] bg-[#fcfaf4]">
                  <div className="flex flex-col gap-3 border-b border-[#e7decb] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b6d4f]">
                          Material library
                    </div>
                    <div className="w-fit rounded-full border border-[#d9cfbb] bg-white px-3 py-1 text-xs font-semibold text-[#5e5239]">
                      Active row {activeRowIndex + 1}
                    </div>
                  </div>

                  <div className="border-b border-[#e7decb] px-4 py-3">
                    <Input
                      value={materialLibraryQuery}
                      onChange={(event) => setMaterialLibraryQuery(event.target.value)}
                      placeholder="Find raw material..."
                      className="h-9 rounded-xl border-[#ddd3bf] bg-white text-sm"
                    />
                  </div>

                  <div className="max-h-[10.75rem] overflow-y-auto px-3 py-3">
                    {renderMaterialLibraryList()}
                  </div>
                </div>

                <div className="mt-4 max-h-[25rem] overflow-y-auto pr-1">
                  <FormulaItemTableEditor
                    items={formulaItems}
                    rawMaterials={rawMaterials}
                    focusRowIndex={focusRowIndex}
                    activeRowIndex={activeRowIndex}
                    onAutoFocusHandled={() => setFocusRowIndex(null)}
                    onActivateRow={setActiveRowIndex}
                    onItemChange={updateItem}
                    onGramAmountChange={updateGramAmount}
                    onDilutionChange={updateDilutionConfig}
                    onRemove={removeFormulaItem}
                    validationErrors={validationErrors}
                    getGuidanceStatus={getItemGuidanceStatus}
                    onOpenGuidanceEditor={handleOpenGuidanceEditor}
                    activeItemInsight={activeItemInsight}
                  />
                </div>

                <div className="mt-4">
                  <FormulaComposerPacePanel
                    items={itemsWithPercentages}
                    rawMaterialsById={rawMaterialsById}
                    referenceLinksMap={referenceLinksMap}
                    onApplyRecommendation={applyPaceRecommendation}
                    priorityMode={pacePriorityMode}
                    onPriorityModeChange={handlePacePriorityModeChange}
                  />
                </div>
              </section>
            </form>

            <div className="h-fit lg:sticky lg:top-24 lg:self-start">
              <div className="space-y-4">
                <FormulaReferenceProfileSidebar details={activeReferenceProfileDetails} />
                <FormulaOdourDisplayPanel
                  items={itemsWithPercentages}
                  rawMaterialsById={rawMaterialsById}
                  referenceLinksMap={referenceLinksMap}
                  isVisible
                />
              </div>
            </div>
          </div>
            )}
          </>
        )}

        <RawMaterialGuidanceQuickEditDialog
          open={guidanceEditorOpen}
          onOpenChange={setGuidanceEditorOpen}
          material={guidanceEditorMaterial}
          guidanceStatus={guidanceEditorMaterial ? getItemGuidanceStatus({ item_id: guidanceEditorMaterial.id }) : null}
          onSaved={handleGuidanceSaved}
        />
      </div>
    </AuthenticatedLayout>
  );
};

export default CreateFormulaPage;
