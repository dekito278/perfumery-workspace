import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Copy, Edit3, ExternalLink, FileText, RefreshCw, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';
import JournalCoverFrame from '@/components/journal/JournalCoverFrame.jsx';
import JournalMarkdownContent from '@/components/journal/JournalMarkdownContent.jsx';
import { useJournalPosts } from '@/hooks/useJournalPosts.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import {
  getJournalCategoryBadgeClassName,
  getJournalCategoryLabel,
  getJournalPublicPath,
  getJournalStatusBadgeClassName,
} from '@/services/journalPostsSupabaseService.js';
import { copyTextToClipboard } from '@/utils/clipboard.js';

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

const getReadingMinutes = (content) => {
  const wordCount = String(content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 180));
};

const MobileJournalDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getJournalPostById, updateJournalPost, loading, error } = useJournalPosts();
  const { getFormulas } = useFormulas();
  const [post, setPost] = useState(null);
  const [formulas, setFormulas] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let active = true;

    const loadDetail = async () => {
      setLoadError('');
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
        if (active) {
          setPost(null);
          setLoadError(err.message || 'Artikel tidak bisa dimuat.');
        }
        toast.error('Artikel tidak bisa dimuat');
      }
    };

    loadDetail();

    return () => {
      active = false;
    };
  }, [getFormulas, getJournalPostById, id, reloadKey]);

  const formula = useMemo(
    () => formulas.find((item) => item.id === post?.related_formula_id),
    [formulas, post?.related_formula_id]
  );

  const readingMinutes = useMemo(() => getReadingMinutes(post?.content), [post?.content]);
  const articleTitle = post?.seo_title || post?.title;
  const publicPath = useMemo(() => getJournalPublicPath(post, { mobile: true }), [post]);
  const publicUrl = publicPath ? `${window.location.origin}${publicPath}` : '';

  const handleCopyLink = async () => {
    const path = post.status === 'published' && (post.slug || post.id) ? `/articles/${post.slug || post.id}` : `/journal/${post.id}`;
    const url = `${window.location.origin}${path}`;

    try {
      await copyTextToClipboard(url);
      toast.success('Link artikel disalin');
    } catch (error) {
      toast.error('Link belum bisa disalin');
    }
  };

  const handleRetry = () => setReloadKey((current) => current + 1);

  const handlePublish = async () => {
    if (!post?.id || publishing) {
      return;
    }

    setPublishing(true);
    try {
      const savedPost = await updateJournalPost(post.id, {
        ...post,
        status: 'published',
        related_formula_id: post.related_formula_id || null,
      });
      setPost(savedPost);
      toast.success('Artikel dipublish dan muncul di halaman Artikel');
    } catch (err) {
      toast.error(err.message || 'Artikel belum bisa dipublish');
    } finally {
      setPublishing(false);
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
      ) : error || loadError ? (
        <MobileStatePanel
          tone="error"
          title="Artikel tidak bisa dibuka"
          description={loadError || error || 'Data artikel tidak ditemukan atau belum bisa dimuat.'}
          action="Coba lagi"
          onAction={handleRetry}
          secondaryAction="Kembali"
          onSecondaryAction={() => navigate('/mobile/journal')}
        />
      ) : post ? (
        <article className="space-y-4 pb-6">
          <header className="border-b border-[#e5e7eb] pb-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`rounded-full ${getJournalCategoryBadgeClassName(post.category)}`}>
                {getJournalCategoryLabel(post.category)}
              </Badge>
              <Badge variant="outline" className={`rounded-full capitalize ${getJournalStatusBadgeClassName(post.status)}`}>
                {post.status}
              </Badge>
              {post.status === 'published' ? (
                <Badge variant="outline" className={`rounded-full ${post.slug ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  {post.slug ? `/${post.slug}` : 'link publik pakai ID'}
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-700">
                  Draft belum tampil di Artikel
                </Badge>
              )}
            </div>

            <h1 className="mt-4 text-[24px] font-bold leading-tight text-[#111827]">
              {post.title || 'Untitled note'}
            </h1>

            {post.excerpt ? (
              <p className="mt-3 text-[15px] font-medium leading-7 text-[#6b7280]">
                {post.excerpt}
              </p>
            ) : null}

            <JournalCoverFrame
              post={post}
              className="mt-4 rounded-2xl border-[#e5e7eb]"
              imageClassName="aspect-[16/9]"
              compact
              eager
            />

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-[#6b7280]">
              <span className="inline-flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(post.updated || post.created)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1">
                <Timer className="h-3.5 w-3.5" />
                {readingMinutes} menit baca
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

            <div className="mt-4 rounded-2xl border border-[#e5e7eb] bg-white p-3">
              <div className="text-[10px] font-bold uppercase text-[#9ca3af]">Status publik</div>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                {publicPath
                  ? 'Artikel ini sudah Published dan bisa dibuka dari halaman Artikel publik.'
                  : 'Artikel ini masih Draft. Artikel Draft tersimpan di Studio Journal dan belum muncul untuk pembeli.'}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/mobile/journal/${post.id}/edit`, { state: { from: `/mobile/journal/${post.id}` } })}
                  className="h-10 rounded-2xl bg-white text-xs font-bold"
                >
                  <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => (publicPath ? navigate(publicPath) : handlePublish())}
                  disabled={publishing}
                  className="h-10 rounded-2xl bg-white text-xs font-bold"
                >
                  {publicPath ? <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                  {publicPath ? 'Buka publik' : publishing ? 'Publish...' : 'Publish'}
                </Button>
              </div>
              {publicUrl ? (
                <div className="mt-2 truncate rounded-xl bg-[#f3f4f6] px-2.5 py-2 text-[11px] font-semibold text-[#6b7280]">
                  {publicUrl}
                </div>
              ) : null}
            </div>

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

          <section className="py-2 pb-8">
            {post.content ? (
              <JournalMarkdownContent content={post.content} mobile />
            ) : (
              <p className="text-sm font-medium text-[#6b7280]">No content yet.</p>
            )}
          </section>
        </article>
      ) : (
        <MobileStatePanel
          tone="empty"
          title="Artikel tidak ditemukan"
          description="Artikel ini mungkin sudah dihapus atau link-nya berubah."
          action="Kembali ke Journal"
          onAction={() => navigate('/mobile/journal')}
        />
      )}
    </MobileAuthenticatedLayout>
  );
};

export default MobileJournalDetailPage;
