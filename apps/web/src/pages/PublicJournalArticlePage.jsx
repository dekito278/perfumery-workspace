import { useTranslate } from '@/hooks/useTranslate.js';
import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Copy, ExternalLink, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import JournalCoverFrame from '@/components/journal/JournalCoverFrame.jsx';
import JournalMarkdownContent from '@/components/journal/JournalMarkdownContent.jsx';
import JournalRelatedProduct from '@/components/journal/JournalRelatedProduct.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import {
  getJournalCategoryBadgeClassName,
  getJournalCategoryLabel,
  getJournalStatusBadgeClassName,
  getPublishedJournalPostBySlug,
} from '@/services/journalPostsSupabaseService.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { formatDate } from '@/utils/formatting.js';
// The shared helpers fall back to the production site URL; this page had its own copies that fell back to
// window.location.origin, so an article viewed on a Vercel preview or a bare domain published a canonical,
// og:url and JSON-LD @id pointing at that host (audit round 8).
import { DEFAULT_SHARE_IMAGE, getSiteOrigin, stripTrailingBrand, toAbsoluteUrl } from '@/utils/seo.js';
import { stripMarkdown } from '@/utils/articleExcerpt.js';

const getReadingMinutes = (content) => {
  const wordCount = String(content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 180));
};


const DEFAULT_DESCRIPTION = 'Read a Solivagant perfumery journal article.';




const truncateMeta = (value, maxLength = 155) => {
  const normalized = stripMarkdown(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}...`;
};


/* ─── Mobile article view (unchanged Tailwind-based layout) ─── */
const MobileArticleView = ({ post, loading, failed, slug, title, description, canonicalUrl, shareImageUrl, publishedDate, modifiedDate, tags, readingMinutes, jsonLd, copyArticleLink, copyState }) => {
  const { t } = useTranslate();
  return (
  <MobileCommerceLayout>
    <Helmet>
      <title>{post ? `${title} - Solivagant Journal` : 'Journal Article - Solivagant'}</title>
      <meta name="description" content={description} />
      {failed ? <meta name="robots" content="noindex,follow" /> : <link rel="canonical" href={canonicalUrl} />}
      <meta property="og:type" content="article" />
      <meta property="og:site_name" content="Solivagant" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={shareImageUrl} />
      <meta property="og:image:alt" content={post?.cover_image_url ? post.title : 'Solivagant perfumery journal'} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={shareImageUrl} />
      {post?.category ? <meta property="article:section" content={getJournalCategoryLabel(post.category)} /> : null}
      {publishedDate ? <meta property="article:published_time" content={publishedDate} /> : null}
      {modifiedDate ? <meta property="article:modified_time" content={modifiedDate} /> : null}
      {tags.map((tag) => <meta key={tag} property="article:tag" content={tag} />)}
      {jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
    </Helmet>

    <main className="mobile-page pb-8 text-[#111827]">
      <header className="mx-auto mb-4 flex w-full max-w-[448px] items-center justify-between gap-3 rounded-[22px] border border-[#d8d5ca] bg-white/90 px-3 py-2.5 shadow-sm">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link to="/mobile/articles" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-editorial-charcoal text-editorial-paper">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[#8d7a4f]">{t("journal.breadcrumb")}</span>
              <span className="block truncate text-sm font-extrabold text-editorial-charcoal">{t('journal.article')}</span>
            </span>
          </Link>
          <Link to="/mobile/catalog" className="shrink-0 rounded-2xl border border-[#d8d5ca] bg-editorial-ivory px-3 py-2 text-xs font-bold text-editorial-charcoal">
            {t('journal.shop')}
          </Link>
        </div>
      </header>

      {loading ? (
        <section className="mx-auto grid min-h-[60svh] max-w-[448px] place-items-center rounded-[28px] bg-white/80 px-4 text-center">
          <div>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-editorial-stone/20 border-t-editorial-charcoal" />
            <p className="mt-4 text-sm font-bold text-editorial-charcoal">{t("journal.loading")}</p>
          </div>
        </section>
      ) : failed ? (
        <section className="mx-auto grid min-h-[60svh] max-w-[448px] place-items-center rounded-[28px] bg-white/85 px-4 py-12 text-center shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8d7a4f]">{t("journal.breadcrumb")}</p>
            <h1 className="mt-3 text-3xl font-bold text-[#111827]">{t("journal.unavailable")}</h1>
            <p className="mt-3 text-sm font-medium leading-7 text-[#6b7280]">
              {t('journal.unavailableBody')}
            </p>
            <Link to="/mobile/articles" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-editorial-charcoal px-5 py-3 text-sm font-bold text-editorial-paper">
              <ArrowLeft className="h-4 w-4" />
              {t('journal.backToArticles')}
            </Link>
          </div>
        </section>
      ) : (
        <article className="mx-auto box-border w-full max-w-[448px] overflow-hidden pb-8">
          <header className="rounded-[28px] border border-[#d8d5ca] bg-white/90 p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`rounded-full text-xs ${getJournalCategoryBadgeClassName(post.category)}`}>
                {getJournalCategoryLabel(post.category)}
              </Badge>
              <Badge variant="outline" className={`rounded-full text-xs ${getJournalStatusBadgeClassName('published')}`}>
                {t('journal.published')}
              </Badge>
            </div>
            <h1 className="mt-4 text-[2rem] font-black leading-[1.05] text-[#111827]">{post.title}</h1>
            {post.excerpt ? <p className="mt-4 text-sm font-semibold leading-7 text-[#5f665e]">{post.excerpt}</p> : null}
            <div className="mt-5 grid gap-2 text-xs font-bold text-[#6b7280]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#d8d5ca] bg-white/80 px-3 py-1.5">
                <CalendarDays className="h-4 w-4 text-editorial-charcoal" />
                {formatDate(post.published_at || post.updated || post.created, t('fmt.dateLocale'))}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#d8d5ca] bg-white/80 px-3 py-1.5">
                <Timer className="h-4 w-4 text-editorial-charcoal" />
                {t('journal.minutesRead', { n: readingMinutes })}
              </span>
            </div>
            {tags.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {tags.map((tag) => <span key={tag} className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-[#6b7280]">{tag}</span>)}
              </div>
            ) : null}
          </header>
          <JournalCoverFrame post={post} className="mt-4 rounded-[26px] border-[#d8d5ca]" imageClassName="aspect-[4/3]" eager />
          <div className="mt-4 grid w-full max-w-full gap-4 pb-8">
            <section className="box-border w-full min-w-0 max-w-full rounded-[26px] bg-white/90 px-4 py-5 shadow-sm ring-1 ring-[#d8d5ca]/70">
              {post.content ? <JournalMarkdownContent content={post.content} mobile /> : (
                <p className="mx-auto max-w-3xl rounded-2xl border border-dashed border-[#d8d5ca] bg-white/75 p-6 text-center text-sm font-medium text-[#6b7280]">
                  {t('journal.noContent')}
                </p>
              )}
            </section>
            <JournalRelatedProduct post={post} mobile />
          </div>
        </article>
      )}
    </main>
  </MobileCommerceLayout>
);
};

/* ─── Desktop article view (editorial design system) ─── */
const PublicJournalArticlePage = ({ mobile = false }) => {
  const { t } = useTranslate();
  const { slug } = useParams();
  const revealRef = useScrollReveal();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copyState, setCopyState] = useState('idle');

  useEffect(() => {
    let active = true;

    const loadPost = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const publishedPost = await getPublishedJournalPostBySlug(slug);
        if (!active) return;
        setPost(publishedPost);
        setFailed(!publishedPost);
      } catch (error) {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPost();
    return () => { active = false; };
  }, [slug]);

  const tags = Array.isArray(post?.tags) ? post.tags.filter(Boolean) : [];
  const readingMinutes = useMemo(() => getReadingMinutes(post?.content), [post?.content]);
  const title = stripTrailingBrand(post?.seo_title || post?.title || 'Journal Article');
  const description = truncateMeta(post?.excerpt || post?.content || DEFAULT_DESCRIPTION);
  const canonicalPath = post?.slug ? `/articles/${post.slug}` : `/articles/${slug || ''}`;
  const siteOrigin = getSiteOrigin();
  const canonicalUrl = toAbsoluteUrl(canonicalPath, siteOrigin);
  const shareImageUrl = toAbsoluteUrl(post?.cover_image_url || DEFAULT_SHARE_IMAGE, siteOrigin);
  const publishedDate = post?.published_at || post?.created;
  const modifiedDate = post?.updated || post?.published_at || post?.created;
  const jsonLd = post ? {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    image: [shareImageUrl],
    datePublished: publishedDate,
    dateModified: modifiedDate,
    author: { '@type': 'Organization', name: 'Solivagant' },
    publisher: {
      '@type': 'Organization',
      name: 'Solivagant',
      logo: { '@type': 'ImageObject', url: toAbsoluteUrl('/brand/solivagant-logo.png', siteOrigin) },
    },
    mainEntityOfPage: canonicalUrl,
  } : null;

  const copyArticleLink = async () => {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch (error) {
      setCopyState('failed');
      window.setTimeout(() => setCopyState('idle'), 1800);
    }
  };

  /* Mobile rendering delegates to the separated component */
  if (mobile) {
    return (
      <MobileArticleView
        post={post}
        loading={loading}
        failed={failed}
        slug={slug}
        title={title}
        description={description}
        canonicalUrl={canonicalUrl}
        shareImageUrl={shareImageUrl}
        publishedDate={publishedDate}
        modifiedDate={modifiedDate}
        tags={tags}
        readingMinutes={readingMinutes}
        jsonLd={jsonLd}
        copyArticleLink={copyArticleLink}
        copyState={copyState}
      />
    );
  }

  /* Desktop — editorial design system */
  return (
    <>
      <Helmet>
        <title>{post ? `${title} - Solivagant Journal` : 'Journal Article - Solivagant'}</title>
        <meta name="description" content={description} />
        {failed ? <meta name="robots" content="noindex,follow" /> : <link rel="canonical" href={canonicalUrl} />}
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Solivagant" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={shareImageUrl} />
        <meta property="og:image:alt" content={post?.cover_image_url ? post.title : 'Solivagant perfumery journal'} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={shareImageUrl} />
        {post?.category ? <meta property="article:section" content={getJournalCategoryLabel(post.category)} /> : null}
        {publishedDate ? <meta property="article:published_time" content={publishedDate} /> : null}
        {modifiedDate ? <meta property="article:modified_time" content={modifiedDate} /> : null}
        {tags.map((tag) => <meta key={tag} property="article:tag" content={tag} />)}
        {jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <ScrollProgress />
        <PublicHeader />

        {loading ? (
          <section className="ng-section grid min-h-[50vh] place-items-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="ng-mono m-0 text-ng-ash">{t('journal.loadingEyebrow')}</p>
              <h1 className="ng-display text-[40px]">{t("journal.loading")}</h1>
            </div>
          </section>
        ) : failed ? (
          <section className="ng-section">
            <div className="ng-container flex flex-col items-start gap-6">
              <p className="ng-mono m-0 text-ng-ash">{t('journal.eyebrowWord')}</p>
              <h1 className="ng-display ng-h2">{t("journal.unavailable")}</h1>
              <p className="ng-lead">{t("journal.unavailableBody")}</p>
              <Link to="/home" className="ng-btn">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('notfound.home')}
              </Link>
            </div>
          </section>
        ) : (
          <article>
            <header className="ng-section !border-b-0 !pb-14 !pt-20 md:!pt-28">
              <div className="mx-auto flex max-w-[880px] flex-col items-center gap-7 text-center">
                <p className="ng-mono m-0 flex flex-wrap justify-center gap-x-3.5 gap-y-1 text-ng-ash">
                  <Link to={`/journal`} className="text-ng-ember no-underline">{getJournalCategoryLabel(post.category)}</Link>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(post.published_at || post.updated || post.created, t('fmt.dateLocale'))}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('journal.minutesRead', { n: readingMinutes })}</span>
                </p>
                <h1 className="ng-display text-[44px] leading-[1.02] md:text-[80px]">{post.title}</h1>
                {post.excerpt ? (
                  <p className="m-0 max-w-[600px] font-ng-display text-[22px] italic leading-snug text-ng-sand md:text-[24px]">{post.excerpt}</p>
                ) : null}
              </div>
            </header>

            <div className="px-[var(--ng-gutter)]">
              <JournalCoverFrame post={post} className="ng-cover mx-auto max-w-[1200px] border-ng-bone/10" imageClassName="aspect-[16/8]" eager />
            </div>

            <div className="ng-section">
              <div className="mx-auto flex max-w-[680px] flex-col gap-10">
                <div className="ng-article">
                  {post.content ? (
                    <JournalMarkdownContent content={post.content} />
                  ) : (
                    <p className="m-0 text-ng-dust">{t("journal.noContent")}</p>
                  )}
                </div>
                {tags.length ? (
                  <ul className="ng-tags">
                    {tags.map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className="ng-btn ng-btn--ghost" onClick={copyArticleLink}>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    {copyState === 'copied' ? t("journal.copied") : copyState === 'failed' ? t("journal.copyFailed") : t("journal.copy")}
                  </button>
                  <a href={canonicalUrl} target="_blank" rel="noreferrer" className="ng-link ng-mono inline-flex min-h-[44px] items-center gap-2">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    {t('journal.openLink')}
                  </a>
                </div>
              </div>
            </div>

            <JournalRelatedProduct post={post} />
          </article>
        )}

        <StorefrontFooter />
      </main>
    </>
  );
};

export default PublicJournalArticlePage;
