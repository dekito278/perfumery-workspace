import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpenText, CalendarDays, FileText, Search, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import MobileFilterChips from '@/components/mobile-ui/MobileFilterChips.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import MobileSearchBar from '@/components/mobile-ui/MobileSearchBar.jsx';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';
import JournalCoverFrame from '@/components/journal/JournalCoverFrame.jsx';
import {
  JOURNAL_CATEGORIES,
  JOURNAL_POSTS_CHANGED_EVENT,
  getJournalCategoryBadgeClassName,
  getJournalCategoryLabel,
  getJournalPublicPath,
  getPublishedJournalPosts,
} from '@/services/journalPostsSupabaseService.js';
import { getMobileFromState } from '@/hooks/useMobileBackNavigation.js';

const formatDate = (value) => {
  if (!value) return 'Belum ada tanggal';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
};

const stripMarkdown = (value) => String(value || '')
  .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[`*_>#-]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const getPreviewText = (post) => stripMarkdown(post.excerpt || post.content || 'Artikel Solivagant.');

const getReadingMinutes = (post) => {
  const wordCount = stripMarkdown(post.content).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 180));
};

const sortByPublished = (posts) => [...posts].sort((left, right) => (
  new Date(right.published_at || right.updated || right.created || 0).getTime()
  - new Date(left.published_at || left.updated || left.created || 0).getTime()
));

export const MobileArticlesContent = ({ active = true }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await getPublishedJournalPosts();
      setPosts(rows);
    } catch (err) {
      setError(err.message || 'Artikel belum bisa dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    window.addEventListener(JOURNAL_POSTS_CHANGED_EVENT, loadArticles);

    return () => {
      window.removeEventListener(JOURNAL_POSTS_CHANGED_EVENT, loadArticles);
    };
  }, [loadArticles]);

  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'Semua' },
    ...JOURNAL_CATEGORIES,
  ], []);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const byCategory = category === 'all'
      ? posts
      : posts.filter((post) => post.category === category);

    return sortByPublished(byCategory.filter((post) => {
      if (!normalizedQuery) return true;

      return [
        post.title,
        post.excerpt,
        post.content,
        getJournalCategoryLabel(post.category),
        (post.tags || []).join(' '),
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery));
    }));
  }, [category, posts, query]);

  const featuredPost = filteredPosts[0];
  const listPosts = featuredPost ? filteredPosts.slice(1) : [];

  const openArticle = (post) => {
    const path = getJournalPublicPath(post, { mobile: true });
    if (!path) return;
    navigate(path, { state: getMobileFromState(location) });
  };

  return (
    <>
      {active ? (
        <Helmet>
          <title>Artikel Solivagant</title>
          <meta name="description" content="Baca artikel Solivagant tentang parfum, bahan, proses, dan cerita di balik aroma." />
        </Helmet>
      ) : null}

      <main className="mobile-page mobile-articles-page">
        <section className="mobile-soft-card overflow-hidden">
          <div className="p-4">
            <div className="inline-flex min-h-[28px] items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-[10px] font-bold uppercase text-[#263d27] shadow-sm">
              <BookOpenText className="h-3.5 w-3.5" />
              Journal
            </div>
            <h1 className="mt-3 text-[24px] font-black leading-tight text-[#0b130c]">
              Artikel parfum Solivagant.
            </h1>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-[#526351]">
              Cerita aroma, material, proses studio, dan panduan kecil sebelum memilih parfum.
            </p>
          </div>
        </section>

        <section className="mobile-sticky-search mobile-commerce-search">
          <div className="mobile-card p-2">
            <MobileSearchBar
              value={query}
              onChange={setQuery}
              placeholder="Cari artikel..."
              disabled={loading}
            />
            <div className="mt-2">
              <MobileFilterChips options={categoryOptions} value={category} onChange={setCategory} />
            </div>
          </div>
        </section>

        {loading ? (
          <MobileLoadingSkeleton title="Memuat artikel" subtitle="Sebentar, artikel sedang disiapkan." />
        ) : error ? (
          <MobileStatePanel
            tone="error"
            title="Artikel belum bisa dimuat"
            description={error}
            action="Coba lagi"
            onAction={loadArticles}
          />
        ) : filteredPosts.length ? (
          <section className="space-y-3">
            {featuredPost ? (
              <article className="mobile-card overflow-hidden p-0">
                <button type="button" onClick={() => openArticle(featuredPost)} className="block w-full text-left">
                  <JournalCoverFrame
                    post={featuredPost}
                    className="rounded-none border-0"
                    imageClassName="aspect-[16/10]"
                    eager
                  />
                  <div className="p-4">
                    <Badge variant="outline" className={`rounded-full text-[10px] ${getJournalCategoryBadgeClassName(featuredPost.category)}`}>
                      {getJournalCategoryLabel(featuredPost.category)}
                    </Badge>
                    <h2 className="mt-3 text-xl font-black leading-tight text-[#0b130c]">
                      {featuredPost.title || 'Artikel Solivagant'}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm font-semibold leading-relaxed text-[#6b7280]">
                      {getPreviewText(featuredPost)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#8b949e]">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(featuredPost.published_at || featuredPost.updated || featuredPost.created)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Timer className="h-3.5 w-3.5" />
                        {getReadingMinutes(featuredPost)} menit
                      </span>
                    </div>
                    <span className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#263d27] px-4 text-xs font-bold text-white">
                      Baca artikel
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </button>
              </article>
            ) : null}

            {listPosts.map((post) => (
              <article key={post.id} className="mobile-card mobile-list-card p-3">
                <button type="button" onClick={() => openArticle(post)} className="grid w-full grid-cols-[86px_1fr] gap-3 text-left">
                  <JournalCoverFrame
                    post={post}
                    className="h-[86px] rounded-xl border-[#e5e7eb]"
                    imageClassName="h-full"
                    compact
                  />
                  <div className="min-w-0">
                    <Badge variant="outline" className={`rounded-full text-[10px] ${getJournalCategoryBadgeClassName(post.category)}`}>
                      {getJournalCategoryLabel(post.category)}
                    </Badge>
                    <h3 className="mt-2 line-clamp-2 text-base font-black leading-tight text-[#0b130c]">
                      {post.title || 'Artikel Solivagant'}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-[#6b7280]">
                      {getPreviewText(post)}
                    </p>
                    <div className="mt-2 text-[11px] font-bold text-[#8b949e]">
                      {formatDate(post.published_at || post.updated || post.created)} · {getReadingMinutes(post)} menit
                    </div>
                  </div>
                </button>
              </article>
            ))}
          </section>
        ) : (
          <MobileEmptyState
            icon={query || category !== 'all' ? Search : FileText}
            title={posts.length ? 'Artikel tidak ditemukan' : 'Artikel belum tersedia'}
            description={posts.length ? 'Coba kata kunci atau kategori lain.' : 'Artikel yang statusnya Published di Studio Journal akan muncul di sini. Draft tetap tersimpan di Studio dan belum tampil untuk pembeli.'}
            action={posts.length ? 'Reset pencarian' : 'Belanja parfum'}
            onAction={() => {
              if (posts.length) {
                setQuery('');
                setCategory('all');
                return;
              }
              navigate('/mobile/catalog');
            }}
          />
        )}
      </main>
    </>
  );
};

const MobileArticlesPage = () => (
  <MobileCommerceLayout>
    <MobileArticlesContent />
  </MobileCommerceLayout>
);

export default MobileArticlesPage;
