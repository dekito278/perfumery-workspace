
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Info, Pencil, Trash2, Printer } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import DetailPageLayout from '@/components/DetailPageLayout.jsx';
import DetailPageHeader from '@/components/DetailPageHeader.jsx';
import DetailSection from '@/components/DetailSection.jsx';
import DetailMetadata from '@/components/DetailMetadata.jsx';
import DeleteFormulaModal from '@/components/DeleteFormulaModal.jsx';
import ExportFormulaButton from '@/components/ExportFormulaButton.jsx';
import FormulaOdourDisplayPanel from '@/components/FormulaOdourDisplayPanel.jsx';
import FormulaEvaluationPanel from '@/components/FormulaEvaluationPanel.jsx';
import FormulaWorkbookSimulationPanel from '@/components/FormulaWorkbookSimulationPanel.jsx';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useBriefProjects } from '@/hooks/useBriefProjects.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { calculatePercentages } from '@/utils/formulaCalculations.js';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { formatDate, formatGramAmount, formatPercentage, formatNullable, formatStatus, formatQuantity } from '@/utils/formatting.js';
import { formatPrice, formatPricePerUnit, calculateIngredientCost, calculateTotalCost } from '@/utils/pricingUtils.js';
import { calculateDilutionComposition } from '@/utils/calculateDilutionCost.js';
import { buildWorkbookSimulation } from '@/utils/formulaWorkbookSimulation.js';
import { buildReferenceAdvisories } from '@/utils/formulaWorkbookSimulation.js';
import { deriveScentFamilyFromCategory } from '@/utils/rawMaterialCategoryMeta.js';
import { buildFormulaItemReferenceMaps, resolveFormulaItemReference } from '@/utils/legacyFormulaItemSources.js';
import { buildFormulaWorkbookExportConfig } from '@/utils/formulaWorkbookExport.js';
import { buildFallbackReferenceProfileFromRawMaterial } from '@/utils/referenceGuidance.js';
import {
  PACE_PRIORITY_QUERY_KEY,
  getPacePriorityModeMeta,
  normalizePacePriorityMode,
} from '@/utils/pacePriority.js';
import { getFormulaById } from '@/services/formulasSupabaseService.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { ensureReferenceLinksForRawMaterials } from '@/services/materialReferenceService.js';
import { fetchRawMaterialsMap } from '@/services/supabaseDataHelpers.js';

const roundToThree = (value) => Math.round(Number(value || 0) * 1000) / 1000;

const buildPacedRevisionVersion = (currentVersion) => {
  const normalized = String(currentVersion || '').trim();
  if (!normalized) {
    return 'PACED';
  }

  if (/paced/i.test(normalized)) {
    return `${normalized}-R2`;
  }

  return `${normalized}-PACED`;
};

const buildPacedRevisionItems = (items, recommendations) => {
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

const normalizeFormulaItemType = (item, itemDetails) => {
  if (item?.item_type === 'accord') {
    return 'accord';
  }

  if (itemDetails?.type === 'solvent' || itemDetails?.item_type === 'solvent' || item?.item_type === 'solvent') {
    return 'solvent';
  }

  return 'raw_material';
};

const getCompositionGroupLabel = (item) => {
  if (item?.item_type === 'solvent') {
    return item.name || 'Solvent';
  }

  return item?.component_family || item?.scent_family || item?.category || 'Material';
};

const FormulaDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { createFormula } = useFormulas();
  const { getFormulaItems } = useFormulaItems();
  const { getBriefs } = useBriefs();
  const { getBriefProjectByBriefId, getBriefProjectStageItems } = useBriefProjects();
  const { getValidationLogs } = useValidationLogs();
  const [formula, setFormula] = useState(null);
  const [items, setItems] = useState([]);
  const [rawMaterialsById, setRawMaterialsById] = useState(new Map());
  const [linkedBriefs, setLinkedBriefs] = useState([]);
  const [linkedProject, setLinkedProject] = useState(null);
  const [linkedProjectStageItems, setLinkedProjectStageItems] = useState([]);
  const [validationLogs, setValidationLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validationLoading, setValidationLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showAllReferenceAlerts, setShowAllReferenceAlerts] = useState(false);
  const [isCreatingPacedRevision, setIsCreatingPacedRevision] = useState(false);
  const pacePriorityMode = normalizePacePriorityMode(searchParams.get(PACE_PRIORITY_QUERY_KEY));

  useEffect(() => {
    loadFormulaDetails();
  }, [id]);

  useEffect(() => {
    loadFormulaValidationLogs();
  }, [id]);

  useEffect(() => {
    loadLinkedBriefs();
  }, [id]);

  useEffect(() => {
    const loadProjectContext = async () => {
      if (!linkedBriefs.length) {
        setLinkedProject(null);
        setLinkedProjectStageItems([]);
        return;
      }

      try {
        const project = await getBriefProjectByBriefId(linkedBriefs[0].id);
        const stageMap = project?.id ? await getBriefProjectStageItems(project.id) : new Map();
        const selectedItems = project?.id
          ? ['top', 'middle', 'base']
              .flatMap((stage) => stageMap.get(stage) || [])
              .filter((item) => item.selection_state === 'selected' || item.selection_state === 'manual')
          : [];
        setLinkedProject(project);
        setLinkedProjectStageItems(selectedItems);
      } catch (error) {
        console.error('Failed to load linked project context:', error);
        setLinkedProject(null);
        setLinkedProjectStageItems([]);
      }
    };

    loadProjectContext();
  }, [getBriefProjectByBriefId, getBriefProjectStageItems, linkedBriefs]);

  const loadFormulaDetails = async () => {
    setLoading(true);
    try {
      const formulaData = await getFormulaById(id);
      setFormula(formulaData);

      const itemsData = await getFormulaItems(id);
      const rawMaterials = await getRawMaterialOptions();
      const rawMaterialsMap = new Map(rawMaterials.map((material) => [material.id, material]));
      const missingMaterialIds = [...new Set(
        itemsData
          .flatMap((item) => [item.item_id, item.dilution_solvent_id])
          .filter(Boolean)
          .filter((materialId) => !rawMaterialsMap.has(materialId))
      )];
      const missingMaterialsMap = await fetchRawMaterialsMap(missingMaterialIds);
      const mergedRawMaterialsMap = new Map([...rawMaterialsMap, ...missingMaterialsMap]);
      setRawMaterialsById(mergedRawMaterialsMap);
      const referenceMaps = await buildFormulaItemReferenceMaps(itemsData, [...mergedRawMaterialsMap.values()]);
      const selectedRawMaterials = itemsData
        .filter((item) => item.item_type === 'raw_material' || item.item_type === 'solvent')
        .map((item) => mergedRawMaterialsMap.get(item.item_id))
        .filter(Boolean);
      const referenceLinksMap = await ensureReferenceLinksForRawMaterials(selectedRawMaterials);

      const enrichedItems = await Promise.all(itemsData.map(async (item) => {
        let itemDetails = resolveFormulaItemReference(item, referenceMaps);
        let unitPrice = 0;
        let category = null;
        let componentFamily = null;
        let isDiluted = Boolean(item.dilution_percent && item.dilution_solvent_id);
        let dilutionPercentage = item.dilution_percent || null;
        let dilutionSolventName = null;

        if (item.item_type === 'raw_material' || item.item_type === 'solvent') {
          itemDetails = itemDetails || mergedRawMaterialsMap.get(item.item_id) || null;
          if (!itemDetails) {
            return {
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
            };
          }
          unitPrice = itemDetails.cost_per_unit || 0;
          category = itemDetails.category || null;
          componentFamily = itemDetails.scent_family || deriveScentFamilyFromCategory(itemDetails.category, '') || null;
          if (!isDiluted) {
            isDiluted = itemDetails.is_diluted || false;
            dilutionPercentage = itemDetails.dilution_percentage || null;
          }
          if (item.dilution_solvent_id) {
            const dilutionSolvent = mergedRawMaterialsMap.get(item.dilution_solvent_id) || null;
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
      }));

      const totalGrams = calculateTotalAmount(enrichedItems);
      const itemsWithPercentages = totalGrams > 0 ? calculatePercentages(enrichedItems, totalGrams) : enrichedItems;
      const itemsWithAdvisories = itemsWithPercentages.map((item) => ({
        ...item,
        ...buildReferenceAdvisories(item),
      }));
      setItems(itemsWithAdvisories);

    } catch (error) {
      toast.error('Failed to load formula details');
      navigate('/formulas');
    } finally {
      setLoading(false);
    }
  };

  const loadFormulaValidationLogs = async () => {
    setValidationLoading(true);
    try {
      const logs = await getValidationLogs({ formulaId: id });
      setValidationLogs(logs);
    } catch (error) {
      toast.error('Failed to load validation logs');
    } finally {
      setValidationLoading(false);
    }
  };

  const loadLinkedBriefs = async () => {
    try {
      const briefs = await getBriefs();
      setLinkedBriefs(briefs.filter((brief) => brief.formula_id === id));
    } catch (error) {
      toast.error('Failed to load linked briefs');
    }
  };

  const handlePrint = async () => {
    const { printWorkbookPdf } = await import('@/utils/workbookPdfExport.js');
    printWorkbookPdf(buildFormulaWorkbookExportConfig({ formula, items, totalGrams, totalCost }));
  };

  const handleCreatePacedRevision = async (recommendations = [], priorityMode = 'balance') => {
    if (!formula || !items.length || !recommendations.length) {
      toast.error('PACE revision needs at least one actionable recommendation');
      return;
    }

    setIsCreatingPacedRevision(true);
    try {
      const priorityModeMeta = getPacePriorityModeMeta(priorityMode);
      const pacedItems = buildPacedRevisionItems(items, recommendations);
      const pacedFormula = await createFormula({
        name: `${formula.name} PACED`,
        code: `${formula.code || 'FORMULA'}-PACED`,
        author_name: formula.author_name || null,
        notes: [
          formula.notes ? String(formula.notes).trim() : null,
          `PACE revision source: ${formula.name}`,
          `PACE priority mode: ${priorityModeMeta.label}`,
          `Applied ${recommendations.length} PACE adjustment${recommendations.length === 1 ? '' : 's'} to create this revision.`,
        ].filter(Boolean).join('\n\n'),
        category: formula.category || null,
        status: 'draft',
        version: buildPacedRevisionVersion(formula.version),
      }, pacedItems);

      toast.success('PACED revision created');
      navigate(`/formulas/${pacedFormula.id}`);
    } catch (error) {
      console.error('Failed to create PACED revision:', error);
      toast.error(error.message || 'Failed to create PACED revision');
    } finally {
      setIsCreatingPacedRevision(false);
    }
  };

  const handlePacePriorityModeChange = (nextMode) => {
    const normalizedMode = normalizePacePriorityMode(nextMode);
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set(PACE_PRIORITY_QUERY_KEY, normalizedMode);
    setSearchParams(nextSearchParams, { replace: true, preventScrollReset: true });
  };

  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from, { state: { restoreScroll: true } });
      return;
    }

    navigate('/formulas');
  };

  const compactCompositionRows = useMemo(() => {
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

    return [...grouped.values()]
      .sort((left, right) => right.percentage - left.percentage)
      .slice(0, 6);
  }, [items]);

  if (loading) {
    return (
      <DetailPageLayout>
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-64 w-full" />
      </DetailPageLayout>
    );
  }

  if (!formula) {
    return null;
  }

  const totalGrams = calculateTotalAmount(items);
  const totalPercentage = items.reduce((sum, item) => sum + (item.percentage || 0), 0);
  const totalCost = calculateTotalCost(items);
  const hasFormulaItems = items.length > 0;
  const dilutedItemCount = items.filter((item) => item.is_diluted && item.dilution_percentage).length;
  const legacyAccordCount = items.filter((item) => item.item_type === 'accord').length;
  const referenceCoverageCount = items.filter((item) => item.reference_profile).length;
  const hasReferenceCoverage = referenceCoverageCount > 0;
  const formulaReferenceAdvisories = items
    .filter((item) => item.advisories?.length)
    .flatMap((item) => item.advisories.map((advisory) => ({
      ...advisory,
      itemName: item.name,
      itemId: item.item_id,
      referenceCode: item.reference_profile?.reference_code || null,
      effectivePercentage: item.effectivePercentage,
      dilutionPercentage: item.dilution_percentage,
    })));
  const ifraAdvisoryCount = formulaReferenceAdvisories.filter((item) => item.type === 'ifra').length;
  const maxUseAdvisoryCount = formulaReferenceAdvisories.filter((item) => item.type === 'max').length;
  const typicalUseAdvisoryCount = formulaReferenceAdvisories.filter((item) => item.type === 'typical').length;
  const totalReferenceAlertCount = formulaReferenceAdvisories.length;
  const visibleReferenceAdvisories = showAllReferenceAlerts
    ? formulaReferenceAdvisories
    : formulaReferenceAdvisories.slice(0, 4);
  const workbookSimulation = buildWorkbookSimulation({
    items,
    rawMaterialsById,
    referenceLinksMap: new Map(
      items
        .filter((item) => item.reference_link)
        .map((item) => [item.item_id, item.reference_link])
    ),
  });
  const hiddenCompositionGroupCount = Math.max(0, new Set(items.map(getCompositionGroupLabel)).size - compactCompositionRows.length);
  const workbookBoardStats = [
    { label: 'Guidance-backed', value: `${workbookSimulation.guidanceBackedCount}/${items.length}` },
    { label: 'Workbook link', value: workbookSimulation.linkedProfileCount },
    { label: 'Manual guidance', value: workbookSimulation.fallbackGuidanceCount },
    { label: 'Missing', value: workbookSimulation.missingGuidanceCount },
    { label: 'Reference alerts', value: totalReferenceAlertCount },
    { label: 'Material cost', value: formatPrice(totalCost) },
  ];

  return (
    <>
      <Helmet>
        <title>{`${formula.name} - Formula Details`}</title>
        <meta name="description" content={`Detailed view of ${formula.name} formula with gram-based composition and cost breakdown.`} />
      </Helmet>
      
      <DetailPageLayout>
        <DetailPageHeader
          eyebrow="Formula"
          title={formula.name}
          subtitle={[
            `Code ${formula.code}`,
            formula.category ? formatStatus(formula.category) : null,
            formula.version ? `Version ${formula.version}` : null,
          ].filter(Boolean).join(' / ')}
          badge={
            formula.status && (
              <Badge variant="outline" className="capitalize text-xs">
                {formatStatus(formula.status)}
              </Badge>
            )
          }
          onBack={handleBack}
          backLabel="Back to formulas"
          meta={
            <>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Formula size</span>
                <span className="detail-page-meta-value">{formatGramAmount(totalGrams)}</span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Material cost</span>
                <span className="detail-page-meta-value">{formatPrice(totalCost)}</span>
              </div>
            </>
          }
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  const nextSearchParams = new URLSearchParams();
                  if (linkedBriefs[0]) {
                    nextSearchParams.set('briefId', linkedBriefs[0].id);
                  }
                  nextSearchParams.set(PACE_PRIORITY_QUERY_KEY, pacePriorityMode);
                  navigate(`/formulas/${id}/edit?${nextSearchParams.toString()}`);
                }}
                className="gap-2 h-9"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <ExportFormulaButton formula={formula} items={items} />
              <Button variant="outline" onClick={handlePrint} className="gap-2 h-9">
                <Printer className="w-4 h-4" />
                Print
              </Button>
              <Button variant="destructive" onClick={() => setIsDeleteModalOpen(true)} className="gap-2 h-9">
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </>
          }
        />

        <div className="space-y-5 print-full-width">
          <div className="rounded-[28px] border border-white/80 bg-white/90 p-3 shadow-sm sm:p-4">
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="h-auto flex-wrap justify-start rounded-2xl bg-muted/70 p-1">
                <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
                <TabsTrigger value="workbook" className="rounded-xl">Workbook</TabsTrigger>
                <TabsTrigger value="composition" className="rounded-xl">Composition</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-5">
                <DetailSection title="Overview">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-xs text-muted-foreground mb-1">Items</div>
                      <div className="text-lg font-semibold">{items.length}</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-xs text-muted-foreground mb-1">Legacy accord items</div>
                      <div className="text-lg font-semibold">{legacyAccordCount}</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-xs text-muted-foreground mb-1">Diluted</div>
                      <div className="text-lg font-semibold">{dilutedItemCount}</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-xs text-muted-foreground mb-1">Guidance-backed</div>
                      <div className="text-lg font-semibold">{referenceCoverageCount}</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-xs text-muted-foreground mb-1">Reference alerts</div>
                      <div className={`text-lg font-semibold ${totalReferenceAlertCount > 0 ? 'text-amber-600' : ''}`}>{totalReferenceAlertCount}</div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-xs text-muted-foreground mb-1">Material cost</div>
                      <div className="text-lg font-semibold font-mono text-primary">{formatPrice(totalCost)}</div>
                    </div>
                  </div>
                </DetailSection>

                <DetailSection title="Reference guidance">
                  {hasFormulaItems ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-xl border bg-card p-4">
                          <div className="text-xs text-muted-foreground mb-1">Workbook links</div>
                          <div className="text-lg font-semibold">{workbookSimulation.linkedProfileCount}</div>
                        </div>
                        <div className="rounded-xl border bg-card p-4">
                          <div className="text-xs text-muted-foreground mb-1">Manual guidance</div>
                          <div className="text-lg font-semibold">{workbookSimulation.fallbackGuidanceCount}</div>
                        </div>
                        <div className="rounded-xl border bg-card p-4">
                          <div className="text-xs text-muted-foreground mb-1">Missing guidance</div>
                          <div className="text-lg font-semibold">{workbookSimulation.missingGuidanceCount}</div>
                        </div>
                        <div className="rounded-xl border bg-card p-4">
                          <div className="text-xs text-muted-foreground mb-1">IFRA alerts</div>
                          <div className={`text-lg font-semibold ${ifraAdvisoryCount > 0 ? 'text-destructive' : ''}`}>{ifraAdvisoryCount}</div>
                        </div>
                        <div className="rounded-xl border bg-card p-4">
                          <div className="text-xs text-muted-foreground mb-1">Max use alerts</div>
                          <div className={`text-lg font-semibold ${maxUseAdvisoryCount > 0 ? 'text-amber-600' : ''}`}>{maxUseAdvisoryCount}</div>
                        </div>
                        <div className="rounded-xl border bg-card p-4">
                          <div className="text-xs text-muted-foreground mb-1">Typical nudges</div>
                          <div className={`text-lg font-semibold ${typicalUseAdvisoryCount > 0 ? 'text-blue-600' : ''}`}>{typicalUseAdvisoryCount}</div>
                        </div>
                      </div>

                      <p className="mt-3 text-sm text-muted-foreground">
                        Untuk bahan diluted, advisory dihitung dari effective active percentage, bukan sekadar persen diluted yang tertulis.
                      </p>

                      <div className="mt-4 space-y-3">
                        {!hasReferenceCoverage ? (
                          <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>No guidance-backed materials yet</AlertTitle>
                            <AlertDescription>
                              Add raw materials that already have workbook reference links or manual guidance to unlock IFRA guidance, odour facets, and lifetime-based charting for this formula.
                            </AlertDescription>
                          </Alert>
                        ) : formulaReferenceAdvisories.length ? visibleReferenceAdvisories.map((advisory) => (
                          <Alert
                            key={`${advisory.itemId}-${advisory.type}`}
                            variant={advisory.severity === 'danger' ? 'destructive' : 'default'}
                            className={advisory.severity === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-950 [&>svg]:text-amber-700' : ''}
                          >
                            {advisory.severity === 'danger' || advisory.severity === 'warning' ? (
                              <AlertTriangle className="h-4 w-4" />
                            ) : (
                              <Info className="h-4 w-4" />
                            )}
                            <AlertTitle>{advisory.itemName} / {advisory.label}</AlertTitle>
                            <AlertDescription>
                              <p>{advisory.message}</p>
                              <p className="mt-1 text-xs opacity-80">
                                Reference {advisory.referenceCode || 'profile linked'}
                                {advisory.dilutionPercentage ? ` / diluted ${formatPercentage(advisory.dilutionPercentage, 1)}` : ''}
                              </p>
                            </AlertDescription>
                          </Alert>
                        )) : (
                          <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>No reference alerts in this formula</AlertTitle>
                            <AlertDescription>
                              Linked raw materials are currently within their typical guidance, max use level, and IFRA reference limit where that data is available.
                            </AlertDescription>
                          </Alert>
                        )}
                        {formulaReferenceAdvisories.length > 4 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAllReferenceAlerts((current) => !current)}
                            className="rounded-xl"
                          >
                            {showAllReferenceAlerts
                              ? 'Show fewer alerts'
                              : `Show ${formulaReferenceAdvisories.length - 4} more alerts`}
                          </Button>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>This formula does not have any ingredients yet</AlertTitle>
                      <AlertDescription>
                        Add at least one raw material to start reference guidance, workbook charting, and concentration alerts for this formula.
                      </AlertDescription>
                    </Alert>
                  )}
                </DetailSection>
              </TabsContent>

              <TabsContent value="workbook" className="space-y-5">
                <DetailSection title="Workbook visualisation">
                  {hasFormulaItems ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] xl:items-start">
                        <div className="space-y-3">
                          <div className="overflow-hidden rounded-[24px] border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,244,235,0.96)_100%)] shadow-sm">
                            <div className="border-b border-[#e2d8c2] px-4 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e6c42]">
                                Composition board
                              </div>
                              <div className="mt-1 text-sm text-[#5f5239]">
                                Dominant groups in a tighter workbook-style table.
                              </div>
                            </div>
                            <div className="px-4 py-3">
                              <div className="grid grid-cols-[minmax(0,1.4fr)_76px_76px_58px] gap-3 border-b border-[#ece4d3] pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                                <div>Group</div>
                                <div className="text-right">% share</div>
                                <div className="text-right">Amount</div>
                                <div className="text-right">Rows</div>
                              </div>
                              <div className="divide-y divide-[#f0e8d8]">
                                {compactCompositionRows.map((row) => (
                                  <div key={row.label} className="grid grid-cols-[minmax(0,1.4fr)_76px_76px_58px] gap-3 py-2 text-sm">
                                    <div className="min-w-0">
                                      <div className="truncate font-medium text-[#3f3524]">{row.label}</div>
                                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#efe9da]">
                                        <div
                                          className="h-full rounded-full bg-[#f2a323]"
                                          style={{ width: `${Math.min(Math.max(row.percentage, 0), 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                    <div className="text-right font-mono text-[#3f3524]">{formatPercentage(row.percentage, 1)}</div>
                                    <div className="text-right font-mono text-[#6b5d41]">{formatGramAmount(row.grams)}</div>
                                    <div className="text-right font-mono text-[#8a7a58]">{row.count}</div>
                                  </div>
                                ))}
                              </div>
                              {hiddenCompositionGroupCount > 0 ? (
                                <div className="border-t border-[#ece4d3] pt-2 text-xs text-muted-foreground">
                                  +{hiddenCompositionGroupCount} more groups hidden for a cleaner desktop view.
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="overflow-hidden rounded-[24px] border border-[#ddd3bf] bg-white shadow-sm">
                            <div className="border-b border-[#eee4d0] px-4 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e6c42]">
                                Formula ledger
                              </div>
                              <div className="mt-1 text-sm text-[#5f5239]">
                                Quick workbook coverage and formula economics.
                              </div>
                            </div>
                            <div className="divide-y divide-[#f1eadc]">
                              {workbookBoardStats.map((stat) => (
                                <div key={stat.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm">
                                  <div className="text-[#6c5f46]">{stat.label}</div>
                                  <div className="font-mono font-semibold text-[#3f3524]">{stat.value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <FormulaOdourDisplayPanel
                            items={items}
                            rawMaterialsById={rawMaterialsById}
                            referenceLinksMap={new Map(
                              items
                                .filter((item) => item.reference_link)
                                .map((item) => [item.item_id, item.reference_link])
                            )}
                            isVisible
                          />
                        </div>
                      </div>
                      <div className="mx-auto w-full max-w-[1120px]">
                          <FormulaWorkbookSimulationPanel
                            items={items}
                            rawMaterialsById={rawMaterialsById}
                            referenceLinksMap={new Map(
                              items
                                .filter((item) => item.reference_link)
                                .map((item) => [item.item_id, item.reference_link])
                            )}
                            title="Workbook diagnostics"
                            description="Reference coverage, lifetime estimate, and IFRA-oriented diagnostics for the current formula."
                            onCreatePacedRevision={handleCreatePacedRevision}
                            isCreatingPacedRevision={isCreatingPacedRevision}
                            priorityMode={pacePriorityMode}
                            onPriorityModeChange={handlePacePriorityModeChange}
                          />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                      Workbook charts and composition profile will appear after the formula has ingredients. Linked workbook materials will unlock odour facets, family spread, and top-middle-base decay curves.
                    </div>
                  )}
                </DetailSection>
              </TabsContent>

              <TabsContent value="composition" className="space-y-5">
                <DetailSection title="Composition">
            {hasFormulaItems ? (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-1">Total amount</div>
                    <div className="text-lg font-semibold font-mono">{formatGramAmount(totalGrams)}</div>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-1">Total percentage</div>
                    <div className="text-lg font-semibold font-mono">{formatPercentage(totalPercentage)}</div>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-1">Material cost</div>
                    <div className="text-lg font-semibold font-mono text-primary">{formatPrice(totalCost)}</div>
                  </div>
                </div>

                <div className="space-y-3 md:hidden">
                  {items.map((item, index) => {
                    const ingredientCost = item.ingredient_cost ?? calculateIngredientCost(item.gram_amount, item.unit_price);
                    const isDiluted = item.is_diluted && item.dilution_percentage;
                    const composition = isDiluted
                      ? calculateDilutionComposition(item.gram_amount, item.dilution_percentage)
                      : null;

                    return (
                      <div key={index} className="rounded-xl border bg-card p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">
                              {item.item_type === 'raw_material' || item.item_type === 'solvent' ? (
                                <button
                                  onClick={() => navigate(`/raw-material/${item.item_id}`, {
                                    state: { from: `${location.pathname}${location.search}` },
                                  })}
                                  className="text-left text-primary hover:underline"
                                >
                                  {item.name}
                                </button>
                              ) : (
                                item.name
                              )}
                            </div>
                            {isDiluted ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {item.dilution_percentage}% in {item.dilution_solvent_name || '-'}
                              </div>
                            ) : null}
                          </div>
                          <Badge variant="outline" className="shrink-0 capitalize text-[10px]">
                            {formatStatus(item.item_type)}
                          </Badge>
                        </div>

                        {item.reference_profile ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              Ref {item.reference_profile.reference_code}
                            </Badge>
                            {item.advisories?.map((advisory) => (
                              <Badge
                                key={`${item.item_id}-${advisory.type}`}
                                variant={advisory.type === 'ifra' ? 'destructive' : 'outline'}
                                className="text-[10px]"
                              >
                                {advisory.label}
                              </Badge>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                          <div>
                            <div className="text-muted-foreground">Amount</div>
                            <div className="mt-1 font-mono text-sm">{formatGramAmount(item.gram_amount)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Percentage</div>
                            <div className="mt-1 font-mono text-sm">{formatPercentage(item.percentage)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Cost</div>
                            <div className="mt-1 font-mono">{formatPrice(ingredientCost)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Unit price</div>
                            <div className="mt-1 font-mono">{formatPricePerUnit(item.unit_price, item.unit)}</div>
                          </div>
                        </div>

                        {isDiluted && composition ? (
                          <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            Active: {formatGramAmount(composition.activeAmount)} + Solvent: {formatGramAmount(composition.solventAmount)}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="hidden table-container md:block">
                  <div className="overflow-hidden rounded-[24px] border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,244,235,0.94)_100%)] shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[#e6dcc8]">
                          <TableHead className="min-w-[230px] pl-5">Material</TableHead>
                          <TableHead className="min-w-[220px]">Guidance</TableHead>
                          <TableHead className="text-right min-w-[120px]">Usage</TableHead>
                          <TableHead className="text-right min-w-[140px] pr-5">Cost</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => {
                        const ingredientCost = item.ingredient_cost ?? calculateIngredientCost(item.gram_amount, item.unit_price);
                        const isDiluted = item.is_diluted && item.dilution_percentage;
                        const composition = isDiluted 
                          ? calculateDilutionComposition(item.gram_amount, item.dilution_percentage)
                          : null;

                        return (
                          <React.Fragment key={index}>
                            <TableRow className="border-[#eee5d3] align-top">
                              <TableCell className="pl-5 py-3">
                                {item.item_type === 'raw_material' || item.item_type === 'solvent' ? (
                                  <div className="space-y-1.5">
                                    <button
                                      onClick={() => navigate(`/raw-material/${item.item_id}`, {
                                        state: { from: `${location.pathname}${location.search}` },
                                      })}
                                      className="text-left text-sm font-semibold text-[#3f3524] transition hover:text-primary hover:underline"
                                    >
                                      {item.name}
                                    </button>
                                    <div className="flex flex-wrap gap-1.5">
                                      <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] capitalize">
                                        {formatStatus(item.item_type)}
                                      </Badge>
                                    </div>
                                    {isDiluted ? (
                                      <div className="text-xs text-muted-foreground">
                                        {item.dilution_percentage}%{item.dilution_solvent_name ? ` in ${item.dilution_solvent_name}` : ''}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    <div className="font-semibold text-sm text-[#3f3524]">{item.name}</div>
                                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] capitalize">
                                      {formatStatus(item.item_type)}
                                    </Badge>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {item.reference_profile ? (
                                    <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
                                      Ref {item.reference_profile.reference_code}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                                      No workbook ref
                                    </Badge>
                                  )}
                                  {item.advisories?.slice(0, 2).map((advisory) => (
                                    <Badge
                                      key={`${item.item_id}-${advisory.type}`}
                                      variant={advisory.type === 'ifra' ? 'destructive' : 'outline'}
                                      className="rounded-full px-2 py-0.5 text-[10px]"
                                    >
                                      {advisory.label}
                                    </Badge>
                                  ))}
                                  {item.advisories?.length > 2 ? (
                                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                                      +{item.advisories.length - 2} more
                                    </Badge>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="py-3 text-right">
                                <div className="font-mono text-sm font-semibold text-[#3f3524]">
                                  {formatGramAmount(item.gram_amount)}
                                </div>
                                <div className="mt-1 font-mono text-xs text-muted-foreground">
                                  {formatPercentage(item.percentage)}
                                </div>
                              </TableCell>
                              <TableCell className="py-3 pr-5 text-right">
                                <div className="font-mono text-sm font-semibold text-[#3f3524]">
                                  {formatPrice(ingredientCost)}
                                </div>
                                <div className="mt-1 font-mono text-xs text-muted-foreground">
                                  {formatPricePerUnit(item.unit_price, item.unit)}
                                </div>
                              </TableCell>
                            </TableRow>
                            {isDiluted && composition && (
                              <TableRow className="bg-[#f7f2e8]">
                                <TableCell colSpan={4} className="px-5 py-2.5">
                                  <div className="text-xs text-muted-foreground">
                                    Active: {formatGramAmount(composition.activeAmount)} + Solvent: {formatGramAmount(composition.solventAmount)}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                      <TableRow className="border-[#e0d6c1] bg-[#f6efe2] font-semibold">
                        <TableCell className="pl-5 text-sm text-[#3f3524]">Total</TableCell>
                        <TableCell className="text-sm text-[#6b5d41]">{items.length} rows</TableCell>
                        <TableCell className="text-right font-mono text-sm text-[#3f3524]">
                          <div>{formatGramAmount(totalGrams)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatPercentage(totalPercentage)}</div>
                        </TableCell>
                        <TableCell className="pr-5 text-right font-mono text-sm text-primary">
                          {formatPrice(totalCost)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Percentages are calculated from gram amounts. Formula detail stays focused on raw materials and solvent-related costs only.
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                This formula does not have any composition rows yet. Add ingredients from the edit flow to unlock percentages, cost breakdown, and workbook charting.
              </div>
            )}
          </DetailSection>

              </TabsContent>

            </Tabs>
          </div>

          {formula.notes && (
            <DetailSection title="Notes">
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{formula.notes}</p>
            </DetailSection>
          )}

          <DetailSection title="Brief context">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Brief memberi arah sebelum evaluasi. Link formula ini ke brief supaya revision notes tidak kehilangan tujuan awal.
                </div>
                <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/briefs?formulaId=${id}`)}>
                  Open brief workspace
                </Button>
              </div>

              {linkedBriefs.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {linkedBriefs.map((brief) => (
                    <div key={brief.id} className="rounded-xl border bg-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{brief.title}</div>
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {brief.status || 'draft'}
                        </Badge>
                      </div>
                      {brief.mood_story ? (
                        <p className="mt-3 text-sm text-muted-foreground">{brief.mood_story}</p>
                      ) : null}
                      {brief.performance_target ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Performance: {brief.performance_target}
                        </p>
                      ) : null}
                      <div className="mt-3 text-xs text-muted-foreground">
                        Updated {formatDate(brief.updated || brief.created)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  No linked brief yet. Add one to anchor the formula&apos;s mood, audience, and performance target.
                </div>
              )}

              {linkedProject ? (
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold">Project stage summary</div>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {linkedProject.current_stage || 'top'}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {linkedProjectStageItems.length
                      ? `${linkedProjectStageItems.length} project stage materials shaped this formula before adjustment.`
                      : 'This brief project does not have selected stage materials yet.'}
                  </div>
                  {linkedProjectStageItems.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['top', 'middle', 'base'].map((stage) => {
                        const stageCount = linkedProjectStageItems.filter((item) => item.stage === stage).length;
                        return (
                          <Badge key={stage} variant="secondary" className="capitalize text-[10px]">
                            {stage} {stageCount}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </DetailSection>

          <DetailSection title="Validation workflow">
            {validationLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-1">Saved notes</div>
                    <div className="text-lg font-semibold">{validationLogs.length}</div>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-1">Action needed</div>
                    <div className="text-lg font-semibold text-amber-600">
                      {validationLogs.filter((log) => log.status === 'action_needed').length}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-1">Last logged</div>
                    <div className="text-lg font-semibold">
                      {validationLogs[0] ? formatDate(validationLogs[0].tested_at || validationLogs[0].created) : '-'}
                    </div>
                  </div>
                </div>

                <FormulaEvaluationPanel
                  formulas={formula ? [formula] : []}
                  validationLogs={validationLogs}
                  selectedFormulaId={formula?.id || null}
                  onOpenFormula={() => navigate(`/formulas/${id}`)}
                  onOpenValidationWorkspace={() => navigate(`/validation?formulaId=${id}`)}
                />
              </div>
            )}
          </DetailSection>

          <DetailSection>
            <DetailMetadata 
              created={formula.created} 
              updated={formula.updated}
            />
          </DetailSection>
        </div>
      </DetailPageLayout>

      <DeleteFormulaModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        formulaId={id}
        formulaName={formula?.name}
        onDeleteSuccess={() => navigate('/formulas')}
      />
    </>
  );
};

export default FormulaDetailPage;

