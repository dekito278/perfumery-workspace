
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, Home, Plus, Package, Eye, AlertTriangle, CheckCircle2, Layers3, Droplets, Wand2, Banknote, Shapes, FlaskConical, FolderTree, Radar, Link2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
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
import { formatQuantity } from '@/utils/formatting.js';
import { calculateIngredientCost, formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';
import { getRawMaterialCategories } from '@/services/rawMaterialCategoriesService.js';
import { ensureReferenceLinksForRawMaterials } from '@/services/materialReferenceService.js';
import { findPerfumersWorldCategoryByValue } from '@/utils/perfumersWorldCategories.js';
import { deriveScentFamilyFromCategory } from '@/utils/rawMaterialCategoryMeta.js';
import { buildFallbackReferenceProfileFromRawMaterial } from '@/utils/referenceGuidance.js';
import { extractWorkbookClassDistribution } from '@/utils/workbookAbcClassification.js';

const hasReferenceValue = (value) => value !== null && value !== undefined;

const RawMaterialsPage = () => {
  const navigate = useNavigate();
  const { fetchMaterials, fetchMaterialsPage, fetchMaterialsSummary, fetchMaterialsReferenceSummary, deleteMaterial } = useRawMaterials();
  const [materials, setMaterials] = useState([]);
  const [remapMaterials, setRemapMaterials] = useState([]);
  const [summaryMaterials, setSummaryMaterials] = useState([]);
  const [referenceStatusMap, setReferenceStatusMap] = useState(new Map());
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [matchedReferenceCount, setMatchedReferenceCount] = useState(0);
  const [ifraReferenceCount, setIfraReferenceCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [referenceFilter, setReferenceFilter] = useState('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [remapModalOpen, setRemapModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [guidanceEditorOpen, setGuidanceEditorOpen] = useState(false);
  const [guidanceEditorMaterial, setGuidanceEditorMaterial] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
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
        stockFilter,
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
  }, [currentPage, searchTerm, typeFilter, categoryFilter, stockFilter, referenceFilter]);

  const filteredMaterials = useMemo(() => {
    return materials;
  }, [materials]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, categoryFilter, stockFilter, referenceFilter]);

  useEffect(() => {
    const materialIds = new Set(materials.map((material) => material.id));
    setSelectedMaterialIds((current) => current.filter((id) => materialIds.has(id)));
  }, [materials]);

  const categoryColorMap = useMemo(
    () => new Map(categories.map((category) => [category.name.toLowerCase(), category.color])),
    [categories]
  );

  const lowStockCount = useMemo(
    () =>
      summaryMaterials.filter((material) => {
        const threshold = material.low_stock_threshold || material.minimum_stock;
        return Number(material.stock_quantity) < Number(threshold);
      }).length,
    [summaryMaterials]
  );

  const solventCount = useMemo(
    () => summaryMaterials.filter((material) => material.type === 'solvent').length,
    [summaryMaterials]
  );

  const categoryCount = useMemo(
    () => new Set(summaryMaterials.map((material) => String(material.category || '').trim()).filter(Boolean)).size,
    [summaryMaterials]
  );

  const inventoryValue = useMemo(
    () =>
      summaryMaterials.reduce(
        (sum, material) => sum + calculateIngredientCost(material.stock_quantity || 0, material.cost_per_unit || 0),
        0
      ),
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

  const confirmDelete = async () => {
    const materialsToDelete = selectedMaterial ? [selectedMaterial] : selectedMaterials;
    if (!materialsToDelete.length) return;

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
      loadMaterials();
      loadSummary();
    } catch (error) {
      toast.error(
        materialsToDelete.length === 1
          ? 'Failed to delete material'
          : 'Failed to delete selected materials'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleView = (material) => {
    navigate(`/raw-material/${material.id}`, {
      state: { from: '/raw-materials' },
    });
  };

  const getMaterialGuidanceDetails = (material) => {
    const linkedReferenceProfile = referenceStatusMap.get(material.id)?.reference_profile || null;
    const fallbackReferenceProfile = linkedReferenceProfile
      ? null
      : buildFallbackReferenceProfileFromRawMaterial(material);
    const referenceProfile = linkedReferenceProfile || fallbackReferenceProfile;
    const classDistribution = extractWorkbookClassDistribution(referenceProfile);
    const primaryClass = classDistribution[0] || null;
    const resolvedValues = {
      workbook_code: referenceProfile?.reference_code || material.workbook_code || '',
      cas_number: referenceProfile?.cas_no || material.cas_number || '',
      ifra_limit: referenceProfile?.ifra_limit_percent ?? material.ifra_limit ?? null,
      reference_abc_primary_family: primaryClass?.familyName
        || referenceProfile?.abc_primary_family
        || material.reference_abc_primary_family
        || '',
      reference_impact: referenceProfile?.impact ?? material.reference_impact ?? null,
      reference_life_hours: referenceProfile?.life_hours ?? material.reference_life_hours ?? null,
      reference_use_level_typical_percent: referenceProfile?.use_level_typical_percent ?? material.reference_use_level_typical_percent ?? null,
      reference_use_level_max_percent: referenceProfile?.use_level_max_percent ?? material.reference_use_level_max_percent ?? null,
    };
    const missingGuidance = !referenceProfile;
    const missingImpact = resolvedValues.reference_impact === null || resolvedValues.reference_impact === undefined || Number(resolvedValues.reference_impact) <= 0;
    const missingLife = resolvedValues.reference_life_hours === null || resolvedValues.reference_life_hours === undefined || Number(resolvedValues.reference_life_hours) <= 0;
    const missingClass = !classDistribution.length && !resolvedValues.reference_abc_primary_family;
    const missingCas = !String(resolvedValues.cas_number || '').trim();
    const missingIfra = resolvedValues.ifra_limit === null || resolvedValues.ifra_limit === undefined;

      return {
        material,
        referenceProfile,
        resolvedValues,
        hasCoreGuidance: !missingImpact && !missingLife,
        hasWarning: missingGuidance || missingImpact || missingLife || missingClass || missingCas || missingIfra,
        missingGuidance,
        missingImpact,
      missingLife,
      missingClass,
      missingCas,
      missingIfra,
    };
  };

  const openGuidanceEditor = (material) => {
    const guidanceDetails = getMaterialGuidanceDetails(material);
    setGuidanceEditorMaterial({
      ...material,
      guidance_resolved_values: guidanceDetails.resolvedValues,
    });
    setGuidanceEditorOpen(true);
  };

  const handleGuidanceSaved = (updatedMaterial) => {
    const nextMaterials = materials.map((material) => (
      material.id === updatedMaterial.id ? updatedMaterial : material
    ));
    setMaterials(nextMaterials);
    setSummaryMaterials((current) => current.map((material) => (
      material.id === updatedMaterial.id ? { ...material, ...updatedMaterial } : material
    )));
    setGuidanceEditorMaterial(updatedMaterial);
    refreshReferenceStatusMap(nextMaterials);
    loadSummary();
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setStockFilter('all');
    setReferenceFilter('all');
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <button onClick={() => handleView(row)} className="text-left">
          <div className="font-medium text-primary hover:underline">{row.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {row.scent_family || deriveScentFamilyFromCategory(row.category, '') || 'Family not set'}
            </span>
            {referenceStatusMap.get(row.id)?.reference_profile ? (
              <Badge variant="secondary" className="text-[10px]">
                Ref {referenceStatusMap.get(row.id).reference_profile.reference_code}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Unmatched
              </Badge>
            )}
            {Boolean(referenceStatusMap.get(row.id)?.reference_profile)
            && hasReferenceValue(referenceStatusMap.get(row.id)?.reference_profile?.ifra_limit_percent) ? (
              <Badge variant="outline" className="text-[10px]">
                IFRA ref
              </Badge>
            ) : null}
          </div>
        </button>
      )
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => (
        <div className="min-w-[120px]">
          <div className="text-sm capitalize text-foreground">{row.type}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-full border border-border/60"
              style={{ backgroundColor: categoryColorMap.get(String(row.category || '').toLowerCase()) || '#CBD5E1' }}
            />
            <span className="truncate">{row.category || 'Uncategorized'}</span>
          </div>
        </div>
      )
    },
    {
      key: 'stock_quantity',
      label: 'Stock',
      align: 'right',
      render: (row) => {
        const threshold = row.low_stock_threshold || row.minimum_stock;
        const isLowStock = row.stock_quantity < threshold;
        return (
          <div className="text-right">
            <div className={`font-mono ${isLowStock ? 'text-destructive font-semibold' : ''}`}>
              {formatQuantity(row.stock_quantity)} {row.unit}
            </div>
            <div className="text-xs text-muted-foreground">
              Min {formatQuantity(threshold)} {row.unit}
            </div>
          </div>
        );
      }
    },
    {
      key: 'guidance',
      label: 'Guidance',
      render: (row) => {
        const guidance = getMaterialGuidanceDetails(row);
        return (
          <div className="min-w-[190px]">
            <button
              type="button"
              onClick={() => openGuidanceEditor(row)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
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
              <div className="mt-2 text-xs text-muted-foreground">
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
          </div>
        );
      }
    },
    {
      key: 'cost_per_unit',
      label: 'Price',
      align: 'right',
      render: (row) => (
        <div className="text-right">
          <div className="font-mono text-sm">{formatPricePerUnit(row.cost_per_unit, row.unit)}</div>
          <div className="text-xs text-muted-foreground">
            Stock value {formatPrice(calculateIngredientCost(row.stock_quantity || 0, row.cost_per_unit || 0))}
          </div>
        </div>
      )
    }
  ];

  const filters = [
    {
      id: 'type',
      value: typeFilter,
      placeholder: 'All types',
      icon: FlaskConical,
      options: [
        { value: 'all', label: 'All types' },
        { value: 'material', label: 'Material' },
        { value: 'solvent', label: 'Solvent' }
      ]
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
      ]
    },
    {
      id: 'stock',
      value: stockFilter,
      placeholder: 'All stock levels',
      icon: Radar,
      options: [
        { value: 'all', label: 'All stock levels' },
        { value: 'low', label: 'Low stock' },
        { value: 'in_stock', label: 'In stock' }
      ]
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
        { value: 'has_guidance', label: 'Has reference guidance' }
      ]
    }
  ];

  const handleFilterChange = (filterId, value) => {
    if (filterId === 'type') {
      setTypeFilter(value);
    } else if (filterId === 'category') {
      setCategoryFilter(value);
    } else if (filterId === 'stock') {
      setStockFilter(value);
    } else if (filterId === 'reference') {
      setReferenceFilter(value);
    }
  };

  const hasActiveFilters =
    typeFilter !== 'all'
    || categoryFilter !== 'all'
    || stockFilter !== 'all'
    || referenceFilter !== 'all'
    || searchTerm;

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Raw Materials - Perfumer Studio</title>
        <meta name="description" content="Manage your raw materials inventory with stock tracking and cost management." />
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
          title="Raw materials"
          description="Audit inventory health, vendor coverage, dilution readiness, and workbook reference coverage from one master list before you dive into detail pages."
          action="Add material"
          actionIcon={Plus}
          onAction={() => setAddModalOpen(true)}
        />

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
                <p className="list-summary-label">Low stock alerts</p>
                <span className="list-summary-value text-destructive">{lowStockCount}</span>
                <p className="list-summary-note">Materials already below their reorder threshold.</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </div>
          <div className="list-summary-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="list-summary-label">Solvents ready</p>
                <span className="list-summary-value">{solventCount}</span>
                <p className="list-summary-note">Solvents available for dilution and batch production.</p>
              </div>
              <Droplets className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div className="list-summary-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="list-summary-label">Estimated stock value</p>
                <span className="list-summary-value text-[1.45rem] sm:text-[1.7rem]">{formatPrice(inventoryValue)}</span>
                <p className="list-summary-note">{categoryCount} categories in use / {ifraReferenceCount} IFRA reference profiles linked.</p>
              </div>
              <Banknote className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="list-toolbar-panel mb-6">
          <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="list-subtle-panel max-w-3xl">
              <div className="flex items-start gap-3">
                <Shapes className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Inventory review flow</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use this page to clean up categorization and stock health, then open each material&apos;s detail page for usage history and dilution context.
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
                Search inventory or reference data
              </div>
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search by name, vendor, CAS, workbook code, reference code, or ABC family..."
                disabled={showRefreshing}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => { loadMaterials(); loadCategories(); }} variant="outline" size="icon" disabled={loading} className="h-11 w-11 rounded-2xl">
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
                <p className="text-sm text-muted-foreground">Use bulk delete to clean up duplicate or unused raw materials faster.</p>
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
              Showing {filteredMaterials.length} of {totalMaterials} materials
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
            description="Add your first raw material to start building your perfume inventory."
            action="Add material"
            actionIcon={Plus}
            onAction={() => setAddModalOpen(true)}
          />
        ) : filteredMaterials.length === 0 ? (
          <NoResultsState
            searchTerm={searchTerm}
            onClearFilters={hasActiveFilters ? handleClearFilters : null}
          />
        ) : (
          <>
            <div className="relative">
              <DataTable
                columns={columns}
                data={filteredMaterials}
                selectable
                selectedRowIds={selectedMaterialIds}
                onToggleRow={handleToggleMaterialSelection}
                onToggleAll={handleToggleAllMaterials}
                mobileCard={(row) => (
                  <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <Checkbox
                          checked={selectedMaterialIds.includes(row.id)}
                          onCheckedChange={() => handleToggleMaterialSelection(row)}
                          aria-label={`Select ${row.name}`}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <button onClick={() => handleView(row)} className="w-full text-left">
                            <div className="truncate text-sm font-semibold text-primary hover:underline">{row.name}</div>
                          </button>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {row.scent_family || deriveScentFamilyFromCategory(row.category, '') || 'Family not set'}
                            </span>
                            {referenceStatusMap.get(row.id)?.reference_profile ? (
                              <Badge variant="secondary" className="text-[10px]">
                                Ref {referenceStatusMap.get(row.id).reference_profile.reference_code}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                Unmatched
                              </Badge>
                            )}
                            {Boolean(referenceStatusMap.get(row.id)?.reference_profile)
                            && hasReferenceValue(referenceStatusMap.get(row.id)?.reference_profile?.ifra_limit_percent) ? (
                              <Badge variant="outline" className="text-[10px]">
                                IFRA ref
                              </Badge>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => openGuidanceEditor(row)}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  getMaterialGuidanceDetails(row).hasWarning
                                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                }`}
                              >
                                {getMaterialGuidanceDetails(row).hasWarning
                                  ? (getMaterialGuidanceDetails(row).hasCoreGuidance ? 'Guidance partial' : 'Need guidance')
                                  : 'Guidance ready'}
                              </button>
                            </div>
                          </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 capitalize text-[11px]">
                        {row.type}
                      </Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-muted/45 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Type</div>
                        <div className="mt-1 truncate text-sm capitalize">{row.type}</div>
                      </div>
                      <div className="rounded-2xl bg-muted/45 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Stock</div>
                        <div className="mt-1 text-sm">{formatQuantity(row.stock_quantity)} {row.unit}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 text-xs text-muted-foreground">
                        {row.cas_number || row.workbook_code || 'Open detail to review vendor, category, and reference'}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openGuidanceEditor(row)}
                          className="h-9 rounded-xl px-3 text-xs"
                          title="Workbook guidance"
                          aria-label={`Workbook guidance for ${row.name}`}
                        >
                          {getMaterialGuidanceDetails(row).hasWarning ? 'Guidance' : 'Guidance OK'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleView(row)}
                          className="h-9 rounded-xl px-4"
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(row)}
                          className="h-9 rounded-xl px-3 text-xs"
                          title="Edit"
                          aria-label={`Edit ${row.name}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(row)}
                          className="h-9 rounded-xl px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete"
                          aria-label={`Delete ${row.name}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                onEdit={handleEdit}
                onDelete={handleDelete}
                actions={(row) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(row)}
                    className="table-action-button"
                    title="View details"
                    aria-label={`View details for ${row.name}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
              />
              {showRefreshing ? (
                <div className="absolute inset-0 flex items-start justify-center rounded-[24px] bg-background/55 pt-8 backdrop-blur-[1px]">
                  <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm shadow-sm">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    Updating results...
                  </div>
                </div>
              ) : null}
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
        onSuccess={() => {
          loadMaterials();
          loadSummary();
        }}
      />

      <EditRawMaterialModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        material={selectedMaterial}
        onSuccess={() => {
          loadMaterials();
          loadSummary();
        }}
      />

      <RemapRawMaterialCategoriesModal
        open={remapModalOpen}
        onOpenChange={setRemapModalOpen}
        materials={remapMaterials}
        onSuccess={() => {
          loadMaterials();
          loadSummary();
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title={selectedMaterial ? 'Delete material' : 'Delete selected materials'}
        description={selectedMaterial
          ? `Are you sure you want to delete "${selectedMaterial?.name}"? This action cannot be undone.`
          : `Are you sure you want to delete ${selectedMaterialIds.length} selected materials? This action cannot be undone.`}
        confirmText={deletingId ? (isBulkDeleting ? 'Deleting selected...' : 'Deleting...') : 'Delete'}
      />

      <RawMaterialGuidanceQuickEditDialog
        open={guidanceEditorOpen}
        onOpenChange={setGuidanceEditorOpen}
        material={guidanceEditorMaterial}
        guidanceStatus={guidanceEditorMaterial ? getMaterialGuidanceDetails(guidanceEditorMaterial) : null}
        onSaved={handleGuidanceSaved}
      />
    </AuthenticatedLayout>
  );
};

export default RawMaterialsPage;
