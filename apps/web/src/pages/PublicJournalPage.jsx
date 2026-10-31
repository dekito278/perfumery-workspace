import { useTranslate } from '@/hooks/useTranslate.js';
import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { catalogPillCounts, pillIsOffered } from '@/utils/catalogFacets.js';
import {
  JOURNAL_ALL_TAB, JOURNAL_TAB_PARAM, journalCategoryLabelFromUrl, journalTabPath,
} from '@/utils/journalCategoryUrl.js';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import JournalCoverFrame from '@/components/journal/JournalCoverFrame.jsx';
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

const ALL_TABS = [JOURNAL_ALL_TAB, ...JOURNAL_CATEGORIES.map((category) => category.label)];

// Which tab a reader is on lives in the URL, as ?category=<the category's stored value>.
//
// It was useState before, which meant the five material stories had no address. A reader who wanted to
// send someone "the posts about raw materials" could only send /journal and say which tab to press;
// their own back button did nothing; a bookmark always reopened on All. The obvious fix was a second
// page at /kelas-parfum, and that is what I nearly built — a route whose whole content would have been
// the five articles /journal already lists, which is a duplicate URL to keep in step and for search
// engines to choose between. The tab was already the index. It just had no address.
//
// The tabs are Links rather than buttons for the same reason: an index you cannot copy, open in a new
// window or crawl is not an index. journalCategoryUrl.js holds the mapping, so it can be run.

// The same predicate the grid filters with, passed into the counter rather than reimplemented beside
// it — a count derived from a second copy of the rule is a count that can disagree with the list.
const matchesJournalCategory = (article, category) => (
  category === JOURNAL_ALL_TAB || getJournalCategoryLabel(article?.category) === category
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
  const [searchParams] = useSearchParams();
  const activeCategory = journalCategoryLabelFromUrl(searchParams.get(JOURNAL_TAB_PARAM) || '');
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
  const effectiveCategory = categories.includes(activeCategory) ? activeCategory : JOURNAL_ALL_TAB;

  useEffect(() => { setVisibleCount(9); }, [activeCategory]);

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
        <title>{effectiveCategory === 'All' ? t("journal.tab") : `${effectiveCategory} — ${t("journal.tab")}`}</title>
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

        <header className="ng-section !pb-12 !pt-16 md:!pt-24">
          <div className="ng-container flex flex-col gap-8">
            <p className="ng-eyebrow ng-mono m-0">{t("journal.eyebrow")}</p>
            <h1 className="ng-display ng-h1">{t("journal.title")}</h1>
            <p className="ng-lead">{t("journal.lead")}</p>
            {/* Category filter tabs — only the ones with something behind them, each carrying its count */}
            <nav className="flex flex-wrap gap-2.5" aria-label={t('journal.breadcrumb')}>
              {categories.map((cat) => (
                <Link
                  key={cat}
                  to={journalTabPath(cat)}
                  aria-current={effectiveCategory === cat ? 'page' : undefined}
                  className="ng-chip ng-filter"
                >
                  {cat === JOURNAL_ALL_TAB ? t("journal.all") : cat}
                  <span className="ng-chip__count">{tabCounts[cat] ?? 0}</span>
                </Link>
              ))}
            </nav>
            {/* The journal has no English twin: journal_posts has one set of columns, so /en/journal shows
                the Indonesian articles rather than a translation that does not exist. One line, said
                plainly, rather than hiding the writing from them or pretending it is translated. */}
            {isInternational ? (
              <p className="m-0 text-sm text-ng-dust">{t('journal.indonesianOnly')}</p>
            ) : null}
          </div>
        </header>

        <section className="ng-section !pt-12">
          <div className="ng-container">
            {loading ? (
              <div className="flex flex-col" aria-hidden="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-3 border-b border-ng-bone/10 py-8">
                    <span className="editorial-skel block h-3 w-32" />
                    <span className="editorial-skel block h-8 w-2/3" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col gap-4 py-14">
                <p className="ng-mono m-0 text-ng-ash">{t('journal.failedEyebrow')}</p>
                <h2 className="ng-display text-[36px] font-normal">{error}</h2>
              </div>
            ) : !filtered.length ? (
              <div className="flex flex-col gap-4 py-14">
                <p className="ng-mono m-0 text-ng-ash">{t("journal.emptyEyebrow")}</p>
                <h2 className="ng-display text-[36px] font-normal">{effectiveCategory !== 'All' ? t('journal.emptyCategory', { category: effectiveCategory }) : t('journal.emptyAll')}</h2>
              </div>
            ) : (
              <div className="flex flex-col gap-16">
                {/* Featured article — large */}
                {featured ? (
                  <Link to={getJournalPublicPath(featured)} className="grid items-center gap-10 text-ng-bone no-underline md:grid-cols-2 md:gap-[72px]" data-reveal>
                    <JournalCoverFrame post={featured} className="ng-cover border-ng-bone/10" imageClassName="aspect-[5/4]" />
                    <span className="flex flex-col gap-5">
                      <span className="ng-mono text-ng-ember">{getJournalCategoryLabel(featured.category)} · {formatDate(featured.published_at || featured.updated || featured.created, t('fmt.dateLocale'))}</span>
                      <span className="font-ng-display text-[40px] leading-[1.02] md:text-[60px]">{featured.title}</span>
                      <span className="max-w-[520px] text-[17px] leading-relaxed text-ng-dust">{getExcerpt(featured)}</span>
                      <span className="ng-mono inline-flex items-center gap-2">{t('journal.read')} <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
                    </span>
                  </Link>
                ) : null}

                {/* The rest, as a list */}
                {remaining.length ? (
                  <div className="flex flex-col border-t border-ng-bone/30" data-reveal>
                    {remaining.map((article) => (
                      <Link key={article.id} to={getJournalPublicPath(article)} className="ng-journal-row">
                        <span className="ng-mono text-ng-ash">{getJournalCategoryLabel(article.category)}</span>
                        <span className="font-ng-display text-[28px] leading-[1.1] md:text-[32px]">{article.title}</span>
                        <span className="text-[15px] leading-relaxed text-ng-dust">{getExcerpt(article)}</span>
                        <time className="ng-mono text-ng-ash">{formatDate(article.published_at || article.updated || article.created, t('fmt.dateLocale'))}</time>
                      </Link>
                    ))}
                  </div>
                ) : null}

                {visibleCount < filtered.length ? (
                  <div className="flex flex-wrap items-center gap-6">
                    <button type="button" className="ng-btn ng-btn--ghost" onClick={() => setVisibleCount((c) => c + 9)}>
                      {t('journal.showMore')}
                    </button>
                    <span className="ng-mono text-ng-ash">{t('journal.shownOf', { shown: Math.min(visibleCount, filtered.length), total: filtered.length })}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default PublicJournalPage;
