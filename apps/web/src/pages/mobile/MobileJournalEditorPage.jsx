import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileFormField from '@/components/mobile-ui/MobileFormField.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
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

const MobileJournalEditorPage = () => {
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
        toast.error('Editor artikel belum bisa dimuat');
        navigate('/mobile/journal');
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
    () => (isEditMode ? 'Edit Artikel Mobile - Solivagant' : 'Artikel Mobile Baru - Solivagant'),
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

    navigate('/mobile/journal');
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (saving) {
      return;
    }

    if (!formState.title.trim()) {
      toast.error('Judul artikel wajib diisi');
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

      toast.success(isEditMode ? 'Artikel diperbarui' : 'Artikel disimpan');
      navigate(`/mobile/journal/${savedPost.id}`);
    } catch (error) {
      toast.error(isEditMode ? 'Artikel belum bisa diperbarui' : 'Artikel belum bisa disimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileAuthenticatedLayout>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content="Mobile editor for perfumery journal notes." />
      </Helmet>

      <MobileTopBar
        title={isEditMode ? 'Edit artikel' : 'Buat artikel'}
        subtitle="Editor artikel"
        eyebrow="Studio"
        onBack={handleBack}
      />

      {loading ? (
        <MobileLoadingSkeleton title="Memuat editor" subtitle="Menyiapkan formula dan detail artikel." />
      ) : (
        <form id="mobile-journal-editor-form" onSubmit={handleSubmit} className="space-y-4 pb-5">
          <section className="space-y-4 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
            <MobileFormField id="journal-title" label="Judul">
              <Input
                id="journal-title"
                value={formState.title}
                onChange={(event) => handleChange('title', event.target.value)}
                placeholder="Jasmine tea accord..."
                className="h-11 rounded-2xl bg-white"
                maxLength={160}
                required
              />
            </MobileFormField>

            <MobileFormField id="journal-category" label="Kategori">
              <Select value={formState.category} onValueChange={(value) => handleChange('category', value)}>
                <SelectTrigger id="journal-category" className="h-11 rounded-2xl bg-white">
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
            </MobileFormField>

            <MobileFormField id="journal-status" label="Status">
              <MobileSegmentedControl
                options={JOURNAL_STATUSES}
                value={formState.status}
                onChange={(value) => handleChange('status', value)}
              />
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">
                {formState.status === 'published'
                  ? 'Published akan tampil di halaman Artikel publik setelah disimpan.'
                  : 'Draft hanya tersimpan di Studio Journal dan belum tampil untuk pembeli.'}
              </p>
            </MobileFormField>

            <MobileFormField id="journal-related-formula" label="Formula terkait" helper="Opsional, boleh dikosongkan.">
              <Select value={formState.related_formula_id} onValueChange={(value) => handleChange('related_formula_id', value)}>
                <SelectTrigger id="journal-related-formula" className="h-11 rounded-2xl bg-white">
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
            </MobileFormField>
          </section>

          <section className="space-y-4 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
            <MobileFormField id="journal-excerpt" label="Ringkasan">
              <Textarea
                id="journal-excerpt"
                value={formState.excerpt}
                onChange={(event) => handleChange('excerpt', event.target.value)}
                placeholder="Ringkasan singkat untuk daftar Journal."
                className="min-h-[92px] rounded-2xl bg-white"
                maxLength={320}
              />
            </MobileFormField>

            <MobileFormField id="journal-content" label="Isi artikel">
              <Textarea
                id="journal-content"
                value={formState.content}
                onChange={(event) => handleChange('content', event.target.value)}
                placeholder={'Tulis pengalaman, accord, observasi material, atau ide produk...\n\nBisa pakai # Heading, - list, atau > quote.'}
                className="min-h-[280px] rounded-2xl bg-white leading-relaxed"
              />
            </MobileFormField>

            <MobileFormField id="journal-tags" label="Tag" helper="Pisahkan tag dengan koma.">
              <Input
                id="journal-tags"
                value={formState.tags}
                onChange={(event) => handleChange('tags', event.target.value)}
                placeholder="jasmine, tea, accord"
                className="h-11 rounded-2xl bg-white"
              />
            </MobileFormField>

            <MobileFormField id="journal-seo-title" label="Judul SEO" helper="Opsional untuk halaman publik nanti.">
              <Input
                id="journal-seo-title"
                value={formState.seo_title}
                onChange={(event) => handleChange('seo_title', event.target.value)}
                placeholder="Optional public title"
                className="h-11 rounded-2xl bg-white"
                maxLength={180}
              />
            </MobileFormField>

            <MobileFormField id="journal-cover-image" label="URL cover image" helper="Opsional untuk rasa blog sungguhan.">
              <Input
                id="journal-cover-image"
                value={formState.cover_image_url}
                onChange={(event) => handleChange('cover_image_url', event.target.value)}
                placeholder="https://..."
                className="h-11 rounded-2xl bg-white"
              />
            </MobileFormField>
          </section>

          <StickyBottomActionBar fixed reserveSpace keyboardBehavior="stay" aria-label="Journal editor actions">
            <div className="grid grid-cols-[0.8fr_1fr] gap-2">
              <Button type="button" variant="outline" onClick={handleBack} className="h-11 rounded-2xl bg-white">
                Batal
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={saving} className="h-11 gap-2 rounded-2xl">
                <Save className="h-4 w-4" />
                {saving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </StickyBottomActionBar>
        </form>
      )}
    </MobileAuthenticatedLayout>
  );
};

export default MobileJournalEditorPage;
