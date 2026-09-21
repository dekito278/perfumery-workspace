import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { ensureReferenceLinksForRawMaterials } from '@/services/materialReferenceService.js';
import { getFormulaById } from '@/services/formulasSupabaseService.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { fetchRawMaterialsMap } from '@/services/supabaseDataHelpers.js';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { buildWorkbookSimulation } from '@/utils/formulaWorkbookSimulation.js';
import { buildFormulaWorkbookExportConfig } from '@/utils/formulaWorkbookExport.js';
import { buildFormulaItemReferenceMaps, resolveFormulaItemReference } from '@/utils/legacyFormulaItemSources.js';
import {
  PACE_PRIORITY_QUERY_KEY,
  getPacePriorityModeMeta,
  normalizePacePriorityMode,
} from '@/utils/pacePriority.js';
import {
  buildPacedRevisionItems,
} from '@/utils/formulaDetail.js';
import { calculateTotalCost } from '@/utils/pricingUtils.js';
import {
  buildCompactCompositionRows,
  buildFormulaDetailItems,
  buildFormulaReferenceAdvisorySummary,
  buildWorkbookBoardStats,
} from '@/utils/formulaDetailData.js';
import { buildLineageChain, diffFormulaItems, nextRevisionVersion } from '@/utils/formulaRevisionLineage.js';

export const useFormulaDetailPage = (id) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { createFormula, getFormulas } = useFormulas();
  const [lineageFormulas, setLineageFormulas] = useState([]);
  const [parentItems, setParentItems] = useState(null);
  const { getFormulaItems } = useFormulaItems();
  const { getValidationLogs } = useValidationLogs();
  const [formula, setFormula] = useState(null);
  const [items, setItems] = useState([]);
  const [rawMaterialsById, setRawMaterialsById] = useState(new Map());
  const [validationLogs, setValidationLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validationLoading, setValidationLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showAllReferenceAlerts, setShowAllReferenceAlerts] = useState(false);
  const [isCreatingPacedRevision, setIsCreatingPacedRevision] = useState(false);
  const pacePriorityMode = normalizePacePriorityMode(searchParams.get(PACE_PRIORITY_QUERY_KEY));


  const loadFormulaDetails = useCallback(async () => {
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

      const enrichedItems = buildFormulaDetailItems({
        items: itemsData,
        rawMaterialsById: mergedRawMaterialsMap,
        referenceLinksMap,
        referenceMaps,
        resolveFormulaItemReference,
      });
      setItems(enrichedItems);
    } catch {
      toast.error('Failed to load formula details');
      navigate('/formulas');
    } finally {
      setLoading(false);
    }
  }, [getFormulaItems, id, navigate]);

  const loadFormulaValidationLogs = useCallback(async () => {
    setValidationLoading(true);
    try {
      const logs = await getValidationLogs({ formulaId: id });
      setValidationLogs(logs);
    } catch {
      toast.error('Failed to load validation logs');
    } finally {
      setValidationLoading(false);
    }
  }, [getValidationLogs, id]);

  useEffect(() => {
    loadFormulaDetails();
  }, [loadFormulaDetails]);

  useEffect(() => {
    loadFormulaValidationLogs();
  }, [loadFormulaValidationLogs]);

  const totalGrams = useMemo(() => calculateTotalAmount(items), [items]);
  const totalPercentage = useMemo(() => items.reduce((sum, item) => sum + (item.percentage || 0), 0), [items]);
  const totalCost = useMemo(() => calculateTotalCost(items), [items]);
  const hasFormulaItems = items.length > 0;
  const dilutedItemCount = items.filter((item) => item.is_diluted && item.dilution_percentage).length;
  const legacyAccordCount = items.filter((item) => item.item_type === 'accord').length;
  const referenceCoverageCount = items.filter((item) => item.reference_profile).length;
  const hasReferenceCoverage = referenceCoverageCount > 0;

  const {
    formulaReferenceAdvisories,
    ifraAdvisoryCount,
    maxUseAdvisoryCount,
    typicalUseAdvisoryCount,
    totalReferenceAlertCount,
    visibleReferenceAdvisories,
  } = useMemo(
    () => buildFormulaReferenceAdvisorySummary(items, showAllReferenceAlerts),
    [items, showAllReferenceAlerts]
  );

  const itemReferenceLinksMap = useMemo(() => new Map(
    items
      .filter((item) => item.reference_link)
      .map((item) => [item.item_id, item.reference_link])
  ), [items]);

  const workbookSimulation = useMemo(() => buildWorkbookSimulation({
    items,
    rawMaterialsById,
    referenceLinksMap: itemReferenceLinksMap,
  }), [items, itemReferenceLinksMap, rawMaterialsById]);

  const { compactCompositionRows, hiddenCompositionGroupCount } = useMemo(
    () => buildCompactCompositionRows(items),
    [items]
  );
  const workbookBoardStats = useMemo(() => buildWorkbookBoardStats({
    itemCount: items.length,
    totalCost,
    totalReferenceAlertCount,
    workbookSimulation,
  }), [items.length, totalCost, totalReferenceAlertCount, workbookSimulation]);

  const handlePrint = async () => {
    try {
      const { printWorkbookPdf } = await import('@/utils/workbookPdfExport.js');
      printWorkbookPdf(buildFormulaWorkbookExportConfig({ formula, items, totalGrams, totalCost }));
    } catch (error) {
      toast.error(error.message || 'Failed to open formula PDF');
    }
  };

  const handleExportPdf = async () => {
    try {
      const { exportWorkbookPdf } = await import('@/utils/workbookPdfExport.js');
      const filename = `${formula?.code || 'formula'}_${String(formula?.name || 'formula').replace(/\s+/g, '_')}.pdf`;
      exportWorkbookPdf(buildFormulaWorkbookExportConfig({ formula, items, totalGrams, totalCost }), filename);
      toast.success('Formula PDF exported');
    } catch (error) {
      toast.error(error.message || 'Failed to export formula PDF');
    }
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
        version: nextRevisionVersion(formula.version),
        // The link that makes the chain real. Until 20260914140000 is applied these two are dropped by
        // createFormula and the revision is created exactly as it is today.
        parent_formula_id: formula.id,
        revision_note: `Applied ${recommendations.length} PACE adjustment${recommendations.length === 1 ? '' : 's'} (${priorityModeMeta.label}).`,
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

  // The chain is assembled client-side from rows RLS already returned, so a formula belonging to someone
  // else can never join it — its parent_formula_id simply resolves to nothing.
  useEffect(() => {
    let cancelled = false;

    const loadLineage = async () => {
      try {
        const allFormulas = await getFormulas();
        if (!cancelled) setLineageFormulas(Array.isArray(allFormulas) ? allFormulas : []);
      } catch (error) {
        // Lineage is decoration on a formula. A failed list must not take the detail page down with it.
        console.warn('Failed to load formula lineage:', error);
        if (!cancelled) setLineageFormulas([]);
      }
    };

    loadLineage();
    return () => { cancelled = true; };
  }, [getFormulas, id]);

  const lineageChain = useMemo(
    () => buildLineageChain(lineageFormulas, id),
    [lineageFormulas, id],
  );

  const parentFormula = useMemo(() => {
    const parentId = formula?.parent_formula_id ? String(formula.parent_formula_id) : null;
    return parentId ? lineageFormulas.find((candidate) => String(candidate.id) === parentId) || null : null;
  }, [formula?.parent_formula_id, lineageFormulas]);

  useEffect(() => {
    let cancelled = false;

    if (!parentFormula?.id) {
      setParentItems(null);
      return undefined;
    }

    const loadParentItems = async () => {
      try {
        const rows = await getFormulaItems(parentFormula.id);
        if (!cancelled) setParentItems(Array.isArray(rows) ? rows : []);
      } catch (error) {
        // No diff is honest. A diff against an empty list would report every material as newly added.
        console.warn('Failed to load the parent formula items:', error);
        if (!cancelled) setParentItems(null);
      }
    };

    loadParentItems();
    return () => { cancelled = true; };
  }, [parentFormula?.id, getFormulaItems]);

  // The diff is built from formula ITEM rows, which carry an item_id and grams — never a name. Without
  // this resolver the panel printed UUIDs, which is what the page already has the catalogue to prevent.
  const resolveMaterialName = useCallback((materialId) => {
    const material = rawMaterialsById.get(String(materialId || ''))
      || rawMaterialsById.get(String(materialId || '').toLowerCase());
    return material?.name || '';
  }, [rawMaterialsById]);

  const revisionDiff = useMemo(
    () => (parentItems ? diffFormulaItems(parentItems, items, { resolveName: resolveMaterialName }) : null),
    [parentItems, items, resolveMaterialName],
  );

  const openRawMaterial = (itemId) => {
    navigate(`/raw-material/${itemId}`, {
      state: { from: `${location.pathname}${location.search}` },
    });
  };

  return {
    compactCompositionRows,
    lineageChain,
    parentFormula,
    revisionDiff,
    dilutedItemCount,
    formula,
    formulaReferenceAdvisories,
    handleBack,
    handleCreatePacedRevision,
    handleExportPdf,
    handlePacePriorityModeChange,
    handlePrint,
    hasFormulaItems,
    hasReferenceCoverage,
    hiddenCompositionGroupCount,
    id,
    ifraAdvisoryCount,
    isCreatingPacedRevision,
    isDeleteModalOpen,
    itemReferenceLinksMap,
    items,
    legacyAccordCount,
    loading,
    location,
    maxUseAdvisoryCount,
    navigate,
    openRawMaterial,
    pacePriorityMode,
    rawMaterialsById,
    referenceCoverageCount,
    setIsDeleteModalOpen,
    setShowAllReferenceAlerts,
    showAllReferenceAlerts,
    totalCost,
    totalGrams,
    totalPercentage,
    totalReferenceAlertCount,
    typicalUseAdvisoryCount,
    validationLoading,
    validationLogs,
    visibleReferenceAdvisories,
    workbookBoardStats,
    workbookSimulation,
  };
};
