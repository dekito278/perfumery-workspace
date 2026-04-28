import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Home, Plus, Package, AlertTriangle, CheckCircle2, Layers3, Droplets, Wand2, Shapes, FolderTree, Link2, Trash2, ArrowRight, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useBriefMaterialShortlists } from '@/hooks/useBriefMaterialShortlists.js';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import FilterBar from '@/components/FilterBar.jsx';
import DataTable from '@/components/DataTable.jsx';
import ListPagination from '@/components/ListPagination.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import NoResultsState from '@/components/NoResultsState.jsx';
import AddRawMaterialModal from '@/components/AddRawMaterialModal.jsx';
import EditRawMaterialModal from '@/components/EditRawMaterialModal.jsx';
import RawMaterialGuidanceQuickEditDialog from '@/components/RawMaterialGuidanceQuickEditDialog.jsx';
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import RemapRawMaterialCategoriesModal from '@/components/RemapRawMaterialCategoriesModal.jsx';
import { formatPricePerUnit } from '@/utils/pricingUtils.js';
import { getRawMaterialDeletionDependencies } from '@/services/rawMaterialsService.js';
import { getRawMaterialCategories } from '@/services/rawMaterialCategoriesService.js';
import { ensureReferenceLinksForRawMaterials } from '@/services/materialReferenceService.js';
import { findPerfumersWorldCategoryByValue } from '@/utils/perfumersWorldCategories.js';
import { deriveScentFamilyFromCategory } from '@/utils/rawMaterialCategoryMeta.js';
import { buildFallbackReferenceProfileFromRawMaterial } from '@/utils/referenceGuidance.js';
import { extractWorkbookClassDistribution } from '@/utils/workbookAbcClassification.js';

const hasReferenceValue = (value) => value !== null && value !== undefined;
const shortlistRoles = ['candidate', 'hero', 'support', 'bridge', 'base'];

const renderDeleteDependencySummary = ({ dependencies, loading, selectedMaterial, selectedMaterials }) => {
  if (!selectedMaterial) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Bulk delete will process {selectedMaterials.length} selected material(s) one by one and stop on the first blocked item.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Checking where this material is still used...
      </div>
    );
  }

  if (dependencies.length) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <div className="font-medium">This material is still referenced in:</div>
        <ul className="mt-2 list-disc pl-5">
          {dependencies.map((entry) => (
            <li key={entry.label}>
              {entry.count} {entry.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
      No blocking references found. This material is ready to delete, and its linked workbook/reference artifacts will be removed too.
    </div>
  );
};

const RawMaterialsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const briefId = searchParams.get('briefId') || '';
  const { fetchMaterials, fetchMaterialsPage, fetchMaterialsSummary, fetchMaterialsReferenceSummary, deleteMaterial } = useRawMaterials();
  const { getBriefs } = useBriefs();
  const { getBriefMaterialShortlist, upsertBriefMaterialShortlist, deleteBriefMaterialShortlistItem } = useBriefMaterialShortlists();
  const [materials, setMaterials] = useState([]);
  const [remapMaterials, setRemapMaterials] = useState([]);
  const [summaryMaterials, setSummaryMaterials] = useState([]);
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
  const showInitialLoading = loading && materials.length === 0 && totalMaterials === 0;
  const showRefreshing = loading && !showInitialLoading;
  const selectedMaterials = useMemo(
    () => materials.filter((material) => selectedMaterialIds.includes(material.id)),
    [materials, selectedMaterialIds]
  );
  const shortlistMaterialIds = useMemo(
    () => shortlistItems.map((item) => item.raw_material_id).filter(Boolean),
    [shortlistItems]
  );
  const isBulkDeleting = deletingId === 'bulk';

  const refreshReferenceStatusMap = async (items) => {
    try {
      const nextReferenceStatusMap = await ensureReferenceLinksForRawMaterials(items);
      setReferenceStatusMap(nextReferenceStatusMap);
    } catch (referenceError) {
      console.error('Failed to load raw material reference status map:', referenceError);
      setReferenceStatusMap(new Map());
    }
  };

  const loadMaterials = async () => {
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
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const [data, referenceSummary] = await Promise.all([
        fetchMaterialsSummary(),
        fetchMaterialsReferenceSummary(),
      ]);
      setSummaryMaterials(data);
      setMatchedReferenceCount(referenceSummary.matchedReferenceCount || 0);
      setIfraReferenceCount(referenceSummary.ifraReferenceCount || 0);
    } catch (error) {
      console.error('Failed to load raw material summary:', error);
      setSummaryMaterials([]);
      setMatchedReferenceCount(0);
      setIfraReferenceCount(0);
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await getRawMaterialCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories([]);
    }
  };

  useEffect(() => {
    loadCategories();
    loadSummary();
  }, []);

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
  }, [briefId]);

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
  }, [remapModalOpen, fetchMaterials]);

  useEffect(() => {
    loadMaterials();
  }, [currentPage, searchTerm, typeFilter, categoryFilter, referenceFilter]);

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

    if (!deleteDialogOpen) {
      setDeleteDependencies([]);
      return;
    }

    if (!selectedMaterial) {
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
      !material.workbook_code
      && !material.reference_abc_primary_family
      && !material.reference_impact
      && !material.reference_life_hours
      && !material.ifra_limit
    )).length,
    [summaryMaterials]
  );

  const handleEdit = (material) => {
    setSelectedMaterial(material);
    setEditModalOpen(true);
  };

  const handleDelete = (material) => {
    setSelectedMaterial(material);
    setDeleteDialogOpen(true);
  };

  const handleToggleMaterialSelection = (material) => {
    setSelectedMaterialIds((current) => (
      current.includes(material.id)
        ? current.filter((id) => id !== material.id)
        : [...current, material.id]
    ));
  };

  const handleToggleAllMaterials = (rows) => {
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
  };

  const handleBulkDelete = () => {
    if (!selectedMaterials.length) {
      return;
    }

    setSelectedMaterial(null);
    setDeleteDialogOpen(true);
  };

  const clearSelection = () => {
    setSelectedMaterialIds([]);
  };

  const refreshShortlist = async () => {
    if (!briefId) {
      return;
    }

    const shortlist = await getBriefMaterialShortlist(briefId);
    setShortlistItems(shortlist);
  };

  const handleSaveSelectionToShortlist = async () => {
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
  };

  const handleRemoveShortlistItem = async (itemId) => {
    try {
      await deleteBriefMaterialShortlistItem(itemId);
      toast.success('Removed from shortlist');
      await refreshShortlist();
    } catch (error) {
      toast.error(error.message || 'Failed to remove shortlist item');
    }
  };

  const handleUpdateShortlistRole = async (itemId, role) => {
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
  };

  const openFormulaWizard = (materialIds) => {
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
  };

  const confirmDelete = async () => {
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
  };

  const handleView = (material) => {
    navigate(`/raw-material/${material.id}`);
  };

  const getMaterialGuidanceDetails = (material) => {
    const resolvedReference = referenceStatusMap.get(material.id)?.reference_profile || buildFallbackReferenceProfileFromRawMaterial(material);
    const classDistribution = extractWorkbookClassDistribution(resolvedReference);
    const resolvedClass = resolvedReference?.abc_primary_family || material.reference_abc_primary_family || classDistribution.primaryFamily || null;
    const resolvedImpact = resolvedReference?.impact ?? material.reference_impact ?? null;
    const resolvedLife = resolvedReference?.life_hours ?? material.reference_life_hours ?? null;
    const resolvedCas = resolvedReference?.cas_number ?? material.cas_number ?? null;
    const resolvedIfra = resolvedReference?.ifra_limit_percent ?? material.ifra_limit ?? null;

    const missingClass = !resolvedClass;
    const missingImpact = !hasReferenceValue(resolvedImpact);
    const missingLife = !hasReferenceValue(resolvedLife);
    const missingCas = !resolvedCas;
    const missingIfra = !hasReferenceValue(resolvedIfra);
    const hasCoreGuidance = !missingClass && !missingImpact && !missingLife;
    const hasWarning = missingClass || missingImpact || missingLife || missingCas || missingIfra;

    return {
      hasWarning,
      hasCoreGuidance,
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
  };

  const openGuidanceEditor = (material) => {
    setGuidanceEditorMaterial(material);
    setGuidanceEditorOpen(true);
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <button onClick={() => handleView(row)} className="text-left">
          <div className="text-sm font-semibold text-primary transition hover:underline">{row.name}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              {row.scent_family || deriveScentFamilyFromCategory(row.category, '') || 'Family not set'}
            </span>
            {referenceStatusMap.get(row.id)?.reference_profile ? (
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] font-medium">
                Ref {referenceStatusMap.get(row.id).reference_profile.reference_code}
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] font-medium">
                Unmatched
              </Badge>
            )}
          </div>
        </button>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => (
        <div className="min-w-[132px]">
          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize">
            {row.type}
          </Badge>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-full border border-border/60"
              style={{ backgroundColor: categoryColorMap.get(String(row.category || '').toLowerCase()) || '#CBD5E1' }}
            />
            <span className="truncate">{row.category || 'Uncategorized'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'guidance',
      label: 'Guidance',
      render: (row) => {
        const guidance = getMaterialGuidanceDetails(row);
        const linkedReference = referenceStatusMap.get(row.id)?.reference_profile || null;
        return (
          <div className="min-w-[190px]">
            <button
              type="button"
              onClick={() => openGuidanceEditor(row)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                guidance.hasWarning
                  ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
              }`}
            >
              {guidance.hasWarning ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
              )}
              {guidance.hasWarning
                ? (guidance.hasCoreGuidance ? 'Guidance partial' : 'Needs guidance')
                : 'Guidance ready'}
            </button>
            <div className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
              {guidance.hasWarning
                ? [
                    guidance.missingClass ? 'family' : null,
                    guidance.missingImpact ? 'impact' : null,
                    guidance.missingLife ? 'life' : null,
                    guidance.missingCas ? 'CAS' : null,
                    guidance.missingIfra ? 'IFRA' : null,
                  ].filter(Boolean).join(', ')
                : 'Impact, life, CAS, dan IFRA sudah ada.'}
            </div>
            <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
              <div>{row.workbook_code ? `Workbook ${row.workbook_code}` : 'No workbook code'}</div>
              <div>{linkedReference?.reference_code ? `Reference ${linkedReference.reference_code}` : 'No linked reference profile'}</div>
              <div>{guidance.resolvedClass ? `Family ${guidance.resolvedClass}` : 'Family not set'}</div>
              <div>
                {guidance.resolvedImpact || guidance.resolvedLife
                  ? `Impact ${guidance.resolvedImpact ?? '-'} | Life ${guidance.resolvedLife ?? '-'}h`
                  : 'Impact/life not set'}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'cost_per_unit',
      label: 'Price',
      align: 'right',
      render: (row) => (
        <div className="text-right">
          <div className="font-mono text-sm font-medium text-foreground">{formatPricePerUnit(row.cost_per_unit, row.unit)}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {row.workbook_code ? `Workbook ${row.workbook_code}` : 'No workbook code'}
          </div>
        </div>
      ),
    },
  ];

  const filters = [
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
        { value: 'ifra_limited', label: 'Has IFRA reference' },
        { value: 'has_guidance', label: 'Has reference guidance' },
      ],
    },
  ];

  const handleFilterChange = (filterId, value) => {
    if (filterId === 'type') {
      setTypeFilter(value);
    } else if (filterId === 'category') {
      setCategoryFilter(value);
    } else if (filterId === 'reference') {
      setReferenceFilter(value);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setReferenceFilter('all');
  };

  const hasActiveFilters =
    typeFilter !== 'all'
    || categoryFilter !== 'all'
    || referenceFilter !== 'all'
    || searchTerm;

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Materials - Perfumer Studio</title>
        <meta name="description" content="Browse your material library, guidance coverage, and dilution readiness from one formulation workspace." />
      </Helmet>
      <div className="page-container">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2 mb-4 h-9"
          >
            <Home className="w-4 h-4" />
            Back to dashboard
          </Button>
        </div>

        <PageHeader
          title="Materials"
          description={briefId
            ? 'Pilih kandidat bahan untuk brief ini, beri peran struktural, lalu kirim langsung ke formula wizard.'
            : 'Review material coverage, vendor metadata, dilution readiness, and workbook reference guidance from one master library.'}
          action="Add material"
          actionIcon={Plus}
          onAction={() => setAddModalOpen(true)}
        />

        {briefId ? (
          <div className="mb-6 rounded-[26px] border bg-[linear-gradient(180deg,rgba(255,250,243,0.95)_0%,rgba(250,244,234,0.92)_100%)] p-5 shadow-sm">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Material shortlist workspace
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {briefContext
                    ? `You are shortlisting materials for "${briefContext.title}". Pilih kandidat dari tabel, simpan ke shortlist, lalu kirim langsung ke formula wizard.`
                    : 'You are working in shortlist mode for a brief. Pick candidates from the table, save them, then move directly into formula composition.'}
                </p>
                {briefContext?.mood_story ? (
                  <div className="mt-3 rounded-[18px] border bg-white/75 px-4 py-3 text-sm text-muted-foreground">
                    <strong className="text-foreground">Brief mood:</strong> {briefContext.mood_story}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => navigate(briefContext ? `/briefs/${briefContext.id}` : '/briefs')}
                >
                  Open brief board
                </Button>
                <Button
                  className="rounded-2xl gap-2"
                  onClick={() => openFormulaWizard(selectedMaterialIds.length ? selectedMaterialIds : shortlistMaterialIds)}
                >
                  Continue to formula
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[22px] border bg-white/80 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current selection</div>
                <div className="mt-2 text-2xl font-bold">{selectedMaterialIds.length}</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Select rows from the table, then save them to this brief shortlist.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-2xl"
                    disabled={!selectedMaterialIds.length}
                    onClick={handleSaveSelectionToShortlist}
                  >
                    Save selection to shortlist
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    disabled={!selectedMaterialIds.length}
                    onClick={() => openFormulaWizard(selectedMaterialIds)}
                  >
                    Compose from selection
                  </Button>
                </div>
              </div>

              <div className="rounded-[22px] border bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Saved shortlist</div>
                    <div className="mt-2 text-2xl font-bold">{shortlistLoading ? '...' : shortlistItems.length}</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    disabled={!shortlistItems.length}
                    onClick={() => openFormulaWizard(shortlistMaterialIds)}
                  >
                    Compose from shortlist
                  </Button>
                </div>
                <div className="mt-4 space-y-2">
                  {shortlistLoading ? (
                    <div className="text-sm text-muted-foreground">Loading shortlist...</div>
                  ) : shortlistItems.length ? shortlistItems.slice(0, 6).map((item) => (
                    <div key={item.id} className="grid gap-3 rounded-[18px] border bg-background/75 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_150px_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.expand?.raw_material_id?.name || 'Unknown material'}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.expand?.raw_material_id?.category || item.expand?.raw_material_id?.type || 'Material'}
                        </div>
                      </div>
                      <Select value={item.role || 'candidate'} onValueChange={(value) => handleUpdateShortlistRole(item.id, value)}>
                        <SelectTrigger className="h-10 rounded-xl bg-white">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          {shortlistRoles.map((role) => (
                            <SelectItem key={role} value={role} className="capitalize">
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-xl px-3"
                        onClick={() => handleRemoveShortlistItem(item.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  )) : (
                    <div className="rounded-[18px] border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                      No saved shortlist yet. Pick materials from the table and save them here first.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="list-summary-grid list-summary-grid-4">
          <div className="list-summary-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="list-summary-label">Total materials</p>
                <span className="list-summary-value">{summaryLoading ? '...' : totalMaterials}</span>
                <p className="list-summary-note">{matchedReferenceCount} linked to workbook references.</p>
              </div>
              <Layers3 className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div className="list-summary-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="list-summary-label">Guidance gaps</p>
                <span className="list-summary-value text-amber-700">{guidanceGapCount}</span>
                <p className="list-summary-note">Materials that still need reference signals.</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-700" />
            </div>
          </div>
          <div className="list-summary-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="list-summary-label">Solvents ready</p>
                <span className="list-summary-value">{solventCount}</span>
                <p className="list-summary-note">Solvents available for dilution-aware composition work.</p>
              </div>
              <Droplets className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div className="list-summary-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="list-summary-label">Categories in use</p>
                <span className="list-summary-value text-[1.45rem] sm:text-[1.7rem]">{categoryCount}</span>
                <p className="list-summary-note">{ifraReferenceCount} IFRA reference profiles linked.</p>
              </div>
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="list-toolbar-panel mb-6">
          <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="list-subtle-panel max-w-3xl">
              <div className="flex items-start gap-3">
                <Shapes className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{briefId ? 'Library maintenance' : 'Material review flow'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {briefId
                      ? 'Shortlist mode is active above. The controls below are maintenance tools for cleaning categories, guidance, and reference coverage.'
                      : 'Use this page to clean up categorization, guidance coverage, and dilution context before opening each material detail page.'}
                  </p>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={() => setRemapModalOpen(true)} className="gap-2 h-10 rounded-2xl xl:self-start">
              <Wand2 className="w-4 h-4" />
              Remap categories
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Search material library or reference data
              </div>
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search by name, vendor, CAS, workbook code, reference code, or family..."
                disabled={showRefreshing}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => { loadMaterials(); loadCategories(); loadSummary(); }} variant="outline" size="icon" disabled={loading} className="h-11 w-11 rounded-2xl">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="mt-3 rounded-[24px] border border-white/70 bg-white/55 p-3">
            <FilterBar
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearAll={handleClearFilters}
              compact
              disabled={showRefreshing}
            />
          </div>

          {selectedMaterialIds.length > 0 ? (
            <div className="mt-3 flex flex-col gap-3 rounded-[24px] border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{selectedMaterialIds.length} material selected on this page</p>
                <p className="text-sm text-muted-foreground">Use bulk delete to clean up duplicate or unused materials faster.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={clearSelection} className="rounded-2xl">
                  Clear selection
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  className="gap-2 rounded-2xl"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete selected
                </Button>
              </div>
            </div>
          ) : null}

          {!loading && totalMaterials > 0 && (
            <div className="results-count">
              Showing {materials.length} of {totalMaterials} materials
              {hasActiveFilters ? ' with active filters applied' : ''}
              {referenceFilter !== 'all' ? ' on this page' : ''}
            </div>
          )}
        </div>

        {showInitialLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !summaryLoading && summaryMaterials.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No materials yet"
            description="Add your first material to start building your formulation library."
            action="Add material"
            actionIcon={Plus}
            onAction={() => setAddModalOpen(true)}
          />
        ) : materials.length === 0 ? (
          <NoResultsState
            searchTerm={searchTerm}
            onClearFilters={hasActiveFilters ? handleClearFilters : null}
          />
        ) : (
          <>
            <div className="relative">
              <DataTable
                columns={columns}
                data={materials}
                selectable
                selectedRowIds={selectedMaterialIds}
                onToggleRow={handleToggleMaterialSelection}
                onToggleAll={handleToggleAllMaterials}
                mobileCard={(row) => {
                  const guidance = getMaterialGuidanceDetails(row);
                  return (
                    <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <Checkbox
                            checked={selectedMaterialIds.includes(row.id)}
                            onCheckedChange={() => handleToggleMaterialSelection(row)}
                            aria-label={`Select ${row.name}`}
                            className="mt-1"
                          />
                          <button onClick={() => handleView(row)} className="min-w-0 flex-1 text-left">
                            <div className="truncate text-base font-semibold text-primary">{row.name}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {row.scent_family || deriveScentFamilyFromCategory(row.category, '') || 'Family not set'}
                            </div>
                          </button>
                        </div>
                        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] capitalize">
                          {row.type}
                        </Badge>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-muted/45 px-3 py-2">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Category</div>
                          <div className="mt-1 text-sm">{row.category || 'Uncategorized'}</div>
                        </div>
                        <div className="rounded-2xl bg-muted/45 px-3 py-2">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Price</div>
                          <div className="mt-1 text-sm">{formatPricePerUnit(row.cost_per_unit, row.unit)}</div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant={guidance.hasWarning ? 'outline' : 'secondary'} className="rounded-full px-2.5 py-1 text-[10px]">
                          {guidance.hasWarning ? 'Needs guidance' : 'Guidance ready'}
                        </Badge>
                        {referenceStatusMap.get(row.id)?.reference_profile ? (
                          <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[10px]">
                            Ref {referenceStatusMap.get(row.id).reference_profile.reference_code}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  );
                }}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>

            <ListPagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalMaterials}
              itemLabel="materials"
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      <AddRawMaterialModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={async () => {
          await Promise.all([loadMaterials(), loadSummary()]);
        }}
      />

      <EditRawMaterialModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        material={selectedMaterial}
        onSuccess={async () => {
          await Promise.all([loadMaterials(), loadSummary()]);
          setSelectedMaterial(null);
        }}
      />

      <RawMaterialGuidanceQuickEditDialog
        open={guidanceEditorOpen}
        onOpenChange={setGuidanceEditorOpen}
        material={guidanceEditorMaterial}
        guidanceStatus={guidanceEditorMaterial ? getMaterialGuidanceDetails(guidanceEditorMaterial) : null}
        onSaved={async () => {
          await Promise.all([loadMaterials(), loadSummary()]);
          if (materials.length) {
            await refreshReferenceStatusMap(materials);
          }
        }}
      />

      <RemapRawMaterialCategoriesModal
        open={remapModalOpen}
        onOpenChange={setRemapModalOpen}
        materials={remapMaterials}
        onSuccess={async () => {
          await Promise.all([loadMaterials(), loadSummary()]);
          const refreshedMaterials = await fetchMaterials();
          setRemapMaterials(refreshedMaterials);
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title={selectedMaterial ? 'Delete material' : 'Delete selected materials'}
        description={selectedMaterial
          ? `Are you sure you want to delete "${selectedMaterial.name}"? This action cannot be undone, and linked workbook/reference artifacts will be removed too.`
          : `Are you sure you want to delete ${selectedMaterials.length} selected materials? This action cannot be undone, and each linked workbook/reference artifact will be removed too.`}
        confirmText={deletingId ? 'Deleting...' : 'Delete'}
        confirmDisabled={Boolean(deletingId)}
        destructive
      >
        {renderDeleteDependencySummary({
          dependencies: deleteDependencies,
          loading: deleteDependencyLoading,
          selectedMaterial,
          selectedMaterials,
        })}
      </ConfirmDialog>
    </AuthenticatedLayout>
  );
};

export default RawMaterialsPage;
