import React, { useEffect, useMemo, useState } from 'react';
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
import FormulaMaterialLibrary from '@/components/FormulaMaterialLibrary.jsx';
import FormulaScaleTool from '@/components/FormulaScaleTool.jsx';
import RawMaterialGuidanceQuickEditDialog from '@/components/RawMaterialGuidanceQuickEditDialog.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useBriefProjects } from '@/hooks/useBriefProjects.js';
import {
  composerSectionClass,
  mapComposerItemsForSubmit,
  useFormulaComposer,
  validateComposerFields,
} from '@/hooks/useFormulaComposer.js';
import { useIsMobile } from '@/hooks/use-mobile.jsx';
import { calculateTotalGrams } from '@/utils/formulaCalculations.js';
import { validateGramAmount } from '@/utils/validation.js';
import { formatGramAmount } from '@/utils/formatting.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { buildComposerItemsFromMaterialIds, buildComposerItemsFromProjectStageItems } from '@/utils/formulaPipeline.js';
import { PACE_PRIORITY_QUERY_KEY, normalizePacePriorityMode } from '@/utils/pacePriority.js';

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
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
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
  const composer = useFormulaComposer({
    rawMaterials,
    calculateTotalAmount: calculateTotalGrams,
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
    selectedRawMaterialIds,
    selectedRawMaterialIdsSet,
    filteredLibraryMaterials,
    getItemGuidanceStatus,
    getItemGuidanceDetails,
    activeItemInsight,
    activeReferenceProfileDetails,
  } = composer;

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoadingData(true);
      try {
        const materialsData = await getRawMaterialOptions();
        let resolvedBrief = null;
        let resolvedProject = null;
        let resolvedProjectStageMap = new Map();

        if (briefId) {
          const briefs = await getBriefs();
          resolvedBrief = briefs.find((brief) => brief.id === briefId) || null;
          try {
            resolvedProject = projectId
              ? { ...(await getBriefProjectByBriefId(briefId) || {}), id: projectId }
              : await getBriefProjectByBriefId(briefId);
            resolvedProjectStageMap = resolvedProject?.id ? await getBriefProjectStageItems(resolvedProject.id) : new Map();
          } catch (projectError) {
            console.error('Formula create project layer unavailable:', projectError);
          }
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
            replaceFormulaItems(buildComposerItemsFromProjectStageItems(resolvedProjectStageItems, materialsData, new Map()));
          } else if (seedMaterialIds.length) {
            replaceFormulaItems(buildComposerItemsFromMaterialIds(seedMaterialIds, materialsData));
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
  }, [briefId, getBriefProjectByBriefId, getBriefProjectStageItems, getBriefs, projectId, replaceFormulaItems, seedMaterialIds]);

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
  };

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

  const isStandaloneFormula = !briefId && !projectId && seedMaterialIds.length === 0;
  const compositionModeTitle = projectStageItems.length
    ? 'Compose from project stages'
    : seedMaterialIds.length
      ? 'Compose from shortlisted materials'
      : briefContext
        ? 'Compose from brief intent'
        : 'Standalone formula';
  const compositionModeDescription = projectStageItems.length
    ? 'This formula starts from project stage picks. Use the library below to refine or rebalance the selected structure.'
    : seedMaterialIds.length
      ? 'This formula starts from shortlisted materials chosen in the library workspace. Use the composer below to refine the structure.'
      : briefContext
        ? 'This formula is linked to a brief. Keep the composition anchored to the story, audience, and performance target below.'
        : 'No brief is required here. Name the formula, choose materials from the library, set grams, and save it as an independent formula.';

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Create Formula - Solivagant</title>
        <meta
          name="description"
          content="Build a formula on a dedicated page with ingredient composition on the left and a live workbook odour display on the right."
        />
      </Helmet>

      <div className="page-container">
        <FormulaMetadataDialog
          open={metadataDialogOpen}
          onOpenChange={handleMetadataDialogChange}
          title={isStandaloneFormula ? 'Create standalone formula' : 'Create formula'}
          description={isStandaloneFormula
            ? 'Isi identitas formula, lalu susun komposisi langsung dari material library tanpa membuat brief.'
            : 'Isi identitas formula dulu sebelum mulai menyusun komposisinya.'}
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

        <div className={`mb-4 space-y-4 ${composerSectionClass}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Composition context
                </div>
                <h2 className="mt-2 text-lg font-semibold">
                  {compositionModeTitle}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {compositionModeDescription}
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
                    {projectStageItems.length ? 'Stage preload' : seedMaterialIds.length ? 'Shortlist preload' : briefContext ? 'Direct composition' : 'Standalone'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {projectStageItems.length
                    ? `${projectStageItems.length} stage-selected materials were loaded into the composer as a starting structure.`
                    : seedMaterialIds.length
                      ? `${seedMaterialIds.length} shortlisted materials were loaded into the composer as a starting structure.`
                      : briefContext
                        ? 'No stage preload was selected. You can still compose directly from the raw material library while keeping this formula linked to the brief.'
                        : 'No brief or preload is attached. This formula will be saved as a standalone composition.'}
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

                        <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] border border-[#ddd3bf] bg-[#fcfaf4] px-4 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b6d4f]">
                            Material library
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
                        getDisabledState={({ material, selectedRawMaterialIdsSet: selectedIds }) => selectedIds.has(material.id)}
                        getBadgeLabel={({ material, currentRowItemId, selectedRawMaterialIdsSet: selectedIds, activeRowIndex, mobile }) => {
                          const selectedInFormula = selectedIds.has(material.id);
                          const selectedInActiveRow = currentRowItemId === material.id;
                          if (selectedInActiveRow) {
                            return 'Selected';
                          }
                          if (selectedInFormula) {
                            return 'Added';
                          }
                          return mobile ? 'Tap to add' : `Row ${activeRowIndex + 1}`;
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
                    <FormulaMaterialLibrary
                      materials={filteredLibraryMaterials}
                      activeRowIndex={activeRowIndex}
                      currentRowItemId={formulaItems[activeRowIndex]?.item_id}
                      selectedRawMaterialIdsSet={selectedRawMaterialIdsSet}
                      onSelect={(itemId) => handleLibrarySelect(itemId)}
                      onDoubleSelect={handleLibraryDoubleClick}
                      getDisabledState={({ material, selectedRawMaterialIdsSet: selectedIds }) => selectedIds.has(material.id)}
                      getBadgeLabel={({ material, currentRowItemId, selectedRawMaterialIdsSet: selectedIds, activeRowIndex, mobile }) => {
                        const selectedInFormula = selectedIds.has(material.id);
                        const selectedInActiveRow = currentRowItemId === material.id;
                        if (selectedInActiveRow) {
                          return 'Selected';
                        }
                        if (selectedInFormula) {
                          return 'Added';
                        }
                        return mobile ? 'Tap to add' : `Row ${activeRowIndex + 1}`;
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

