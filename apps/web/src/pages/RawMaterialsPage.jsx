
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Home, Plus, Package, Eye } from 'lucide-react';
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
import { formatQuantity, formatCurrency } from '@/utils/formatting.js';

const RawMaterialsPage = () => {
  const navigate = useNavigate();
  const { fetchMaterials, deleteMaterial } = useRawMaterials();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
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

  useEffect(() => {
    loadMaterials();
  }, []);

  const filteredMaterials = useMemo(() => {
    return materials.filter(material => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        material.name.toLowerCase().includes(searchLower) ||
        (material.category && material.category.toLowerCase().includes(searchLower)) ||
        (material.scent_family && material.scent_family.toLowerCase().includes(searchLower));
      
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
    navigate(`/raw-material/${material.id}`);
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
      render: (row) => <span className="font-medium">{row.name}</span>
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.category}
        </Badge>
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
      key: 'cost_per_unit',
      label: 'Price',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-sm">
          {formatCurrency(row.cost_per_unit)} / 10 ml
        </span>
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
        { value: 'floral', label: 'Floral' },
        { value: 'amber', label: 'Amber' },
        { value: 'woody', label: 'Woody' },
        { value: 'citrus', label: 'Citrus' },
        { value: 'musk', label: 'Musk' },
        { value: 'fruity', label: 'Fruity' },
        { value: 'green', label: 'Green' },
        { value: 'gourmand', label: 'Gourmand' },
        { value: 'spicy', label: 'Spicy' },
        { value: 'resinous', label: 'Resinous' },
        { value: 'solvent', label: 'Solvent' }
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2 mb-4"
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

        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search by name, category, or scent family..."
              />
            </div>
            <Button onClick={loadMaterials} variant="outline" size="icon" disabled={loading}>
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
