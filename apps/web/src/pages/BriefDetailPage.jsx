import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Layers3, Sparkles, WandSparkles, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { toast } from 'sonner';
import DetailMetadata from '@/components/DetailMetadata.jsx';
import DetailPageHeader from '@/components/DetailPageHeader.jsx';
import DetailPageLayout from '@/components/DetailPageLayout.jsx';
import DetailSection from '@/components/DetailSection.jsx';
import { useBriefProjects } from '@/hooks/useBriefProjects.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { ensureReferenceLinksForRawMaterials } from '@/services/materialReferenceService.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { buildStageTargetProfile, getStageLabel, getWizardQuestionsForStage } from '@/utils/briefProjectWizard.js';
import { buildStageDecisionAssist, explainMaterialForStage, rankMaterialRecommendations } from '@/utils/materialCompositionProfile.js';
import { formatDate, formatStatus } from '@/utils/formatting.js';

const STAGES = ['top', 'middle', 'base'];
const POST_STAGE_PHASES = ['review', 'formula', 'validation'];

const stageColorMap = {
  top: 'bg-[#fff4df] text-[#8b5d00] border-[#f2d39a]',
  middle: 'bg-[#f9edea] text-[#8e4f3b] border-[#e9c1b4]',
  base: 'bg-[#efe8de] text-[#6a5439] border-[#d9c6ab]',
};

const getEmptyDrafts = () => ({
  top: {},
  middle: {},
  base: {},
});

const resolveActiveBoardStage = (currentStage) => {
  if (STAGES.includes(currentStage)) {
    return currentStage;
  }

  if (POST_STAGE_PHASES.includes(currentStage)) {
    return 'base';
  }

  return 'top';
};

const getSelectedStageItems = (stageItemsMap, stage) =>
  (stageItemsMap.get(stage) || []).filter((item) => item.selection_state === 'selected' || item.selection_state === 'manual');

const getStageStatusFromItems = (items) => (
  items.some((item) => item.selection_state === 'selected' || item.selection_state === 'manual')
    ? 'completed'
    : 'reviewed'
);

const getFirstIncompleteQuestionIndex = (questions, answers = {}) => {
  const firstIncompleteIndex = questions.findIndex((question) => !answers?.[question.id]);
  return firstIncompleteIndex >= 0 ? firstIncompleteIndex : Math.max(questions.length - 1, 0);
};

const formatDebugPercent = (value) => `${Math.round(Number(value || 0))}%`;

const BriefDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getBriefs } = useBriefs();
  const { getFormulas } = useFormulas();
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
  const currentGeneratedRows = currentStageRows.filter((item) => item.selection_state === 'selected' || item.selection_state === 'manual');
  const currentRejectedRows = currentStageRows.filter((item) => item.selection_state === 'rejected');
  const activeTargetProfile = buildStageTargetProfile(activeStage, draftAnswers[activeStage] || {}, brief);
  const briefText = useMemo(
    () => [brief?.mood_story, brief?.audience_usage, brief?.performance_target, brief?.budget_direction].filter(Boolean).join(' '),
    [brief]
  );
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
      });

      return [item.raw_material_id, explanation];
    }),
  ), [activeStage, activeTargetProfile, briefText, currentStageRows, draftAnswers, referenceLinksMap]);
  const compareCandidates = useMemo(() => (
    [...currentStageRows]
      .sort((left, right) => Number(right.fit_score || 0) - Number(left.fit_score || 0))
      .slice(0, 8)
  ), [currentStageRows]);
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
        limit: 8,
      });
      const existingStageRows = stageItemsMap.get(activeStage) || [];
      const existingByMaterialId = new Map(existingStageRows.map((item) => [item.raw_material_id, item]));

      if (projectUnavailable || !project) {
        const localRows = ranked.map((row, index) => {
          const material = availableMaterials.find((item) => item.id === row.raw_material_id) || null;
          const existing = existingByMaterialId.get(row.raw_material_id);
          return {
            id: existing?.id || `local-${activeStage}-${row.raw_material_id}-${index}`,
            stage: activeStage,
            raw_material_id: row.raw_material_id,
            selection_state: existing?.selection_state === 'manual' ? 'manual' : 'selected',
            role: existing?.role || row.primary_function || 'support',
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
          selection_state: existing?.selection_state === 'manual' ? 'manual' : 'selected',
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

      const stageSelectedCount = (selectionState === 'selected' || selectionState === 'manual')
        ? (selectedItemsByStage.get(item.stage)?.length || 0) + 1
        : Math.max((selectedItemsByStage.get(item.stage)?.length || 1) - 1, 0);

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
    } catch (error) {
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

  if (loading) {
    return (
      <DetailPageLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </DetailPageLayout>
    );
  }

  if (!brief || (!project && !projectUnavailable)) {
    return (
      <DetailPageLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </DetailPageLayout>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${brief.title} - Composition Project`}</title>
        <meta name="description" content="Guide one brief through top, middle, and base decisions before turning the shortlist directly into a formula." />
      </Helmet>

      <DetailPageLayout>
        <DetailPageHeader
          eyebrow="Composition project"
          title={brief.title}
          subtitle="Brief ini sekarang menjadi satu project kerja: arahkan top, middle, dan base lewat wizard, generate material, lalu teruskan langsung ke formula."
          badge={(
            <Badge variant="outline" className="capitalize text-xs">
              {brief.status || 'draft'}
            </Badge>
          )}
          onBack={handleBack}
          backLabel="Back to briefs"
          meta={(
            <>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Current phase</span>
                <span className="detail-page-meta-value">{formatStatus(projectPhase)}</span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Ready stages</span>
                <span className="detail-page-meta-value">{readyStageCount}/3</span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Action logs</span>
                <span className="detail-page-meta-value">{actionNeededLogs.length}</span>
              </div>
            </>
          )}
          actions={(
            <>
              <Button variant="outline" className="h-9 gap-2" onClick={() => navigate('/raw-materials')}>
                Library
              </Button>
              <Button
                className="h-9 gap-2"
                onClick={nextPrimaryAction.onClick}
                disabled={!projectUnavailable && !formula && !allStagesReady}
              >
                {nextPrimaryAction.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
        />

        <div className="space-y-5">
          <DetailSection title="Direction">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Mood and story</div>
                <div className="mt-2 whitespace-pre-wrap text-sm">{brief.mood_story || '-'}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Audience and usage</div>
                <div className="mt-2 whitespace-pre-wrap text-sm">{brief.audience_usage || '-'}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Performance target</div>
                <div className="mt-2 whitespace-pre-wrap text-sm">{brief.performance_target || '-'}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Budget and direction</div>
                <div className="mt-2 whitespace-pre-wrap text-sm">{brief.budget_direction || '-'}</div>
              </div>
            </div>
          </DetailSection>

          <>
            <DetailSection title="Stage flow">
              {projectUnavailable ? (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Project persistence belum sinkron, jadi wizard ini berjalan dalam mode lokal dulu. Kamu tetap bisa isi profil top, middle, dan base lalu langsung lanjut compose formula dari hasil generate.
                </div>
              ) : null}
                {stageFlowHint ? (
                  <div className="mb-4 rounded-xl border bg-background/60 p-4 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{projectPhaseLabel}.</span> {stageFlowHint}
                  </div>
                ) : null}
                <div className="grid gap-3 lg:grid-cols-3">
                  {STAGES.map((stage) => {
                    const stageRows = selectedItemsByStage.get(stage) || [];
                    const stageState = stageMap.get(stage);
                    const isActive = activeStage === stage;
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => openStageWizard(stage)}
                        className={`rounded-2xl border p-4 text-left transition ${isActive ? 'border-primary bg-primary/5 shadow-sm' : 'bg-card hover:border-primary/40'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="outline" className={`capitalize ${stageColorMap[stage]}`}>
                            {getStageLabel(stage)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{stageRows.length} selected</span>
                        </div>
                        <div className="mt-3 text-sm font-semibold">
                          {stageState?.target_profile?.summary || `${getStageLabel(stage)} belum dibentuk`}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {stageState?.status ? formatStatus(stageState.status) : 'Pending'}
                        </div>
                        <div className="mt-3 text-xs font-medium text-primary">
                          {stageRows.length ? 'Edit profile' : 'Start wizard'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </DetailSection>

              <DetailSection title={`${getStageLabel(activeStage)} profile`}>
                <div className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
                  <div className="rounded-2xl border bg-card p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <WandSparkles className="h-4 w-4 text-primary" />
                      Wizard ringkas
                    </div>
                    <div className="mt-4 text-sm text-muted-foreground">
                      Pilihan aroma untuk stage ini sekarang dibuka lewat modal bertingkat. Anda bisa berhenti di tengah, lanjut ke stage berikutnya, atau kembali edit kapan saja.
                    </div>

                    <div className="mt-4 space-y-2">
                      {activeAnswerLabels.length ? activeAnswerLabels.map((answer) => (
                        <div key={answer.id} className="rounded-xl border bg-background/70 px-3 py-3">
                          <div className="text-xs text-muted-foreground">{answer.title}</div>
                          <div className="mt-1 text-sm font-medium">{answer.label}</div>
                        </div>
                      )) : (
                        <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                          Belum ada jawaban untuk stage ini. Buka wizard lalu pilih arah aromanya satu per satu.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 rounded-xl border bg-background/60 p-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Target profile</div>
                      <div className="mt-2 text-sm font-semibold">{activeTargetProfile.summary}</div>
                      <div className="mt-2 text-xs text-muted-foreground">{activeTargetProfile.stage_goal}</div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => openStageWizard(activeStage)}>
                        {activeAnswerLabels.length ? 'Edit wizard' : `Start ${getStageLabel(activeStage)} wizard`}
                      </Button>
                      <Button className="rounded-xl gap-2" onClick={handleGenerateRecommendations} disabled={busyStage === activeStage}>
                        <Sparkles className="h-4 w-4" />
                        {busyStage === activeStage ? 'Generating...' : 'Generate materials'}
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => handleOpenNextStage(STAGES[Math.min(STAGES.indexOf(activeStage) + 1, STAGES.length - 1)])}
                        disabled={activeStage === 'base'}
                      >
                        Next stage
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border bg-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Generated materials</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Jawaban stage langsung diterjemahkan menjadi material aktif dari library Anda. Tidak perlu select manual lagi.
                          </div>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          {currentGeneratedRows.length} active
                        </Badge>
                      </div>

                      <div className="mt-4 space-y-3">
                        {currentGeneratedRows.length ? currentGeneratedRows.map((item) => (
                          <div key={item.id} className="rounded-xl border bg-background/75 p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold">{item.expand?.raw_material_id?.name || 'Unknown material'}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {item.recommendation_reason || 'Generated from stage fit'}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Badge variant="secondary" className="rounded-full text-[10px] capitalize">
                                    {item.selection_state === 'manual' ? 'manual override' : 'generated'}
                                  </Badge>
                                  {item.primary_function ? (
                                    <Badge variant="secondary" className="rounded-full text-[10px] capitalize">
                                      {formatStatus(item.primary_function)}
                                    </Badge>
                                  ) : null}
                                  {item.secondary_function ? (
                                    <Badge variant="outline" className="rounded-full text-[10px] capitalize">
                                      {formatStatus(item.secondary_function)}
                                    </Badge>
                                  ) : null}
                                  {item.warning ? (
                                    <Badge variant="outline" className="rounded-full text-[10px] text-amber-700">
                                      {item.warning}
                                    </Badge>
                                  ) : null}
                                </div>
                                {stageMaterialExplainMap.get(item.raw_material_id)?.score_breakdown ? (
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                    <div className="rounded-xl border bg-background/65 px-3 py-2">
                                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Score fit</div>
                                      <div className="mt-1 text-sm font-semibold">
                                        {Number(stageMaterialExplainMap.get(item.raw_material_id).fit_score || item.fit_score || 0).toFixed(2)}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        Stage {Number(stageMaterialExplainMap.get(item.raw_material_id).score_breakdown.stage_natural_score || 0).toFixed(1)}
                                      </div>
                                    </div>
                                    <div className="rounded-xl border bg-background/65 px-3 py-2">
                                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Target alignment</div>
                                      <div className="mt-1 text-sm font-semibold">
                                        Class {formatDebugPercent(stageMaterialExplainMap.get(item.raw_material_id).score_breakdown.class_fit_score)}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        Function {formatDebugPercent(stageMaterialExplainMap.get(item.raw_material_id).score_breakdown.function_fit_score)}
                                      </div>
                                    </div>
                                    <div className="rounded-xl border bg-background/65 px-3 py-2">
                                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Performance fit</div>
                                      <div className="mt-1 text-sm font-semibold">
                                        Impact {formatDebugPercent(stageMaterialExplainMap.get(item.raw_material_id).score_breakdown.impact_fit_score)}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        Life {formatDebugPercent(stageMaterialExplainMap.get(item.raw_material_id).score_breakdown.life_fit_score)}
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => handleStageItemState(item, 'rejected')}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Exclude
                                </Button>
                                <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => handleRemoveStageItem(item)}>
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </div>
                        )) : (
                          <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                            Belum ada hasil generate untuk stage ini. Jawab profile note dulu, lalu generate materials.
                          </div>
                        )}
                      </div>

                      {currentRejectedRows.length ? (
                        <div className="mt-4 rounded-xl border bg-background/50 p-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Excluded for now</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {currentRejectedRows.map((item) => (
                              <Button
                                key={item.id}
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                onClick={() => handleStageItemState(item, 'selected')}
                              >
                                {item.expand?.raw_material_id?.name || 'Unknown material'}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {compareCandidates.length ? (
                        <div className="mt-4 rounded-xl border bg-background/55 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Compare candidates</div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                Lihat ranking stage ini berdampingan supaya keputusan keep atau exclude lebih mudah diaudit.
                              </div>
                            </div>
                            <Badge variant="outline" className="rounded-full">
                              {compareCandidates.length} compared
                            </Badge>
                          </div>

                          <div className="mt-4 grid gap-3 xl:grid-cols-2">
                            {compareCandidates.map((item) => {
                              const explanation = stageMaterialExplainMap.get(item.raw_material_id);
                              const breakdown = explanation?.score_breakdown || null;
                              return (
                                <div key={`compare-${item.id}`} className="rounded-xl border bg-background/75 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold">{item.expand?.raw_material_id?.name || 'Unknown material'}</div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {item.recommendation_reason || 'Generated from stage fit'}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-semibold">{Number(item.fit_score || 0).toFixed(2)}</div>
                                      <div className="text-[11px] text-muted-foreground">fit score</div>
                                    </div>
                                  </div>

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Badge variant={item.selection_state === 'rejected' ? 'outline' : 'secondary'} className="rounded-full text-[10px] capitalize">
                                      {item.selection_state === 'manual' ? 'manual' : item.selection_state}
                                    </Badge>
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
                                  </div>

                                  {breakdown ? (
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                      <div className="rounded-lg border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
                                        Stage {Number(breakdown.stage_natural_score || 0).toFixed(1)} • Class {formatDebugPercent(breakdown.class_fit_score)}
                                      </div>
                                      <div className="rounded-lg border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
                                        Function {formatDebugPercent(breakdown.function_fit_score)} • Life {formatDebugPercent(breakdown.life_fit_score)}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>

                          {decisionAssist.suggestions.length ? (
                            <div className="mt-4 rounded-xl border bg-background/65 p-4">
                              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Decision assist</div>
                              <div className="mt-3 space-y-3">
                                {decisionAssist.suggestions.map((suggestion, index) => (
                                  <div key={`${suggestion.type}-${index}`} className="rounded-lg border bg-background/80 px-3 py-3">
                                    <div className="text-sm font-semibold">{suggestion.title}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">{suggestion.message}</div>
                                  </div>
                                ))}
                              </div>
                              {decisionAssist.duplicatePairs.length ? (
                                <div className="mt-4 grid gap-2 xl:grid-cols-2">
                                  {decisionAssist.duplicatePairs.slice(0, 4).map((pair) => (
                                    <div key={`${pair.keep_item_id}-${pair.drop_item_id}`} className="rounded-lg border bg-background/80 px-3 py-3">
                                      <div className="text-sm font-medium">{pair.keep_name} vs {pair.drop_name}</div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        Overlap {pair.overlap_score}% • {pair.reason}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </DetailSection>
          </>

          <DetailSection title="Next step">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Stage selection</div>
                <div className="mt-2 text-lg font-semibold">{stageBoardCompleted ? 'Selection complete' : `${readyStageCount}/3 stages ready`}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {stageBoardCompleted
                    ? 'Top, middle, dan base sudah punya keputusan material yang bisa diteruskan.'
                    : projectUnavailable
                      ? 'Stage flow masih berjalan lokal. Lanjutkan wizard per stage lalu generate materials.'
                      : 'Jawab profile note tiap stage lalu generate materials supaya board siap diteruskan ke formula.'}
                </div>
                {!stageBoardCompleted && !projectUnavailable ? (
                  <div className="mt-3">
                    <Button variant="outline" className="rounded-xl" onClick={() => handleOpenNextStage(activeStage)}>
                      Continue {getStageLabel(activeStage)}
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Formula handoff</div>
                <div className="mt-2 text-lg font-semibold">{allStagesReady ? 'Ready for formula' : 'Not ready yet'}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {projectUnavailable
                    ? 'Kalau generated materials sudah siap, Anda bisa langsung compose formula dari hasil wizard ini.'
                    : 'Langkah setelah brief adalah jawab profile note per stage, generate materials, lalu teruskan pilihan itu langsung ke formula composer.'}
                </div>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => navigate(
                      project
                        ? `/formulas/new?briefId=${brief.id}&projectId=${project.id}`
                        : selectedMaterialIds.length
                          ? `/formulas/new?briefId=${brief.id}&materialIds=${selectedMaterialIds.join(',')}`
                          : `/briefs/${brief.id}`
                    )}
                    disabled={!projectUnavailable && !allStagesReady}
                  >
                    {projectUnavailable ? 'Compose formula' : 'Open formula wizard'}
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Formula and validation</div>
                <div className="mt-2 text-lg font-semibold">
                  {formula ? formula.name : allStagesReady ? 'Ready for formula' : 'Not ready yet'}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {formula
                    ? `${validationLogs.length} validation note tersambung ke formula ini.`
                    : 'Belum masuk formula. Selesaikan jawaban stage dan generate materials dulu, lalu lanjut ke formula composer.'}
                </div>
                <div className="mt-3">
                  <Button
                    className="rounded-xl"
                    onClick={() => navigate(
                      formula
                        ? `/formulas/${formula.id}`
                        : `/formulas/new?briefId=${brief.id}${project?.id ? `&projectId=${project.id}` : ''}`
                    )}
                    disabled={!formula && !projectUnavailable && !allStagesReady}
                  >
                    {formula ? 'Open formula' : 'Compose formula'}
                  </Button>
                </div>
                {formula ? (
                  <div className="mt-2">
                    <Button
                      variant="ghost"
                      className="rounded-xl px-0 text-primary"
                      onClick={() => navigate(`/validation?formulaId=${formula.id}`)}
                    >
                      Open validation workspace
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Validation follow-up">
            {validationLogs.length ? (
              <div className="space-y-3">
                {validationLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="rounded-xl border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {formatStatus(log.test_type)}
                      </Badge>
                      <Badge variant={log.status === 'action_needed' ? 'destructive' : 'outline'} className="text-[10px]">
                        {formatStatus(log.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(log.tested_at)}</span>
                    </div>
                    <div className="mt-2 text-sm">{log.note}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                No validation logs yet for this project.
              </div>
            )}
          </DetailSection>

          <DetailSection>
            <DetailMetadata created={brief.created} updated={brief.updated} />
          </DetailSection>
        </div>
      </DetailPageLayout>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-3xl rounded-[28px] border bg-background p-0">
          <DialogHeader className="border-b px-6 py-5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`capitalize ${stageColorMap[activeStage]}`}>
                {getStageLabel(activeStage)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Step {Math.min(wizardQuestionIndex + 1, Math.max(currentQuestions.length, 1))} of {Math.max(currentQuestions.length, 1)}
              </span>
            </div>
            <DialogTitle className="mt-3 text-xl">Arahkan profile {getStageLabel(activeStage).toLowerCase()} note</DialogTitle>
            <DialogDescription>
              Pilih karakter yang paling mendekati brief. Anda bisa lanjut ke stage berikutnya kapan pun tanpa harus menyelesaikan semua pilihan sekaligus.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5">
            {currentQuestion ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold">{currentQuestion.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Pilihan ini akan menentukan rekomendasi material untuk stage {getStageLabel(activeStage).toLowerCase()}.
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
                <Button className="rounded-xl gap-2" onClick={handleGenerateRecommendations} disabled={busyStage === activeStage}>
                  <Sparkles className="h-4 w-4" />
                  {busyStage === activeStage ? 'Generating...' : 'Generate materials'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BriefDetailPage;
