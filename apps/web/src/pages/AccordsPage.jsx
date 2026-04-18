import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Home, Plus, Beaker, Eye, FlaskConical, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAccords } from '@/hooks/useAccords.js';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import DataTable from '@/components/DataTable.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import NoResultsState from '@/components/NoResultsState.jsx';
import AddAccordModal from '@/components/AddAccordModal.jsx';
import EditAccordModal from '@/components/EditAccordModal.jsx';
import ImportAccordPdfModal from '@/components/ImportAccordPdfModal.jsx';
import ProduceAccordModal from '@/components/ProduceAccordModal.jsx';
import DeleteConfirmationDialog from '@/components/DeleteConfirmationDialog.jsx';
import { formatQuantity, formatCurrency } from '@/utils/formatting.js';

const AccordsPage = () => {
  const navigate = useNavigate();
  const { fetchAccords, deleteAccord } = useAccords();
  const [accords, setAccords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [produceModalOpen, setProduceModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAccord, setSelectedAccord] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadAccords = async () => {
    setLoading(true);
    try {
      const data = await fetchAccords();
      setAccords(data);
    } catch (error) {
      toast.error('Failed to load accords');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccords();
  }, []);

  const filteredAccords = useMemo(() => {
    if (!searchQuery.trim()) {
      return accords;
    }

    const query = searchQuery.toLowerCase();
    return accords.filter((accord) =>
      accord.name.toLowerCase().includes(query) ||
      (accord.notes && accord.notes.toLowerCase().includes(query))
    );
  }, [searchQuery, accords]);

  const handleEdit = (accord) => {
    setSelectedAccord(accord);
    setEditModalOpen(true);
  };

  const handleProduce = (accord) => {
    setSelectedAccord(accord);
    setProduceModalOpen(true);
  };

  const handleDeleteClick = (accord) => {
    setSelectedAccord(accord);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAccord) {
      return;
    }

    setDeleting(true);
    try {
      await deleteAccord(selectedAccord.id);
      toast.success('Accord deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedAccord(null);
      loadAccords();
    } catch (error) {
      toast.error('Failed to delete accord');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <button
          onClick={() => navigate(`/accords/${row.id}`)}
          className="font-medium text-sm text-left text-primary hover:underline"
        >
          {row.name}
        </button>
      ),
    },
    {
      key: 'stock_quantity',
      label: 'Stock',
      render: (row) => (
        <span className="font-mono text-sm">
          {formatQuantity(row.stock_quantity)} {row.unit || 'ml'}
        </span>
      ),
    },
    {
      key: 'cost_per_unit',
      label: 'Cost / 10 ml',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-sm">
          {row.cost_per_unit ? formatCurrency(row.cost_per_unit) : '-'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Stock status',
      render: (row) => (
        <Badge variant={Number(row.stock_quantity || 0) > 0 ? 'default' : 'secondary'} className="text-xs">
          {Number(row.stock_quantity || 0) > 0 ? 'Ready' : 'Empty'}
        </Badge>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.notes || '-'}
        </span>
      ),
    },
  ];

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Accords - Perfumer Studio</title>
        <meta name="description" content="Manage custom accords and keep their stock ready for formula production." />
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
          title="Accords"
          description="Manage custom accords and keep them ready for formula production"
          action="Create accord"
          actionIcon={Plus}
          onAction={() => setAddModalOpen(true)}
        />

        <div className="mb-4 flex justify-end">
          <Button variant="outline" onClick={() => setImportModalOpen(true)} className="gap-2 h-9">
            <FileUp className="w-4 h-4" />
            Import PDF
          </Button>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by accord name or notes..."
              />
            </div>
            <Button onClick={loadAccords} variant="outline" size="icon" disabled={loading} className="h-9 w-9">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {!loading && accords.length > 0 && (
            <div className="results-count">
              Showing {filteredAccords.length} of {accords.length} accords
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : accords.length === 0 ? (
          <EmptyState
            icon={Beaker}
            title="No accords yet"
            description="Create your first accord to prepare reusable blends for formulas and batches."
            action="Create accord"
            actionIcon={Plus}
            onAction={() => setAddModalOpen(true)}
          />
        ) : filteredAccords.length === 0 ? (
          <NoResultsState
            searchTerm={searchQuery}
            onClearFilters={() => setSearchQuery('')}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredAccords}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            actions={(row) => (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/accords/${row.id}`)}
                  className="h-8 w-8 p-0"
                  title="View details"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleProduce(row)}
                  className="h-8 w-8 p-0"
                  title="Produce accord"
                >
                  <FlaskConical className="w-4 h-4" />
                </Button>
              </>
            )}
          />
        )}
      </div>

      <AddAccordModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={loadAccords}
      />

      <ImportAccordPdfModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={loadAccords}
      />

      {selectedAccord && (
        <>
          <EditAccordModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            accord={selectedAccord}
            onSuccess={loadAccords}
          />

          <ProduceAccordModal
            open={produceModalOpen}
            onOpenChange={setProduceModalOpen}
            accord={selectedAccord}
            onSuccess={loadAccords}
          />

          <DeleteConfirmationDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onConfirm={handleDeleteConfirm}
            title="Delete accord"
            description={`Are you sure you want to delete "${selectedAccord.name}"? This action cannot be undone.`}
            confirmText={deleting ? 'Deleting...' : 'Delete'}
          />
        </>
      )}
    </AuthenticatedLayout>
  );
};

export default AccordsPage;
