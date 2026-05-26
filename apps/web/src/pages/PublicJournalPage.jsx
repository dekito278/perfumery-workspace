import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { BookOpenText, CalendarDays } from 'lucide-react';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import {
  getJournalCategoryLabel,
  getJournalPublicPath,
  getPublishedJournalPosts,
  JOURNAL_POSTS_CHANGED_EVENT,
} from '@/services/journalPostsSupabaseService.js';
import { formatDate } from '@/utils/formatting.js';

const getExcerpt = (article) => article.excerpt || String(article.content || '')
  .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[`*_>#-]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 180);

const PublicJournalPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <>
      <Helmet>
        <title>Journal - SOLIVAGANT</title>
        <meta name="description" content="Editorial notes from the SOLIVAGANT perfume atelier." />
        <meta property="og:title" content="Journal - SOLIVAGANT" />
        <meta property="og:description" content="Editorial notes on scent memory, raw materials, atelier process, product stories, and perfumery culture." />
      </Helmet>

      <main className="solivagant-editorial-home">
        <PublicHeader />

        <section className="editorial-page-hero">
          <p className="editorial-eyebrow">JOURNAL / EDITORIAL</p>
          <h1>Journal</h1>
          <p>Field notes on scent memory, raw materials, atelier process, and the stories behind SOLIVAGANT perfume objects.</p>
        </section>

        <section className="editorial-section editorial-journal editorial-section--compact">
          {loading ? (
            <div className="editorial-empty-state">
              <p className="editorial-eyebrow">LOADING</p>
              <h2>Memuat journal yang sudah published.</h2>
            </div>
          ) : null}
          {error ? (
            <div className="editorial-empty-state">
              <p className="editorial-eyebrow">JOURNAL ERROR</p>
              <h2>{error}</h2>
            </div>
          ) : null}
          {!loading && !error && !articles.length ? (
            <div className="editorial-empty-state">
              <p className="editorial-eyebrow">NO PUBLISHED POSTS</p>
              <h2>Belum ada artikel published.</h2>
              <p>Artikel yang tampil di sini hanya yang sudah dipublish dari studio journal.</p>
            </div>
          ) : null}
          <div className="editorial-journal-grid editorial-journal-grid--wide">
            {articles.map((article) => (
              <article key={article.id}>
                <span>{getJournalCategoryLabel(article.category)}</span>
                <h3>{article.title}</h3>
                <p className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(article.published_at || article.updated || article.created)}
                </p>
                <p>{getExcerpt(article) || 'Artikel ini belum memiliki excerpt.'}</p>
                <Link to={getJournalPublicPath(article)} className="editorial-journal-link">
                  Read More <BookOpenText className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <footer className="editorial-footer">
          <span>SOLIVAGANT by Dekito</span>
          <Link to="/materials">Explore Materials</Link>
        </footer>
      </main>
    </>
  );
};

export default PublicJournalPage;
