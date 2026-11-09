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
import { FORMULA_CATEGORIES, FORMULA_STATUSES } from '@/utils/constants.js';

const ImportFormulaPdfModal = lazy(() => import('@/components/ImportFormulaPdfModal.jsx'));
// Stored values ('ready_for_batch', 'perfume') are not words; the list prints their labels.
const statusLabel = (value) => FORMULA_STATUSES.find((option) => option.value === value)?.label || value;
const categoryLabel = (value) => FORMULA_CATEGORIES.find((option) => option.value === value)?.label || value;

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
        // Per-formula metrics are decoration; one failed items query used to reject the whole Promise.all
        // and drop the entire formula list into the error state (audit round 8).
        Promise.all(
          data.map(async (formula) => {
            try {
              const items = await getFormulaItems(formula.id);
              return [
                formula.id,
                {
                  itemCount: items.length,
                  totalGrams: calculateTotalAmount(items),
                },
              ];
            } catch (metricError) {
              console.warn(`Formula metrics unavailable for ${formula.code || formula.id}:`, metricError.message || metricError);
              return [formula.id, { itemCount: null, totalGrams: null }];
            }
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
      setLoadError(error.message || 'Data formula belum bisa dimuat. Periksa koneksi lalu coba lagi.');
      toast.error('Gagal memuat formula');
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
      toast.success('Formula diduplikasi');
      loadFormulas();
    } catch (error) {
      toast.error('Gagal menduplikasi formula');
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
      label: 'Nama',
      render: (row) => <span className="font-medium text-sm">{row.name}</span>,
    },
    {
      key: 'code',
      label: 'Kode',
      render: (row) => <span className="font-mono text-xs">{row.code}</span>,
    },
    {
      key: 'category',
      label: 'Kategori',
      render: (row) => (
        <Badge variant="outline" className="text-xs">
          {formatNullable(categoryLabel(row.category), 'Tanpa kategori')}
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
          <Badge variant={statusColors[row.status] || 'secondary'} className="text-xs">
            {statusLabel(row.status || 'draft')}
          </Badge>
        );
      },
    },
    {
      key: 'total',
      label: 'Jumlah total',
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
      label: 'Validasi',
      render: (row) => {
        const pipeline = pipelineByFormulaId[row.id] || {
          validationCount: 0,
          actionNeededCount: 0,
        };

        return (
          <div className="flex min-w-[250px] flex-wrap gap-1.5">
            <Badge variant={pipeline.validationCount ? 'secondary' : 'outline'} className="text-[10px]">
              Catatan uji {pipeline.validationCount}
            </Badge>
            {pipeline.actionNeededCount ? (
              <Badge variant="destructive" className="text-[10px]">
                Perlu tindakan {pipeline.actionNeededCount}
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
      placeholder: 'Semua status',
      options: [
        { value: 'all', label: 'Semua status' },
        { value: 'draft', label: statusLabel('draft') },
        { value: 'active', label: statusLabel('active') },
        { value: 'archived', label: statusLabel('archived') },
      ],
    },
    {
      id: 'category',
      value: categoryFilter,
      placeholder: 'Semua kategori',
      options: [
        { value: 'all', label: 'Semua kategori' },
        ...formulaCategories.map((category) => ({ value: category, label: categoryLabel(category) })),
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
        <title>Formula - Solivagant</title>
        <meta name="description" content="Kelola komposisi formula, impor workbook, dan formula parfum yang siap direvisi." />
      </Helmet>

      <div className="page-container">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/studio')}
            className="gap-2 mb-4 h-9"
          >
            <Home className="w-4 h-4" />
            Kembali ke dasbor
          </Button>
        </div>

        <PageHeader
          title="Formula"
          description="Buat formula mandiri langsung dari pustaka bahan."
          action="Formula baru"
          actionIcon={Beaker}
          onAction={() => navigate('/formulas/new')}
        />

        <div className="mb-6 flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl bg-white/80" onClick={() => setImportModalOpen(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            Impor PDF
          </Button>
        </div>

        <div className="list-toolbar-panel mb-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Cari formula
              </div>
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Cari nama, kode, status, atau kategori..."
                disabled={loading}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={loadFormulas} variant="outline" size="icon" aria-label="Muat ulang" disabled={loading} className="h-11 w-11 rounded-2xl">
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
              Menampilkan {paginatedFormulas.length} dari {filteredFormulas.length} formula
              {hasActiveFilters ? ' dengan saringan aktif' : ''}
            </div>
          )}
        </div>

        {loadError && formulas.length > 0 ? (
          <div className="mb-5">
            <StateBlock
              tone="error"
              title="Data formula mungkin sudah usang"
              description={loadError}
              action={loading ? '' : 'Coba lagi'}
              onAction={loading ? null : loadFormulas}
              className="bg-rose-50/80 p-5"
            />
          </div>
        ) : null}

        {loading ? (
          <StudioLoadingState
            eyebrow="Memuat formula"
            title="Menyiapkan daftar formula"
            description="Mengambil formula, ringkasan komposisi, dan catatan uji."
          />
        ) : loadError && formulas.length === 0 ? (
          <StateBlock
            tone="error"
            title="Formula gagal dimuat"
            description={loadError}
            action="Coba lagi"
            onAction={loadFormulas}
          />
        ) : formulas.length === 0 ? (
          <EmptyState
            icon={Beaker}
            title="Belum ada formula"
            description="Buat formula pertama atau impor PDF workbook untuk mulai menyusun komposisi."
            action="Formula baru"
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
                      <Badge variant="outline" className="text-xs">
                        {statusLabel(row.status || 'draft')}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Kategori</div>
                        <div className="mt-1">{formatNullable(categoryLabel(row.category), 'Tanpa kategori')}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Jumlah total</div>
                        <div className="mt-1 font-mono">{metrics ? formatGramAmount(metrics.totalGrams) : '-'}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      <Badge variant={pipeline.validationCount ? 'secondary' : 'outline'} className="text-[10px]">
                        Catatan uji {pipeline.validationCount || 0}
                      </Badge>
                      {pipeline.actionNeededCount ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Perlu tindakan {pipeline.actionNeededCount}
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
                        aria-label={`Lihat ${row.name}`}
                      >
                        <Eye className="h-4 w-4" />
                        Lihat
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicate(row)}
                        className="h-10 rounded-xl gap-2 text-xs"
                        disabled={duplicatingId === row.id}
                        aria-label={`Duplikasi ${row.name}`}
                      >
                        <Copy className={`h-4 w-4 ${duplicatingId === row.id ? 'animate-spin' : ''}`} />
                        Duplikasi
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
                        aria-label={`Hapus ${row.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Hapus
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
                    title="Lihat detail"
                    aria-label={`Lihat ${row.name}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(row)}
                    className="table-action-button"
                    title="Duplikasi formula"
                    aria-label={`Duplikasi ${row.name}`}
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
              itemLabel="formula"
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

