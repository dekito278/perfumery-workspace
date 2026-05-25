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
import FormulaMaterialLibrary from '@/components/FormulaMaterialLibrary.jsx';
import FormulaOdourDisplayPanel from '@/components/FormulaOdourDisplayPanel.jsx';
import FormulaComposerPacePanel from '@/components/FormulaComposerPacePanel.jsx';
import FormulaReferenceProfileSidebar from '@/components/FormulaReferenceProfileSidebar.jsx';
import FormulaScaleTool from '@/components/FormulaScaleTool.jsx';
import RawMaterialGuidanceQuickEditDialog from '@/components/RawMaterialGuidanceQuickEditDialog.jsx';
import FormulaMaterialQuickCreateDialog from '@/components/FormulaMaterialQuickCreateDialog.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useBriefProjects } from '@/hooks/useBriefProjects.js';
import {
  composerSectionClass,
  mapComposerItemsForSubmit,
  useFormulaComposer,
  validateComposerFields,
} from '@/hooks/useFormulaComposer.js';
import { useIsMobile } from '@/hooks/use-mobile.jsx';
import { calculatePercentages } from '@/utils/formulaCalculations.js';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { validateGramAmount } from '@/utils/validation.js';
import { formatGramAmount, formatStatus } from '@/utils/formatting.js';
import { createRawMaterial, getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { selectRelatedBriefFormulaIds } from '@/utils/briefFormulaHistory.js';
import { formatImpactBandLabel, formatLifeRangeLabel, getStageLabel } from '@/utils/briefProjectWizard.js';
import {
  buildAdaptiveStageTargetProfile,
  buildBriefAiIntentRequestPayload,
  collectBriefText,
  createFallbackBriefAiIntent,
  getAdaptiveWizardQuestionsForStage,
  normalizeBriefAiIntent,
  shouldUseAiIntent,
  summarizeWizardFeedback,
} from '@/utils/briefAiIntent.js';
import { buildComposerItemsFromProjectStageItems } from '@/utils/formulaPipeline.js';
import {
  buildComposerCorrectionFeedbackContext,
  createEmptyRecommendationFeedbackContext,
  buildHistoricalFormulaFeedbackContext,
  buildRecommendationFeedbackContext,
  mergeRecommendationFeedbackContexts,
  buildStageDecisionAssist,
  explainMaterialForStage,
  getArchitectureRoleLabel,
  rankMaterialRecommendations,
} from '@/utils/materialCompositionProfile.js';
import { PACE_PRIORITY_QUERY_KEY, normalizePacePriorityMode } from '@/utils/pacePriority.js';
import { readPersistedRecommendationLearning, writePersistedRecommendationLearning } from '@/utils/recommendationLearningStorage.js';
import { buildQuickRawMaterialPayload, getQuickMaterialDuplicateCandidates, normalizeQuickMaterialName, upsertMaterialOption } from '@/utils/formulaMaterialQuickCreate.js';
import { createBriefAiInterpretation, getLatestBriefAiInterpretation } from '@/services/briefAiInterpretationsService.js';
import { requestBriefAiIntent } from '@/services/briefAiIntentService.js';

const STAGES = ['top', 'middle', 'base'];
const WIZARD_CANDIDATE_LIMIT = 30;
const WIZARD_VISIBLE_CANDIDATE_LIMIT = 12;
const APPLIED_SELECTION_STATES = new Set(['selected', 'manual']);
const normalizeFormulaItemType = (item, material) => {
  if (item?.item_type === 'accord') {
    return 'accord';
  }

  if (material?.type === 'solvent' || item?.item_type === 'solvent') {
    return 'solvent';
  }

  return 'raw_material';
};

const getSelectedStageItems = (stageItemsMap, stage) =>
  (stageItemsMap.get(stage) || []).filter((item) => APPLIED_SELECTION_STATES.has(item.selection_state));
const getAppliedStageItems = (stageItemsMap) =>
  STAGES
    .flatMap((stage) => stageItemsMap.get(stage) || [])
    .filter((item) => APPLIED_SELECTION_STATES.has(item.selection_state));
const getFirstIncompleteQuestionIndex = (questions, answers = {}) => {
  const firstIncompleteIndex = questions.findIndex((question) => !answers?.[question.id]);
  return firstIncompleteIndex >= 0 ? firstIncompleteIndex : Math.max(questions.length - 1, 0);
};
const formatDebugPercent = (value) => `${Math.round(Number(value || 0))}%`;
const formatEffectTag = (tag) => String(tag || '').replace(/_/g, ' ').trim();
const getLearningSignals = (item, explanation) => (
  Array.isArray(item?.learning_signals) && item.learning_signals.length
    ? item.learning_signals
    : Array.isArray(explanation?.learning_signals)
      ? explanation.learning_signals
      : []
).slice(0, 2);
const getAllWizardStageItems = (stageItemsMap) =>
  STAGES.flatMap((stage) => stageItemsMap.get(stage) || []);
const groupFormulaItemsByFormulaId = (items = []) => {
  const grouped = new Map();
  (items || []).forEach((item) => {
    const formulaId = String(item?.formula_id || '');
    if (!formulaId) {
      return;
    }
    const current = grouped.get(formulaId) || [];
    current.push(item);
    grouped.set(formulaId, current);
  });
  return grouped;
};

const EditFormulaPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getFormulaById, updateFormula, loading } = useFormulas();
  const { getFormulaItems, getFormulaItemsByFormulaIds } = useFormulaItems();
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
  const [legacyAccordItems, setLegacyAccordItems] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [mobileComposerTab, setMobileComposerTab] = useState('compose');
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const [guidanceEditorOpen, setGuidanceEditorOpen] = useState(false);
  const [guidanceEditorMaterial, setGuidanceEditorMaterial] = useState(null);
  const [quickCreateIntent, setQuickCreateIntent] = useState(null);
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const [needsGuidanceMaterialId, setNeedsGuidanceMaterialId] = useState('');
  const [linkedBrief, setLinkedBrief] = useState(null);
  const [linkedProject, setLinkedProject] = useState(null);
  const [projectUnavailable, setProjectUnavailable] = useState(false);
  const [linkedProjectStageItems, setLinkedProjectStageItems] = useState([]);
  const [wizardStageItemsMap, setWizardStageItemsMap] = useState(new Map(STAGES.map((stage) => [stage, []])));
  const [historicalFormulaFeedbackEntries, setHistoricalFormulaFeedbackEntries] = useState([]);
  const [persistedRecommendationFeedbackContext, setPersistedRecommendationFeedbackContext] = useState(() => createEmptyRecommendationFeedbackContext());
  const [briefAiIntent, setBriefAiIntent] = useState(null);
  const [briefAiIntentLoading, setBriefAiIntentLoading] = useState(false);
  const [draftAnswers, setDraftAnswers] = useState({ top: {}, middle: {}, base: {} });
  const [activeStage, setActiveStage] = useState('top');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardQuestionIndex, setWizardQuestionIndex] = useState(0);
  const [busyStage, setBusyStage] = useState('');
  const [expandedWizardCandidateId, setExpandedWizardCandidateId] = useState('');
  const isMobile = useIsMobile();
  const composer = useFormulaComposer({
    rawMaterials,
    calculateTotalAmount,
    validateGramAmount,
  });
  const {
    formulaItems,
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
    selectedRawMaterialIdsSet,
    filteredLibraryMaterials,
    getItemGuidanceStatus,
    getItemGuidanceDetails,
    activeItemInsight,
    activeReferenceProfileDetails,
  } = composer;

  useEffect(() => {
    if (loadingData || !linkedBrief?.id) {
      setBriefAiIntent(null);
      return;
    }

    let active = true;
    const inputText = collectBriefText(linkedBrief);

    const resolveBriefIntent = async () => {
      setBriefAiIntentLoading(true);
      try {
        let latestInterpretation = null;
        try {
          latestInterpretation = await getLatestBriefAiInterpretation(linkedBrief.id);
        } catch (storageError) {
          console.error('Brief AI interpretation storage unavailable:', storageError);
        }

        if (!active) {
          return;
        }

        if (latestInterpretation?.intent_payload && latestInterpretation.input_text === inputText) {
          setBriefAiIntent(normalizeBriefAiIntent({
            ...latestInterpretation.intent_payload,
            source: latestInterpretation.source,
            model: latestInterpretation.model,
            confidence: latestInterpretation.confidence ?? latestInterpretation.intent_payload.confidence,
            fallback_reason: latestInterpretation.fallback_reason || latestInterpretation.intent_payload.fallback_reason,
          }, latestInterpretation.source || 'ai'));
          return;
        }

        const feedbackSummary = summarizeWizardFeedback({
          wizardStageItemsMap,
          rawMaterialsById,
          activeStage,
        });
        const payload = buildBriefAiIntentRequestPayload({
          brief: linkedBrief,
          existingAnswers: draftAnswers,
          feedbackSummary,
        });
        const nextIntent = await requestBriefAiIntent({
          brief: linkedBrief,
          payload,
        });

        if (!active) {
          return;
        }

        setBriefAiIntent(nextIntent);
        try {
          await createBriefAiInterpretation({
            briefId: linkedBrief.id,
            inputText,
            intentPayload: nextIntent,
            model: nextIntent.model,
            confidence: nextIntent.confidence,
            source: nextIntent.source === 'ai' ? 'ai' : 'fallback',
            fallbackReason: nextIntent.fallback_reason,
          });
        } catch (storageError) {
          console.error('Failed to persist brief AI interpretation:', storageError);
        }
      } catch (error) {
        console.error('Failed to resolve brief AI intent:', error);
        if (active) {
          setBriefAiIntent(createFallbackBriefAiIntent({ freeText: inputText, brief: linkedBrief }));
        }
      } finally {
        if (active) {
          setBriefAiIntentLoading(false);
        }
      }
    };

    resolveBriefIntent();

    return () => {
      active = false;
    };
  // Resolve once per linked brief; live feedback is consumed by the local recommender every generation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedBrief?.id, loadingData]);

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
        const relatedHistoryTargets = selectRelatedBriefFormulaIds({
          briefs,
          currentBrief: resolvedBrief,
          excludeFormulaId: id,
          limit: 12,
        });
        let nextHistoricalFormulaFeedbackEntries = [];
        if (relatedHistoryTargets.length) {
          try {
            const historicalItems = await getFormulaItemsByFormulaIds(relatedHistoryTargets.map((entry) => entry.formulaId));
            const historicalItemsByFormulaId = groupFormulaItemsByFormulaId(historicalItems);
            nextHistoricalFormulaFeedbackEntries = relatedHistoryTargets.map((entry) => ({
              formulaId: entry.formulaId,
              briefText: entry.briefText,
              items: historicalItemsByFormulaId.get(entry.formulaId) || [],
            })).filter((entry) => entry.items.length > 0);
          } catch (historyError) {
            console.error('Failed to load historical formula memory:', historyError);
          }
        }
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
        setHistoricalFormulaFeedbackEntries(nextHistoricalFormulaFeedbackEntries);
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
        replaceFormulaItems(formattedItems);
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
  }, [briefIdFromQuery, getBriefProjectByBriefId, getBriefProjectStages, getBriefProjectStageItems, getBriefs, getFormulaById, getFormulaItems, getFormulaItemsByFormulaIds, id, navigate, replaceFormulaItems]);

  useEffect(() => {
    if (loadingData || !linkedBrief || !pendingBriefWizardOpen) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('openBriefWizard');
    setSearchParams(nextSearchParams, { replace: true, preventScrollReset: true });
    setPendingBriefWizardOpen(false);
    setActiveStage('top');
    setWizardQuestionIndex(getFirstIncompleteQuestionIndex(
      getAdaptiveWizardQuestionsForStage('top', draftAnswers.top || {}, briefAiIntent),
      draftAnswers.top || {},
    ));
    setWizardOpen(true);
  }, [briefAiIntent, draftAnswers.top, linkedBrief, loadingData, pendingBriefWizardOpen, searchParams, setSearchParams]);

  const handleMobileLibraryPick = (itemId) => {
    handleLibraryDoubleClick(itemId);
    setMobileLibraryOpen(false);
    setMobileComposerTab('compose');
  };

  const handlePacePriorityModeChange = (nextMode) => {
    const normalizedMode = normalizePacePriorityMode(nextMode);
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set(PACE_PRIORITY_QUERY_KEY, normalizedMode);
    setSearchParams(nextSearchParams, { replace: true, preventScrollReset: true });
  };

  const handleApplyPaceRecommendation = (recommendation) => {
    const updatedIndex = applyPaceRecommendation(recommendation);
    if (updatedIndex >= 0) {
      toast.success(`${recommendation.title} applied`);
    }
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
    if (updatedMaterial?.id === needsGuidanceMaterialId) {
      setNeedsGuidanceMaterialId('');
    }
  };

  const handleCreateMissingMaterial = ({ name: materialName, rowIndex }) => {
    const nextName = normalizeQuickMaterialName(materialName);
    if (!nextName) return;
    setQuickCreateIntent({ name: nextName, rowIndex });
  };

  const quickCreateDuplicateCandidates = getQuickMaterialDuplicateCandidates(rawMaterials, quickCreateIntent?.name);

  const handleSelectQuickCreateExistingMaterial = (material) => {
    if (!material?.id) return;
    const rowIndex = Number.isFinite(quickCreateIntent?.rowIndex) ? quickCreateIntent.rowIndex : 0;
    setRawMaterials((current) => upsertMaterialOption(current, material));
    updateItem(rowIndex, material.id, material);
    setActiveRowIndex(rowIndex);
    setFocusRowIndex(rowIndex);
    setQuickCreateIntent(null);
    toast.success(`Using existing material: ${material.name}`);
  };

  const handleConfirmQuickCreateMaterial = async (details = {}) => {
    const nextName = normalizeQuickMaterialName(quickCreateIntent?.name);
    if (!nextName) return;
    const rowIndex = Number.isFinite(quickCreateIntent?.rowIndex) ? quickCreateIntent.rowIndex : 0;

    setQuickCreateLoading(true);
    try {
      const createdMaterial = await createRawMaterial(buildQuickRawMaterialPayload(nextName, details));
      setRawMaterials((current) => upsertMaterialOption(current, createdMaterial));
        updateItem(rowIndex, createdMaterial.id, createdMaterial);
        setActiveRowIndex(rowIndex);
        setFocusRowIndex(rowIndex);
        if (!createdMaterial?._creationResolution) {
          setNeedsGuidanceMaterialId(createdMaterial.id);
        }
        setQuickCreateIntent(null);
      toast.success(createdMaterial?._creationResolution ? `Using existing material: ${createdMaterial.name}` : `Raw material added: ${createdMaterial.name}`);
    } catch (error) {
      toast.error(error.message || 'Failed to add raw material');
    } finally {
      setQuickCreateLoading(false);
    }
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
    setWizardQuestionIndex(getFirstIncompleteQuestionIndex(
      getAdaptiveWizardQuestionsForStage(nextStage, draftAnswers[nextStage] || {}, briefAiIntent),
      draftAnswers[nextStage] || {},
    ));
  };

  const handleWizardStageJump = (stage) => {
    if (!STAGES.includes(stage)) {
      return;
    }

    setActiveStage(stage);
    setExpandedWizardCandidateId('');
    setWizardQuestionIndex(getFirstIncompleteQuestionIndex(
      getAdaptiveWizardQuestionsForStage(stage, draftAnswers[stage] || {}, briefAiIntent),
      draftAnswers[stage] || {},
    ));
  };

  const handleFinishWizard = () => {
    const appliedCount = getAppliedStageItems(wizardStageItemsMap).length;
    setWizardOpen(false);
    toast.success(
      appliedCount > 0
        ? `${appliedCount} material tetap tersinkron ke formula composer.`
        : 'Wizard selesai. Pilih kandidat lalu add jika ingin masuk ke formula composer.'
    );
  };

  const persistSeededFormulaItems = async (stageItems) => {
    const seededComposerItems = buildComposerItemsFromProjectStageItems(stageItems, rawMaterials, referenceLinksMap);
    const activeSeededItems = seededComposerItems.filter((item) => item.item_id || item.gram_amount || item.dilution_percent || item.dilution_solvent_id);
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
    }, mapComposerItemsForSubmit(seededItemsWithPercentages));

    replaceFormulaItems(seededComposerItems);
  };

  const refreshLinkedProjectStageItems = async (projectId) => {
    const [nextProject, nextStageMap] = await Promise.all([
      getBriefProjectByBriefId(linkedBrief.id),
      getBriefProjectStageItems(projectId),
    ]);
    const nextProjectStageItems = getAppliedStageItems(nextStageMap);

    setLinkedProject(nextProject);
    setLinkedProjectStageItems(nextProjectStageItems);
    setWizardStageItemsMap(nextStageMap);
    replaceFormulaItems(buildComposerItemsFromProjectStageItems(nextProjectStageItems, rawMaterials, referenceLinksMap));
    return nextProjectStageItems;
  };

  const buildLocalWizardStageItems = (ranked, stage) => ranked.map((row) => {
    const material = rawMaterials.find((item) => item.id === row.raw_material_id) || null;
    return {
      id: `local-${stage}-${row.raw_material_id}`,
      project_id: null,
      stage,
      raw_material_id: row.raw_material_id,
      selection_state: 'recommended',
      role: row.primary_function || 'support',
      rank_order: row.rank_order,
      fit_score: row.fit_score,
      primary_function: row.primary_function,
      secondary_function: row.secondary_function,
      recommendation_reason: row.recommendation_reason,
      recommended_usage_strategy: row.recommended_usage_strategy,
      recommended_usage_label: row.recommended_usage_label,
      recommended_dilution_percent: row.recommended_dilution_percent,
      recommended_seed_grams: row.recommended_seed_grams,
      effect_tags: row.effect_tags,
      warning: row.warning,
      expand: {
        raw_material_id: material,
      },
    };
  });

  const syncWizardSelectionToFormula = async (nextStageMap) => {
    const nextProjectStageItems = getAppliedStageItems(nextStageMap);
    setLinkedProjectStageItems(nextProjectStageItems);
    await persistSeededFormulaItems(nextProjectStageItems);
    return nextProjectStageItems;
  };

  const handleWizardCandidateSelection = async (candidate, nextSelectionState) => {
    const currentStageRows = wizardStageItemsMap.get(activeStage) || [];
    const nextStageMap = new Map(wizardStageItemsMap);
    const nextStageRows = currentStageRows.map((row) => (
      row.raw_material_id === candidate.raw_material_id
        ? { ...row, selection_state: nextSelectionState }
        : row
    ));
    nextStageMap.set(activeStage, nextStageRows);

    try {
      if (projectUnavailable || !linkedProject?.id) {
        setWizardStageItemsMap(nextStageMap);
        await syncWizardSelectionToFormula(nextStageMap);
      } else {
        await upsertBriefProjectStageItems(linkedProject.id, [{
          stage: activeStage,
          raw_material_id: candidate.raw_material_id,
          selection_state: nextSelectionState,
          role: candidate.role,
          rank_order: candidate.rank_order,
          fit_score: candidate.fit_score,
          primary_function: candidate.primary_function,
          secondary_function: candidate.secondary_function,
          recommendation_reason: candidate.recommendation_reason,
          warning: candidate.warning,
        }]);
        await refreshLinkedProjectStageItems(linkedProject.id);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update wizard selection');
    }
  };

  const handleGenerateWizardMaterials = async () => {
    if (!linkedBrief) {
      return;
    }

    const stageAnswers = draftAnswers[activeStage] || {};
    if (!stageAnswers.family && !shouldUseAiIntent(briefAiIntent)) {
      toast.error('Pilih arah aroma dulu, atau tunggu AI membaca brief selesai.');
      return;
    }

    setBusyStage(activeStage);
    setExpandedWizardCandidateId('');
    try {
      const targetProfile = buildAdaptiveStageTargetProfile(activeStage, stageAnswers, linkedBrief, briefAiIntent);
      const lockedMaterialIds = new Set((wizardStageItemsMap.get(activeStage) || [])
        .filter((item) => item.selection_state !== 'recommended')
        .map((item) => item.raw_material_id)
        .filter(Boolean));
      const ranked = rankMaterialRecommendations({
        materials: rawMaterials.filter((item) => item.type !== 'solvent'),
        referenceLinksMap,
        stage: activeStage,
        answers: stageAnswers,
        briefText: wizardBriefText,
        targetProfile,
        limit: WIZARD_CANDIDATE_LIMIT * 2,
        feedbackContext: combinedRecommendationFeedbackContext,
      })
        .filter((row) => !lockedMaterialIds.has(row.raw_material_id))
        .slice(0, WIZARD_CANDIDATE_LIMIT);

      if (projectUnavailable) {
        const preservedStageRows = (wizardStageItemsMap.get(activeStage) || [])
          .filter((item) => item.selection_state !== 'recommended');
        const localStageRows = buildLocalWizardStageItems(ranked, activeStage);
        const nextStageMap = new Map(wizardStageItemsMap);
        nextStageMap.set(activeStage, [...preservedStageRows, ...localStageRows]);
        setWizardStageItemsMap(nextStageMap);
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
            toast.success(`${getStageLabel(activeStage)} candidates generated. Pick the materials you want to add.`);
            return;
          }
        }

        await upsertBriefProjectStage(project.id, activeStage, {
          status: ranked.length ? 'completed' : 'reviewed',
          answers: stageAnswers,
          target_profile: targetProfile,
          recommendation_note: targetProfile.summary,
        });
        await deleteBriefProjectStageItemsByStage(project.id, activeStage, ['recommended']);
        await upsertBriefProjectStageItems(project.id, ranked.map((row) => ({
          stage: activeStage,
          raw_material_id: row.raw_material_id,
          selection_state: 'recommended',
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

        await refreshLinkedProjectStageItems(project.id);
      }

      toast.success(`${getStageLabel(activeStage)} candidates generated. Pick the materials you want to add.`);
    } catch (error) {
      toast.error(error.message || 'Failed to generate wizard materials');
    } finally {
      setBusyStage('');
    }
  };

  const activeTargetProfile = useMemo(
    () => buildAdaptiveStageTargetProfile(activeStage, draftAnswers[activeStage] || {}, linkedBrief, briefAiIntent),
    [activeStage, briefAiIntent, draftAnswers, linkedBrief]
  );
  const wizardBriefText = useMemo(
    () => [
      collectBriefText(linkedBrief),
      briefAiIntent?.scent_story,
      ...(briefAiIntent?.stage_blueprints?.[activeStage]?.aroma_keywords || []),
      ...(briefAiIntent?.avoidances || []),
    ].filter(Boolean).join(' '),
    [activeStage, briefAiIntent, linkedBrief]
  );
  const recommendationFeedbackContext = useMemo(() => buildRecommendationFeedbackContext({
    composerItems: itemsWithPercentages,
    stageItems: getAllWizardStageItems(wizardStageItemsMap),
    rawMaterialsById,
    referenceLinksMap,
    stage: activeStage,
    totalFormulaGrams: totalGrams,
  }), [activeStage, itemsWithPercentages, rawMaterialsById, referenceLinksMap, totalGrams, wizardStageItemsMap]);
  const correctionRecommendationFeedbackContext = useMemo(() => buildComposerCorrectionFeedbackContext({
    composerItems: itemsWithPercentages,
    stageItems: getAllWizardStageItems(wizardStageItemsMap),
    rawMaterialsById,
    referenceLinksMap,
    stage: activeStage,
    totalFormulaGrams: totalGrams,
  }), [activeStage, itemsWithPercentages, rawMaterialsById, referenceLinksMap, totalGrams, wizardStageItemsMap]);
  const historicalRecommendationFeedbackContext = useMemo(() => buildHistoricalFormulaFeedbackContext({
    entries: historicalFormulaFeedbackEntries,
    rawMaterialsById,
    referenceLinksMap,
    stage: activeStage,
    targetProfile: activeTargetProfile,
    briefText: wizardBriefText,
  }), [activeStage, activeTargetProfile, historicalFormulaFeedbackEntries, rawMaterialsById, referenceLinksMap, wizardBriefText]);
  const combinedRecommendationFeedbackContext = useMemo(
    () => mergeRecommendationFeedbackContexts(
      persistedRecommendationFeedbackContext,
      recommendationFeedbackContext,
      correctionRecommendationFeedbackContext,
      historicalRecommendationFeedbackContext,
    ),
    [
      correctionRecommendationFeedbackContext,
      historicalRecommendationFeedbackContext,
      persistedRecommendationFeedbackContext,
      recommendationFeedbackContext,
    ]
  );
  const currentWizardStageRows = useMemo(() => wizardStageItemsMap.get(activeStage) || [], [activeStage, wizardStageItemsMap]);
  const wizardStageExplainMap = useMemo(() => new Map(
    currentWizardStageRows.map((item) => {
      const material = item.expand?.raw_material_id || null;
      if (!material?.id) {
        return [item.raw_material_id, null];
      }

      const explanation = explainMaterialForStage({
        material,
        referenceLink: referenceLinksMap.get(material.id) || null,
        stage: activeStage,
        answers: draftAnswers[activeStage] || {},
        briefText: wizardBriefText,
        targetProfile: activeTargetProfile,
        feedbackContext: combinedRecommendationFeedbackContext,
      });

      return [item.raw_material_id, explanation];
    }),
  ), [activeStage, activeTargetProfile, combinedRecommendationFeedbackContext, currentWizardStageRows, draftAnswers, referenceLinksMap, wizardBriefText]);
  const recommendedWizardCandidates = useMemo(
    () => [...currentWizardStageRows]
      .filter((item) => item.selection_state === 'recommended')
      .sort((left, right) => Number(right.fit_score || 0) - Number(left.fit_score || 0)),
    [currentWizardStageRows]
  );
  const wizardCompareCandidates = useMemo(
    () => recommendedWizardCandidates.slice(0, WIZARD_VISIBLE_CANDIDATE_LIMIT),
    [recommendedWizardCandidates]
  );

  useEffect(() => {
    const learningUserId = formula?.user_id || linkedBrief?.user_id || '';
    setPersistedRecommendationFeedbackContext(readPersistedRecommendationLearning(learningUserId));
  }, [formula?.user_id, linkedBrief?.user_id]);

  useEffect(() => {
    const learningUserId = formula?.user_id || linkedBrief?.user_id || '';
    if (!learningUserId || !correctionRecommendationFeedbackContext?.has_feedback) {
      return;
    }

    setPersistedRecommendationFeedbackContext((current) => {
      const nextPersistedContext = mergeRecommendationFeedbackContexts(
        current,
        correctionRecommendationFeedbackContext,
      );
      writePersistedRecommendationLearning(learningUserId, nextPersistedContext);
      return nextPersistedContext;
    });
  }, [
    correctionRecommendationFeedbackContext,
    formula?.user_id,
    linkedBrief?.user_id,
  ]);
  const selectedWizardCandidates = useMemo(
    () => [...currentWizardStageRows]
      .filter((item) => APPLIED_SELECTION_STATES.has(item.selection_state))
      .sort((left, right) => Number(right.fit_score || 0) - Number(left.fit_score || 0)),
    [currentWizardStageRows]
  );
  const wizardDecisionAssist = useMemo(() => buildStageDecisionAssist({
    items: wizardCompareCandidates,
    explanationMap: wizardStageExplainMap,
  }), [wizardCompareCandidates, wizardStageExplainMap]);
  const currentQuestions = useMemo(
    () => getAdaptiveWizardQuestionsForStage(activeStage, draftAnswers[activeStage] || {}, briefAiIntent),
    [activeStage, briefAiIntent, draftAnswers]
  );
  const currentQuestion = currentQuestions[wizardQuestionIndex] || currentQuestions[currentQuestions.length - 1] || null;
  const hasCurrentWizardCandidates = currentWizardStageRows.length > 0;

  const validateForm = () => {
    const errors = validateComposerFields({ name, code, formulaItems, activeFormulaItems });
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
      const itemsForSubmit = mapComposerItemsForSubmit(itemsWithPercentages);

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

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>{`${formula?.name || 'Edit Formula'} - Solivagant`}</title>
        <meta
          name="description"
          content="Edit a formula with the same composition workspace used for creating formulas."
        />
      </Helmet>

      <div className="page-container">
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogContent className="flex h-[min(96vh,980px)] w-[min(98vw,1560px)] max-w-none flex-col overflow-hidden rounded-[28px] border bg-background p-0">
            <DialogHeader className="shrink-0 border-b px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {getStageLabel(activeStage)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Step {Math.min(wizardQuestionIndex + 1, Math.max(currentQuestions.length, 1))} of {Math.max(currentQuestions.length, 1)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full">
                    {recommendedWizardCandidates.length} candidates
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {getAppliedStageItems(wizardStageItemsMap).length} added
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {formatImpactBandLabel(activeTargetProfile.impact_band)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {formatLifeRangeLabel(activeTargetProfile.life_range_hours)}
                  </Badge>
                </div>
              </div>
              <DialogTitle className="mt-2 text-xl">Arah brief untuk formula baru ini</DialogTitle>
              <DialogDescription className="max-w-4xl">
                AI membaca brief menjadi arah aroma per stage, lalu engine lokal meranking material dari data library dan feedback pilihan Anda.
              </DialogDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                {STAGES.map((stage) => {
                  const isActive = activeStage === stage;
                  const selectedCount = getSelectedStageItems(wizardStageItemsMap, stage).length;
                  return (
                    <Button
                      key={stage}
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      className="h-9 rounded-full px-4"
                      onClick={() => handleWizardStageJump(stage)}
                    >
                      {getStageLabel(stage)}
                      <span className="ml-2 text-xs opacity-80">{selectedCount}</span>
                    </Button>
                  );
                })}
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
              {currentQuestion ? (
                <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="min-h-0 overflow-y-auto pr-1">
                    <div className="rounded-2xl border bg-[linear-gradient(135deg,rgba(255,248,235,0.98)_0%,rgba(242,247,239,0.98)_100%)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">AI brief direction</div>
                        <Badge variant={shouldUseAiIntent(briefAiIntent) ? 'secondary' : 'outline'} className="rounded-full text-[10px]">
                          {briefAiIntentLoading ? 'reading' : shouldUseAiIntent(briefAiIntent) ? `${Math.round(Number(briefAiIntent.confidence || 0) * 100)}% fit` : 'fallback'}
                        </Badge>
                      </div>
                      <div className="mt-2 line-clamp-4 text-xs leading-relaxed text-[#4f4639]">
                        {briefAiIntentLoading
                          ? 'Sedang membaca brief dan menyusun arah aroma yang lebih contextual...'
                          : briefAiIntent?.scent_story || 'Wizard memakai fallback lokal sampai brief AI tersedia.'}
                      </div>
                      {activeTargetProfile.tags?.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {activeTargetProfile.tags.slice(0, 8).map((tag) => (
                            <Badge key={`intent-tag-${tag}`} variant="outline" className="rounded-full bg-white/70 text-[10px] capitalize">
                              {formatEffectTag(tag)}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 flex min-h-[15rem] flex-col rounded-2xl border bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(249,246,239,0.98)_100%)] p-3">
                      <div className="text-sm font-semibold">{currentQuestion.title}</div>
                      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {currentQuestion.description || `Pilihan ini membantu menentukan material awal untuk stage ${getStageLabel(activeStage).toLowerCase()}.`}
                      </div>
                      <div className="mt-3 min-h-[11rem] flex-1 overflow-y-auto pr-1">
                        <div className="grid gap-2">
                        {currentQuestion.options.map((option) => {
                          const selected = draftAnswers[activeStage]?.[currentQuestion.id] === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => handleWizardOptionSelect(currentQuestion.id, option.value)}
                              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                                selected
                                  ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                                  : 'bg-card hover:border-primary/40'
                              }`}
                            >
                              <div className="text-sm font-medium">{option.label}</div>
                              {option.hint ? (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {option.hint}
                                </div>
                              ) : null}
                              {option.tags?.length ? (
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  {option.tags.join(', ')}
                                </div>
                              ) : null}
                            </button>
                          );
                        })}
                        </div>
                      </div>
                    </div>

                    {projectUnavailable ? (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        Sinkronisasi project belum aktif, jadi kandidat stage tetap bisa dipilih di wizard ini, tetapi belum disimpan ke `brief_projects`.
                      </div>
                    ) : null}

                    <div className="mt-3 rounded-2xl border bg-background/70 p-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current target</div>
                      <div className="mt-2 text-sm font-semibold">{activeTargetProfile.summary}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="rounded-full">
                          {activeTargetProfile.impact_summary}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          {activeTargetProfile.life_summary}
                        </Badge>
                      </div>
                      <div className="mt-2 line-clamp-3 text-xs text-muted-foreground">{activeTargetProfile.stage_goal}</div>
                    </div>

                    <div className="mt-3 rounded-2xl border bg-background/70 p-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Selected direction</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {activeTargetProfile.selected_labels?.length ? activeTargetProfile.selected_labels.map((label) => (
                          <Badge key={label} variant="outline" className="rounded-full text-xs">
                            {label}
                          </Badge>
                        )) : (
                          <span className="text-sm text-muted-foreground">Belum ada jawaban yang dipilih.</span>
                        )}
                      </div>
                    </div>

                    {wizardDecisionAssist.suggestions.length ? (
                      <div className="mt-3 rounded-2xl border bg-background/70 p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Decision assist</div>
                        <div className="mt-3 space-y-2">
                          {wizardDecisionAssist.suggestions.slice(0, 3).map((suggestion, index) => (
                            <div key={`${suggestion.type}-${index}`} className="rounded-lg border bg-background px-3 py-3">
                              <div className="text-sm font-semibold">{suggestion.title}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{suggestion.message}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {wizardCompareCandidates.length ? (
                    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-background/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Candidate shortlist</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Kandidat yang di-Add atau di-Skip langsung keluar dari daftar aktif. Sistem akan menaikkan kandidat berikutnya dari pool rekomendasi.
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0 rounded-full">
                            {wizardCompareCandidates.length} visible
                          </Badge>
                        </div>

                        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                          <div className="shrink-0 rounded-2xl border bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,242,232,0.98)_100%)] p-3 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Selected for composer</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Kandidat yang Anda pilih akan langsung sinkron ke formula composer.
                                </div>
                              </div>
                              <Badge variant="secondary" className="rounded-full">
                                {selectedWizardCandidates.length} selected
                              </Badge>
                            </div>

                            {selectedWizardCandidates.length ? (
                              <div className="mt-2 overflow-x-auto pb-1">
                                <div className="flex min-w-max gap-2">
                                {selectedWizardCandidates.map((item) => {
                                  const explanation = wizardStageExplainMap.get(item.raw_material_id);
                                  const usageLabel = item.recommended_usage_label || explanation?.recommended_usage_label || null;
                                  const architectureRoleLabel = getArchitectureRoleLabel({ candidate: item, stage: activeStage });
                                  const learningSignals = getLearningSignals(item, explanation);
                                  return (
                                    <div
                                      key={`selected-${item.raw_material_id}`}
                                      className="flex w-[18rem] items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 text-xs"
                                    >
                                      <div className="min-w-0">
                                        <div className="truncate font-medium">{item.expand?.raw_material_id?.name || 'Unknown material'}</div>
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                          <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">{architectureRoleLabel}</span>
                                          {usageLabel ? (
                                            <span className="rounded-full border border-sky-200 px-2 py-0.5 text-[10px] text-sky-700">{usageLabel}</span>
                                          ) : null}
                                          {learningSignals.map((signal) => (
                                            <span key={`${item.raw_material_id}-${signal}`} className="rounded-full border border-emerald-200 px-2 py-0.5 text-[10px] text-emerald-700">
                                              {signal}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 rounded-full px-3"
                                        onClick={() => handleWizardCandidateSelection(item, 'recommended')}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  );
                                })}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 rounded-xl border border-dashed bg-background/70 px-3 py-3 text-xs text-muted-foreground">
                                Belum ada material terpilih untuk stage ini.
                              </div>
                            )}
                          </div>

                          <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-10">
                            <div className="grid gap-2 xl:grid-cols-2">
                          {wizardCompareCandidates.map((item) => {
                            const explanation = wizardStageExplainMap.get(item.raw_material_id);
                            const breakdown = explanation?.score_breakdown || null;
                            const isApplied = APPLIED_SELECTION_STATES.has(item.selection_state);
                            const isRejected = item.selection_state === 'rejected';
                            const isExpanded = expandedWizardCandidateId === item.raw_material_id;
                            const usageLabel = item.recommended_usage_label || explanation?.recommended_usage_label || null;
                            const effectTags = (
                              Array.isArray(item.effect_tags) && item.effect_tags.length
                                ? item.effect_tags
                                : Array.isArray(explanation?.effect_tags)
                                  ? explanation.effect_tags
                                  : []
                            ).slice(0, 2);
                            const architectureRoleLabel = getArchitectureRoleLabel({ candidate: item, stage: activeStage });
                            const learningSignals = getLearningSignals(item, explanation);
                            return (
                              <div
                                key={`wizard-compare-${item.id}`}
                                className={`rounded-xl border bg-background/90 p-3 transition ${
                                  isRejected ? 'opacity-55' : isApplied ? 'border-primary/40 bg-primary/5' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-start justify-between gap-3 text-left"
                                  onClick={() => setExpandedWizardCandidateId(isExpanded ? '' : item.raw_material_id)}
                                >
                                  <div className="min-w-0">
                                    <div className="line-clamp-1 text-sm font-semibold">{item.expand?.raw_material_id?.name || 'Unknown material'}</div>
                                    <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                      {item.recommendation_reason || 'Generated from stage fit'}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      <Badge variant={isRejected ? 'outline' : isApplied ? 'default' : 'secondary'} className="rounded-full text-[10px] capitalize">
                                        {item.selection_state === 'manual' ? 'manual' : item.selection_state}
                                      </Badge>
                                      <Badge variant="outline" className="rounded-full text-[10px]">
                                        {architectureRoleLabel}
                                      </Badge>
                                      {usageLabel ? (
                                        <Badge variant="outline" className="rounded-full text-[10px] text-sky-700">
                                          {usageLabel}
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="rounded-xl bg-muted/50 px-3 py-2 text-right">
                                    <div className="text-sm font-semibold leading-none">{Number(item.fit_score || 0).toFixed(1)}</div>
                                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">fit</div>
                                  </div>
                                </button>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isApplied ? 'default' : 'outline'}
                                    className="h-8 rounded-full px-3"
                                    onClick={() => handleWizardCandidateSelection(item, isApplied ? 'recommended' : 'selected')}
                                  >
                                    {isApplied ? 'Remove' : 'Add'}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isRejected ? 'default' : 'outline'}
                                    className="h-8 rounded-full px-3"
                                    onClick={() => handleWizardCandidateSelection(item, isRejected ? 'recommended' : 'rejected')}
                                  >
                                    {isRejected ? 'Undo skip' : 'Skip'}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 rounded-full px-3"
                                    onClick={() => setExpandedWizardCandidateId(isExpanded ? '' : item.raw_material_id)}
                                  >
                                    {isExpanded ? 'Hide detail' : 'Show detail'}
                                  </Button>
                                </div>

                                {isExpanded ? (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {item.primary_function ? (
                                      <Badge variant="outline" className="rounded-full text-[10px] capitalize">
                                        {formatStatus(item.primary_function)}
                                      </Badge>
                                    ) : null}
                                    {item.secondary_function ? (
                                      <Badge variant="outline" className="rounded-full text-[10px] capitalize">
                                        {formatStatus(item.secondary_function)}
                                      </Badge>
                                    ) : null}
                                    {effectTags.map((tag) => (
                                      <Badge key={`${item.id}-${tag}`} variant="outline" className="rounded-full text-[10px] capitalize">
                                        {formatEffectTag(tag)}
                                      </Badge>
                                    ))}
                                    {learningSignals.map((signal) => (
                                      <Badge key={`${item.id}-${signal}`} variant="outline" className="rounded-full border-emerald-200 text-[10px] text-emerald-700">
                                        {signal}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : null}

                                {isExpanded && breakdown ? (
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <div className="rounded-xl border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
                                      Stage {Number(breakdown.stage_natural_score || 0).toFixed(1)} • Class {formatDebugPercent(breakdown.class_fit_score)}
                                    </div>
                                    <div className="rounded-xl border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
                                      Function {formatDebugPercent(breakdown.function_fit_score)} • Life {formatDebugPercent(breakdown.life_fit_score)}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
                        Belum ada kandidat aktif. Pilih arah yang sesuai lalu tekan `Generate materials`.
                      </div>
                    )}
                  </div>
                ) : (
                <div className="rounded-2xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  Wizard untuk stage ini belum punya pertanyaan.
                </div>
              )}
            </div>

            <DialogFooter className="shrink-0 border-t px-5 py-4">
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
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="text-xs text-muted-foreground">
                    {getAppliedStageItems(wizardStageItemsMap).length} material dipilih untuk composer
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={handleWizardNextStage}
                    disabled={activeStage === 'base'}
                  >
                    Continue to next stage
                  </Button>
                  <Button
                    className="rounded-xl gap-2"
                    onClick={activeStage === 'base' && hasCurrentWizardCandidates ? handleFinishWizard : handleGenerateWizardMaterials}
                    disabled={busyStage === activeStage}
                  >
                    <Sparkles className="h-4 w-4" />
                    {busyStage === activeStage
                      ? 'Generating...'
                      : activeStage === 'base' && hasCurrentWizardCandidates
                        ? 'Finish wizard'
                        : 'Generate materials'}
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
                            Reference links {referenceLinksMap.size}
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

                        <div className="mt-4">
                          <FormulaScaleTool
                            formulaItems={formulaItems}
                            totalGrams={totalGrams}
                            replaceFormulaItems={replaceFormulaItems}
                          />
                        </div>

                        <div className="mt-4">
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
                              onCreateMissingMaterial={handleCreateMissingMaterial}
                              needsGuidanceMaterialId={needsGuidanceMaterialId}
                            />
                        </div>

                        <div className="mt-4">
                          <FormulaComposerPacePanel
                            items={itemsWithPercentages}
                            rawMaterialsById={rawMaterialsById}
                            referenceLinksMap={referenceLinksMap}
                            onApplyRecommendation={handleApplyPaceRecommendation}
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
                      <FormulaMaterialLibrary
                        materials={filteredLibraryMaterials}
                        activeRowIndex={activeRowIndex}
                        currentRowItemId={formulaItems[activeRowIndex]?.item_id}
                        selectedRawMaterialIdsSet={selectedRawMaterialIdsSet}
                        mobile
                        onSelect={(itemId) => handleMobileLibraryPick(itemId)}
                        onDoubleSelect={handleLibraryDoubleClick}
                        getDisabledState={({ material, currentRowItemId, selectedRawMaterialIdsSet: selectedIds }) => (
                          selectedIds.has(material.id) && currentRowItemId !== material.id
                        )}
                        getBadgeLabel={({ material, currentRowItemId, selectedRawMaterialIdsSet: selectedIds, activeRowIndex, mobile }) => {
                          const alreadyAdded = selectedIds.has(material.id) && currentRowItemId !== material.id;
                          return alreadyAdded ? 'Added' : (mobile ? 'Tap to add' : `Row ${activeRowIndex + 1}`);
                        }}
                      />
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
                        Reference links {referenceLinksMap.size}
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
                        <FormulaMaterialLibrary
                          materials={filteredLibraryMaterials}
                          activeRowIndex={activeRowIndex}
                          currentRowItemId={formulaItems[activeRowIndex]?.item_id}
                          selectedRawMaterialIdsSet={selectedRawMaterialIdsSet}
                          onSelect={(itemId) => handleLibrarySelect(itemId)}
                          onDoubleSelect={handleLibraryDoubleClick}
                          getDisabledState={({ material, currentRowItemId, selectedRawMaterialIdsSet: selectedIds }) => (
                            selectedIds.has(material.id) && currentRowItemId !== material.id
                          )}
                          getBadgeLabel={({ material, currentRowItemId, selectedRawMaterialIdsSet: selectedIds, activeRowIndex, mobile }) => {
                            const alreadyAdded = selectedIds.has(material.id) && currentRowItemId !== material.id;
                            return alreadyAdded ? 'Added' : (mobile ? 'Tap to add' : `Row ${activeRowIndex + 1}`);
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <FormulaScaleTool
                        formulaItems={formulaItems}
                        totalGrams={totalGrams}
                        replaceFormulaItems={replaceFormulaItems}
                      />
                    </div>

                    <div className="mt-4">
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
                          onCreateMissingMaterial={handleCreateMissingMaterial}
                          needsGuidanceMaterialId={needsGuidanceMaterialId}
                        />
                    </div>

                    <div className="mt-4">
                      <FormulaComposerPacePanel
                        items={itemsWithPercentages}
                        rawMaterialsById={rawMaterialsById}
                        referenceLinksMap={referenceLinksMap}
                    onApplyRecommendation={handleApplyPaceRecommendation}
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

        <FormulaMaterialQuickCreateDialog
        open={Boolean(quickCreateIntent)}
        materialName={quickCreateIntent?.name || ''}
        duplicateCandidates={quickCreateDuplicateCandidates}
        loading={quickCreateLoading}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setQuickCreateIntent(null);
        }}
        onSelectExisting={handleSelectQuickCreateExistingMaterial}
        onConfirm={handleConfirmQuickCreateMaterial}
      />

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

