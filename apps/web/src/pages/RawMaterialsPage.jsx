
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Home, Plus, Package, Eye, AlertTriangle, Layers3, Droplets, Wand2, Banknote, Shapes } from 'lucide-react';
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
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import RemapRawMaterialCategoriesModal from '@/components/RemapRawMaterialCategoriesModal.jsx';
import { formatQuantity } from '@/utils/formatting.js';
import { calculateIngredientCost, formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';
import { getRawMaterialCategories } from '@/services/rawMaterialCategoriesService.js';
import { findPerfumersWorldCategoryByValue } from '@/utils/perfumersWorldCategories.js';
import { deriveScentFamilyFromCategory } from '@/utils/rawMaterialCategoryMeta.js';

const RawMaterialsPage = () => {
  const navigate = useNavigate();
  const { fetchMaterials, deleteMaterial } = useRawMaterials();
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [remapModalOpen, setRemapModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const data = await fetchMaterials();
      setMaterials(data);
    } catch (error) {
      toast.error('Failed to load materials');
    } finally {
      setLoading(false);
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
    loadMaterials();
    loadCategories();
  }, []);

  const filteredMaterials = useMemo(() => {
    return materials.filter(material => {
      const searchLower = searchTerm.toLowerCase();
      const family = material.scent_family || deriveScentFamilyFromCategory(material.category, '');
      const matchesSearch = 
        material.name.toLowerCase().includes(searchLower) ||
        (material.category && material.category.toLowerCase().includes(searchLower)) ||
        (family && family.toLowerCase().includes(searchLower)) ||
        (material.vendor && material.vendor.toLowerCase().includes(searchLower)) ||
        (material.cas_number && material.cas_number.toLowerCase().includes(searchLower));
      
      const matchesType = typeFilter === 'all' || material.type === typeFilter;
      const matchesCategory =
        categoryFilter === 'all' ||
        String(material.category || '').toLowerCase() === String(categoryFilter || '').toLowerCase();
      
      let matchesStock = true;
      if (stockFilter === 'low') {
        const threshold = material.low_stock_threshold || material.minimum_stock;
        matchesStock = material.stock_quantity < threshold;
      } else if (stockFilter === 'in_stock') {
        const threshold = material.low_stock_threshold || material.minimum_stock;
        matchesStock = material.stock_quantity >= threshold;
      }
      
      return matchesSearch && matchesType && matchesCategory && matchesStock;
    });
  }, [materials, searchTerm, typeFilter, categoryFilter, stockFilter]);

  const paginatedMaterials = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredMaterials.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredMaterials]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, categoryFilter, stockFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredMaterials.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredMaterials.length]);

  const categoryColorMap = useMemo(
    () => new Map(categories.map((category) => [category.name.toLowerCase(), category.color])),
    [categories]
  );

  const lowStockCount = useMemo(
    () =>
      materials.filter((material) => {
        const threshold = material.low_stock_threshold || material.minimum_stock;
        return Number(material.stock_quantity) < Number(threshold);
      }).length,
    [materials]
  );

  const solventCount = useMemo(
    () => materials.filter((material) => material.type === 'solvent').length,
    [materials]
  );

  const categoryCount = useMemo(
    () => new Set(materials.map((material) => String(material.category || '').trim()).filter(Boolean)).size,
    [materials]
  );

  const inventoryValue = useMemo(
    () =>
      materials.reduce(
        (sum, material) => sum + calculateIngredientCost(material.stock_quantity || 0, material.cost_per_unit || 0),
        0
      ),
    [materials]
  );

  const handleEdit = (material) => {
    setSelectedMaterial(material);
    setEditModalOpen(true);
  };

  const handleDelete = (material) => {
    setSelectedMaterial(material);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedMaterial) return;
    
    setDeletingId(selectedMaterial.id);
    try {
      await deleteMaterial(selectedMaterial.id);
      toast.success('Material deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedMaterial(null);
      loadMaterials();
    } catch (error) {
      toast.error('Failed to delete material');
    } finally {
      setDeletingId(null);
    }
  };

  const handleView = (material) => {
    navigate(`/raw-material/${material.id}`, {
      state: { from: '/raw-materials' },
    });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setStockFilter('all');
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <button
          onClick={() => handleView(row)}
          className="text-left"
        >
          <div className="font-medium text-primary hover:underline">{row.name}</div>
          <div className="text-xs text-muted-foreground">
            {row.scent_family || deriveScentFamilyFromCategory(row.category, '') || 'Family not set'}
          </div>
        </button>
      )
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) => (
        <span className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full border border-border/60"
              style={{ backgroundColor: categoryColorMap.get(String(row.category || '').toLowerCase()) || '#CBD5E1' }}
            />
          <Badge variant="outline" className="capitalize">
            {row.category}
          </Badge>
        </span>
      )
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => (
        <span className="text-muted-foreground capitalize">{row.type}</span>
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
      key: 'vendor',
      label: 'Vendor / CAS',
      render: (row) => (
        <div className="min-w-[180px]">
          <div className="text-sm font-medium">{row.vendor || '-'}</div>
          <div className="text-xs text-muted-foreground">{row.cas_number || 'No CAS number'}</div>
        </div>
      )
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
      options: [
        { value: 'all', label: 'All stock levels' },
        { value: 'low', label: 'Low stock' },
        { value: 'in_stock', label: 'In stock' }
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
    }
  };

  const hasActiveFilters = typeFilter !== 'all' || categoryFilter !== 'all' || stockFilter !== 'all' || searchTerm;

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
          description="Audit inventory health, vendor coverage, and dilution readiness from one master list before you dive into detail pages."
          action="Add material"
          actionIcon={Plus}
          onAction={() => setAddModalOpen(true)}
        />

        <div className="list-summary-grid list-summary-grid-4">
          <div className="list-summary-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="list-summary-label">Total materials</p>
                <span className="list-summary-value">{materials.length}</span>
                <p className="list-summary-note">Active inventory records across materials and solvents.</p>
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
                <p className="list-summary-note">{categoryCount} mapped categories currently in use.</p>
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
                Search materials or vendor
              </div>
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search by name, vendor, CAS, scent family, or category..."
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => { loadMaterials(); loadCategories(); }} variant="outline" size="icon" disabled={loading} className="h-11 w-11 rounded-2xl">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearFilters}
          />

          {!loading && materials.length > 0 && (
            <div className="results-count">
              Showing {filteredMaterials.length} of {materials.length} materials
              {hasActiveFilters ? ' with active filters applied' : ''}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : materials.length === 0 ? (
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
            <DataTable
              columns={columns}
              data={paginatedMaterials}
              mobileCard={(row) => (
                <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <button onClick={() => handleView(row)} className="w-full text-left">
                        <div className="truncate text-sm font-semibold text-primary hover:underline">{row.name}</div>
                      </button>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.scent_family || deriveScentFamilyFromCategory(row.category, '') || 'Family not set'}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 capitalize text-[11px]">
                      {row.type}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-muted/45 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Vendor</div>
                      <div className="mt-1 truncate text-sm">{row.vendor || '-'}</div>
                    </div>
                    <div className="rounded-2xl bg-muted/45 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Stock</div>
                      <div className="mt-1 text-sm">{formatQuantity(row.stock_quantity)} {row.unit}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 text-xs text-muted-foreground">
                      {row.category || 'Uncategorized'}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(row)}
                      className="h-9 rounded-xl px-4"
                    >
                      View
                    </Button>
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
                  className="h-8 w-8 p-0"
                  title="View details"
                >
                  <Eye className="w-4 h-4" />
                </Button>
              )}
            />
            <ListPagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={filteredMaterials.length}
              itemLabel="materials"
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      <AddRawMaterialModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={loadMaterials}
      />

      <EditRawMaterialModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        material={selectedMaterial}
        onSuccess={() => {
          loadMaterials();
        }}
      />

      <RemapRawMaterialCategoriesModal
        open={remapModalOpen}
        onOpenChange={setRemapModalOpen}
        materials={materials}
        onSuccess={loadMaterials}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete material"
        description={`Are you sure you want to delete "${selectedMaterial?.name}"? This action cannot be undone.`}
        confirmText={deletingId ? 'Deleting...' : 'Delete'}
      />
    </AuthenticatedLayout>
  );
};

export default RawMaterialsPage;
