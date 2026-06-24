import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import {
  getJournalCategoryLabel,
  getJournalPublicPath,
  getPublishedJournalPosts,
  JOURNAL_POSTS_CHANGED_EVENT,
} from '@/services/journalPostsSupabaseService.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { formatDate } from '@/utils/formatting.js';

const getExcerpt = (article) => article.excerpt || String(article.content || '')
  .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[`*_>#-]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 180);

const CATEGORIES = ['All', 'Scent Memory', 'Raw Material', 'Atelier Process', 'Product Story', 'Culture'];

const PublicJournalPage = () => {
  const revealRef = useScrollReveal();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [visibleCount, setVisibleCount] = useState(9);

  useEffect(() => {
    let active = true;

    const loadArticles = async () => {
      setLoading(true);
      setError('');
      try {
        const posts = await getPublishedJournalPosts();
        if (active) setArticles(posts);
      } catch (err) {
        if (active) setError(err.message || 'Gagal memuat journal.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadArticles();
    window.addEventListener(JOURNAL_POSTS_CHANGED_EVENT, loadArticles);

    return () => {
      active = false;
      window.removeEventListener(JOURNAL_POSTS_CHANGED_EVENT, loadArticles);
    };
  }, []);

  const filtered = useMemo(() => {
    if (activeCategory === 'All') return articles;
    return articles.filter((a) => getJournalCategoryLabel(a.category) === activeCategory);
  }, [articles, activeCategory]);

  const featured = filtered[0];
  const remaining = useMemo(() => filtered.slice(1, visibleCount), [filtered, visibleCount]);

  return (
    <>
      <Helmet>
        <title>Journal - SOLIVAGANT</title>
        <meta name="description" content="Editorial notes from the SOLIVAGANT perfume atelier." />
        <meta property="og:title" content="Journal - SOLIVAGANT" />
        <meta property="og:description" content="Editorial notes on scent memory, raw materials, atelier process, product stories, and perfumery culture." />
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <PublicHeader />

        <section className="journal-hero">
          <p className="editorial-eyebrow hero-animate-text hero-animate-text--d1">JOURNAL / EDITORIAL</p>
          <h1 className="hero-animate-text hero-animate-text--d2">Field Notes</h1>
          <p className="hero-animate-text hero-animate-text--d3">On scent memory, raw materials, atelier process, and the stories behind SOLIVAGANT perfume objects.</p>
        </section>

        {/* Category filter tabs */}
        <nav className="journal-tabs hero-animate-fade">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`journal-tab${activeCategory === cat ? ' is-active' : ''}`}
              onClick={() => { setActiveCategory(cat); setVisibleCount(9); }}
            >
              {cat}
            </button>
          ))}
        </nav>

        <section className="journal-content">
          {loading ? (
            <div className="editorial-empty-state">
              <p className="editorial-eyebrow">LOADING</p>
              <h2>Memuat journal...</h2>
            </div>
          ) : error ? (
            <div className="editorial-empty-state">
              <p className="editorial-eyebrow">ERROR</p>
              <h2>{error}</h2>
            </div>
          ) : !filtered.length ? (
            <div className="editorial-empty-state">
              <p className="editorial-eyebrow">NO POSTS</p>
              <h2>Belum ada artikel{activeCategory !== 'All' ? ` di kategori ${activeCategory}` : ''}.</h2>
            </div>
          ) : (
            <>
              {/* Featured article — large */}
              {featured ? (
                <Link to={getJournalPublicPath(featured)} className="journal-featured card-lift" data-reveal>
                  <div className="journal-featured__body">
                    <span className="journal-featured__category">{getJournalCategoryLabel(featured.category)}</span>
                    <h2>{featured.title}</h2>
                    <p>{getExcerpt(featured)}</p>
                    <div className="journal-featured__meta">
                      <time>{formatDate(featured.published_at || featured.updated || featured.created)}</time>
                      <span className="journal-featured__read">Read article <ArrowRight className="h-4 w-4" /></span>
                    </div>
                  </div>
                </Link>
              ) : null}

              {/* Grid of remaining articles */}
              {remaining.length ? (
                <div className="journal-grid" data-reveal data-stagger-children>
                  {remaining.map((article) => (
                    <Link key={article.id} to={getJournalPublicPath(article)} className="journal-card card-lift">
                      <span className="journal-card__category">{getJournalCategoryLabel(article.category)}</span>
                      <h3>{article.title}</h3>
                      <p>{getExcerpt(article)}</p>
                      <time>{formatDate(article.published_at || article.updated || article.created)}</time>
                    </Link>
                  ))}
                </div>
              ) : null}

              {visibleCount < filtered.length ? (
                <div className="journal-load-more">
                  <button type="button" onClick={() => setVisibleCount((c) => c + 9)}>
                    Load more articles
                  </button>
                  <span>{Math.min(visibleCount, filtered.length)} of {filtered.length}</span>
                </div>
              ) : null}
            </>
          )}
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default PublicJournalPage;
