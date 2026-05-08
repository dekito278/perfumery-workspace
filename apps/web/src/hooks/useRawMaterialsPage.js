import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderTree, Droplets, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useBriefMaterialShortlists } from '@/hooks/useBriefMaterialShortlists.js';
import { getRawMaterialDeletionDependencies, getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { getRawMaterialCategories } from '@/services/rawMaterialCategoriesService.js';
import { ensureReferenceLinksForRawMaterials } from '@/services/materialReferenceService.js';
import { findPerfumersWorldCategoryByValue } from '@/utils/perfumersWorldCategories.js';
import { buildFallbackReferenceProfileFromRawMaterial } from '@/utils/referenceGuidance.js';
import { extractWorkbookClassDistribution } from '@/utils/workbookAbcClassification.js';
import { buildRawMaterialDuplicateAudit } from '@/utils/rawMaterialDuplicateAudit.js';

const hasReferenceValue = (value) => value !== null && value !== undefined && value !== '';
const hasPositiveReferenceValue = (value) => {
  if (!hasReferenceValue(value)) {
    return false;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0;
};

export const shortlistRoles = ['candidate', 'hero', 'support', 'bridge', 'base'];

export const REFERENCE_STATUS_LABELS = {
  approved_pw: 'PW',
  approved_external: 'External approved',
  provisional_external: 'Provisional',
  conflict_review: 'Conflict',
  fallback_manual: 'Manual fallback',
};

export const getReferenceStatusBadgeClassName = (status) => {
  switch (status) {
    case 'approved_pw':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'approved_external':
      return 'border-sky-200 bg-sky-50 text-sky-900';
    case 'provisional_external':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'conflict_review':
      return 'border-rose-200 bg-rose-50 text-rose-900';
    default:
      return 'border-border bg-background text-foreground';
  }
};

export const useRawMaterialsPage = ({ briefId, navigate }) => {
  const { fetchMaterials, fetchMaterialsPage, fetchMaterialsSummary, fetchMaterialsReferenceSummary, deleteMaterial } = useRawMaterials();
  const { getBriefs } = useBriefs();
  const { getBriefMaterialShortlist, upsertBriefMaterialShortlist, deleteBriefMaterialShortlistItem } = useBriefMaterialShortlists();

  const [materials, setMaterials] = useState([]);
  const [remapMaterials, setRemapMaterials] = useState([]);
  const [summaryMaterials, setSummaryMaterials] = useState([]);
  const [auditMaterials, setAuditMaterials] = useState([]);
  const [referenceStatusMap, setReferenceStatusMap] = useState(new Map());
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [briefContext, setBriefContext] = useState(null);
  const [shortlistItems, setShortlistItems] = useState([]);
  const [shortlistLoading, setShortlistLoading] = useState(false);
  const [matchedReferenceCount, setMatchedReferenceCount] = useState(0);
  const [ifraReferenceCount, setIfraReferenceCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [referenceFilter, setReferenceFilter] = useState('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [remapModalOpen, setRemapModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [guidanceEditorOpen, setGuidanceEditorOpen] = useState(false);
  const [guidanceEditorMaterial, setGuidanceEditorMaterial] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteDependencies, setDeleteDependencies] = useState([]);
  const [deleteDependencyLoading, setDeleteDependencyLoading] = useState(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMaterials, setTotalMaterials] = useState(0);
  const pageSize = 12;

  const selectedMaterials = useMemo(
    () => materials.filter((material) => selectedMaterialIds.includes(material.id)),
    [materials, selectedMaterialIds]
  );
  const shortlistMaterialIds = useMemo(
    () => shortlistItems.map((item) => item.raw_material_id).filter(Boolean),
    [shortlistItems]
  );
  const isBulkDeleting = deletingId === 'bulk';
  const showInitialLoading = loading && materials.length === 0 && totalMaterials === 0;
  const showRefreshing = loading && !showInitialLoading;

  const refreshReferenceStatusMap = useCallback(async (items) => {
    try {
      const nextReferenceStatusMap = await ensureReferenceLinksForRawMaterials(items);
      setReferenceStatusMap(nextReferenceStatusMap);
    } catch (referenceError) {
      console.error('Failed to load raw material reference status map:', referenceError);
      setReferenceStatusMap(new Map());
    }
  }, []);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const { items, total } = await fetchMaterialsPage({
        page: currentPage,
        pageSize,
        searchTerm,
        typeFilter,
        categoryFilter,
        referenceFilter,
      });
      setMaterials(items);
      setTotalMaterials(total);
      await refreshReferenceStatusMap(items);
    } catch (error) {
      toast.error('Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, currentPage, fetchMaterialsPage, referenceFilter, refreshReferenceStatusMap, searchTerm, typeFilter]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const [data, referenceSummary, auditRows] = await Promise.all([
        fetchMaterialsSummary(),
        fetchMaterialsReferenceSummary(),
        getRawMaterialOptions({ forceRefresh: true }),
      ]);
      setSummaryMaterials(data);
      setAuditMaterials(auditRows || []);
      setMatchedReferenceCount(referenceSummary.matchedReferenceCount || 0);
      setIfraReferenceCount(referenceSummary.ifraReferenceCount || 0);
    } catch (error) {
      console.error('Failed to load raw material summary:', error);
      setSummaryMaterials([]);
      setAuditMaterials([]);
      setMatchedReferenceCount(0);
      setIfraReferenceCount(0);
    } finally {
      setSummaryLoading(false);
    }
  }, [fetchMaterialsReferenceSummary, fetchMaterialsSummary]);

  const loadCategories = useCallback(async () => {
    try {
      const data = await getRawMaterialCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories([]);
    }
  }, []);

  const refreshShortlist = useCallback(async () => {
    if (!briefId) {
      return;
    }

    const shortlist = await getBriefMaterialShortlist(briefId);
    setShortlistItems(shortlist);
  }, [briefId, getBriefMaterialShortlist]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadMaterials(), loadCategories(), loadSummary()]);
  }, [loadCategories, loadMaterials, loadSummary]);

  useEffect(() => {
    loadCategories();
    loadSummary();
  }, [loadCategories, loadSummary]);

  useEffect(() => {
    const loadBriefContext = async () => {
      if (!briefId) {
        setBriefContext(null);
        setShortlistItems([]);
        return;
      }

      setShortlistLoading(true);
      try {
        const [briefs, shortlist] = await Promise.all([
          getBriefs(),
          getBriefMaterialShortlist(briefId),
        ]);
        setBriefContext(briefs.find((item) => item.id === briefId) || null);
        setShortlistItems(shortlist);
      } catch (error) {
        toast.error('Failed to load shortlist workspace');
      } finally {
        setShortlistLoading(false);
      }
    };

    loadBriefContext();
  }, [briefId, getBriefMaterialShortlist, getBriefs]);

  useEffect(() => {
    const loadRemapMaterials = async () => {
      if (!remapModalOpen) {
        return;
      }

      try {
        const data = await fetchMaterials();
        setRemapMaterials(data);
      } catch (error) {
        console.error('Failed to load remap materials:', error);
        setRemapMaterials([]);
      }
    };

    loadRemapMaterials();
  }, [fetchMaterials, remapModalOpen]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, categoryFilter, referenceFilter]);

  useEffect(() => {
    const materialIds = new Set(materials.map((material) => material.id));
    setSelectedMaterialIds((current) => current.filter((id) => materialIds.has(id)));
  }, [materials]);

  useEffect(() => {
    const loadDeleteDependencies = async () => {
      if (!deleteDialogOpen || !selectedMaterial?.id) {
        setDeleteDependencyLoading(false);
        return;
      }

      setDeleteDependencyLoading(true);
      try {
        const blockers = await getRawMaterialDeletionDependencies(selectedMaterial.id);
        setDeleteDependencies(blockers);
      } catch (error) {
        console.error('Failed to load raw material delete dependencies:', error);
        setDeleteDependencies([]);
      } finally {
        setDeleteDependencyLoading(false);
      }
    };

    if (!deleteDialogOpen || !selectedMaterial) {
      setDeleteDependencies([]);
      setDeleteDependencyLoading(false);
      return;
    }

    loadDeleteDependencies();
  }, [deleteDialogOpen, selectedMaterial]);

  const categoryColorMap = useMemo(
    () => new Map(categories.map((category) => [category.name.toLowerCase(), category.color])),
    [categories]
  );

  const solventCount = useMemo(
    () => summaryMaterials.filter((material) => material.type === 'solvent').length,
    [summaryMaterials]
  );

  const categoryCount = useMemo(
    () => new Set(summaryMaterials.map((material) => String(material.category || '').trim()).filter(Boolean)).size,
    [summaryMaterials]
  );

  const guidanceGapCount = useMemo(
    () => summaryMaterials.filter((material) => (
      !material.reference_abc_primary_family
      || !hasPositiveReferenceValue(material.reference_impact)
      || !hasPositiveReferenceValue(material.reference_life_hours)
      || !material.cas_number
      || !hasReferenceValue(material.ifra_limit)
    )).length,
    [summaryMaterials]
  );

  const audit = useMemo(() => buildRawMaterialDuplicateAudit(auditMaterials), [auditMaterials]);
  const practicalMergeCandidateCount = audit.summary?.practicalMergeCandidateCount || 0;
  const guidanceReadyCount = Math.max(totalMaterials - guidanceGapCount, 0);
  const referenceCoverageRate = totalMaterials ? Math.round((matchedReferenceCount / totalMaterials) * 100) : 0;
  const guidanceCoverageRate = totalMaterials ? Math.round((guidanceReadyCount / totalMaterials) * 100) : 0;
  const ifraCoverageRate = totalMaterials ? Math.round((ifraReferenceCount / totalMaterials) * 100) : 0;

  const handleEdit = useCallback((material) => {
    setSelectedMaterial(material);
    setEditModalOpen(true);
  }, []);

  const handleDelete = useCallback((material) => {
    setSelectedMaterial(material);
    setDeleteDialogOpen(true);
  }, []);

  const handleView = useCallback((material) => {
    navigate(`/raw-material/${material.id}`);
  }, [navigate]);

  const handleToggleMaterialSelection = useCallback((material) => {
    setSelectedMaterialIds((current) => (
      current.includes(material.id)
        ? current.filter((id) => id !== material.id)
        : [...current, material.id]
    ));
  }, []);

  const handleToggleAllMaterials = useCallback((rows) => {
    const rowIds = rows.map((row) => row.id).filter(Boolean);
    if (!rowIds.length) {
      return;
    }

    setSelectedMaterialIds((current) => {
      const allSelected = rowIds.every((id) => current.includes(id));
      if (allSelected) {
        return current.filter((id) => !rowIds.includes(id));
      }

      return [...new Set([...current, ...rowIds])];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedMaterialIds([]);
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (!selectedMaterials.length) {
      return;
    }

    setSelectedMaterial(null);
    setDeleteDialogOpen(true);
  }, [selectedMaterials.length]);

  const getMaterialGuidanceDetails = useCallback((material) => {
    const resolvedReference = referenceStatusMap.get(material.id)?.reference_profile || buildFallbackReferenceProfileFromRawMaterial(material);
    const classDistribution = extractWorkbookClassDistribution(resolvedReference);
    const resolvedClass = resolvedReference?.abc_primary_family || material.reference_abc_primary_family || classDistribution.primaryFamily || null;
    const resolvedImpact = resolvedReference?.impact ?? material.reference_impact ?? null;
    const resolvedLife = resolvedReference?.life_hours ?? material.reference_life_hours ?? null;
    const resolvedCas = resolvedReference?.cas_number ?? material.cas_number ?? null;
    const resolvedIfra = resolvedReference?.ifra_limit_percent ?? material.ifra_limit ?? null;

    const missingClass = !resolvedClass;
    const missingImpact = !hasPositiveReferenceValue(resolvedImpact);
    const missingLife = !hasPositiveReferenceValue(resolvedLife);
    const missingCas = !resolvedCas;
    const missingIfra = !hasReferenceValue(resolvedIfra);
    const hasCoreGuidance = !missingClass && !missingImpact && !missingLife;
    const hasWarning = missingClass || missingImpact || missingLife || missingCas || missingIfra;

    return {
      hasWarning,
      hasCoreGuidance,
      resolvedReference,
      reviewStatus: resolvedReference?.review_status || 'fallback_manual',
      confidenceScore: resolvedReference?.confidence_score ?? null,
      missingClass,
      missingImpact,
      missingLife,
      missingCas,
      missingIfra,
      resolvedClass,
      resolvedImpact,
      resolvedLife,
      resolvedCas,
      resolvedIfra,
    };
  }, [referenceStatusMap]);

  const openGuidanceEditor = useCallback((material) => {
    const guidance = getMaterialGuidanceDetails(material);
    setGuidanceEditorMaterial({
      ...material,
      guidance_reference_profile: guidance.resolvedReference,
      guidance_resolved_values: {
        workbook_code: guidance.resolvedReference?.reference_code || material.workbook_code || null,
        cas_number: guidance.resolvedCas,
        ifra_limit: guidance.resolvedIfra,
        reference_abc_primary_family: guidance.resolvedClass,
        reference_impact: guidance.resolvedImpact,
        reference_life_hours: guidance.resolvedLife,
        reference_use_level_typical_percent: guidance.resolvedReference?.use_level_typical_percent ?? material.reference_use_level_typical_percent ?? null,
        reference_use_level_max_percent: guidance.resolvedReference?.use_level_max_percent ?? material.reference_use_level_max_percent ?? null,
      },
    });
    setGuidanceEditorOpen(true);
  }, [getMaterialGuidanceDetails]);

  const handleSaveSelectionToShortlist = useCallback(async () => {
    if (!briefId || !selectedMaterials.length) {
      return;
    }

    try {
      await upsertBriefMaterialShortlist(
        briefId,
        selectedMaterials.map((material) => ({
          raw_material_id: material.id,
          role: 'candidate',
        }))
      );
      toast.success('Materials added to shortlist');
      await refreshShortlist();
    } catch (error) {
      toast.error(error.message || 'Failed to save shortlist');
    }
  }, [briefId, refreshShortlist, selectedMaterials, upsertBriefMaterialShortlist]);

  const handleRemoveShortlistItem = useCallback(async (itemId) => {
    try {
      await deleteBriefMaterialShortlistItem(itemId);
      toast.success('Removed from shortlist');
      await refreshShortlist();
    } catch (error) {
      toast.error(error.message || 'Failed to remove shortlist item');
    }
  }, [deleteBriefMaterialShortlistItem, refreshShortlist]);

  const handleUpdateShortlistRole = useCallback(async (itemId, role) => {
    const shortlistItem = shortlistItems.find((item) => item.id === itemId);
    if (!briefId || !shortlistItem) {
      return;
    }

    try {
      await upsertBriefMaterialShortlist(briefId, [{
        raw_material_id: shortlistItem.raw_material_id,
        role,
        note: shortlistItem.note || null,
      }]);
      toast.success('Shortlist role updated');
      await refreshShortlist();
    } catch (error) {
      toast.error(error.message || 'Failed to update shortlist role');
    }
  }, [briefId, refreshShortlist, shortlistItems, upsertBriefMaterialShortlist]);

  const openFormulaWizard = useCallback((materialIds) => {
    const uniqueIds = [...new Set((materialIds || []).filter(Boolean))];
    if (!uniqueIds.length) {
      toast.error('Select or shortlist materials first');
      return;
    }

    const nextSearch = new URLSearchParams();
    if (briefId) {
      nextSearch.set('briefId', briefId);
    }
    nextSearch.set('materialIds', uniqueIds.join(','));
    navigate(`/formulas/new?${nextSearch.toString()}`);
  }, [briefId, navigate]);

  const confirmDelete = useCallback(async () => {
    const materialsToDelete = selectedMaterial ? [selectedMaterial] : selectedMaterials;
    if (!materialsToDelete.length) {
      return;
    }

    setDeletingId(selectedMaterial ? selectedMaterial.id : 'bulk');
    try {
      for (const material of materialsToDelete) {
        await deleteMaterial(material.id);
      }

      toast.success(
        materialsToDelete.length === 1
          ? 'Material deleted successfully'
          : `${materialsToDelete.length} materials deleted successfully`
      );

      setDeleteDialogOpen(false);
      setSelectedMaterial(null);
      clearSelection();
      await Promise.all([loadMaterials(), loadSummary()]);
    } catch (error) {
      toast.error(error.message || 'Failed to delete material');
    } finally {
      setDeletingId(null);
    }
  }, [clearSelection, deleteMaterial, loadMaterials, loadSummary, selectedMaterial, selectedMaterials]);

  const filters = useMemo(() => [
    {
      id: 'type',
      value: typeFilter,
      placeholder: 'All types',
      icon: Droplets,
      options: [
        { value: 'all', label: 'All types' },
        { value: 'material', label: 'Material' },
        { value: 'solvent', label: 'Solvent' },
      ],
    },
    {
      id: 'category',
      value: categoryFilter,
      placeholder: 'All categories',
      icon: FolderTree,
      options: [
        { value: 'all', label: 'All categories' },
        ...categories.map((category) => ({
          value: category.name.toLowerCase(),
          label: findPerfumersWorldCategoryByValue(category.name)?.description
            ? `${category.name} - ${findPerfumersWorldCategoryByValue(category.name).description}`
            : category.name,
        })),
      ],
    },
    {
      id: 'reference',
      value: referenceFilter,
      placeholder: 'All reference states',
      icon: Link2,
      options: [
        { value: 'all', label: 'All reference states' },
        { value: 'matched', label: 'Matched' },
        { value: 'unmatched', label: 'Unmatched' },
        { value: 'missing_data', label: 'Missing data' },
        { value: 'ifra_limited', label: 'Has IFRA reference' },
        { value: 'has_guidance', label: 'Has reference guidance' },
        { value: 'approved_pw', label: 'PW approved' },
        { value: 'approved_external', label: 'External approved' },
        { value: 'provisional_review', label: 'Needs review' },
        { value: 'conflict_review', label: 'Conflict review' },
      ],
    },
  ], [categories, categoryFilter, referenceFilter, typeFilter]);

  const handleFilterChange = useCallback((filterId, value) => {
    if (filterId === 'type') {
      setTypeFilter(value);
    } else if (filterId === 'category') {
      setCategoryFilter(value);
    } else if (filterId === 'reference') {
      setReferenceFilter(value);
    }
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setReferenceFilter('all');
  }, []);

  const hasActiveFilters =
    typeFilter !== 'all'
    || categoryFilter !== 'all'
    || referenceFilter !== 'all'
    || searchTerm;

  return {
    materials,
    remapMaterials,
    setRemapMaterials,
    summaryMaterials,
    referenceStatusMap,
    categories,
    loading,
    summaryLoading,
    briefContext,
    shortlistItems,
    shortlistLoading,
    matchedReferenceCount,
    ifraReferenceCount,
    searchTerm,
    setSearchTerm,
    typeFilter,
    categoryFilter,
    referenceFilter,
    addModalOpen,
    setAddModalOpen,
    editModalOpen,
    setEditModalOpen,
    remapModalOpen,
    setRemapModalOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    guidanceEditorOpen,
    setGuidanceEditorOpen,
    guidanceEditorMaterial,
    selectedMaterial,
    setSelectedMaterial,
    deletingId,
    deleteDependencies,
    deleteDependencyLoading,
    selectedMaterialIds,
    currentPage,
    setCurrentPage,
    totalMaterials,
    pageSize,
    selectedMaterials,
    shortlistMaterialIds,
    isBulkDeleting,
    showInitialLoading,
    showRefreshing,
    categoryColorMap,
    solventCount,
    categoryCount,
    guidanceGapCount,
    practicalMergeCandidateCount,
    guidanceReadyCount,
    referenceCoverageRate,
    guidanceCoverageRate,
    ifraCoverageRate,
    handleEdit,
    handleDelete,
    handleView,
    handleToggleMaterialSelection,
    handleToggleAllMaterials,
    handleBulkDelete,
    clearSelection,
    handleSaveSelectionToShortlist,
    handleRemoveShortlistItem,
    handleUpdateShortlistRole,
    openFormulaWizard,
    confirmDelete,
    getMaterialGuidanceDetails,
    openGuidanceEditor,
    filters,
    handleFilterChange,
    handleClearFilters,
    hasActiveFilters,
    shortlistRoles,
    loadMaterials,
    loadSummary,
    loadCategories,
    refreshAll,
    refreshReferenceStatusMap,
    fetchMaterials,
  };
};
