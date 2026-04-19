import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Home, Plus, Beaker, Eye, Copy, FlaskConical, FileUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import FilterBar from '@/components/FilterBar.jsx';
import DataTable from '@/components/DataTable.jsx';
import ListPagination from '@/components/ListPagination.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import NoResultsState from '@/components/NoResultsState.jsx';
import AddFormulaModal from '@/components/AddFormulaModal.jsx';
import EditFormulaModal from '@/components/EditFormulaModal.jsx';
import CreateBatchModal from '@/components/CreateBatchModal.jsx';
import DeleteFormulaModal from '@/components/DeleteFormulaModal.jsx';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { formatGramAmount, formatNullable } from '@/utils/formatting.js';

const ImportFormulaPdfModal = lazy(() => import('@/components/ImportFormulaPdfModal.jsx'));

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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createBatchModalOpen, setCreateBatchModalOpen] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false, formulaId: null, formulaName: null });
  const [selectedFormula, setSelectedFormula] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const loadFormulas = async () => {
    setLoading(true);
    try {
      const data = await getFormulas();
      setFormulas(data);

      const metrics = {};
      for (const formula of data) {
        const items = await getFormulaItems(formula.id);
        metrics[formula.id] = {
          itemCount: items.length,
          totalGrams: calculateTotalAmount(items),
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
    return formulas.filter((formula) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        formula.name.toLowerCase().includes(searchLower) ||
        formula.code.toLowerCase().includes(searchLower) ||
        (formula.status && formula.status.toLowerCase().includes(searchLower)) ||
        (formula.category && formula.category.toLowerCase().includes(searchLower));

      const matchesStatus = statusFilter === 'all' || formula.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || formula.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [formulas, searchTerm, statusFilter, categoryFilter]);

  const paginatedFormulas = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredFormulas.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredFormulas]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, categoryFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredFormulas.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredFormulas.length]);

  const handleEdit = (formula) => {
    setSelectedFormula(formula);
    setEditModalOpen(true);
  };

  const handleDelete = (formula) => {
    setDeleteModalState({
      isOpen: true,
      formulaId: formula.id,
      formulaName: formula.name,
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
      render: (row) => <span className="font-medium text-sm">{row.name}</span>,
    },
    {
      key: 'code',
      label: 'Code',
      render: (row) => <span className="font-mono text-xs">{row.code}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) => (
        <Badge variant="outline" className="capitalize text-xs">
          {formatNullable(row.category, 'uncategorized')}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const statusColors = {
          draft: 'secondary',
          active: 'default',
          archived: 'outline',
        };
        return (
          <Badge variant={statusColors[row.status] || 'secondary'} className="capitalize text-xs">
            {row.status || 'draft'}
          </Badge>
        );
      },
    },
    {
      key: 'total',
      label: 'Total amount',
      render: (row) => {
        const metrics = formulaMetrics[row.id];
        return (
          <span className="font-mono text-xs">
            {metrics ? formatGramAmount(metrics.totalGrams) : '-'}
          </span>
        );
      },
    },
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
        { value: 'archived', label: 'Archived' },
      ],
    },
    {
      id: 'category',
      value: categoryFilter,
      placeholder: 'All categories',
      options: [
        { value: 'all', label: 'All categories' },
        { value: 'perfume', label: 'Perfume' },
        { value: 'accord', label: 'Accord' },
      ],
    },
  ];

  const handleFilterChange = (filterId, value) => {
    if (filterId === 'status') {
      setStatusFilter(value);
    }
    if (filterId === 'category') {
      setCategoryFilter(value);
    }
  };

  const hasActiveFilters = statusFilter !== 'all' || categoryFilter !== 'all' || searchTerm;
  const accordCount = formulas.filter((formula) => formula.category === 'accord').length;
  const perfumeCount = formulas.filter((formula) => formula.category !== 'accord').length;

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
          description="Kelola seluruh formula dalam satu tempat. Formula kategori Perfume dan Accord sekarang memakai workflow yang sama tanpa menu Accord terpisah."
          action="Create formula"
          actionIcon={Plus}
          onAction={() => setAddModalOpen(true)}
        />

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_70px_-42px_rgba(125,86,13,0.35)]">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              Unified formula workspace
            </div>
            <h2 className="mt-3 text-xl font-semibold">Import, buat, edit, dan batch semua formula dari satu jalur.</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Category hanya menjadi penanda jenis formula. Seluruh operasi utama tetap berada di halaman ini.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total</div>
              <div className="mt-3 text-3xl font-bold">{formulas.length}</div>
            </div>
            <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Perfume</div>
              <div className="mt-3 text-3xl font-bold">{perfumeCount}</div>
            </div>
            <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Accord</div>
              <div className="mt-3 text-3xl font-bold">{accordCount}</div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-[28px] border border-white/80 bg-white/80 p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Search formulas
              </div>
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search by formula name, code, status, or category..."
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setImportModalOpen(true)} className="h-11 rounded-2xl gap-2 border-white/70 bg-white/80 px-4">
                <FileUp className="w-4 h-4" />
                Import PDF
              </Button>
              <Button onClick={loadFormulas} variant="outline" size="icon" disabled={loading} className="h-11 w-11 rounded-2xl border-white/70 bg-white/80">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : formulas.length === 0 ? (
          <EmptyState
            icon={Beaker}
            title="No formulas yet"
            description="Create your first perfume or accord formula by combining raw materials with precise gram amounts."
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
          <>
            <DataTable
              columns={columns}
              data={paginatedFormulas}
              mobileCard={(row) => {
                const metrics = formulaMetrics[row.id];
                const statusColors = {
                  draft: 'secondary',
                  active: 'default',
                  archived: 'outline',
                };

                return (
                  <div className="rounded-[22px] border border-white/80 bg-white/88 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button onClick={() => handleView(row)} className="text-left">
                          <div className="truncate text-sm font-semibold text-primary hover:underline">{row.name}</div>
                        </button>
                        <div className="mt-1 text-xs font-mono text-muted-foreground">{row.code}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline" className="capitalize text-[11px]">
                            {formatNullable(row.category, 'uncategorized')}
                          </Badge>
                          <Badge variant={statusColors[row.status] || 'secondary'} className="capitalize text-[11px]">
                            {row.status || 'draft'}
                          </Badge>
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">
                          {metrics ? `${formatGramAmount(metrics.totalGrams)} total` : 'No composition yet'}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(row)}
                          className="h-8 w-8 rounded-xl p-0"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCreateBatch(row)}
                          className="h-8 w-8 rounded-xl p-0"
                          title="Create batch"
                        >
                          <FlaskConical className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicate(row)}
                          className="h-8 w-8 rounded-xl p-0"
                          title="Duplicate formula"
                          disabled={duplicatingId === row.id}
                        >
                          <Copy className={`w-4 h-4 ${duplicatingId === row.id ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }}
              onEdit={handleEdit}
              onDelete={handleDelete}
              actions={(row) => (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(row)}
                    className="h-8 w-8 rounded-xl p-0"
                    title="View details"
                    aria-label={`View ${row.name}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCreateBatch(row)}
                    className="h-8 w-8 rounded-xl p-0"
                    title="Create batch"
                    aria-label={`Create batch from ${row.name}`}
                  >
                    <FlaskConical className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(row)}
                    className="h-8 w-8 rounded-xl p-0"
                    title="Duplicate formula"
                    aria-label={`Duplicate ${row.name}`}
                    disabled={duplicatingId === row.id}
                  >
                    <Copy className={`w-4 h-4 ${duplicatingId === row.id ? 'animate-spin' : ''}`} />
                  </Button>
                </>
              )}
            />
            <ListPagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={filteredFormulas.length}
              itemLabel="formulas"
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      <AddFormulaModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={loadFormulas}
      />

      {importModalOpen && (
        <Suspense fallback={null}>
          <ImportFormulaPdfModal
            open={importModalOpen}
            onOpenChange={setImportModalOpen}
            onSuccess={loadFormulas}
          />
        </Suspense>
      )}

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
