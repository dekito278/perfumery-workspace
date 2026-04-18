
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Home, Plus, Beaker, Eye, Copy, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import FilterBar from '@/components/FilterBar.jsx';
import DataTable from '@/components/DataTable.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import NoResultsState from '@/components/NoResultsState.jsx';
import AddFormulaModal from '@/components/AddFormulaModal.jsx';
import EditFormulaModal from '@/components/EditFormulaModal.jsx';
import CreateBatchModal from '@/components/CreateBatchModal.jsx';
import DeleteFormulaModal from '@/components/DeleteFormulaModal.jsx';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { formatGramAmount } from '@/utils/formatting.js';

const FormulasPage = () => {
  const navigate = useNavigate();
  const { getFormulas, duplicateFormula } = useFormulas();
  const { getFormulaItems } = useFormulaItems();
  const [formulas, setFormulas] = useState([]);
  const [formulaMetrics, setFormulaMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createBatchModalOpen, setCreateBatchModalOpen] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false, formulaId: null, formulaName: null });
  const [selectedFormula, setSelectedFormula] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);

  const loadFormulas = async () => {
    setLoading(true);
    try {
      const data = await getFormulas();
      setFormulas(data);

      const metrics = {};
      for (const formula of data) {
        const items = await getFormulaItems(formula.id);
        const totalGrams = calculateTotalAmount(items);

        metrics[formula.id] = {
          itemCount: items.length,
          totalGrams: totalGrams
        };
      }

      setFormulaMetrics(metrics);
    } catch (error) {
      toast.error('Failed to load formulas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFormulas();
  }, []);

  const filteredFormulas = useMemo(() => {
    return formulas.filter(formula => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        formula.name.toLowerCase().includes(searchLower) ||
        formula.code.toLowerCase().includes(searchLower) ||
        (formula.category && formula.category.toLowerCase().includes(searchLower)) ||
        (formula.status && formula.status.toLowerCase().includes(searchLower));
      
      const matchesStatus = statusFilter === 'all' || formula.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || formula.category === categoryFilter;
      
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [formulas, searchTerm, statusFilter, categoryFilter]);

  const handleEdit = (formula) => {
    setSelectedFormula(formula);
    setEditModalOpen(true);
  };

  const handleDelete = (formula) => {
    setDeleteModalState({
      isOpen: true,
      formulaId: formula.id,
      formulaName: formula.name
    });
  };

  const handleDuplicate = async (formula) => {
    setDuplicatingId(formula.id);
    try {
      await duplicateFormula(formula.id);
      toast.success('Formula duplicated successfully');
      loadFormulas();
    } catch (error) {
      toast.error('Failed to duplicate formula');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleView = (formula) => {
    navigate(`/formulas/${formula.id}`);
  };

  const handleCreateBatch = (formula) => {
    setSelectedFormula(formula);
    setCreateBatchModalOpen(true);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => <span className="font-medium text-sm">{row.name}</span>
    },
    {
      key: 'code',
      label: 'Code',
      render: (row) => <span className="font-mono text-xs">{row.code}</span>
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const statusColors = {
          draft: 'secondary',
          active: 'default',
          archived: 'outline'
        };
        return (
          <Badge variant={statusColors[row.status] || 'secondary'} className="capitalize text-xs">
            {row.status || 'draft'}
          </Badge>
        );
      }
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) => (
        <span className="text-muted-foreground capitalize text-xs">
          {row.category ? row.category.replace(/_/g, ' ') : '—'}
        </span>
      )
    },
    {
      key: 'total',
      label: 'Total amount',
      render: (row) => {
        const metrics = formulaMetrics[row.id];
        return (
          <span className="font-mono text-xs">
            {metrics ? formatGramAmount(metrics.totalGrams) : '—'}
          </span>
        );
      }
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
        { value: 'active', label: 'Active' },
        { value: 'archived', label: 'Archived' }
      ]
    },
    {
      id: 'category',
      value: categoryFilter,
      placeholder: 'All categories',
      options: [
        { value: 'all', label: 'All categories' },
        { value: 'perfume', label: 'Perfume' },
        { value: 'eau_de_toilette', label: 'Eau de toilette' },
        { value: 'eau_de_cologne', label: 'Eau de cologne' },
        { value: 'fragrance_oil', label: 'Fragrance oil' }
      ]
    }
  ];

  const handleFilterChange = (filterId, value) => {
    if (filterId === 'status') {
      setStatusFilter(value);
    } else if (filterId === 'category') {
      setCategoryFilter(value);
    }
  };

  const hasActiveFilters = statusFilter !== 'all' || categoryFilter !== 'all' || searchTerm;

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Formulas - Perfumer Studio</title>
        <meta name="description" content="Define fragrance formulas with gram-based ingredient specifications." />
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
          title="Formulas"
          description="Define fragrance formulas with gram-based ingredient specifications"
          action="Create formula"
          actionIcon={Plus}
          onAction={() => setAddModalOpen(true)}
        />

        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search by name, code, category, or status..."
              />
            </div>
            <Button onClick={loadFormulas} variant="outline" size="icon" disabled={loading} className="h-9 w-9">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearFilters}
          />

          {!loading && formulas.length > 0 && (
            <div className="results-count">
              Showing {filteredFormulas.length} of {formulas.length} formulas
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : formulas.length === 0 ? (
          <EmptyState
            icon={Beaker}
            title="No formulas yet"
            description="Create your first formula by combining raw materials and accords with precise gram amounts."
            action="Create formula"
            actionIcon={Plus}
            onAction={() => setAddModalOpen(true)}
          />
        ) : filteredFormulas.length === 0 ? (
          <NoResultsState
            searchTerm={searchTerm}
            onClearFilters={hasActiveFilters ? handleClearFilters : null}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredFormulas}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCreateBatch(row)}
                  className="h-8 w-8 p-0"
                  title="Create batch"
                >
                  <FlaskConical className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDuplicate(row)}
                  className="h-8 w-8 p-0"
                  title="Duplicate formula"
                  disabled={duplicatingId === row.id}
                >
                  <Copy className={`w-4 h-4 ${duplicatingId === row.id ? 'animate-spin' : ''}`} />
                </Button>
              </>
            )}
          />
        )}
      </div>

      <AddFormulaModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={loadFormulas}
      />

      <EditFormulaModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        formula={selectedFormula}
        onSuccess={loadFormulas}
      />

      <CreateBatchModal
        open={createBatchModalOpen}
        onOpenChange={setCreateBatchModalOpen}
        preSelectedFormulaId={selectedFormula?.id}
        onSuccess={() => {
          toast.success('Batch created successfully');
          setCreateBatchModalOpen(false);
          navigate('/batches');
        }}
      />

      <DeleteFormulaModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, formulaId: null, formulaName: null })}
        formulaId={deleteModalState.formulaId}
        formulaName={deleteModalState.formulaName}
        onDeleteSuccess={() => {
          setDeleteModalState({ isOpen: false, formulaId: null, formulaName: null });
          loadFormulas();
        }}
      />
    </AuthenticatedLayout>
  );
};

export default FormulasPage;
