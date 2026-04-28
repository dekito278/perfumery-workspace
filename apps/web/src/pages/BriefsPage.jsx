import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, Eye, Home, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import FilterBar from '@/components/FilterBar.jsx';
import DataTable from '@/components/DataTable.jsx';
import ListPagination from '@/components/ListPagination.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import NoResultsState from '@/components/NoResultsState.jsx';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { formatDate, formatNullable } from '@/utils/formatting.js';

const BriefsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryFormulaId = searchParams.get('formulaId') || '';
  const { getBriefs, deleteBrief } = useBriefs();
  const { getFormulas } = useFormulas();
  const [briefs, setBriefs] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [linkFilter, setLinkFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const loadBriefs = async () => {
    setLoading(true);
    try {
      const [briefRows, formulaRows] = await Promise.all([
        getBriefs(),
        getFormulas(),
      ]);
      setBriefs(briefRows);
      setFormulas(formulaRows);
    } catch (error) {
      toast.error('Failed to load briefs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBriefs();
  }, []);

  const formulasById = useMemo(
    () => new Map(formulas.map((formula) => [formula.id, formula])),
    [formulas]
  );

  const filteredBriefs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return briefs.filter((brief) => {
      const linkedFormula = brief.formula_id ? formulasById.get(brief.formula_id) : null;
      const matchesSearch = !normalizedSearch || [
        brief.title,
        brief.status,
        brief.mood_story,
        brief.audience_usage,
        linkedFormula?.name,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch));

      const matchesStatus = statusFilter === 'all' || brief.status === statusFilter;
      const matchesLink = linkFilter === 'all'
        || (linkFilter === 'linked' && Boolean(brief.formula_id))
        || (linkFilter === 'unlinked' && !brief.formula_id);

      return matchesSearch && matchesStatus && matchesLink;
    });
  }, [briefs, formulasById, linkFilter, searchTerm, statusFilter]);

  const paginatedBriefs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredBriefs.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredBriefs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, linkFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredBriefs.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredBriefs.length]);

  const handleDeleteBrief = async (brief) => {
    const confirmed = window.confirm(`Delete brief "${brief.title}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteBrief(brief.id);
      toast.success('Brief deleted');
      await loadBriefs();
    } catch (error) {
      toast.error('Failed to delete brief');
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setLinkFilter('all');
  };

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (row) => (
        <button
          type="button"
          onClick={() => navigate(`/briefs/${row.id}`, {
            state: { from: `${location.pathname}${location.search}` },
          })}
          className="text-left text-sm font-medium text-primary transition hover:underline"
        >
          {row.title}
        </button>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'default' : 'secondary'} className="capitalize text-xs">
          {row.status || 'draft'}
        </Badge>
      ),
    },
    {
      key: 'linked_formula',
      label: 'Linked Formula',
      render: (row) => {
        const linkedFormula = row.formula_id ? formulasById.get(row.formula_id) : null;
        return (
          <span className="text-sm">
            {formatNullable(linkedFormula?.name, 'No linked formula')}
          </span>
        );
      },
    },
    {
      key: 'progress',
      label: 'Progress',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.formula_id ? 'Formula linked' : 'Needs project follow-up'}
        </span>
      ),
    },
    {
      key: 'updated',
      label: 'Updated',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.updated || row.created)}
        </span>
      ),
    },
  ];

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Briefs - Formulation Workspace</title>
        <meta name="description" content="Review, search, and open formulation briefs before moving into project work." />
      </Helmet>

      <div className="page-container">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4 gap-2 h-9">
            <Home className="w-4 h-4" />
            Back to dashboard
          </Button>
        </div>

        <PageHeader
          eyebrow="Brief workspace"
          title="Briefs"
          description="Briefs sekarang jadi workspace list-only. Buat brief baru di halaman terpisah, lalu buka project untuk shortlist dan formula."
          action="Start brief"
          actionIcon={Plus}
          onAction={() => navigate(queryFormulaId ? `/briefs/new?formulaId=${queryFormulaId}` : '/briefs/new')}
        />

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search briefs, formulas, or direction..."
            disabled={loading}
          />
          <Button
            onClick={loadBriefs}
            variant="outline"
            size="icon"
            disabled={loading}
            className="h-11 w-11 rounded-2xl"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="mt-4">
          <FilterBar
            compact
            disabled={loading}
            onClearAll={handleClearFilters}
            onFilterChange={(filterId, value) => {
              if (filterId === 'status') {
                setStatusFilter(value);
                return;
              }

              if (filterId === 'linked_formula') {
                setLinkFilter(value);
              }
            }}
            filters={[
              {
                id: 'status',
                placeholder: 'Status',
                value: statusFilter,
                options: [
                  { value: 'all', label: 'All statuses' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'active', label: 'Active' },
                  { value: 'archived', label: 'Archived' },
                ],
              },
              {
                id: 'linked_formula',
                placeholder: 'Formula link',
                value: linkFilter,
                options: [
                  { value: 'all', label: 'All briefs' },
                  { value: 'linked', label: 'Linked only' },
                  { value: 'unlinked', label: 'Unlinked only' },
                ],
              },
            ]}
          />
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : briefs.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No briefs yet"
              description="Mulai satu brief baru untuk menangkap arah formula sebelum masuk ke project board."
              action="Start brief"
              actionIcon={Plus}
              onAction={() => navigate(queryFormulaId ? `/briefs/new?formulaId=${queryFormulaId}` : '/briefs/new')}
            />
          ) : filteredBriefs.length === 0 ? (
            <NoResultsState searchTerm={searchTerm} onClearFilters={handleClearFilters} />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={paginatedBriefs}
                onEdit={(brief) => navigate(`/briefs/${brief.id}/edit`, {
                  state: { from: `${location.pathname}${location.search}` },
                })}
                onDelete={handleDeleteBrief}
                actions={(brief) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="table-action-button"
                    onClick={() => navigate(`/briefs/${brief.id}`, {
                      state: { from: `${location.pathname}${location.search}` },
                    })}
                    title="Open project"
                    aria-label={`Open project ${brief.title}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
                mobileCard={(brief) => {
                  const linkedFormula = brief.formula_id ? formulasById.get(brief.formula_id) : null;
                  return (
                    <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-primary">{brief.title}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant={brief.status === 'active' ? 'default' : 'secondary'} className="capitalize text-[10px]">
                              {brief.status || 'draft'}
                            </Badge>
                            {linkedFormula ? (
                              <Badge variant="outline" className="text-[10px]">
                                {linkedFormula.name}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => navigate(`/briefs/${brief.id}`, {
                            state: { from: `${location.pathname}${location.search}` },
                          })}
                        >
                          Open
                        </Button>
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground">
                        {brief.formula_id ? 'Formula linked' : 'Needs project follow-up'}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Updated {formatDate(brief.updated || brief.created)}
                      </div>
                    </div>
                  );
                }}
              />

              <ListPagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={filteredBriefs.length}
                itemLabel="briefs"
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default BriefsPage;
