
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Home, Plus, Package, Eye, AlertTriangle, Layers3, Droplets, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import FilterBar from '@/components/FilterBar.jsx';
import DataTable from '@/components/DataTable.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import NoResultsState from '@/components/NoResultsState.jsx';
import AddRawMaterialModal from '@/components/AddRawMaterialModal.jsx';
import EditRawMaterialModal from '@/components/EditRawMaterialModal.jsx';
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import RawMaterialDetailModal from '@/components/RawMaterialDetailModal.jsx';
import RemapRawMaterialCategoriesModal from '@/components/RemapRawMaterialCategoriesModal.jsx';
import { formatQuantity } from '@/utils/formatting.js';
import { formatPricePerUnit } from '@/utils/pricingUtils.js';
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
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [remapModalOpen, setRemapModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

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
      const matchesCategory = categoryFilter === 'all' || material.category === categoryFilter;
      
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

  const handleEdit = (material) => {
    setSelectedMaterial(material);
    setDetailModalOpen(false);
    setEditModalOpen(true);
  };

  const handleDelete = (material) => {
    setSelectedMaterial(material);
    setDetailModalOpen(false);
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
    setSelectedMaterial(material);
    setDetailModalOpen(true);
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
          className="font-medium text-left text-primary hover:underline"
        >
          {row.name}
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
          <span className={`font-mono ${isLowStock ? 'text-destructive font-semibold' : ''}`}>
            {formatQuantity(row.stock_quantity)} {row.unit}
          </span>
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
          <div className="text-xs text-muted-foreground">Min {formatQuantity(row.minimum_stock)} {row.unit}</div>
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
          description="Manage your raw materials inventory with stock tracking and cost management"
          action="Add material"
          actionIcon={Plus}
          onAction={() => setAddModalOpen(true)}
        />

        <div className="mb-4 flex justify-end">
          <Button variant="outline" onClick={() => setRemapModalOpen(true)} className="gap-2 h-9">
            <Wand2 className="w-4 h-4" />
            Remap categories
          </Button>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total materials</p>
                <p className="mt-1 text-2xl font-semibold">{materials.length}</p>
              </div>
              <Layers3 className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low stock alerts</p>
                <p className="mt-1 text-2xl font-semibold text-destructive">{lowStockCount}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Solvents ready</p>
                <p className="mt-1 text-2xl font-semibold">{solventCount}</p>
              </div>
              <Droplets className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search by name, vendor, CAS, scent family, or category..."
              />
            </div>
            <Button onClick={() => { loadMaterials(); loadCategories(); }} variant="outline" size="icon" disabled={loading} className="h-9 w-9">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearFilters}
          />

          {!loading && materials.length > 0 && (
            <div className="results-count">
              Showing {filteredMaterials.length} of {materials.length} materials
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
          <DataTable
            columns={columns}
            data={filteredMaterials}
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
          setDetailModalOpen(false);
        }}
      />

      <RawMaterialDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        material={selectedMaterial}
        onEdit={handleEdit}
        onDelete={handleDelete}
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
