import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Copy, ExternalLink, Share2, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import JournalCoverFrame from '@/components/journal/JournalCoverFrame.jsx';
import JournalMarkdownContent from '@/components/journal/JournalMarkdownContent.jsx';
import {
  getJournalCategoryBadgeClassName,
  getJournalCategoryLabel,
  getJournalStatusBadgeClassName,
  getPublishedJournalPostBySlug,
} from '@/services/journalPostsSupabaseService.js';
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

const PublicJournalArticlePage = ({ mobile = false }) => {
  const { slug } = useParams();
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
        if (!active) {
          return;
        }

        setPost(publishedPost);
        setFailed(!publishedPost);
      } catch (error) {
        if (active) {
          setFailed(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPost();

    return () => {
      active = false;
    };
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
    author: {
      '@type': 'Organization',
      name: 'Solivagant',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Solivagant',
      logo: {
        '@type': 'ImageObject',
        url: toAbsoluteUrl('/brand/solivagant-logo.png', siteOrigin),
      },
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

  const page = (
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

      <main className={`${mobile ? 'mobile-page pb-8 text-[#111827]' : 'min-h-screen bg-[#f7f8f2] text-[#111827]'}`}>
        <header className={mobile ? 'mx-auto mb-4 flex w-full max-w-[448px] items-center justify-between gap-3 rounded-[22px] border border-[#d8d5ca] bg-white/90 px-3 py-2.5 shadow-sm' : 'border-b border-[#263d27]/15 bg-[#050705] text-[#eef2e8]'}>
          <div className={mobile ? 'flex min-w-0 flex-1 items-center gap-3' : 'mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8'}>
            <Link to={mobile ? '/mobile/articles' : '/home'} className="flex min-w-0 items-center gap-3">
              {mobile ? (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#263d27] text-[#eef2e8]">
                  <ArrowLeft className="h-4 w-4" />
                </span>
              ) : (
                <img src="/brand/solivagant-logo.png" alt="Solivagant" className="h-11 w-32 rounded-xl object-contain" />
              )}
              {mobile ? (
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[#8d7a4f]">Journal</span>
                  <span className="block truncate text-sm font-extrabold text-[#263d27]">Article</span>
                </span>
              ) : null}
            </Link>
            <Link to={mobile ? '/mobile/catalog' : '/catalog'} className={mobile ? 'shrink-0 rounded-2xl border border-[#d8d5ca] bg-[#f7f8f2] px-3 py-2 text-xs font-bold text-[#263d27]' : 'rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-[#eef2e8]'}>
              {mobile ? 'Belanja' : 'Catalog'}
            </Link>
          </div>
        </header>

        {loading ? (
          <section className={`${mobile ? 'mx-auto grid min-h-[60svh] max-w-[448px] place-items-center rounded-[28px] bg-white/80 px-4 text-center' : 'grid min-h-[60vh] place-items-center px-4 text-center'}`}>
            <div>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#263d27]/20 border-t-[#263d27]" />
              <p className="mt-4 text-sm font-bold text-[#263d27]">Loading article...</p>
            </div>
          </section>
        ) : failed ? (
          <section className={`${mobile ? 'mx-auto grid min-h-[60svh] max-w-[448px] place-items-center rounded-[28px] bg-white/85 px-4 py-12 text-center shadow-sm' : 'mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-4 py-16 text-center sm:px-6'}`}>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8d7a4f]">Journal</p>
              <h1 className="mt-3 text-3xl font-bold text-[#111827]">Article not available</h1>
              <p className="mt-3 text-sm font-medium leading-7 text-[#6b7280]">
                Artikel ini belum dipublish, sudah dipindah, atau link-nya tidak tersedia.
              </p>
              <Link to={mobile ? '/mobile/articles' : '/home'} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#263d27] px-5 py-3 text-sm font-bold text-[#eef2e8]">
                <ArrowLeft className="h-4 w-4" />
                {mobile ? 'Kembali ke artikel' : 'Back to Solivagant'}
              </Link>
            </div>
          </section>
        ) : (
          <article className={mobile ? 'mx-auto box-border w-full max-w-[448px] overflow-hidden pb-8' : 'mx-auto box-border w-full max-w-6xl overflow-hidden px-4 py-8 sm:px-6 sm:py-12 lg:px-8'}>
            <header className={mobile ? 'rounded-[28px] border border-[#d8d5ca] bg-white/90 p-4 shadow-sm' : 'border-b border-[#d8d5ca] pb-8 sm:pb-10'}>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={`rounded-full text-xs ${getJournalCategoryBadgeClassName(post.category)}`}>
                  {getJournalCategoryLabel(post.category)}
                </Badge>
                <Badge variant="outline" className={`rounded-full text-xs ${getJournalStatusBadgeClassName('published')}`}>
                  Published
                </Badge>
              </div>

              <h1 className={mobile ? 'mt-4 text-[2rem] font-black leading-[1.05] text-[#111827]' : 'mt-5 max-w-4xl text-4xl font-bold leading-tight text-[#111827] sm:text-6xl'}>
                {post.title}
              </h1>

              {post.excerpt ? (
                <p className={mobile ? 'mt-4 text-sm font-semibold leading-7 text-[#5f665e]' : 'mt-5 max-w-3xl text-base font-medium leading-8 text-[#5f665e] sm:text-xl'}>
                  {post.excerpt}
                </p>
              ) : null}

              <div className={mobile ? 'mt-5 grid gap-2 text-xs font-bold text-[#6b7280]' : 'mt-6 flex flex-wrap gap-3 text-sm font-semibold text-[#6b7280]'}>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#d8d5ca] bg-white/80 px-3 py-1.5">
                  <CalendarDays className="h-4 w-4 text-[#263d27]" />
                  {formatDate(post.published_at || post.updated || post.created)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#d8d5ca] bg-white/80 px-3 py-1.5">
                  <Timer className="h-4 w-4 text-[#263d27]" />
                  {readingMinutes} min read
                </span>
              </div>

              {tags.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-[#6b7280]">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </header>

            <JournalCoverFrame
              post={post}
              className={mobile ? 'mt-4 rounded-[26px] border-[#d8d5ca]' : 'mt-8 rounded-[28px] border-[#d8d5ca]'}
              imageClassName={mobile ? 'aspect-[4/3]' : 'aspect-[16/8]'}
              eager
            />

            <div className={mobile ? 'mt-4 grid w-full max-w-full gap-4 pb-8' : 'mt-9 grid w-full max-w-full gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start'}>
              <section className={mobile ? 'box-border w-full min-w-0 max-w-full rounded-[26px] bg-white/90 px-4 py-5 shadow-sm ring-1 ring-[#d8d5ca]/70' : 'box-border w-full min-w-0 max-w-full rounded-[28px] bg-white/60 px-4 py-6 ring-1 ring-[#d8d5ca]/70 sm:px-8 sm:py-9 lg:bg-transparent lg:px-0 lg:py-0 lg:ring-0'}>
                {post.content ? (
                  <JournalMarkdownContent content={post.content} mobile={mobile} />
                ) : (
                  <p className="mx-auto max-w-3xl rounded-2xl border border-dashed border-[#d8d5ca] bg-white/75 p-6 text-center text-sm font-medium text-[#6b7280]">
                    Artikel ini belum memiliki isi.
                  </p>
                )}
              </section>

              <aside className={mobile ? 'w-full min-w-0 max-w-full' : 'w-full min-w-0 max-w-full lg:sticky lg:top-6'}>
                <div className="box-border w-full max-w-full overflow-hidden rounded-[24px] border border-[#d8d5ca] bg-white shadow-sm">
                  <div className="aspect-[1.91/1] overflow-hidden bg-[#f7f8f2]">
                    <img src={shareImageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" width="1200" height="630" />
                  </div>
                  <div className="space-y-4 p-4">
                    <div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-[#eef2e8] px-2.5 py-1 text-[10px] font-bold uppercase text-[#263d27]">
                        <Share2 className="h-3.5 w-3.5" />
                        Share preview
                      </div>
                      <h2 className="mt-3 line-clamp-3 text-sm font-bold leading-snug text-[#111827]">{title}</h2>
                      <p className="mt-2 line-clamp-4 text-xs font-medium leading-5 text-[#6b7280]">{description}</p>
                    </div>
                    <div className="rounded-2xl bg-[#f7f8f2] px-3 py-2 text-[11px] font-semibold text-[#6b7280]">
                      <span className="block truncate">{canonicalUrl}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white text-xs font-bold" onClick={copyArticleLink}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Failed' : 'Copy'}
                      </Button>
                      <Button asChild variant="outline" className="h-10 rounded-2xl bg-white text-xs font-bold">
                        <a href={canonicalUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Open
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </article>
        )}
      </main>
    </>
  );

  return mobile ? <MobileCommerceLayout>{page}</MobileCommerceLayout> : page;
};

export default PublicJournalArticlePage;
