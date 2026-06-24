import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Copy, ExternalLink, Share2, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import JournalCoverFrame from '@/components/journal/JournalCoverFrame.jsx';
import JournalMarkdownContent from '@/components/journal/JournalMarkdownContent.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import {
  getJournalCategoryBadgeClassName,
  getJournalCategoryLabel,
  getJournalStatusBadgeClassName,
  getPublishedJournalPostBySlug,
} from '@/services/journalPostsSupabaseService.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { formatDate } from '@/utils/formatting.js';

const getReadingMinutes = (content) => {
  const wordCount = String(content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 180));
};

const FALLBACK_SHARE_IMAGE = '/brand/home/perfumer-at-work.jpg';
const DEFAULT_DESCRIPTION = 'Read a Solivagant perfumery journal article.';

const getSiteOrigin = () => {
  const configuredOrigin = String(import.meta.env.VITE_PUBLIC_SITE_URL || import.meta.env.VITE_SITE_URL || '').trim();
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, '');
  }

  return typeof window !== 'undefined' ? window.location.origin : '';
};

const stripMarkdown = (value) => String(value || '')
  .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[`*_>#-]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const truncateMeta = (value, maxLength = 155) => {
  const normalized = stripMarkdown(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}...`;
};

const toAbsoluteUrl = (value, origin) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return origin ? `${origin}${path}` : path;
};

/* ─── Mobile article view (unchanged Tailwind-based layout) ─── */
const MobileArticleView = ({ post, loading, failed, slug, title, description, canonicalUrl, shareImageUrl, publishedDate, modifiedDate, tags, readingMinutes, jsonLd, copyArticleLink, copyState }) => (
  <MobileCommerceLayout>
    <Helmet>
      <title>{post ? `${title} - Solivagant Journal` : 'Journal Article - Solivagant'}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
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
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#1b1a16] text-[#fffaf0]">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[#8d7a4f]">Journal</span>
              <span className="block truncate text-sm font-extrabold text-[#1b1a16]">Article</span>
            </span>
          </Link>
          <Link to="/mobile/catalog" className="shrink-0 rounded-2xl border border-[#d8d5ca] bg-[#f7f1e5] px-3 py-2 text-xs font-bold text-[#1b1a16]">
            Belanja
          </Link>
        </div>
      </header>

      {loading ? (
        <section className="mx-auto grid min-h-[60svh] max-w-[448px] place-items-center rounded-[28px] bg-white/80 px-4 text-center">
          <div>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#e5decf]/20 border-t-[#1b1a16]" />
            <p className="mt-4 text-sm font-bold text-[#1b1a16]">Loading article...</p>
          </div>
        </section>
      ) : failed ? (
        <section className="mx-auto grid min-h-[60svh] max-w-[448px] place-items-center rounded-[28px] bg-white/85 px-4 py-12 text-center shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8d7a4f]">Journal</p>
            <h1 className="mt-3 text-3xl font-bold text-[#111827]">Article not available</h1>
            <p className="mt-3 text-sm font-medium leading-7 text-[#6b7280]">
              Artikel ini belum dipublish, sudah dipindah, atau link-nya tidak tersedia.
            </p>
            <Link to="/mobile/articles" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#1b1a16] px-5 py-3 text-sm font-bold text-[#fffaf0]">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke artikel
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
                Published
              </Badge>
            </div>
            <h1 className="mt-4 text-[2rem] font-black leading-[1.05] text-[#111827]">{post.title}</h1>
            {post.excerpt ? <p className="mt-4 text-sm font-semibold leading-7 text-[#5f665e]">{post.excerpt}</p> : null}
            <div className="mt-5 grid gap-2 text-xs font-bold text-[#6b7280]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#d8d5ca] bg-white/80 px-3 py-1.5">
                <CalendarDays className="h-4 w-4 text-[#1b1a16]" />
                {formatDate(post.published_at || post.updated || post.created)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#d8d5ca] bg-white/80 px-3 py-1.5">
                <Timer className="h-4 w-4 text-[#1b1a16]" />
                {readingMinutes} min read
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
                  Artikel ini belum memiliki isi.
                </p>
              )}
            </section>
          </div>
        </article>
      )}
    </main>
  </MobileCommerceLayout>
);

/* ─── Desktop article view (editorial design system) ─── */
const PublicJournalArticlePage = ({ mobile = false }) => {
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
  const title = post?.seo_title || post?.title || 'Journal Article';
  const description = truncateMeta(post?.excerpt || post?.content || DEFAULT_DESCRIPTION);
  const canonicalPath = post?.slug ? `/articles/${post.slug}` : `/articles/${slug || ''}`;
  const siteOrigin = getSiteOrigin();
  const canonicalUrl = toAbsoluteUrl(canonicalPath, siteOrigin);
  const shareImageUrl = toAbsoluteUrl(post?.cover_image_url || FALLBACK_SHARE_IMAGE, siteOrigin);
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
        <link rel="canonical" href={canonicalUrl} />
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
        <PublicHeader />

        {loading ? (
          <section className="notfound-content">
            <div className="reveal-divider" style={{ width: 40, margin: '0 auto 20px' }} />
            <p className="editorial-eyebrow">LOADING</p>
            <h1 style={{ fontSize: 'var(--text-section)' }}>Memuat artikel...</h1>
          </section>
        ) : failed ? (
          <section className="notfound-content">
            <p className="editorial-eyebrow hero-animate-text hero-animate-text--d1">JOURNAL</p>
            <h1 className="hero-animate-text hero-animate-text--d2">Article not available</h1>
            <p className="hero-animate-text hero-animate-text--d3">Artikel ini belum dipublish, sudah dipindah, atau link-nya tidak tersedia.</p>
            <div className="notfound-actions hero-animate-text hero-animate-text--d4">
              <Link to="/home" className="editorial-button editorial-button--primary">
                <ArrowLeft className="h-4 w-4" /> Back to Solivagant
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Article header */}
            <header className="journal-article-header" data-reveal>
              <div className="journal-article-header__badges">
                <span className="journal-article-badge journal-article-badge--category">
                  {getJournalCategoryLabel(post.category)}
                </span>
                <span className="journal-article-badge journal-article-badge--status">
                  Published
                </span>
              </div>

              <h1 className="hero-animate-text hero-animate-text--d1">{post.title}</h1>

              {post.excerpt ? (
                <p className="journal-article-header__excerpt hero-animate-text hero-animate-text--d2">{post.excerpt}</p>
              ) : null}

              <div className="journal-article-header__meta hero-animate-text hero-animate-text--d3">
                <span className="journal-article-meta-pill">
                  <CalendarDays />
                  {formatDate(post.published_at || post.updated || post.created)}
                </span>
                <span className="journal-article-meta-pill">
                  <Timer />
                  {readingMinutes} min read
                </span>
              </div>

              {tags.length ? (
                <div className="journal-article-header__tags hero-animate-fade">
                  {tags.map((tag) => <span key={tag} className="journal-article-tag">{tag}</span>)}
                </div>
              ) : null}
            </header>

            {/* Cover image */}
            <div className="journal-article-cover" data-reveal="scale">
              <JournalCoverFrame
                post={post}
                className="img-hover-zoom"
                imageClassName="aspect-[16/8]"
                eager
              />
            </div>

            {/* Body + sidebar */}
            <div className="journal-article-layout">
              <section className="journal-article-body" data-reveal>
                {post.content ? (
                  <JournalMarkdownContent content={post.content} />
                ) : (
                  <div className="editorial-empty-state">
                    <p className="editorial-eyebrow">NO CONTENT</p>
                    <h2>Artikel ini belum memiliki isi.</h2>
                  </div>
                )}
              </section>

              <aside className="journal-article-sidebar" data-reveal="right">
                <div className="journal-article-share">
                  <div className="journal-article-share__image">
                    <img src={shareImageUrl} alt="" loading="lazy" decoding="async" width="1200" height="630" />
                  </div>
                  <div className="journal-article-share__body">
                    <span className="journal-article-share__label">
                      <Share2 /> Share preview
                    </span>
                    <h2>{title}</h2>
                    <p className="journal-article-share__desc">{description}</p>
                    <div className="journal-article-share__url">{canonicalUrl}</div>
                    <div className="journal-article-share__actions">
                      <button type="button" onClick={copyArticleLink}>
                        <Copy />
                        {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Failed' : 'Copy'}
                      </button>
                      <a href={canonicalUrl} target="_blank" rel="noreferrer">
                        <ExternalLink />
                        Open
                      </a>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}

        <StorefrontFooter />
      </main>
    </>
  );
};

export default PublicJournalArticlePage;
