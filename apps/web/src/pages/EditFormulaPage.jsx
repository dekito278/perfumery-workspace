import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronLeft, Save, ClipboardList, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import FormulaMetadataDialog from '@/components/FormulaMetadataDialog.jsx';
import FormulaItemTableEditor from '@/components/FormulaItemTableEditor.jsx';
import FormulaOdourDisplayPanel from '@/components/FormulaOdourDisplayPanel.jsx';
import FormulaComposerPacePanel from '@/components/FormulaComposerPacePanel.jsx';
import FormulaReferenceProfileSidebar from '@/components/FormulaReferenceProfileSidebar.jsx';
import RawMaterialGuidanceQuickEditDialog from '@/components/RawMaterialGuidanceQuickEditDialog.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useBriefProjects } from '@/hooks/useBriefProjects.js';
import { useIsMobile } from '@/hooks/use-mobile.jsx';
import { calculatePercentages, validateFormulaItems } from '@/utils/formulaCalculations.js';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { validateGramAmount } from '@/utils/validation.js';
import { formatGramAmount } from '@/utils/formatting.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { ensureReferenceLinksForRawMaterials } from '@/services/materialReferenceService.js';
import { buildStageTargetProfile, getStageLabel, getWizardQuestionsForStage } from '@/utils/briefProjectWizard.js';
import { buildFallbackReferenceProfileFromRawMaterial } from '@/utils/referenceGuidance.js';
import { buildComposerItemsFromProjectStageItems } from '@/utils/formulaPipeline.js';
import { rankMaterialRecommendations } from '@/utils/materialCompositionProfile.js';
import { buildWorkbookSimulation } from '@/utils/formulaWorkbookSimulation.js';
import { extractWorkbookClassDistribution } from '@/utils/workbookAbcClassification.js';
import { PACE_PRIORITY_QUERY_KEY, normalizePacePriorityMode } from '@/utils/pacePriority.js';

const STAGES = ['top', 'middle', 'base'];
const createEmptyFormulaItem = () => ({
  item_id: '',
  gram_amount: '',
  dilution_percent: '',
  dilution_solvent_id: '',
  dilution_solvent_name: '',
  item_type: '',
});

const normalizeFormulaItemType = (item, material) => {
  if (item?.item_type === 'accord') {
    return 'accord';
  }

  if (material?.type === 'solvent' || item?.item_type === 'solvent') {
    return 'solvent';
  }

  return 'raw_material';
};

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

const getActiveFormulaItems = (items) =>
  items.filter((item) => item.item_id || item.gram_amount || item.dilution_percent || item.dilution_solvent_id);

const normalizeFormulaItems = (items) => [createEmptyFormulaItem(), ...getActiveFormulaItems(items)];
const composerSectionClass = 'rounded-[28px] border border-[#e6deca] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,246,239,0.98)_100%)] p-4 shadow-sm sm:p-6';
const roundComposerGram = (value) => Math.round(Number(value || 0) * 1000) / 1000;
const getSelectedStageItems = (stageItemsMap, stage) =>
  (stageItemsMap.get(stage) || []).filter((item) => item.selection_state === 'selected' || item.selection_state === 'manual');
const getFirstIncompleteQuestionIndex = (questions, answers = {}) => {
  const firstIncompleteIndex = questions.findIndex((question) => !answers?.[question.id]);
  return firstIncompleteIndex >= 0 ? firstIncompleteIndex : Math.max(questions.length - 1, 0);
};

const EditFormulaPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getFormulaById, updateFormula, loading } = useFormulas();
  const { getFormulaItems } = useFormulaItems();
  const { getBriefs } = useBriefs();
  const {
    ensureBriefProject,
    getBriefProjectByBriefId,
    getBriefProjectStages,
    getBriefProjectStageItems,
    upsertBriefProjectStage,
    upsertBriefProjectStageItems,
    deleteBriefProjectStageItemsByStage,
    updateBriefProject,
  } = useBriefProjects();
  const briefIdFromQuery = searchParams.get('briefId') || '';
  const [pendingBriefWizardOpen, setPendingBriefWizardOpen] = useState(() => searchParams.get('openBriefWizard') === '1');
  const pacePriorityMode = normalizePacePriorityMode(searchParams.get(PACE_PRIORITY_QUERY_KEY));
  const [formula, setFormula] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('perfume');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [formulaItems, setFormulaItems] = useState([createEmptyFormulaItem()]);
  const [legacyAccordItems, setLegacyAccordItems] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [referenceLinksMap, setReferenceLinksMap] = useState(new Map());
  const [loadingData, setLoadingData] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const [focusRowIndex, setFocusRowIndex] = useState(0);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [materialLibraryQuery, setMaterialLibraryQuery] = useState('');
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [mobileComposerTab, setMobileComposerTab] = useState('compose');
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const [guidanceEditorOpen, setGuidanceEditorOpen] = useState(false);
  const [guidanceEditorMaterial, setGuidanceEditorMaterial] = useState(null);
  const [linkedBrief, setLinkedBrief] = useState(null);
  const [linkedProject, setLinkedProject] = useState(null);
  const [projectUnavailable, setProjectUnavailable] = useState(false);
  const [linkedProjectStageItems, setLinkedProjectStageItems] = useState([]);
  const [wizardStageItemsMap, setWizardStageItemsMap] = useState(new Map(STAGES.map((stage) => [stage, []])));
  const [draftAnswers, setDraftAnswers] = useState({ top: {}, middle: {}, base: {} });
  const [activeStage, setActiveStage] = useState('top');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardQuestionIndex, setWizardQuestionIndex] = useState(0);
  const [busyStage, setBusyStage] = useState('');
  const isMobile = useIsMobile();

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoadingData(true);
      try {
        const [formulaData, materialsData, itemsData, briefs] = await Promise.all([
          getFormulaById(id),
          getRawMaterialOptions(),
          getFormulaItems(id),
          getBriefs(),
        ]);

        if (!active) {
          return;
        }

        setFormula(formulaData);
        setRawMaterials(materialsData);
        const resolvedBrief = briefs.find((brief) => brief.formula_id === id)
          || briefs.find((brief) => brief.id === briefIdFromQuery)
          || null;
        let resolvedProject = null;
        let resolvedProjectStageAnswerMap = new Map();
        let resolvedProjectStageMap = new Map();
        let nextProjectUnavailable = false;

        if (resolvedBrief) {
          try {
            resolvedProject = await getBriefProjectByBriefId(resolvedBrief.id);
            [resolvedProjectStageAnswerMap, resolvedProjectStageMap] = resolvedProject?.id
              ? await Promise.all([
                  getBriefProjectStages(resolvedProject.id),
                  getBriefProjectStageItems(resolvedProject.id),
                ])
              : [new Map(), new Map()];
          } catch (projectError) {
            console.error('Edit formula project layer unavailable:', projectError);
            nextProjectUnavailable = true;
          }
        }
        const resolvedProjectStageItems = resolvedProject?.id
          ? ['top', 'middle', 'base']
              .flatMap((stage) => resolvedProjectStageMap.get(stage) || [])
              .filter((item) => item.selection_state === 'selected' || item.selection_state === 'manual')
          : [];
        setLinkedBrief(resolvedBrief);
        setLinkedProject(resolvedProject);
        setProjectUnavailable(nextProjectUnavailable);
        setLinkedProjectStageItems(resolvedProjectStageItems);
        setWizardStageItemsMap(resolvedProjectStageMap?.size ? resolvedProjectStageMap : new Map(STAGES.map((stage) => [stage, []])));
        setDraftAnswers({
          top: resolvedProjectStageAnswerMap.get('top')?.answers || {},
          middle: resolvedProjectStageAnswerMap.get('middle')?.answers || {},
          base: resolvedProjectStageAnswerMap.get('base')?.answers || {},
        });

        const hiddenLegacyAccordItems = itemsData.filter((item) => item.item_type === 'accord');
        setLegacyAccordItems(hiddenLegacyAccordItems);

        const formattedItems = itemsData
          .filter((item) => item.item_type !== 'accord')
          .map((item) => {
            const material = materialsData.find((entry) => entry.id === item.item_id);
            return {
              item_type: normalizeFormulaItemType(item, material),
              item_id: item.item_id,
              gram_amount: item.grams !== null && item.grams !== undefined
                ? String(item.grams)
                : String(item.percentage || 0),
              dilution_percent: item.dilution_percent?.toString() || '',
              dilution_solvent_id: item.dilution_solvent_id || '',
              dilution_solvent_name: item.dilution_solvent_id
                ? materialsData.find((solvent) => solvent.id === item.dilution_solvent_id)?.name || ''
                : '',
            };
          });

        setName(formulaData.name || '');
        setCode(formulaData.code || '');
        setCategory(formulaData.category || 'perfume');
        setVersion(formulaData.version || '');
        setStatus(formulaData.status || 'draft');
        setNotes(formulaData.notes || '');
        setFormulaItems(normalizeFormulaItems(formattedItems));
        setValidationErrors({});
        setFocusRowIndex(0);
        setActiveRowIndex(0);
      } catch (error) {
        toast.error('Failed to load formula data');
        navigate('/formulas');
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
  }, [briefIdFromQuery, getBriefProjectByBriefId, getBriefProjectStages, getBriefProjectStageItems, getBriefs, getFormulaById, getFormulaItems, id, navigate]);

  useEffect(() => {
    if (loadingData || !linkedBrief || !pendingBriefWizardOpen) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('openBriefWizard');
    setSearchParams(nextSearchParams, { replace: true, preventScrollReset: true });
    setPendingBriefWizardOpen(false);
    setActiveStage('top');
    setWizardQuestionIndex(getFirstIncompleteQuestionIndex(getWizardQuestionsForStage('top', draftAnswers.top || {}), draftAnswers.top || {}));
    setWizardOpen(true);
  }, [draftAnswers.top, linkedBrief, loadingData, pendingBriefWizardOpen, searchParams, setSearchParams]);

  const removeFormulaItem = (index) => {
    const remainingItems = formulaItems.filter((_, itemIndex) => itemIndex !== index);
    setFormulaItems(normalizeFormulaItems(remainingItems));
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
    const updated = [...formulaItems];
    updated[index].item_id = itemId;
    updated[index].item_type = '';

    const material = rawMaterials.find((row) => row.id === itemId);
    if (material) {
      updated[index].item_type = material.type === 'solvent' ? 'solvent' : 'raw_material';
    }

    setFormulaItems(updated);
    setActiveRowIndex(index);
  };

  const buildItemWithMaterial = (baseItem, itemId) => {
    const material = rawMaterials.find((row) => row.id === itemId);

    return {
      ...baseItem,
      item_id: itemId,
      item_type: material ? (material.type === 'solvent' ? 'solvent' : 'raw_material') : '',
    };
  };

  const handleLibrarySelect = (itemId) => {
    if (selectedRawMaterialIdsSet.has(itemId)) {
      return;
    }

    updateItem(activeRowIndex, itemId);
  };

  const handleLibraryDoubleClick = (itemId) => {
    const currentRowItemId = formulaItems[activeRowIndex]?.item_id;
    if (selectedRawMaterialIdsSet.has(itemId) && currentRowItemId !== itemId) {
      return;
    }

    setFormulaItems((currentItems) => {
      const nextItems = [...currentItems];
      const rowIndex = Math.min(activeRowIndex, Math.max(nextItems.length - 1, 0));
      nextItems[rowIndex] = buildItemWithMaterial(nextItems[rowIndex] || createEmptyFormulaItem(), itemId);

      const committedItem = nextItems[rowIndex];
      const remainingItems = nextItems.filter((_, itemIndex) => itemIndex !== rowIndex);
      const normalizedItems = [createEmptyFormulaItem(), committedItem, ...getActiveFormulaItems(remainingItems)];

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

  const updateGramAmount = (index, gramAmount) => {
    const updated = [...formulaItems];
    updated[index].gram_amount = gramAmount;
    setFormulaItems(updated);
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

    setFormulaItems(updated);
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

    setFormulaItems((currentItems) => currentItems.map((item, index) => {
      if (item.item_id !== recommendation.itemId) {
        return item;
      }

      updatedIndex = index;
      return {
        ...item,
        gram_amount: targetGramAmount,
      };
    }));

    if (updatedIndex >= 0) {
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
  const totalGrams = calculateTotalAmount(activeFormulaItems);
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
      rawMaterial,
      referenceProfile,
      classDistribution,
      missingGuidance,
      missingImpact,
      missingLife,
      missingClass,
      missingCas,
      missingIfra,
      hasWarning: missingGuidance || missingImpact || missingLife || missingClass || missingCas || missingIfra,
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

  const setStageAnswer = (stage, questionId, value) => {
    setDraftAnswers((current) => {
      const stageDraft = { ...(current[stage] || {}), [questionId]: value };
      if (questionId === 'family') {
        delete stageDraft.nuance;
      }
      return {
        ...current,
        [stage]: stageDraft,
      };
    });
  };

  const handleWizardOptionSelect = (questionId, value) => {
    setStageAnswer(activeStage, questionId, value);
    if (wizardQuestionIndex < currentQuestions.length - 1) {
      setWizardQuestionIndex((current) => current + 1);
    }
  };

  const handleWizardBack = () => {
    setWizardQuestionIndex((current) => Math.max(current - 1, 0));
  };

  const handleWizardNext = () => {
    setWizardQuestionIndex((current) => Math.min(current + 1, Math.max(currentQuestions.length - 1, 0)));
  };

  const handleWizardNextStage = () => {
    const nextStage = STAGES[Math.min(STAGES.indexOf(activeStage) + 1, STAGES.length - 1)];
    setActiveStage(nextStage);
    setWizardQuestionIndex(getFirstIncompleteQuestionIndex(getWizardQuestionsForStage(nextStage, draftAnswers[nextStage] || {}), draftAnswers[nextStage] || {}));
  };

  const persistSeededFormulaItems = async (stageItems) => {
    const seededComposerItems = buildComposerItemsFromProjectStageItems(stageItems, rawMaterials);
    const activeSeededItems = getActiveFormulaItems(seededComposerItems);
    const seededTotalAmount = calculateTotalAmount(activeSeededItems);
    const seededItemsWithPercentages = seededTotalAmount > 0
      ? calculatePercentages(activeSeededItems, seededTotalAmount)
      : [];

    await updateFormula(id, {
      name,
      code,
      category,
      version: version || null,
      status,
      notes: notes || null,
      total_amount: seededTotalAmount,
    }, seededItemsWithPercentages.map((item) => ({
      item_type: item.item_type,
      item_id: item.item_id,
      percentage: item.percentage,
      grams: parseFloat(item.gram_amount),
      dilution_percent: item.dilution_percent ? parseFloat(item.dilution_percent) : null,
      dilution_solvent_id: item.dilution_solvent_id || null,
      concentrate_amount: item.dilution_percent
        ? Number(((parseFloat(item.gram_amount) * parseFloat(item.dilution_percent)) / 100).toFixed(3))
        : null,
    })));

    setFormulaItems(normalizeFormulaItems(seededComposerItems));
  };

  const refreshLinkedProjectStageItems = async (projectId) => {
    const [nextProject, nextStageMap] = await Promise.all([
      getBriefProjectByBriefId(linkedBrief.id),
      getBriefProjectStageItems(projectId),
    ]);
    const nextProjectStageItems = STAGES
      .flatMap((stage) => nextStageMap.get(stage) || [])
      .filter((item) => item.selection_state === 'selected' || item.selection_state === 'manual');

    setLinkedProject(nextProject);
    setLinkedProjectStageItems(nextProjectStageItems);
    setWizardStageItemsMap(nextStageMap);
    setFormulaItems(normalizeFormulaItems(buildComposerItemsFromProjectStageItems(nextProjectStageItems, rawMaterials)));
    return nextProjectStageItems;
  };

  const buildLocalWizardStageItems = (ranked, stage) => ranked.map((row) => {
    const material = rawMaterials.find((item) => item.id === row.raw_material_id) || null;
    return {
      id: `local-${stage}-${row.raw_material_id}`,
      project_id: null,
      stage,
      raw_material_id: row.raw_material_id,
      selection_state: 'selected',
      role: row.primary_function || 'support',
      rank_order: row.rank_order,
      fit_score: row.fit_score,
      primary_function: row.primary_function,
      secondary_function: row.secondary_function,
      recommendation_reason: row.recommendation_reason,
      warning: row.warning,
      expand: {
        raw_material_id: material,
      },
    };
  });

  const handleGenerateWizardMaterials = async () => {
    if (!linkedBrief) {
      return;
    }

    const stageAnswers = draftAnswers[activeStage] || {};
    if (!stageAnswers.family) {
      toast.error('Choose the aroma direction first');
      return;
    }

    setBusyStage(activeStage);
    try {
      const targetProfile = buildStageTargetProfile(activeStage, stageAnswers, linkedBrief);
      const ranked = rankMaterialRecommendations({
        materials: rawMaterials.filter((item) => item.type !== 'solvent'),
        referenceLinksMap: new Map(),
        stage: activeStage,
        answers: stageAnswers,
        briefText: wizardBriefText,
        limit: 8,
      });

      let nextProjectStageItems = [];
      if (projectUnavailable) {
        const localStageRows = buildLocalWizardStageItems(ranked, activeStage);
        const nextStageMap = new Map(wizardStageItemsMap);
        nextStageMap.set(activeStage, localStageRows);
        setWizardStageItemsMap(nextStageMap);
        nextProjectStageItems = STAGES
          .flatMap((stage) => nextStageMap.get(stage) || [])
          .filter((item) => item.selection_state === 'selected' || item.selection_state === 'manual');
      } else {
        let project = linkedProject;
        if (!project) {
          try {
            project = await ensureBriefProject(linkedBrief.id);
            setLinkedProject(project);
          } catch (projectError) {
            console.error('Formula wizard project layer unavailable:', projectError);
            setProjectUnavailable(true);

            const localStageRows = buildLocalWizardStageItems(ranked, activeStage);
            const nextStageMap = new Map(wizardStageItemsMap);
            nextStageMap.set(activeStage, localStageRows);
            setWizardStageItemsMap(nextStageMap);
            nextProjectStageItems = STAGES
              .flatMap((stage) => nextStageMap.get(stage) || [])
              .filter((item) => item.selection_state === 'selected' || item.selection_state === 'manual');

            await persistSeededFormulaItems(nextProjectStageItems);
            toast.success(`${getStageLabel(activeStage)} materials added to formula composer`);

            if (activeStage === 'base') {
              setWizardOpen(false);
              if (nextProjectStageItems.length) {
                setActiveRowIndex(0);
                setFocusRowIndex(0);
              }
            } else {
              handleWizardNextStage();
            }
            return;
          }
        }

        await upsertBriefProjectStage(project.id, activeStage, {
          status: ranked.length ? 'completed' : 'reviewed',
          answers: stageAnswers,
          target_profile: targetProfile,
          recommendation_note: targetProfile.summary,
        });
        await deleteBriefProjectStageItemsByStage(project.id, activeStage, ['recommended', 'rejected', 'selected']);
        await upsertBriefProjectStageItems(project.id, ranked.map((row) => ({
          stage: activeStage,
          raw_material_id: row.raw_material_id,
          selection_state: 'selected',
          role: row.primary_function || 'support',
          rank_order: row.rank_order,
          fit_score: row.fit_score,
          primary_function: row.primary_function,
          secondary_function: row.secondary_function,
          recommendation_reason: row.recommendation_reason,
          warning: row.warning,
        })));

        const allStagesReady = STAGES.every((stage) => {
          if (stage === activeStage) {
            return ranked.length > 0;
          }
          return getSelectedStageItems(wizardStageItemsMap, stage).length > 0;
        });

        await updateBriefProject(project.id, {
          status: allStagesReady ? 'ready_for_formula' : 'in_progress',
          current_stage: allStagesReady ? 'formula' : activeStage,
        });

        nextProjectStageItems = await refreshLinkedProjectStageItems(project.id);
      }

      await persistSeededFormulaItems(nextProjectStageItems);
      toast.success(`${getStageLabel(activeStage)} materials added to formula composer`);

      if (activeStage === 'base') {
        setWizardOpen(false);
        if (nextProjectStageItems.length) {
          setActiveRowIndex(0);
          setFocusRowIndex(0);
        }
        return;
      }

      handleWizardNextStage();
    } catch (error) {
      toast.error(error.message || 'Failed to generate wizard materials');
    } finally {
      setBusyStage('');
    }
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
  const wizardBriefText = useMemo(
    () => [linkedBrief?.mood_story, linkedBrief?.audience_usage, linkedBrief?.performance_target, linkedBrief?.budget_direction].filter(Boolean).join(' '),
    [linkedBrief]
  );
  const currentQuestions = useMemo(
    () => getWizardQuestionsForStage(activeStage, draftAnswers[activeStage] || {}),
    [activeStage, draftAnswers]
  );
  const currentQuestion = currentQuestions[wizardQuestionIndex] || currentQuestions[currentQuestions.length - 1] || null;
  const activeTargetProfile = useMemo(
    () => buildStageTargetProfile(activeStage, draftAnswers[activeStage] || {}, linkedBrief),
    [activeStage, draftAnswers, linkedBrief]
  );

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

      await updateFormula(id, {
        name,
        code,
        category,
        version: version || null,
        status,
        notes: notes || null,
        total_amount: totalGrams,
      }, itemsForSubmit);

      toast.success('Formula updated successfully');
      navigate(`/formulas/${id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to update formula');
    }
  };

  const hasErrors = Object.keys(validationErrors).length > 0;
  const hasLegacyAccordItems = legacyAccordItems.length > 0;
  const renderMaterialLibraryList = ({ mobile = false } = {}) => (
    <div className={mobile ? 'space-y-2' : 'space-y-1.5'}>
      {filteredLibraryMaterials.map((material) => {
        const currentRowItemId = formulaItems[activeRowIndex]?.item_id;
        const alreadyAdded = selectedRawMaterialIdsSet.has(material.id) && currentRowItemId !== material.id;

        return (
          <button
            key={material.id}
            type="button"
            onClick={() => (mobile ? handleMobileLibraryPick(material.id) : handleLibrarySelect(material.id))}
            onDoubleClick={mobile ? undefined : () => handleLibraryDoubleClick(material.id)}
            disabled={alreadyAdded}
            className={`flex w-full min-w-0 flex-col items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
              alreadyAdded
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
              alreadyAdded
                ? 'bg-[#e4dccb] text-[#8b7d63]'
                : 'bg-[#f6efe0] text-[#7d6942]'
            }`}>
              {alreadyAdded ? 'Added' : mobile ? 'Tap to add' : `Row ${activeRowIndex + 1}`}
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

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>{`${formula?.name || 'Edit Formula'} - Perfumer Studio`}</title>
        <meta
          name="description"
          content="Edit a formula with the same composition workspace used for creating formulas."
        />
      </Helmet>

      <div className="page-container">
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogContent className="max-w-3xl rounded-[28px] border bg-background p-0">
            <DialogHeader className="border-b px-6 py-5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {getStageLabel(activeStage)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Step {Math.min(wizardQuestionIndex + 1, Math.max(currentQuestions.length, 1))} of {Math.max(currentQuestions.length, 1)}
                </span>
              </div>
              <DialogTitle className="mt-3 text-xl">Arah brief untuk formula baru ini</DialogTitle>
              <DialogDescription>
                Wizard ini hanya muncul sekali saat formula baru dibuat dari brief. Pilih karakter aromanya, lalu composer formula akan terisi kandidat material awal.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-5">
              {currentQuestion ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold">{currentQuestion.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Pilihan ini membantu menentukan material awal untuk stage {getStageLabel(activeStage).toLowerCase()}.
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {currentQuestion.options.map((option) => {
                      const selected = draftAnswers[activeStage]?.[currentQuestion.id] === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleWizardOptionSelect(currentQuestion.id, option.value)}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            selected
                              ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                              : 'bg-card hover:border-primary/40'
                          }`}
                        >
                          <div className="font-medium">{option.label}</div>
                          {option.tags?.length ? (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {option.tags.join(', ')}
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {projectUnavailable ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      Sinkronisasi project belum aktif, jadi wizard ini langsung mengisi formula tanpa menyimpan stage board ke `brief_projects`.
                    </div>
                  ) : null}

                  <div className="rounded-2xl border bg-background/70 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current target</div>
                    <div className="mt-2 text-sm font-semibold">{activeTargetProfile.summary}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{activeTargetProfile.stage_goal}</div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  Wizard untuk stage ini belum punya pertanyaan.
                </div>
              )}
            </div>

            <DialogFooter className="border-t px-6 py-5">
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={handleWizardBack} disabled={wizardQuestionIndex === 0}>
                    Back
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={handleWizardNext}
                    disabled={!currentQuestion || wizardQuestionIndex >= currentQuestions.length - 1}
                  >
                    Next question
                  </Button>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={handleWizardNextStage}
                    disabled={activeStage === 'base'}
                  >
                    Next stage
                  </Button>
                  <Button className="rounded-xl gap-2" onClick={handleGenerateWizardMaterials} disabled={busyStage === activeStage}>
                    <Sparkles className="h-4 w-4" />
                    {busyStage === activeStage ? 'Generating...' : activeStage === 'base' ? 'Finish wizard' : 'Generate materials'}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <FormulaMetadataDialog
          open={metadataDialogOpen}
          onOpenChange={setMetadataDialogOpen}
          title="Edit formula"
          description="Perbarui identitas formula tanpa meninggalkan composer."
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
          onConfirm={() => setMetadataDialogOpen(false)}
          confirmLabel="Apply changes"
        />

        <div className="mb-4 shrink-0">
          <Button
            variant="ghost"
            onClick={() => navigate(formula ? `/formulas/${id}` : '/formulas')}
            className="gap-2 mb-4 h-9"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to formula
          </Button>
        </div>

        <div className={`mb-3 shrink-0 px-3 py-3 sm:px-4 lg:mb-3 ${composerSectionClass}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Formula Composer
              </div>
              <h1 className="mt-1 text-xl font-bold tracking-[-0.02em] sm:text-2xl">
                {name || formula?.name || 'Edit formula'}
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
                form="edit-formula-form"
                disabled={loading || hasErrors || activeFormulaItems.length === 0 || hasLegacyAccordItems}
                className="h-10 w-full rounded-2xl gap-2 px-5 sm:w-auto"
              >
                <Save className="h-4 w-4" />
                {loading ? 'Updating...' : 'Update formula'}
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

        {linkedBrief || linkedProject ? (
          <div className={`mb-4 space-y-4 ${composerSectionClass}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Composition context
                </div>
                <h2 className="mt-2 text-lg font-semibold">What am I composing from right now?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Keep the brief as the intent anchor. Use project stage selections and direct materials to refine the formula directly in the composer.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {linkedBrief ? (
                  <Button variant="outline" className="rounded-2xl" onClick={() => navigate(`/briefs/${linkedBrief.id}`)}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Open brief board
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[22px] border bg-white/85 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold">Brief intent</div>
                  {linkedBrief ? (
                    <>
                      <Badge variant="secondary" className="rounded-full">{linkedBrief.title}</Badge>
                      {linkedBrief.status ? <Badge variant="outline" className="rounded-full capitalize">{linkedBrief.status}</Badge> : null}
                    </>
                  ) : (
                    <Badge variant="outline" className="rounded-full">No linked brief</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {linkedBrief?.mood_story || 'This formula is not linked to a brief yet. Use the brief workspace if you want to re-anchor the composition direction.'}
                </p>
              </div>

              <div className="rounded-[22px] border bg-white/85 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold">Editing mode</div>
                  <Badge variant="outline" className="rounded-full">Direct formula refinement</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Accord-first rebuilding has been retired. Edit this formula directly from its current material composition.
                </p>
              </div>

              {linkedProject ? (
                <div className="rounded-[22px] border bg-white/85 p-4 lg:col-span-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold">Project stage anchor</div>
                    <Badge variant="outline" className="rounded-full capitalize">
                      {linkedProject.current_stage || 'top'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {linkedProjectStageItems.length
                      ? `${linkedProjectStageItems.length} stage-selected materials exist in the project. Use them as the structural reference while editing.`
                      : 'This brief project does not have stage selections yet.'}
                  </p>
                  {linkedProjectStageItems.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['top', 'middle', 'base'].map((stage) => {
                        const stageCount = linkedProjectStageItems.filter((item) => item.stage === stage).length;
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
                <form id="edit-formula-form" onSubmit={handleSubmit} className="space-y-4">
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

                        {hasLegacyAccordItems ? (
                          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                            <p className="text-xs text-amber-800">
                              Formula ini masih punya {legacyAccordItems.length} hidden legacy accord item{legacyAccordItems.length > 1 ? 's' : ''}. Update dibatasi sampai data accord lama dibersihkan.
                            </p>
                          </div>
                        ) : null}

                        <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] border border-[#ddd3bf] bg-[#fcfaf4] px-4 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b6d4f]">
                            Direct raw materials
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
                        form="edit-formula-form"
                        disabled={loading || hasErrors || activeFormulaItems.length === 0 || hasLegacyAccordItems}
                        className="h-11 rounded-2xl gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {loading ? 'Updating...' : 'Update'}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.72fr)] 2xl:grid-cols-[minmax(0,1.85fr)_minmax(380px,0.68fr)]">
                <form id="edit-formula-form" onSubmit={handleSubmit} className="space-y-4">
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

                    {hasLegacyAccordItems ? (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                        <p className="text-xs text-amber-800">
                          Formula ini masih punya {legacyAccordItems.length} hidden legacy accord item{legacyAccordItems.length > 1 ? 's' : ''}. Formula masih bisa dilihat, tetapi update dibatasi sampai data accord lama dibersihkan.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-4 rounded-[18px] border border-[#ddd3bf] bg-[#fcfaf4]">
                      <div className="flex flex-col gap-3 border-b border-[#e7decb] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b6d4f]">
                          Direct raw materials
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

export default EditFormulaPage;
