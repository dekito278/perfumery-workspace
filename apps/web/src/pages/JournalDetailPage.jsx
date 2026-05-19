import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Beaker, BookOpenText, CalendarDays, Copy, Pencil, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import JournalCoverFrame from '@/components/journal/JournalCoverFrame.jsx';
import JournalMarkdownContent from '@/components/journal/JournalMarkdownContent.jsx';
import { useJournalPosts } from '@/hooks/useJournalPosts.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import {
  getJournalCategoryBadgeClassName,
  getJournalCategoryLabel,
  getJournalStatusBadgeClassName,
} from '@/services/journalPostsSupabaseService.js';
import { copyTextToClipboard } from '@/utils/clipboard.js';
import { formatDate, formatStatus } from '@/utils/formatting.js';

const getReadingMinutes = (content) => {
  const wordCount = String(content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 180));
};

const JournalDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getJournalPostById } = useJournalPosts();
  const { getFormulas } = useFormulas();
  const [post, setPost] = useState(null);
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadJournalDetail = async () => {
      setLoading(true);
      try {
        const [postRow, formulaRows] = await Promise.all([
          getJournalPostById(id),
          getFormulas(),
        ]);

        if (!active) {
          return;
        }

        setPost(postRow);
        setFormulas(formulaRows);
      } catch (error) {
        toast.error('Failed to load journal note');
        navigate('/journal');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadJournalDetail();

    return () => {
      active = false;
    };
  }, [getFormulas, getJournalPostById, id, navigate]);

  const formulasById = useMemo(
    () => new Map(formulas.map((formula) => [formula.id, formula])),
    [formulas]
  );

  const relatedFormula = post?.related_formula_id ? formulasById.get(post.related_formula_id) : null;
  const tags = Array.isArray(post?.tags) ? post.tags.filter(Boolean) : [];
  const readingMinutes = getReadingMinutes(post?.content);
  const articleTitle = post?.seo_title || post?.title;

  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from, { state: { restoreScroll: true } });
      return;
    }

    navigate('/journal');
  };

  const handleCopyLink = async () => {
    const path = post.status === 'published' && post.slug ? `/articles/${post.slug}` : `/journal/${post.id}`;
    const url = `${window.location.origin}${path}`;

    try {
      await copyTextToClipboard(url);
      toast.success('Journal link copied');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>{articleTitle ? `${articleTitle} - Journal - Solivagant` : 'Journal Detail - Solivagant'}</title>
        <meta name="description" content={post?.excerpt || 'Read a perfumery journal note.'} />
        {post?.cover_image_url ? <meta property="og:image" content={post.cover_image_url} /> : null}
        {post?.status === 'published' ? <meta property="article:published_time" content={post.published_at || post.created} /> : null}
      </Helmet>

      <div className="page-container">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={handleBack} className="h-9 w-fit gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to journal
          </Button>
          {post ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyLink}
                className="h-10 w-fit gap-2 rounded-2xl px-4"
              >
                <Copy className="h-4 w-4" />
                Copy link
              </Button>
              <Button
                type="button"
                onClick={() => navigate(`/journal/${post.id}/edit`, { state: { from: `/journal/${post.id}` } })}
                className="h-10 w-fit gap-2 rounded-2xl px-4"
              >
                <Pencil className="h-4 w-4" />
                Edit note
              </Button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : !post ? (
          <EmptyState
            icon={BookOpenText}
            title="Journal note not found"
            description="The note may have been removed or is no longer available."
          />
        ) : (
          <article className="mx-auto max-w-5xl">
            <header className="border-b pb-8 sm:pb-10">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={`rounded-full text-xs ${getJournalCategoryBadgeClassName(post.category)}`}>
                  {getJournalCategoryLabel(post.category)}
                </Badge>
                <Badge variant="outline" className={`rounded-full text-xs ${getJournalStatusBadgeClassName(post.status)}`}>
                  {formatStatus(post.status || 'draft')}
                </Badge>
              </div>

              <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight text-[#111827] sm:text-6xl" style={{ letterSpacing: '-0.02em' }}>
                {post.title}
              </h1>

              {post.excerpt ? (
                <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground sm:text-xl">
                  {post.excerpt}
                </p>
              ) : null}

              <JournalCoverFrame
                post={post}
                className="mt-7 rounded-[26px]"
                imageClassName="aspect-[16/7]"
                eager
              />

              <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Updated {formatDate(post.updated || post.created)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5">
                  <Timer className="h-4 w-4 text-primary" />
                  {readingMinutes} min read
                </span>
                {relatedFormula ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/formulas/${relatedFormula.id}`)}
                    className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5 font-semibold text-primary transition hover:bg-white"
                  >
                    <Beaker className="h-4 w-4" />
                    {relatedFormula.name}
                  </button>
                ) : null}
              </div>

              {tags.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </header>

            <section className="mt-10 pb-12">
              {post.content ? (
                <JournalMarkdownContent content={post.content} />
              ) : (
                <div className="mx-auto max-w-2xl rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  Belum ada isi artikel. Tambahkan content di editor supaya catatan ini enak dibaca.
                </div>
              )}
            </section>
          </article>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default JournalDetailPage;
