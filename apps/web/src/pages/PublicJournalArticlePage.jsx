import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
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

const PublicJournalArticlePage = () => {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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
  const description = post?.excerpt || 'Read a Solivagant perfumery journal article.';
  const canonicalPath = post?.slug ? `/articles/${post.slug}` : `/articles/${slug || ''}`;

  return (
    <>
      <Helmet>
        <title>{post ? `${title} - Solivagant Journal` : 'Journal Article - Solivagant'}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalPath} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {post?.cover_image_url ? <meta property="og:image" content={post.cover_image_url} /> : null}
        {post?.published_at ? <meta property="article:published_time" content={post.published_at} /> : null}
      </Helmet>

      <main className="min-h-screen bg-[#f7f8f2] text-[#111827]">
        <header className="border-b border-[#263d27]/15 bg-[#050705] text-[#eef2e8]">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/home" className="flex items-center gap-3">
              <img src="/brand/solivagant-logo.png" alt="Solivagant" className="h-11 w-32 rounded-xl object-contain" />
            </Link>
            <Link to="/catalog" className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-[#eef2e8]">
              Catalog
            </Link>
          </div>
        </header>

        {loading ? (
          <section className="grid min-h-[60vh] place-items-center px-4 text-center">
            <div>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#263d27]/20 border-t-[#263d27]" />
              <p className="mt-4 text-sm font-bold text-[#263d27]">Loading article...</p>
            </div>
          </section>
        ) : failed ? (
          <section className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-4 py-16 text-center sm:px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8d7a4f]">Journal</p>
              <h1 className="mt-3 text-3xl font-bold text-[#111827]">Article not available</h1>
              <p className="mt-3 text-sm font-medium leading-7 text-[#6b7280]">
                Artikel ini belum dipublish, sudah dipindah, atau link-nya tidak tersedia.
              </p>
              <Link to="/home" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#263d27] px-5 py-3 text-sm font-bold text-[#eef2e8]">
                <ArrowLeft className="h-4 w-4" />
                Back to Solivagant
              </Link>
            </div>
          </section>
        ) : (
          <article className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
            <header className="border-b border-[#d8d5ca] pb-8 sm:pb-10">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={`rounded-full text-xs ${getJournalCategoryBadgeClassName(post.category)}`}>
                  {getJournalCategoryLabel(post.category)}
                </Badge>
                <Badge variant="outline" className={`rounded-full text-xs ${getJournalStatusBadgeClassName('published')}`}>
                  Published
                </Badge>
              </div>

              <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight text-[#111827] sm:text-6xl">
                {post.title}
              </h1>

              {post.excerpt ? (
                <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-[#5f665e] sm:text-xl">
                  {post.excerpt}
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-[#6b7280]">
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
              className="mt-8 rounded-[28px] border-[#d8d5ca]"
              imageClassName="aspect-[16/8]"
              eager
            />

            <section className="mt-9 pb-14">
              {post.content ? (
                <JournalMarkdownContent content={post.content} />
              ) : (
                <p className="mx-auto max-w-3xl rounded-2xl border border-dashed border-[#d8d5ca] bg-white/75 p-6 text-center text-sm font-medium text-[#6b7280]">
                  Artikel ini belum memiliki isi.
                </p>
              )}
            </section>
          </article>
        )}
      </main>
    </>
  );
};

export default PublicJournalArticlePage;
