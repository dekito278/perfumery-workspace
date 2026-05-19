import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Copy, Edit3, FileText, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';
import JournalMarkdownContent from '@/components/journal/JournalMarkdownContent.jsx';
import { useJournalPosts } from '@/hooks/useJournalPosts.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { getJournalCategoryLabel } from '@/services/journalPostsSupabaseService.js';

const formatDate = (value) => {
  if (!value) {
    return 'No date';
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
};

const categoryBadgeClassNames = {
  formula_accord: 'border-amber-200 bg-amber-50 text-amber-800',
  experience: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  material_note: 'border-sky-200 bg-sky-50 text-sky-800',
  process: 'border-violet-200 bg-violet-50 text-violet-800',
  product_idea: 'border-rose-200 bg-rose-50 text-rose-800',
};

const getReadingMinutes = (content) => {
  const wordCount = String(content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 180));
};

const MobileJournalDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getJournalPostById, loading, error } = useJournalPosts();
  const { getFormulas } = useFormulas();
  const [post, setPost] = useState(null);
  const [formulas, setFormulas] = useState([]);

  useEffect(() => {
    let active = true;

    const loadDetail = async () => {
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
      } catch (err) {
        toast.error('Failed to load journal note');
      }
    };

    loadDetail();

    return () => {
      active = false;
    };
  }, [getFormulas, getJournalPostById, id]);

  const formula = useMemo(
    () => formulas.find((item) => item.id === post?.related_formula_id),
    [formulas, post?.related_formula_id]
  );

  const readingMinutes = useMemo(() => getReadingMinutes(post?.content), [post?.content]);
  const articleTitle = post?.seo_title || post?.title;

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/journal/${post.slug || post.id}`;

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Journal link copied');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  return (
    <MobileAuthenticatedLayout>
      <Helmet>
        <title>{articleTitle ? `${articleTitle} - Journal Mobile` : 'Journal Note - Solivagant'}</title>
        <meta name="description" content={post?.excerpt || 'Read a perfumery journal note on mobile.'} />
        {post?.cover_image_url ? <meta property="og:image" content={post.cover_image_url} /> : null}
      </Helmet>

      <MobileTopBar
        title="Journal"
        subtitle={post ? formatDate(post.updated || post.created) : 'Loading note'}
        eyebrow="Reading"
        onBack={() => navigate('/mobile/journal')}
        action={post ? (
          <div className="flex gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={handleCopyLink}
              className="mobile-interactive mobile-pressable h-10 w-10 rounded-2xl bg-white"
              aria-label="Copy journal link"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => navigate(`/mobile/journal/${post.id}/edit`, { state: { from: `/mobile/journal/${post.id}` } })}
              className="mobile-interactive mobile-pressable h-10 w-10 rounded-2xl bg-white"
              aria-label="Edit journal note"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      />

      {loading && !post ? (
        <MobileLoadingSkeleton title="Loading note" subtitle="Opening your journal entry." />
      ) : error ? (
        <MobileStatePanel
          tone="error"
          title="Note unavailable"
          description={error}
          action="Back to journal"
          onAction={() => navigate('/mobile/journal')}
        />
      ) : post ? (
        <article className="space-y-4 pb-6">
          <header className="border-b border-[#e5e7eb] pb-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`rounded-full ${categoryBadgeClassNames[post.category] || ''}`}>
                {getJournalCategoryLabel(post.category)}
              </Badge>
              <Badge variant="outline" className="rounded-full capitalize">
                {post.status}
              </Badge>
            </div>

            <h1 className="mt-4 text-[24px] font-bold leading-tight text-[#111827]">
              {post.title || 'Untitled note'}
            </h1>

            {post.excerpt ? (
              <p className="mt-3 text-[15px] font-medium leading-7 text-[#6b7280]">
                {post.excerpt}
              </p>
            ) : null}

            {post.cover_image_url ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-[#f3f4f6]">
                <img
                  src={post.cover_image_url}
                  alt=""
                  className="aspect-[16/9] w-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-[#6b7280]">
              <span className="inline-flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(post.updated || post.created)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1">
                <Timer className="h-3.5 w-3.5" />
                {readingMinutes} min read
              </span>
            </div>

            {formula ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/mobile/formulas/${formula.id}`)}
                className="mt-4 h-auto min-h-11 w-full justify-start rounded-2xl bg-white px-3 py-2 text-left"
              >
                <FileText className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{formula.name}</span>
              </Button>
            ) : null}

            {post.tags?.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {post.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-[#f3f4f6] px-2 py-1 text-[10px] font-bold text-[#6b7280]">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </header>

          <section className="py-1">
            {post.content ? (
              <JournalMarkdownContent content={post.content} mobile />
            ) : (
              <p className="text-sm font-medium text-[#6b7280]">No content yet.</p>
            )}
          </section>
        </article>
      ) : null}
    </MobileAuthenticatedLayout>
  );
};

export default MobileJournalDetailPage;
