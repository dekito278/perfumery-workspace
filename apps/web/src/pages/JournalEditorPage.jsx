import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpenText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { useJournalPosts } from '@/hooks/useJournalPosts.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import {
  JOURNAL_CATEGORIES,
  JOURNAL_STATUSES,
} from '@/services/journalPostsSupabaseService.js';

const createEmptyPost = (formulaId = 'none', formulaName = '') => {
  const hasFormula = formulaId && formulaId !== 'none';

  return {
    title: hasFormula && formulaName ? `${formulaName} notes` : '',
    category: hasFormula ? 'formula_accord' : 'experience',
    status: 'draft',
    related_formula_id: formulaId || 'none',
    excerpt: '',
    content: '',
    seo_title: '',
    cover_image_url: '',
    tags: '',
  };
};

const toEditorState = (post) => ({
  title: post.title || '',
  category: post.category || 'experience',
  status: post.status || 'draft',
  related_formula_id: post.related_formula_id || 'none',
  excerpt: post.excerpt || '',
  content: post.content || '',
  seo_title: post.seo_title || '',
  cover_image_url: post.cover_image_url || '',
  tags: Array.isArray(post.tags) ? post.tags.join(', ') : '',
});

const JournalEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryFormulaId = searchParams.get('formulaId') || 'none';
  const isEditMode = Boolean(id);
  const { getJournalPostById, createJournalPost, updateJournalPost } = useJournalPosts();
  const { getFormulas } = useFormulas();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formulas, setFormulas] = useState([]);
  const [formState, setFormState] = useState(createEmptyPost(queryFormulaId));

  useEffect(() => {
    let active = true;

    const loadEditor = async () => {
      setLoading(true);
      try {
        const [formulaRows, post] = await Promise.all([
          getFormulas(),
          isEditMode ? getJournalPostById(id) : Promise.resolve(null),
        ]);

        if (!active) {
          return;
        }

        const linkedFormula = formulaRows.find((formula) => formula.id === queryFormulaId);
        setFormulas(formulaRows);
        setFormState(post ? toEditorState(post) : createEmptyPost(queryFormulaId, linkedFormula?.name));
      } catch (error) {
        toast.error('Failed to load journal editor');
        navigate('/studio/journal');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadEditor();

    return () => {
      active = false;
    };
  }, [getFormulas, getJournalPostById, id, isEditMode, navigate, queryFormulaId]);

  const pageTitle = useMemo(
    () => (isEditMode ? 'Edit Journal - Solivagant' : 'New Journal - Solivagant'),
    [isEditMode]
  );

  const handleChange = (field, value) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from, { state: { restoreScroll: true } });
      return;
    }

    navigate('/studio/journal');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) {
      return;
    }

    if (!formState.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formState,
        related_formula_id: formState.related_formula_id === 'none' ? null : formState.related_formula_id,
      };

      const savedPost = isEditMode
        ? await updateJournalPost(id, payload)
        : await createJournalPost(payload);

      toast.success(isEditMode ? 'Artikel berhasil diperbarui' : 'Artikel berhasil disimpan');
      navigate(`/studio/journal/${savedPost.id}`);
    } catch (error) {
      toast.error(isEditMode ? 'Artikel belum bisa diperbarui' : 'Artikel belum bisa disimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content="Write or edit a perfumery journal note." />
      </Helmet>

      <div className="page-container space-y-6">
        <div>
          <Button variant="ghost" onClick={handleBack} className="mb-4 h-9 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Journal
          </Button>
        </div>

        <div className="rounded-[30px] border bg-[linear-gradient(135deg,rgba(255,255,255,0.97)_0%,rgba(246,241,232,0.98)_100%)] p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <BookOpenText className="h-3.5 w-3.5 text-primary" />
            Editor Journal
          </div>
          <h1 className="mt-4 text-3xl font-bold" style={{ letterSpacing: '-0.02em' }}>
            {isEditMode ? 'Edit artikel Journal.' : 'Tulis artikel Journal baru.'}
          </h1>
          <p className="mt-3 max-w-3xl text-base text-muted-foreground">
            Tulis catatan accord, pengalaman meracik, eksperimen, atau ide produk dengan struktur yang ringan.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-[28px] border bg-white/90 p-5 shadow-sm">
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Title</div>
                  <Input
                    value={formState.title}
                    onChange={(event) => handleChange('title', event.target.value)}
                    placeholder="Jasmine tea accord, Vetiver trial notes..."
                    className="h-11 rounded-2xl bg-white"
                    maxLength={160}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Excerpt</div>
                  <Textarea
                    value={formState.excerpt}
                    onChange={(event) => handleChange('excerpt', event.target.value)}
                    placeholder="Ringkasan singkat supaya mudah dipindai di daftar Journal."
                    className="min-h-[96px] rounded-2xl bg-white"
                    maxLength={320}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Content</div>
                  <Textarea
                    value={formState.content}
                    onChange={(event) => handleChange('content', event.target.value)}
                    placeholder={'Tulis pengalaman, formula accord, observasi material, atau ide yang ingin kamu simpan...\n\nGunakan # Heading, - list, atau > quote untuk formatting ringan.'}
                    className="min-h-[360px] rounded-2xl bg-white leading-relaxed"
                  />
                </div>
              </div>
            </div>

            <aside className="rounded-[28px] border bg-white/90 p-5 shadow-sm xl:sticky xl:top-6 xl:self-start">
              <div className="text-sm font-semibold">Pengaturan publikasi</div>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Category</div>
                  <Select value={formState.category} onValueChange={(value) => handleChange('category', value)}>
                    <SelectTrigger className="h-11 rounded-2xl bg-white">
                      <SelectValue placeholder="Choose category" />
                    </SelectTrigger>
                    <SelectContent>
                      {JOURNAL_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Status</div>
                  <Select value={formState.status} onValueChange={(value) => handleChange('status', value)}>
                    <SelectTrigger className="h-11 rounded-2xl bg-white">
                      <SelectValue placeholder="Choose status" />
                    </SelectTrigger>
                    <SelectContent>
                      {JOURNAL_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {formState.status === 'published'
                      ? 'Published akan tampil di halaman Artikel publik setelah disimpan.'
                      : 'Draft hanya tersimpan di Studio Journal dan belum tampil untuk pembeli.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Formula terkait</div>
                  <Select value={formState.related_formula_id} onValueChange={(value) => handleChange('related_formula_id', value)}>
                    <SelectTrigger className="h-11 rounded-2xl bg-white">
                      <SelectValue placeholder="Optional formula link" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa formula terkait</SelectItem>
                      {formulas.map((formula) => (
                        <SelectItem key={formula.id} value={formula.id}>
                          {formula.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Tags</div>
                  <Input
                    value={formState.tags}
                    onChange={(event) => handleChange('tags', event.target.value)}
                    placeholder="jasmine, tea, accord"
                    className="h-11 rounded-2xl bg-white"
                  />
                  <p className="text-xs text-muted-foreground">Pisahkan tag dengan koma.</p>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">SEO Title</div>
                  <Input
                    value={formState.seo_title}
                    onChange={(event) => handleChange('seo_title', event.target.value)}
                    placeholder="Optional public article title"
                    className="h-11 rounded-2xl bg-white"
                    maxLength={180}
                  />
                  <p className="text-xs text-muted-foreground">Disiapkan untuk halaman publik nanti. Kosongkan untuk memakai title utama.</p>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Cover Image URL</div>
                  <Input
                    value={formState.cover_image_url}
                    onChange={(event) => handleChange('cover_image_url', event.target.value)}
                    placeholder="https://..."
                    className="h-11 rounded-2xl bg-white"
                  />
                  <p className="text-xs text-muted-foreground">Opsional untuk tampilan blog ketika artikel dipublikasi.</p>
                </div>

                <Button type="submit" disabled={saving} className="h-11 w-full gap-2 rounded-2xl">
                  <Save className="h-4 w-4" />
                  {saving ? 'Menyimpan...' : isEditMode ? 'Update artikel' : 'Simpan artikel'}
                </Button>
              </div>
            </aside>
          </form>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default JournalEditorPage;
