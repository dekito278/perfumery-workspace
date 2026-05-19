import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { BookOpenText, CalendarDays, Home, Plus, RefreshCw, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import FilterBar from '@/components/FilterBar.jsx';
import DataTable from '@/components/DataTable.jsx';
import ListPagination from '@/components/ListPagination.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import NoResultsState from '@/components/NoResultsState.jsx';
import { useJournalPosts } from '@/hooks/useJournalPosts.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import {
  JOURNAL_CATEGORIES,
  JOURNAL_STATUSES,
  getJournalCategoryLabel,
} from '@/services/journalPostsSupabaseService.js';
import { formatDate, formatStatus } from '@/utils/formatting.js';

const pageSize = 8;

const categoryBadgeClassNames = {
  formula_accord: 'border-amber-200 bg-amber-50 text-amber-800',
  experience: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  material_note: 'border-sky-200 bg-sky-50 text-sky-800',
  process: 'border-violet-200 bg-violet-50 text-violet-800',
  product_idea: 'border-rose-200 bg-rose-50 text-rose-800',
};

const getStatusVariant = (status) => {
  if (status === 'published') return 'default';
  return 'secondary';
};

const getPreviewText = (post) => {
  const source = post.excerpt || post.content || '';
  return String(source).replace(/\s+/g, ' ').trim();
};

const getReadingMinutes = (post) => {
  const wordCount = String(post.content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 180));
};

const JournalPage = () => {
  const navigate = useNavigate();
  const { getJournalPosts } = useJournalPosts();
  const { getFormulas } = useFormulas();
  const [posts, setPosts] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const loadJournalPosts = async () => {
    setLoading(true);
    try {
      const [postRows, formulaRows] = await Promise.all([
        getJournalPosts(),
        getFormulas(),
      ]);
      setPosts(postRows);
      setFormulas(formulaRows);
    } catch (error) {
      toast.error('Failed to load journal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJournalPosts();
  }, []);

  const summary = useMemo(() => ({
    total: posts.length,
    drafts: posts.filter((post) => post.status === 'draft').length,
    published: posts.filter((post) => post.status === 'published').length,
  }), [posts]);

  const formulasById = useMemo(
    () => new Map(formulas.map((formula) => [formula.id, formula])),
    [formulas]
  );

  const filteredPosts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return posts.filter((post) => {
      const tags = Array.isArray(post.tags) ? post.tags.join(' ') : '';
      const relatedFormula = post.related_formula_id ? formulasById.get(post.related_formula_id) : null;
      const matchesSearch = !normalizedSearch || [
        post.title,
        post.excerpt,
        post.content,
        tags,
        relatedFormula?.name,
        getJournalCategoryLabel(post.category),
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch));

      const matchesCategory = categoryFilter === 'all' || post.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || post.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    }).sort((left, right) =>
      new Date(right.updated || right.created || 0).getTime() - new Date(left.updated || left.created || 0).getTime()
    );
  }, [categoryFilter, formulasById, posts, searchTerm, statusFilter]);

  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredPosts.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredPosts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, searchTerm, statusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredPosts.length]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (post) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/journal/${post.id}`)}
            className="text-left text-sm font-semibold text-[#111827] transition hover:text-primary"
          >
            {post.title}
          </button>
          {getPreviewText(post) ? (
            <div className="mt-1 line-clamp-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{getPreviewText(post)}</div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(post.updated || post.created)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />
              {getReadingMinutes(post)} min read
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (post) => (
        <Badge variant="outline" className={`rounded-full text-xs ${categoryBadgeClassNames[post.category] || ''}`}>
          {getJournalCategoryLabel(post.category)}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (post) => (
        <Badge variant={getStatusVariant(post.status)} className="text-xs">
          {formatStatus(post.status || 'draft')}
        </Badge>
      ),
    },
    {
      key: 'related_formula',
      label: 'Formula',
      render: (post) => {
        const formula = post.related_formula_id ? formulasById.get(post.related_formula_id) : null;
        return formula ? (
          <button
            type="button"
            onClick={() => navigate(`/formulas/${formula.id}`)}
            className="text-left text-sm font-semibold text-primary hover:underline"
          >
            {formula.name}
          </button>
        ) : (
          <span className="text-sm text-muted-foreground">No link</span>
        );
      },
    },
    {
      key: 'tags',
      label: 'Tags',
      render: (post) => {
        const tags = Array.isArray(post.tags) ? post.tags.filter(Boolean).slice(0, 3) : [];
        return tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No tags</span>
        );
      },
    },
    {
      key: 'updated',
      label: 'Updated',
      render: (post) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(post.updated || post.created)}
        </span>
      ),
    },
  ];

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Journal - Solivagant</title>
        <meta name="description" content="Collect perfumery notes, accord stories, process notes, and product ideas in one writing library." />
      </Helmet>

      <div className="page-container">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/studio')} className="mb-4 h-9 gap-2">
            <Home className="h-4 w-4" />
            Back to dashboard
          </Button>
        </div>

        <PageHeader
          eyebrow="Writing library"
          title="Journal"
          description="Simpan tulisan tentang pengalaman meracik, catatan accord, material note, eksperimen, dan ide produk dalam satu rak kerja."
          action="New Journal"
          actionIcon={Plus}
          onAction={() => navigate('/journal/new')}
        />

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[24px] border bg-white/85 p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Total notes</div>
            <div className="mt-2 text-2xl font-bold">{summary.total}</div>
          </div>
          <div className="rounded-[24px] border bg-white/85 p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Drafts</div>
            <div className="mt-2 text-2xl font-bold">{summary.drafts}</div>
          </div>
          <div className="rounded-[24px] border bg-white/85 p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Published</div>
            <div className="mt-2 text-2xl font-bold">{summary.published}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search journal title, notes, tags..."
            disabled={loading}
          />
          <Button
            onClick={loadJournalPosts}
            variant="outline"
            size="icon"
            disabled={loading}
            className="h-11 w-11 rounded-2xl"
            title="Refresh journal"
            aria-label="Refresh journal"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="mt-4">
          <FilterBar
            compact
            disabled={loading}
            onClearAll={handleClearFilters}
            onFilterChange={(filterId, value) => {
              if (filterId === 'category') {
                setCategoryFilter(value);
                return;
              }

              if (filterId === 'status') {
                setStatusFilter(value);
              }
            }}
            filters={[
              {
                id: 'category',
                placeholder: 'Category',
                value: categoryFilter,
                options: [
                  { value: 'all', label: 'All categories' },
                  ...JOURNAL_CATEGORIES,
                ],
              },
              {
                id: 'status',
                placeholder: 'Status',
                value: statusFilter,
                options: [
                  { value: 'all', label: 'All statuses' },
                  ...JOURNAL_STATUSES,
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
          ) : posts.length === 0 ? (
            <EmptyState
              icon={BookOpenText}
              title="Your writing shelf is still empty"
              description="Mulai dari satu catatan kecil: accord yang sedang diuji, pengalaman meracik, material yang menarik, atau ide produk yang belum sempat dikerjakan."
              action="New Journal"
              actionIcon={Plus}
              onAction={() => navigate('/journal/new')}
            />
          ) : filteredPosts.length === 0 ? (
            <NoResultsState searchTerm={searchTerm} onClearFilters={handleClearFilters} />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={paginatedPosts}
                onEdit={(post) => navigate(`/journal/${post.id}/edit`)}
                mobileCard={(post) => (
                  <div className="rounded-[22px] border border-white/80 bg-white/95 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/journal/${post.id}`)}
                          className="text-left text-base font-bold leading-snug text-[#111827]"
                        >
                          {post.title}
                        </button>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline" className={`rounded-full text-[10px] ${categoryBadgeClassNames[post.category] || ''}`}>
                            {getJournalCategoryLabel(post.category)}
                          </Badge>
                          <Badge variant={getStatusVariant(post.status)} className="text-[10px]">
                            {formatStatus(post.status || 'draft')}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl"
                        onClick={() => navigate(`/journal/${post.id}/edit`)}
                      >
                        Edit
                      </Button>
                    </div>
                    {getPreviewText(post) ? (
                      <div className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{getPreviewText(post)}</div>
                    ) : null}
                    {post.related_formula_id && formulasById.get(post.related_formula_id) ? (
                      <div className="mt-3 text-xs font-semibold text-primary">
                        Formula: {formulasById.get(post.related_formula_id).name}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
                      <span>Updated {formatDate(post.updated || post.created)}</span>
                      <span>{getReadingMinutes(post)} min read</span>
                    </div>
                  </div>
                )}
              />

              <ListPagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={filteredPosts.length}
                itemLabel="journal notes"
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default JournalPage;
