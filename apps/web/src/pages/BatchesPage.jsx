
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RefreshCw, Home, Plus, Boxes, Eye, FlaskConical, ClipboardList, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useBatches } from '@/hooks/useBatches.js';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import FilterBar from '@/components/FilterBar.jsx';
import DataTable from '@/components/DataTable.jsx';
import ListPagination from '@/components/ListPagination.jsx';
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

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

  const paginatedBatches = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredBatches.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredBatches]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredBatches.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredBatches.length]);

  const draftCount = useMemo(
    () => batches.filter((batch) => batch.status === 'draft').length,
    [batches]
  );

  const completedCount = useMemo(
    () => batches.filter((batch) => batch.status === 'completed').length,
    [batches]
  );

  const deductedCount = useMemo(
    () => batches.filter((batch) => batch.is_stock_deducted).length,
    [batches]
  );

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
      render: (row) => (
        <button onClick={() => handleView(row)} className="text-left">
          <div className="font-mono font-semibold text-sm text-primary hover:underline">{row.batch_code}</div>
          <div className="text-xs text-muted-foreground">
            {formatQuantity(row.target_quantity)} {row.unit}
          </div>
        </button>
      )
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
          description="Move batches from planning to completion with clearer status tracking, material readiness, and production records."
          action="Create batch"
          actionIcon={Plus}
          onAction={() => setCreateModalOpen(true)}
        />

        <div className="list-summary-grid list-summary-grid-4">
          <div className="list-summary-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="list-summary-label">Total batches</p>
                <span className="list-summary-value">{batches.length}</span>
                <p className="list-summary-note">All production runs recorded in the workspace.</p>
              </div>
              <Boxes className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div className="list-summary-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="list-summary-label">Draft queue</p>
                <span className="list-summary-value">{draftCount}</span>
                <p className="list-summary-note">Draft batches can still be edited, produced, or deleted.</p>
              </div>
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div className="list-summary-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="list-summary-label">Completed</p>
                <span className="list-summary-value text-emerald-700">{completedCount}</span>
                <p className="list-summary-note">Production runs already marked as completed.</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            </div>
          </div>
          <div className="list-summary-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="list-summary-label">Stock deducted</p>
                <span className="list-summary-value">{deductedCount}</span>
                <p className="list-summary-note">Batches with material deductions already recorded.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="list-toolbar-panel mb-6 flex flex-col gap-4">
          <div className="list-subtle-panel">
            <div className="flex items-start gap-3">
              <FlaskConical className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">Batch workflow</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Draft batches are your planning stage. Open a batch detail page to review material expansion, costs, and stock deduction before completion.
                </p>
              </div>
            </div>
          </div>

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
              {hasActiveFilters ? ' with active filters applied' : ''}
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
          <>
            <DataTable
              columns={columns}
              data={paginatedBatches}
              mobileCard={(row) => (
                <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <button onClick={() => handleView(row)} className="w-full text-left">
                        <div className="truncate font-mono text-sm font-semibold text-primary hover:underline">{row.batch_code}</div>
                      </button>
                      <div className="mt-1 truncate text-sm text-foreground">{row.expand?.formula_id?.name || 'Unknown formula'}</div>
                    </div>
                    <BatchStatusBadge status={row.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-muted/45 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Target</div>
                      <div className="mt-1 text-sm">{formatQuantity(row.target_quantity)} {row.unit}</div>
                    </div>
                    <div className="rounded-2xl bg-muted/45 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Date</div>
                      <div className="mt-1 text-sm">
                        {new Date(row.production_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 text-xs text-muted-foreground">
                        {row.expand?.solvent_id?.name || 'No solvent selected'}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(row)}
                          className="table-action-button"
                          title="View details"
                          aria-label={`View details for ${row.batch_code}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {row.status === 'draft' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleProduce(row)}
                              className="table-action-button"
                              title="Produce batch"
                              aria-label={`Produce batch ${row.batch_code}`}
                            >
                              <FlaskConical className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(row)}
                              className="h-8 rounded-xl px-3 text-xs"
                              title="Edit"
                              aria-label={`Edit ${row.batch_code}`}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(row)}
                              className="h-8 rounded-xl px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Delete"
                              aria-label={`Delete ${row.batch_code}`}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
              )}
              onEdit={handleEdit}
              onDelete={handleDelete}
              actions={(row) => (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(row)}
                    className="table-action-button"
                    title="View details"
                    aria-label={`View details for ${row.batch_code}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  {row.status === 'draft' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleProduce(row)}
                      className="table-action-button"
                      title="Produce batch"
                      aria-label={`Produce batch ${row.batch_code}`}
                    >
                      <FlaskConical className="w-4 h-4" />
                    </Button>
                  )}
                </>
              )}
            />
            <ListPagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={filteredBatches.length}
              itemLabel="batches"
              onPageChange={setCurrentPage}
            />
          </>
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
