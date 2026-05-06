import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useBriefProjects } from '@/hooks/useBriefProjects.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { ensureReferenceLinksForRawMaterials } from '@/services/materialReferenceService.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { selectRelatedBriefFormulaIds } from '@/utils/briefFormulaHistory.js';
import { buildStageTargetProfile, getStageLabel, getWizardQuestionsForStage } from '@/utils/briefProjectWizard.js';
import {
  buildHistoricalFormulaFeedbackContext,
  createEmptyRecommendationFeedbackContext,
  buildRecommendationFeedbackContext,
  buildStageDecisionAssist,
  explainMaterialForStage,
  mergeRecommendationFeedbackContexts,
  rankMaterialRecommendations,
} from '@/utils/materialCompositionProfile.js';
import { readPersistedRecommendationLearning } from '@/utils/recommendationLearningStorage.js';
import {
  formatDebugPercent,
  getEmptyDrafts,
  getFirstIncompleteQuestionIndex,
  getSelectedStageItems,
  getStageStatusFromItems,
  resolveActiveBoardStage,
  STAGES,
} from '@/utils/briefProjectBoard.js';

const STAGE_RECOMMENDATION_LIMIT = 30;
const STAGE_COMPARE_VISIBLE_LIMIT = 12;

export const useBriefDetailPage = (id) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getBriefs } = useBriefs();
  const { getFormulas } = useFormulas();
  const { getFormulaItemsByFormulaIds } = useFormulaItems();
  const {
    ensureBriefProject,
    getBriefProjectByBriefId,
    getBriefProjectStages,
    getBriefProjectStageItems,
    upsertBriefProjectStage,
    upsertBriefProjectStageItems,
    deleteBriefProjectStageItem,
    deleteBriefProjectStageItemsByStage,
    updateBriefProject,
  } = useBriefProjects();
  const { getValidationLogs } = useValidationLogs();

  const [brief, setBrief] = useState(null);
  const [formula, setFormula] = useState(null);
  const [validationLogs, setValidationLogs] = useState([]);
  const [project, setProject] = useState(null);
  const [stageMap, setStageMap] = useState(new Map());
  const [stageItemsMap, setStageItemsMap] = useState(new Map(STAGES.map((stage) => [stage, []])));
  const [draftAnswers, setDraftAnswers] = useState(getEmptyDrafts());
  const [activeStage, setActiveStage] = useState('top');
  const [availableMaterials, setAvailableMaterials] = useState([]);
  const [referenceLinksMap, setReferenceLinksMap] = useState(new Map());
  const [historicalFormulaFeedbackEntries, setHistoricalFormulaFeedbackEntries] = useState([]);
  const [persistedRecommendationFeedbackContext, setPersistedRecommendationFeedbackContext] = useState(() => createEmptyRecommendationFeedbackContext());
  const [loading, setLoading] = useState(true);
  const [busyStage, setBusyStage] = useState('');
  const [projectUnavailable, setProjectUnavailable] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardQuestionIndex, setWizardQuestionIndex] = useState(0);
  const autoOpenedWizardRef = useRef(false);

  const projectPhase = project?.current_stage || activeStage;

  const loadBoard = async () => {
    setLoading(true);
    try {
      const [briefsResult, formulasResult, materialsResult] = await Promise.allSettled([
        getBriefs(),
        getFormulas(),
        getRawMaterialOptions(),
      ]);

      const briefs = briefsResult.status === 'fulfilled' ? briefsResult.value : [];
      const formulas = formulasResult.status === 'fulfilled' ? formulasResult.value : [];
      const materialRows = materialsResult.status === 'fulfilled' ? materialsResult.value : [];

      const briefRow = briefs.find((item) => item.id === id) || null;
      if (!briefRow) {
        throw new Error('Brief not found');
      }

      const linkedFormula = briefRow.formula_id
        ? formulas.find((item) => item.id === briefRow.formula_id) || null
        : null;
      const relatedHistoryTargets = selectRelatedBriefFormulaIds({
        briefs,
        currentBrief: briefRow,
        excludeFormulaId: briefRow?.formula_id || '',
        limit: 12,
      });
      const validationRows = briefRow.formula_id
        ? await getValidationLogs({ formulaId: briefRow.formula_id }).catch((error) => {
            console.error('Failed to load validation logs for brief project:', error);
            return [];
          })
        : [];
      const linksMap = await ensureReferenceLinksForRawMaterials(materialRows.filter((item) => item.type !== 'solvent'))
        .catch((error) => {
          console.error('Failed to load reference links for brief project:', error);
          return new Map();
        });
      let historicalFormulaFeedbackEntries = [];
      if (relatedHistoryTargets.length) {
        try {
          const historicalItems = await getFormulaItemsByFormulaIds(relatedHistoryTargets.map((entry) => entry.formulaId));
          const historicalItemsByFormulaId = new Map();
          historicalItems.forEach((item) => {
            const formulaId = String(item?.formula_id || '');
            if (!formulaId) {
              return;
            }
            const current = historicalItemsByFormulaId.get(formulaId) || [];
            current.push(item);
            historicalItemsByFormulaId.set(formulaId, current);
          });
          historicalFormulaFeedbackEntries = relatedHistoryTargets.map((entry) => ({
            formulaId: entry.formulaId,
            briefText: entry.briefText,
            items: historicalItemsByFormulaId.get(entry.formulaId) || [],
          })).filter((entry) => entry.items.length > 0);
        } catch (historyError) {
          console.error('Failed to load brief history formula memory:', historyError);
        }
      }

      let resolvedProject = null;
      let projectStages = new Map();
      let projectItems = new Map(STAGES.map((stage) => [stage, []]));
      let nextProjectUnavailable = false;

      try {
        const ensuredProject = await ensureBriefProject(id);
        const [projectRowResult, projectStagesResult, projectItemsResult] = await Promise.allSettled([
          getBriefProjectByBriefId(id),
          getBriefProjectStages(ensuredProject.id),
          getBriefProjectStageItems(ensuredProject.id),
        ]);

        resolvedProject = projectRowResult.status === 'fulfilled' ? (projectRowResult.value || ensuredProject) : ensuredProject;
        projectStages = projectStagesResult.status === 'fulfilled' ? projectStagesResult.value : new Map();
        projectItems = projectItemsResult.status === 'fulfilled'
          ? projectItemsResult.value
          : new Map(STAGES.map((stage) => [stage, []]));
      } catch (projectError) {
        console.error('Brief project layer unavailable:', projectError);
        nextProjectUnavailable = true;
      }

      setBrief(briefRow);
      setFormula(linkedFormula);
      setValidationLogs(validationRows);
      setProject(resolvedProject);
      setProjectUnavailable(nextProjectUnavailable);
      setStageMap(projectStages);
      setStageItemsMap(projectItems);
      setAvailableMaterials(materialRows.filter((item) => item.type !== 'solvent'));
      setReferenceLinksMap(linksMap);
      setHistoricalFormulaFeedbackEntries(historicalFormulaFeedbackEntries);
      setDraftAnswers({
        top: projectStages.get('top')?.answers || {},
        middle: projectStages.get('middle')?.answers || {},
        base: projectStages.get('base')?.answers || {},
      });
      setActiveStage(resolveActiveBoardStage(resolvedProject?.current_stage || 'top'));
    } catch (error) {
      console.error('Failed to load project board:', error);
      toast.error('Failed to load project board');
      navigate('/briefs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    autoOpenedWizardRef.current = false;
    loadBoard();
  }, [id]);

  useEffect(() => {
    if (loading || !brief || autoOpenedWizardRef.current || searchParams.get('openWizard') !== '1') {
      return;
    }

    autoOpenedWizardRef.current = true;
    openStageWizard(resolveActiveBoardStage(project?.current_stage || 'top'));

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('openWizard');
    setSearchParams(nextSearchParams, { replace: true });
  }, [brief, loading, project?.current_stage, searchParams, setSearchParams]);

  const selectedItemsByStage = useMemo(() => {
    const selected = new Map(STAGES.map((stage) => [stage, []]));
    STAGES.forEach((stage) => {
      const rows = stageItemsMap.get(stage) || [];
      selected.set(stage, rows.filter((item) => item.selection_state === 'selected' || item.selection_state === 'manual'));
    });
    return selected;
  }, [stageItemsMap]);

  const actionNeededLogs = useMemo(
    () => validationLogs.filter((log) => log.status === 'action_needed'),
    [validationLogs]
  );

  const currentQuestions = useMemo(
    () => getWizardQuestionsForStage(activeStage, draftAnswers[activeStage] || {}),
    [activeStage, draftAnswers]
  );

  const currentQuestion = currentQuestions[wizardQuestionIndex] || currentQuestions[currentQuestions.length - 1] || null;
  const currentStageRows = stageItemsMap.get(activeStage) || [];
  const currentSelectedRows = selectedItemsByStage.get(activeStage) || [];
  const currentGeneratedRows = currentSelectedRows;
  const currentRecommendedRows = currentStageRows.filter((item) => item.selection_state === 'recommended');
  const currentRejectedRows = currentStageRows.filter((item) => item.selection_state === 'rejected');
  const activeTargetProfile = buildStageTargetProfile(activeStage, draftAnswers[activeStage] || {}, brief);
  const briefText = useMemo(
    () => [brief?.mood_story, brief?.audience_usage, brief?.performance_target, brief?.budget_direction].filter(Boolean).join(' '),
    [brief]
  );
  const availableMaterialsById = useMemo(
    () => new Map(availableMaterials.map((item) => [item.id, item])),
    [availableMaterials]
  );
  const recommendationFeedbackContext = useMemo(() => buildRecommendationFeedbackContext({
    stageItems: STAGES.flatMap((stage) => stageItemsMap.get(stage) || []),
    rawMaterialsById: availableMaterialsById,
    referenceLinksMap,
    stage: activeStage,
  }), [activeStage, availableMaterialsById, referenceLinksMap, stageItemsMap]);
  const historicalRecommendationFeedbackContext = useMemo(() => buildHistoricalFormulaFeedbackContext({
    entries: historicalFormulaFeedbackEntries,
    rawMaterialsById: availableMaterialsById,
    referenceLinksMap,
    stage: activeStage,
    targetProfile: activeTargetProfile,
    briefText,
  }), [activeStage, activeTargetProfile, availableMaterialsById, briefText, historicalFormulaFeedbackEntries, referenceLinksMap]);
  const combinedRecommendationFeedbackContext = useMemo(
    () => mergeRecommendationFeedbackContexts(
      persistedRecommendationFeedbackContext,
      recommendationFeedbackContext,
      historicalRecommendationFeedbackContext,
    ),
    [historicalRecommendationFeedbackContext, persistedRecommendationFeedbackContext, recommendationFeedbackContext]
  );

  useEffect(() => {
    const learningUserId = brief?.user_id || formula?.user_id || '';
    setPersistedRecommendationFeedbackContext(readPersistedRecommendationLearning(learningUserId));
  }, [brief?.user_id, formula?.user_id]);

  const stageMaterialExplainMap = useMemo(() => new Map(
    currentStageRows.map((item) => {
      const material = item.expand?.raw_material_id || null;
      if (!material?.id) {
        return [item.raw_material_id, null];
      }

      const explanation = explainMaterialForStage({
        material,
        referenceLink: referenceLinksMap.get(material.id) || null,
        stage: activeStage,
        answers: draftAnswers[activeStage] || {},
        briefText,
        targetProfile: activeTargetProfile,
        feedbackContext: combinedRecommendationFeedbackContext,
      });

      return [item.raw_material_id, explanation];
    }),
  ), [activeStage, activeTargetProfile, briefText, combinedRecommendationFeedbackContext, currentStageRows, draftAnswers, referenceLinksMap]);

  const compareCandidates = useMemo(() => (
    [...currentRecommendedRows]
      .sort((left, right) => Number(right.fit_score || 0) - Number(left.fit_score || 0))
      .slice(0, STAGE_COMPARE_VISIBLE_LIMIT)
  ), [currentRecommendedRows]);

  const decisionAssist = useMemo(() => buildStageDecisionAssist({
    items: compareCandidates,
    explanationMap: stageMaterialExplainMap,
  }), [compareCandidates, stageMaterialExplainMap]);

  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from, { state: { restoreScroll: true } });
      return;
    }

    navigate('/briefs');
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

  const openStageWizard = async (stage) => {
    await handleOpenNextStage(stage);
    const nextQuestions = getWizardQuestionsForStage(stage, draftAnswers[stage] || {});
    setWizardQuestionIndex(getFirstIncompleteQuestionIndex(nextQuestions, draftAnswers[stage] || {}));
    setWizardOpen(true);
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

  const handleWizardNextStage = async () => {
    const nextStage = STAGES[Math.min(STAGES.indexOf(activeStage) + 1, STAGES.length - 1)];
    if (nextStage === activeStage) {
      return;
    }

    await openStageWizard(nextStage);
  };

  const handleFinishWizard = async () => {
    setWizardOpen(false);

    if (project?.id && !projectUnavailable && allStagesReady && !formula) {
      try {
        const nextProject = await updateBriefProject(project.id, {
          status: 'ready_for_formula',
          current_stage: 'review',
        });
        setProject(nextProject);
      } catch (error) {
        toast.error(error.message || 'Failed to finish wizard');
        return;
      }
    }

    toast.success(
      allStagesReady
        ? 'Wizard selesai. Top, middle, dan base siap diteruskan ke formula.'
        : `${getStageLabel(activeStage)} stage tersimpan. Pilih material untuk tiap stage supaya bisa lanjut formula.`
    );
  };

  const refreshProjectState = async (projectId, fallbackProject = null) => {
    const [nextProject, nextStageMap, nextStageItemsMap] = await Promise.all([
      getBriefProjectByBriefId(id),
      getBriefProjectStages(projectId),
      getBriefProjectStageItems(projectId),
    ]);
    const resolvedProject = nextProject || fallbackProject || project || null;
    setProject(resolvedProject);
    setStageMap(nextStageMap);
    setStageItemsMap(nextStageItemsMap);
    setActiveStage((current) => (
      STAGES.includes(resolvedProject?.current_stage)
        ? resolvedProject.current_stage
        : current
    ));
    return { nextProject: resolvedProject, nextStageMap, nextStageItemsMap };
  };

  const syncProjectSelectionPhase = async (projectId, nextStageItemsMap, preferredStage) => {
    if (!projectId || formula || projectUnavailable) {
      return;
    }

    const selectionReady = STAGES.every((stage) => getSelectedStageItems(nextStageItemsMap, stage).length > 0);
    const nextProject = await updateBriefProject(projectId, {
      status: selectionReady ? 'ready_for_formula' : 'in_progress',
      current_stage: selectionReady ? 'review' : preferredStage,
    });
    setProject(nextProject);
  };

  const updateLocalStageState = (stage, rows, answers = draftAnswers[stage] || {}) => {
    const targetProfile = buildStageTargetProfile(stage, answers, brief);
    setStageMap((current) => {
      const next = new Map(current);
      next.set(stage, {
        ...(current.get(stage) || {}),
        stage,
        status: getStageStatusFromItems(rows),
        answers,
        target_profile: targetProfile,
        recommendation_note: targetProfile.summary,
      });
      return next;
    });
    setStageItemsMap((current) => {
      const next = new Map(current);
      next.set(stage, rows);
      return next;
    });
  };

  const handleGenerateRecommendations = async () => {
    if (!project && !projectUnavailable) {
      return;
    }

    const stageAnswers = draftAnswers[activeStage] || {};
    if (!stageAnswers.family) {
      toast.error('Choose the stage tone first');
      return;
    }

    setBusyStage(activeStage);
    try {
      const targetProfile = buildStageTargetProfile(activeStage, stageAnswers, brief);
      const ranked = rankMaterialRecommendations({
        materials: availableMaterials,
        referenceLinksMap,
        stage: activeStage,
        answers: stageAnswers,
        briefText,
        targetProfile,
        limit: STAGE_RECOMMENDATION_LIMIT,
        feedbackContext: combinedRecommendationFeedbackContext,
      });
      const existingStageRows = stageItemsMap.get(activeStage) || [];
      const existingByMaterialId = new Map(existingStageRows.map((item) => [item.raw_material_id, item]));

      if (projectUnavailable || !project) {
        const localRows = ranked.map((row, index) => {
          const material = availableMaterials.find((item) => item.id === row.raw_material_id) || null;
          const existing = existingByMaterialId.get(row.raw_material_id);
          const nextSelectionState = existing?.selection_state === 'manual'
            ? 'manual'
            : existing?.selection_state === 'selected'
              ? 'selected'
              : 'recommended';

          return {
            id: existing?.id || `local-${activeStage}-${row.raw_material_id}-${index}`,
            stage: activeStage,
            raw_material_id: row.raw_material_id,
            selection_state: nextSelectionState,
            role: existing?.role || row.primary_function || 'support',
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

        updateLocalStageState(activeStage, localRows, stageAnswers);
        toast.success(`${getStageLabel(activeStage)} materials generated`);
        return;
      }

      await upsertBriefProjectStage(project.id, activeStage, {
        status: ranked.length ? 'completed' : 'reviewed',
        answers: stageAnswers,
        target_profile: targetProfile,
        recommendation_note: targetProfile.summary,
      });

      await deleteBriefProjectStageItemsByStage(project.id, activeStage, ['recommended', 'rejected', 'selected']);
      await upsertBriefProjectStageItems(project.id, ranked.map((row) => {
        const existing = existingByMaterialId.get(row.raw_material_id);
        return {
          stage: activeStage,
          raw_material_id: row.raw_material_id,
          selection_state: existing?.selection_state === 'manual'
            ? 'manual'
            : existing?.selection_state === 'selected'
              ? 'selected'
              : 'recommended',
          role: existing?.role || row.primary_function || 'support',
          rank_order: row.rank_order,
          fit_score: row.fit_score,
          primary_function: row.primary_function,
          secondary_function: row.secondary_function,
          recommendation_reason: row.recommendation_reason,
          warning: row.warning,
        };
      }));

      await updateBriefProject(project.id, {
        status: 'in_progress',
        current_stage: activeStage,
      });

      const { nextStageItemsMap } = await refreshProjectState(project.id, project);
      await syncProjectSelectionPhase(project.id, nextStageItemsMap, activeStage);
      toast.success(`${getStageLabel(activeStage)} materials generated`);
    } catch (error) {
      toast.error(error.message || 'Failed to generate recommendations');
    } finally {
      setBusyStage('');
    }
  };

  const handleStageItemState = async (item, selectionState) => {
    if ((!project && !projectUnavailable) || !item) {
      return;
    }

    try {
      if (projectUnavailable || !project) {
        const nextRows = (stageItemsMap.get(item.stage) || []).map((row) => (
          row.raw_material_id === item.raw_material_id
            ? { ...row, selection_state: selectionState }
            : row
        ));
        updateLocalStageState(item.stage, nextRows);
        return;
      }

      await upsertBriefProjectStageItems(project.id, [{
        stage: item.stage,
        raw_material_id: item.raw_material_id,
        selection_state: selectionState,
        role: item.role || item.primary_function || 'support',
        rank_order: item.rank_order || 0,
        fit_score: item.fit_score,
        primary_function: item.primary_function,
        secondary_function: item.secondary_function,
        recommendation_reason: item.recommendation_reason,
        warning: item.warning,
      }]);

      const stageRows = stageItemsMap.get(item.stage) || [];
      const nextStageRows = stageRows.map((row) => (
        row.raw_material_id === item.raw_material_id
          ? { ...row, selection_state: selectionState }
          : row
      ));
      const stageSelectedCount = nextStageRows.filter((row) => row.selection_state === 'selected' || row.selection_state === 'manual').length;

      await upsertBriefProjectStage(project.id, item.stage, {
        status: stageSelectedCount > 0 ? 'completed' : 'reviewed',
        answers: stageMap.get(item.stage)?.answers || draftAnswers[item.stage] || {},
        target_profile: stageMap.get(item.stage)?.target_profile || buildStageTargetProfile(item.stage, draftAnswers[item.stage] || {}, brief),
        recommendation_note: stageMap.get(item.stage)?.recommendation_note || null,
      });

      const { nextStageItemsMap } = await refreshProjectState(project.id, project);
      await syncProjectSelectionPhase(project.id, nextStageItemsMap, item.stage);
    } catch (error) {
      toast.error(error.message || 'Failed to update stage selection');
    }
  };

  const handleRemoveStageItem = async (item) => {
    if ((!project && !projectUnavailable) || !item) {
      return;
    }

    try {
      if (projectUnavailable || !project) {
        const nextRows = (stageItemsMap.get(item.stage) || []).filter((row) => row.raw_material_id !== item.raw_material_id);
        updateLocalStageState(item.stage, nextRows);
        return;
      }

      if (!item.id) {
        return;
      }

      await deleteBriefProjectStageItem(item.id);
      const { nextStageItemsMap } = await refreshProjectState(project.id, project);
      await syncProjectSelectionPhase(project.id, nextStageItemsMap, item.stage);
    } catch (error) {
      toast.error(error.message || 'Failed to remove material');
    }
  };

  const handleOpenNextStage = async (nextStage) => {
    if (!project && !projectUnavailable) {
      return;
    }

    setActiveStage(nextStage);
    if (projectUnavailable || !project) {
      return;
    }

    try {
      await updateBriefProject(project.id, {
        status: 'in_progress',
        current_stage: nextStage,
      });
      setProject((current) => current ? { ...current, current_stage: nextStage } : current);
    } catch {
      toast.error('Failed to move project stage');
    }
  };

  const allStagesReady = STAGES.every((stage) => (selectedItemsByStage.get(stage) || []).length > 0);
  const readyStageCount = STAGES.filter((stage) => (selectedItemsByStage.get(stage) || []).length > 0).length;
  const stageBoardCompleted = allStagesReady || projectPhase === 'review' || Boolean(formula);
  const selectedMaterialIds = [...new Set(
    STAGES.flatMap((stage) => (selectedItemsByStage.get(stage) || []).map((item) => item.raw_material_id))
  )];

  const projectPhaseLabel = projectPhase === 'review'
    ? 'Review stage'
    : projectPhase === 'formula'
      ? 'Formula phase'
      : projectPhase === 'validation'
        ? 'Validation phase'
        : `${getStageLabel(activeStage)} stage`;

  const stageFlowHint = projectPhase === 'review'
    ? 'Seleksi top, middle, dan base sudah siap ditinjau sebelum diteruskan ke formula.'
    : projectPhase === 'formula'
      ? 'Board stage sudah selesai. Fokus project sekarang bergeser ke formula composer.'
      : projectPhase === 'validation'
        ? 'Project sudah masuk fase validation, jadi wizard ini berfungsi sebagai jejak keputusan stage.'
        : null;

  const nextPrimaryAction = formula
    ? {
        label: actionNeededLogs.length ? 'Open validation' : 'Open formula',
        onClick: () => navigate(actionNeededLogs.length ? `/validation?formulaId=${formula.id}` : `/formulas/${formula.id}`),
      }
    : projectUnavailable
      ? {
          label: allStagesReady ? 'Compose formula' : `Continue ${getStageLabel(activeStage)} wizard`,
          onClick: () => (
            allStagesReady
              ? navigate(`/formulas/new?briefId=${brief.id}&materialIds=${selectedMaterialIds.join(',')}`)
              : openStageWizard(activeStage)
          ),
        }
      : {
          label: 'Compose formula',
          onClick: () => navigate(`/formulas/new?briefId=${brief.id}&projectId=${project.id}`),
        };

  const activeStageAnswers = draftAnswers[activeStage] || {};
  const activeAnswerLabels = currentQuestions
    .map((question) => {
      const option = question.options.find((item) => item.value === activeStageAnswers[question.id]);
      return option ? { id: question.id, title: question.title, label: option.label } : null;
    })
    .filter(Boolean);

  return {
    actionNeededLogs,
    activeAnswerLabels,
    activeStage,
    activeTargetProfile,
    allStagesReady,
    brief,
    busyStage,
    compareCandidates,
    currentGeneratedRows,
    currentQuestion,
    currentQuestions,
    currentRecommendedRows,
    currentRejectedRows,
    decisionAssist,
    draftAnswers,
    formatDebugPercent,
    formula,
    handleBack,
    handleGenerateRecommendations,
    handleOpenNextStage,
    handleRemoveStageItem,
    handleStageItemState,
    handleWizardBack,
    handleFinishWizard,
    handleWizardNext,
    handleWizardNextStage,
    handleWizardOptionSelect,
    loading,
    nextPrimaryAction,
    openStageWizard,
    project,
    projectPhase,
    projectPhaseLabel,
    projectUnavailable,
    readyStageCount,
    searchParams,
    selectedItemsByStage,
    selectedMaterialIds,
    setWizardOpen,
    stageBoardCompleted,
    stageFlowHint,
    stageMap,
    stageMaterialExplainMap,
    validationLogs,
    wizardOpen,
    wizardQuestionIndex,
  };
};
