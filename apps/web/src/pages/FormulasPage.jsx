import React, { Suspense, lazy, useCallback, useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Home, Plus, Beaker, Eye, Copy, FileUp, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import FilterBar from '@/components/FilterBar.jsx';
import DataTable from '@/components/DataTable.jsx';
import ListPagination from '@/components/ListPagination.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import NoResultsState from '@/components/NoResultsState.jsx';
import StudioLoadingState from '@/components/StudioLoadingState.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import DeleteFormulaModal from '@/components/DeleteFormulaModal.jsx';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { formatGramAmount, formatNullable } from '@/utils/formatting.js';

const ImportFormulaPdfModal = lazy(() => import('@/components/ImportFormulaPdfModal.jsx'));

const FormulasPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getFormulas, duplicateFormula } = useFormulas();
  const { getFormulaItems } = useFormulaItems();
  const { getValidationLogs } = useValidationLogs();
  const [formulas, setFormulas] = useState([]);
  const [formulaMetrics, setFormulaMetrics] = useState({});
  const [pipelineByFormulaId, setPipelineByFormulaId] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false, formulaId: null, formulaName: null });
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const loadFormulas = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await getFormulas();
      setFormulas(data);

      const [validationLogs, metricEntries] = await Promise.all([
        getValidationLogs(),
        Promise.all(
          data.map(async (formula) => {
            const items = await getFormulaItems(formula.id);
            return [
              formula.id,
              {
                itemCount: items.length,
                totalGrams: calculateTotalAmount(items),
              },
            ];
          })
        ),
      ]);

      setFormulaMetrics(Object.fromEntries(metricEntries));

      const validationCountsByFormulaId = validationLogs.reduce((accumulator, log) => {
        const current = accumulator.get(log.formula_id) || { total: 0, actionNeeded: 0 };
        current.total += 1;
        if (log.status === 'action_needed') {
          current.actionNeeded += 1;
        }
        accumulator.set(log.formula_id, current);
        return accumulator;
      }, new Map());

      const nextPipelineByFormulaId = {};
      data.forEach((formula) => {
        const validationSummary = validationCountsByFormulaId.get(formula.id) || { total: 0, actionNeeded: 0 };

        nextPipelineByFormulaId[formula.id] = {
          validationCount: validationSummary.total,
          actionNeededCount: validationSummary.actionNeeded,
        };
      });

      setPipelineByFormulaId(nextPipelineByFormulaId);
    } catch (error) {
      setLoadError(error.message || 'Formula data could not be loaded. Check the connection and retry.');
      toast.error('Failed to load formulas');
    } finally {
      setLoading(false);
    }
  }, [getFormulaItems, getFormulas, getValidationLogs]);

  const handleImportSuccess = async (createdFormula) => {
    await loadFormulas();

    if (createdFormula?.id) {
      navigate(`/formulas/${createdFormula.id}`);
    }
  };

  useEffect(() => {
    loadFormulas();
  }, [loadFormulas]);

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

  const formulaCategories = useMemo(
    () =>
      [...new Set(formulas.map((formula) => String(formula.category || '').trim()).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right)),
    [formulas]
  );

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
    navigate(`/formulas/${formula.id}/edit`);
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
    navigate(`/formulas/${formula.id}`, {
      state: { from: `${location.pathname}${location.search}` },
    });
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
    {
      key: 'pipeline',
      label: 'Pipeline',
      render: (row) => {
        const pipeline = pipelineByFormulaId[row.id] || {
          validationCount: 0,
          actionNeededCount: 0,
        };

        return (
          <div className="flex min-w-[250px] flex-wrap gap-1.5">
            <Badge variant={pipeline.validationCount ? 'secondary' : 'outline'} className="text-[10px]">
              Logs {pipeline.validationCount}
            </Badge>
            {pipeline.actionNeededCount ? (
              <Badge variant="destructive" className="text-[10px]">
                Action {pipeline.actionNeededCount}
              </Badge>
            ) : null}
          </div>
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
        ...formulaCategories.map((category) => ({ value: category, label: category })),
      ],
    },
  ];

  const handleFilterChange = (filterId, value) => {
    if (filterId === 'status') {
      setStatusFilter(value);
    } else if (filterId === 'category') {
      setCategoryFilter(value);
    }
  };

  const hasActiveFilters =
    statusFilter !== 'all'
    || categoryFilter !== 'all'
    || searchTerm;

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Formulas - Solivagant</title>
        <meta name="description" content="Manage formula compositions, workbook imports, and revision-ready perfume formulas." />
      </Helmet>

      <div className="page-container">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/studio')}
            className="gap-2 mb-4 h-9"
          >
            <Home className="w-4 h-4" />
            Back to dashboard
          </Button>
        </div>

        <PageHeader
          title="Formulas"
          description="Buat formula mandiri langsung dari material library."
          action="New formula"
          actionIcon={Beaker}
          onAction={() => navigate('/formulas/new')}
        />

        <div className="mb-6 flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl bg-white/80" onClick={() => setImportModalOpen(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            Import PDF
          </Button>
        </div>

        <div className="list-toolbar-panel mb-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Search formulas
              </div>
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search by name, code, status, or category..."
                disabled={loading}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={loadFormulas} variant="outline" size="icon" disabled={loading} className="h-11 w-11 rounded-2xl">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/70 bg-white/55 p-3">
            <FilterBar
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearAll={handleClearFilters}
              compact
              disabled={loading}
            />
          </div>

          {!loading && formulas.length > 0 && (
            <div className="results-count">
              Showing {paginatedFormulas.length} of {filteredFormulas.length} formulas
              {hasActiveFilters ? ' with active filters applied' : ''}
            </div>
          )}
        </div>

        {loadError && formulas.length > 0 ? (
          <div className="mb-5">
            <StateBlock
              tone="error"
              title="Formula data may be stale"
              description={loadError}
              action={loading ? '' : 'Retry formulas'}
              onAction={loading ? null : loadFormulas}
              className="bg-rose-50/80 p-5"
            />
          </div>
        ) : null}

        {loading ? (
          <StudioLoadingState
            eyebrow="Loading formulas"
            title="Preparing formula library"
            description="Mengambil formula, metric komposisi, dan validation log."
          />
        ) : loadError && formulas.length === 0 ? (
          <StateBlock
            tone="error"
            title="Formulas could not be loaded"
            description={loadError}
            action="Retry formulas"
            onAction={loadFormulas}
          />
        ) : formulas.length === 0 ? (
          <EmptyState
            icon={Beaker}
            title="No formulas yet"
            description="Create your first formula to start composing guidance-aware, performance-ready formulas."
            action="New formula"
            actionIcon={Plus}
            onAction={() => navigate('/formulas/new')}
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
              onEdit={handleEdit}
              onDelete={handleDelete}
              mobileCard={(row) => {
                const metrics = formulaMetrics[row.id];
                const pipeline = pipelineByFormulaId[row.id] || {};
                return (
                  <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-primary">{row.name}</div>
                        <div className="mt-1 text-xs font-mono text-muted-foreground">{row.code}</div>
                      </div>
                      <Badge variant="outline" className="capitalize text-xs">
                        {row.status || 'draft'}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Category</div>
                        <div className="mt-1">{formatNullable(row.category, 'uncategorized')}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total amount</div>
                        <div className="mt-1 font-mono">{metrics ? formatGramAmount(metrics.totalGrams) : '-'}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      <Badge variant={pipeline.validationCount ? 'secondary' : 'outline'} className="text-[10px]">
                        Logs {pipeline.validationCount || 0}
                      </Badge>
                      {pipeline.actionNeededCount ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Action {pipeline.actionNeededCount}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(row)}
                        className="h-10 rounded-xl gap-2 text-xs"
                        aria-label={`View ${row.name}`}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicate(row)}
                        className="h-10 rounded-xl gap-2 text-xs"
                        disabled={duplicatingId === row.id}
                        aria-label={`Duplicate ${row.name}`}
                      >
                        <Copy className={`h-4 w-4 ${duplicatingId === row.id ? 'animate-spin' : ''}`} />
                        Duplicate
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(row)}
                        className="h-10 rounded-xl gap-2 text-xs"
                        aria-label={`Edit ${row.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(row)}
                        className="h-10 rounded-xl gap-2 border-destructive/25 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Delete ${row.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              }}
              actions={(row) => (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(row)}
                    className="table-action-button"
                    title="View details"
                    aria-label={`View ${row.name}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(row)}
                    className="table-action-button"
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

      {importModalOpen && (
        <Suspense fallback={null}>
          <ImportFormulaPdfModal
            open={importModalOpen}
            onOpenChange={setImportModalOpen}
            onSuccess={handleImportSuccess}
          />
        </Suspense>
      )}

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

