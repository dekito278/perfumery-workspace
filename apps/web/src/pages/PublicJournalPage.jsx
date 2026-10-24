import { useTranslate } from '@/hooks/useTranslate.js';
import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { catalogPillCounts, pillIsOffered } from '@/utils/catalogFacets.js';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import TextReveal from '@/components/storefront/TextReveal.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import {
  getJournalCategoryLabel,
  getJournalPublicPath,
  getPublishedJournalPosts,
  JOURNAL_CATEGORIES,
  JOURNAL_POSTS_CHANGED_EVENT,
} from '@/services/journalPostsSupabaseService.js';
import { getSiteOrigin, toAbsoluteUrl } from '@/utils/seo.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { useStorefrontRegion } from '@/hooks/useStorefrontRegion.js';
import { formatDate } from '@/utils/formatting.js';
import { articleExcerpt } from '@/utils/articleExcerpt.js';
import { publicErrorMessage } from '@/utils/publicErrorMessage.js';

const getExcerpt = (article) => articleExcerpt(article, 180);

const ALL_TABS = ['All', ...JOURNAL_CATEGORIES.map((category) => category.label)];

// The same predicate the grid filters with, passed into the counter rather than reimplemented beside
// it — a count derived from a second copy of the rule is a count that can disagree with the list.
const matchesJournalCategory = (article, category) => (
  category === 'All' || getJournalCategoryLabel(article?.category) === category
);

// The tabs are built from what is PUBLISHED, not from the five categories the editor offers.
//
// Until 2026-10-25 they came straight from JOURNAL_CATEGORIES, so the live journal showed Formula
// Accord, Process and Product Idea with nothing behind any of them: three taps that each ended on an
// empty page. The catalogue stopped doing this in #516; the journal was never in that change's scope,
// and the guard that was written for it reads two catalogue files by name.
//
// Same rule as the catalogue, same helper: count first, offer only what is there, and say the number
// before the tap rather than after it.

const PublicJournalPage = () => {
  const { t } = useTranslate();
  const { isInternational } = useStorefrontRegion();
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
        if (active) setError(publicErrorMessage(err, t("journal.loadFailed")));
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
  }, [t]);

  const tabCounts = useMemo(
    () => catalogPillCounts(articles, ALL_TABS, matchesJournalCategory),
    [articles],
  );
  const categories = useMemo(
    () => ALL_TABS.filter((category) => pillIsOffered(category, tabCounts[category])),
    [tabCounts],
  );
  // A tab can vanish under the reader — an article unpublished while the page is open empties the
  // category they are standing in. Falling back to All beats showing an empty grid under a tab that is
  // no longer on screen.
  const effectiveCategory = categories.includes(activeCategory) ? activeCategory : 'All';

  const filtered = useMemo(
    () => articles.filter((article) => matchesJournalCategory(article, effectiveCategory)),
    [articles, effectiveCategory],
  );

  const featured = filtered[0];
  const remaining = useMemo(() => filtered.slice(1, visibleCount), [filtered, visibleCount]);

  const journalCanonical = toAbsoluteUrl('/journal', getSiteOrigin());

  return (
    <>
      <Helmet>
        <title>{t("journal.tab")}</title>
        <meta name="description" content={t("journal.meta")} />
        <link rel="canonical" href={journalCanonical} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SOLIVAGANT" />
        <meta property="og:url" content={journalCanonical} />
        <meta property="og:title" content={t("journal.tab")} />
        <meta property="og:description" content="Editorial notes on scent memory, raw materials, atelier process, product stories, and perfumery culture." />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <ScrollProgress />
        <PublicHeader />

        <section className="journal-hero">
          <p className="editorial-eyebrow hero-animate-text hero-animate-text--d1">{t("journal.eyebrow")}</p>
          <TextReveal as="h1" text={t("journal.title")} />
          <p className="hero-animate-text hero-animate-text--d3">{t("journal.lead")}</p>
        </section>

        {/* Category filter tabs — only the ones with something behind them, each carrying its count */}
        <nav className="journal-tabs hero-animate-fade">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={effectiveCategory === cat}
              className={`journal-tab${effectiveCategory === cat ? ' is-active' : ''}`}
              onClick={() => { setActiveCategory(cat); setVisibleCount(9); }}
            >
              {cat === 'All' ? t("journal.all") : cat}
              <span className="journal-tab__count">{tabCounts[cat] ?? 0}</span>
            </button>
          ))}
        </nav>

        {/* The journal has no English twin: journal_posts has one set of columns, so /en/journal shows
            the Indonesian articles rather than a translation that does not exist. robots.txt keeps
            crawlers off it for that reason, but the link is in the English shop's own nav, so a reader
            does reach it — and finds Indonesian titles with nothing saying why. One line, said plainly,
            rather than hiding the writing from them or pretending it is translated. */}
        {isInternational ? (
          <p className="journal-language-note">{t('journal.indonesianOnly')}</p>
        ) : null}

        <section className="journal-content">
          {loading ? (
            <div className="journal-grid" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skel-card">
                  <div className="editorial-skel skel-card__img" style={{ aspectRatio: '16 / 10' }} />
                  <div className="editorial-skel skel-line skel-line--sm" />
                  <div className="editorial-skel skel-line skel-line--lg" />
                  <div className="editorial-skel skel-line skel-line--md" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="editorial-empty-state">
              <p className="editorial-eyebrow">{t('journal.failedEyebrow')}</p>
              <h2>{error}</h2>
            </div>
          ) : !filtered.length ? (
            <div className="editorial-empty-state">
              <p className="editorial-eyebrow">{t("journal.emptyEyebrow")}</p>
              <h2>{effectiveCategory !== 'All' ? t('journal.emptyCategory', { category: effectiveCategory }) : t('journal.emptyAll')}</h2>
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
                      <time>{formatDate(featured.published_at || featured.updated || featured.created, t('fmt.dateLocale'))}</time>
                      <span className="journal-featured__read">{t('journal.read')} <ArrowRight className="h-4 w-4" /></span>
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
                      <time>{formatDate(article.published_at || article.updated || article.created, t('fmt.dateLocale'))}</time>
                    </Link>
                  ))}
                </div>
              ) : null}

              {visibleCount < filtered.length ? (
                <div className="journal-load-more">
                  <button type="button" onClick={() => setVisibleCount((c) => c + 9)}>
                    {t('journal.showMore')}
                  </button>
                  <span>{t('journal.shownOf', { shown: Math.min(visibleCount, filtered.length), total: filtered.length })}</span>
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
