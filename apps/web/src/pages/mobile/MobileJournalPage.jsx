import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { BookOpenText, CalendarDays, FileText, Plus, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSearchBar from '@/components/mobile-ui/MobileSearchBar.jsx';
import MobileFilterChips from '@/components/mobile-ui/MobileFilterChips.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
import { useJournalPosts } from '@/hooks/useJournalPosts.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import {
  JOURNAL_CATEGORIES,
  JOURNAL_STATUSES,
  getJournalCategoryLabel,
} from '@/services/journalPostsSupabaseService.js';
import { filterByText, getVisibleItems, MOBILE_PAGE_SIZE, sortByUpdated } from '@/pages/mobile/mobilePageUtils.js';

const formatDate = (value) => {
  if (!value) {
    return 'No date';
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
};

const categoryBadgeClassNames = {
  formula_accord: 'border-amber-200 bg-amber-50 text-amber-800',
  experience: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  material_note: 'border-sky-200 bg-sky-50 text-sky-800',
  process: 'border-violet-200 bg-violet-50 text-violet-800',
  product_idea: 'border-rose-200 bg-rose-50 text-rose-800',
};

const getPreviewText = (post) => String(post.excerpt || post.content || 'No preview yet.')
  .replace(/\s+/g, ' ')
  .trim();

const getReadingMinutes = (post) => {
  const wordCount = String(post.content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 180));
};

const MobileJournalPage = () => {
  const navigate = useNavigate();
  const { getJournalPosts, loading, error } = useJournalPosts();
  const { getFormulas } = useFormulas();
  const [posts, setPosts] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE);

  useEffect(() => {
    let active = true;

    const loadJournal = async () => {
      try {
        const [postRows, formulaRows] = await Promise.all([
          getJournalPosts(),
          getFormulas(),
        ]);

        if (!active) {
          return;
        }

        setPosts(postRows);
        setFormulas(formulaRows);
      } catch (err) {
        toast.error('Failed to load journal');
      }
    };

    loadJournal();

    return () => {
      active = false;
    };
  }, [getFormulas, getJournalPosts]);

  useEffect(() => {
    setVisibleCount(MOBILE_PAGE_SIZE);
  }, [query, category, status]);

  const formulaById = useMemo(
    () => new Map(formulas.map((formula) => [formula.id, formula])),
    [formulas]
  );

  const filteredPosts = useMemo(() => {
    const byCategory = category === 'all'
      ? posts
      : posts.filter((post) => post.category === category);
    const byStatus = status === 'all'
      ? byCategory
      : byCategory.filter((post) => post.status === status);

    return sortByUpdated(filterByText(byStatus, query, [
      'title',
      'excerpt',
      'content',
      (post) => getJournalCategoryLabel(post.category),
      (post) => (post.tags || []).join(' '),
      (post) => formulaById.get(post.related_formula_id)?.name,
    ]));
  }, [category, formulaById, posts, query, status]);

  const visiblePosts = getVisibleItems(filteredPosts, visibleCount);

  const categoryOptions = [
    { value: 'all', label: 'All' },
    ...JOURNAL_CATEGORIES,
  ];

  const statusOptions = [
    { value: 'all', label: 'All status' },
    ...JOURNAL_STATUSES,
  ];

  return (
    <MobileAuthenticatedLayout>
      <Helmet>
        <title>Journal Mobile - Solivagant</title>
        <meta name="description" content="Mobile perfumery journal for notes, accord ideas, and product thoughts." />
      </Helmet>

      <MobileTopBar
        title="Journal"
        subtitle={`${posts.length} notes`}
        eyebrow="Studio"
        action={(
          <Button
            type="button"
            onClick={() => navigate('/mobile/journal/new')}
            className="mobile-interactive mobile-pressable h-10 gap-1 rounded-2xl px-3 text-xs font-bold"
            aria-label="New journal note"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        )}
      />

      <div className="space-y-3 pb-6">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-3">
            <div className="text-[10px] font-bold uppercase text-[#9ca3af]">Total</div>
            <div className="mt-1 text-lg font-bold text-[#111827]">{posts.length}</div>
          </div>
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-3">
            <div className="text-[10px] font-bold uppercase text-[#9ca3af]">Draft</div>
            <div className="mt-1 text-lg font-bold text-[#111827]">{posts.filter((post) => post.status === 'draft').length}</div>
          </div>
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-3">
            <div className="text-[10px] font-bold uppercase text-[#9ca3af]">Published</div>
            <div className="mt-1 text-lg font-bold text-[#111827]">{posts.filter((post) => post.status === 'published').length}</div>
          </div>
        </div>

        <MobileSearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search notes, accord, material..."
          disabled={loading}
        />

        <MobileFilterChips options={categoryOptions} value={category} onChange={setCategory} />
        <MobileFilterChips options={statusOptions} value={status} onChange={setStatus} />

        {loading && !posts.length ? (
          <MobileLoadingSkeleton title="Loading journal" subtitle="Preparing your notes." />
        ) : error ? (
          <MobileStatePanel
            tone="error"
            title="Journal unavailable"
            description={error}
            action="Try again"
            onAction={() => window.location.reload()}
          />
        ) : visiblePosts.length ? (
          <div className="space-y-3">
            {visiblePosts.map((post) => {
              const formula = formulaById.get(post.related_formula_id);
              const preview = getPreviewText(post);
              return (
                <article
                  key={post.id}
                  className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/mobile/journal/${post.id}`)}
                    className="block w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`rounded-full text-[10px] ${categoryBadgeClassNames[post.category] || ''}`}>
                        {getJournalCategoryLabel(post.category)}
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-[10px] capitalize">
                        {post.status}
                      </Badge>
                    </div>
                    <h2 className="mt-3 line-clamp-2 text-base font-bold leading-snug text-[#111827]">
                      {post.title || 'Untitled note'}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-[#6b7280]">
                      {preview}
                    </p>
                  </button>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#8b949e]">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(post.updated || post.created)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Timer className="h-3.5 w-3.5" />
                      {getReadingMinutes(post)} min
                    </span>
                    {formula ? <span>{formula.name}</span> : null}
                  </div>

                  {post.tags?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {post.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full bg-[#f3f4f6] px-2 py-1 text-[10px] font-bold text-[#6b7280]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}

            <PaginationOrLoadMore
              visibleCount={visiblePosts.length}
              totalCount={filteredPosts.length}
              onLoadMore={() => setVisibleCount((current) => current + MOBILE_PAGE_SIZE)}
            />
          </div>
        ) : (
          <MobileEmptyState
            icon={query || category !== 'all' || status !== 'all' ? FileText : BookOpenText}
            title={posts.length ? 'No notes found' : 'Start your journal'}
            description={posts.length ? 'Try another keyword, category, or status.' : 'Mulai dari satu catatan kecil: accord, material, proses, pengalaman, atau ide produk dari HP.'}
            action="New Journal"
            onAction={() => navigate('/mobile/journal/new')}
          />
        )}
      </div>
    </MobileAuthenticatedLayout>
  );
};

export default MobileJournalPage;
