
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RefreshCw, Home, Plus, Boxes, Eye, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { useBatches } from '@/hooks/useBatches.js';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import FilterBar from '@/components/FilterBar.jsx';
import DataTable from '@/components/DataTable.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import NoResultsState from '@/components/NoResultsState.jsx';
import BatchStatusBadge from '@/components/BatchStatusBadge.jsx';
import CreateBatchModal from '@/components/CreateBatchModal.jsx';
import EditBatchModal from '@/components/EditBatchModal.jsx';
import MaterialRequirementsModal from '@/components/MaterialRequirementsModal.jsx';
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import { formatQuantity } from '@/utils/formatting.js';

const BatchesPage = () => {
  const navigate = useNavigate();
  const { getBatches, deleteBatch } = useBatches();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [produceModalOpen, setProduceModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const data = await getBatches();
      setBatches(data);
    } catch (error) {
      toast.error('Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const filteredBatches = useMemo(() => {
    return batches.filter(batch => {
      const searchLower = searchTerm.toLowerCase();
      const formulaName = batch.expand?.formula_id?.name || '';
      const solventName = batch.expand?.solvent_id?.name || '';
      const matchesSearch = 
        batch.batch_code.toLowerCase().includes(searchLower) ||
        formulaName.toLowerCase().includes(searchLower) ||
        solventName.toLowerCase().includes(searchLower) ||
        (batch.status && batch.status.toLowerCase().includes(searchLower));
      
      const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [batches, searchTerm, statusFilter]);

  const handleEdit = (batch) => {
    if (batch.status !== 'draft') {
      toast.error('Only draft batches can be edited');
      return;
    }
    setSelectedBatch(batch);
    setEditModalOpen(true);
  };

  const handleProduce = (batch) => {
    if (batch.status !== 'draft') {
      toast.error('Only draft batches can be produced');
      return;
    }
    setSelectedBatch(batch);
    setProduceModalOpen(true);
  };

  const handleDelete = (batch) => {
    if (batch.status !== 'draft') {
      toast.error('Only draft batches can be deleted');
      return;
    }
    setSelectedBatch(batch);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedBatch) return;
    
    setDeletingId(selectedBatch.id);
    try {
      await deleteBatch(selectedBatch.id);
      toast.success('Batch deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedBatch(null);
      loadBatches();
    } catch (error) {
      toast.error(error.message || 'Failed to delete batch');
    } finally {
      setDeletingId(null);
    }
  };

  const handleView = (batch) => {
    navigate(`/batches/${batch.id}`);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  const columns = [
    {
      key: 'batch_code',
      label: 'Batch code',
      render: (row) => <span className="font-mono font-semibold text-sm">{row.batch_code}</span>
    },
    {
      key: 'formula',
      label: 'Formula',
      render: (row) => (
        <button
          onClick={() => navigate(`/formulas/${row.formula_id}`)}
          className="text-primary hover:underline font-medium transition-colors text-sm"
        >
          {row.expand?.formula_id?.name || 'Unknown'}
        </button>
      )
    },
    {
      key: 'solvent',
      label: 'Solvent',
      render: (row) => (
        <span className="text-xs">
          {row.expand?.solvent_id?.name || 'N/A'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <BatchStatusBadge status={row.status} />
    },
    {
      key: 'target_quantity',
      label: 'Target qty',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-sm">{formatQuantity(row.target_quantity)} {row.unit}</span>
      )
    },
    {
      key: 'production_date',
      label: 'Production date',
      render: (row) => new Date(row.production_date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    }
  ];

  const filters = [
    {
      id: 'status',
      value: statusFilter,
      placeholder: 'All statuses',
      options: [
        { value: 'all', label: 'All statuses' },
        { value: 'draft', label: 'Draft' },
        { value: 'in_progress', label: 'In progress' },
        { value: 'completed', label: 'Completed' }
      ]
    }
  ];

  const handleFilterChange = (filterId, value) => {
    if (filterId === 'status') {
      setStatusFilter(value);
    }
  };

  const hasActiveFilters = statusFilter !== 'all' || searchTerm;

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Batches - Perfumer Studio</title>
        <meta name="description" content="Track production batches with solvent dilution and monitor batch status." />
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
          title="Batches"
          description="Track production batches with solvent dilution and monitor batch status"
          action="Create batch"
          actionIcon={Plus}
          onAction={() => setCreateModalOpen(true)}
        />

        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search by batch code, formula, solvent, or status..."
              />
            </div>
            <Button onClick={loadBatches} variant="outline" size="icon" disabled={loading} className="h-9 w-9">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearFilters}
          />

          {!loading && batches.length > 0 && (
            <div className="results-count">
              Showing {filteredBatches.length} of {batches.length} batches
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : batches.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No batches yet"
            description="Create your first production batch with solvent dilution to start tracking material usage."
            action="Create batch"
            actionIcon={Plus}
            onAction={() => setCreateModalOpen(true)}
          />
        ) : filteredBatches.length === 0 ? (
          <NoResultsState
            searchTerm={searchTerm}
            onClearFilters={hasActiveFilters ? handleClearFilters : null}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredBatches}
            onEdit={handleEdit}
            onDelete={handleDelete}
            actions={(row) => (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleView(row)}
                  className="h-8 w-8 p-0"
                  title="View details"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                {row.status === 'draft' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleProduce(row)}
                    className="h-8 w-8 p-0"
                    title="Produce batch"
                  >
                    <FlaskConical className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
          />
        )}
      </div>

      <CreateBatchModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={loadBatches}
      />

      <EditBatchModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        batch={selectedBatch}
        onSuccess={loadBatches}
      />

      <MaterialRequirementsModal
        open={produceModalOpen}
        onOpenChange={setProduceModalOpen}
        batch={selectedBatch}
        onSuccess={loadBatches}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete batch"
        description={`Are you sure you want to delete batch "${selectedBatch?.batch_code}"? This action cannot be undone.`}
        confirmText={deletingId ? 'Deleting...' : 'Delete'}
      />
    </AuthenticatedLayout>
  );
};

export default BatchesPage;
