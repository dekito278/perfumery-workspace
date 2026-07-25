import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Trash2, Upload, GripVertical, Eye, EyeOff,
  Music, Video, Type, Image, Quote, Columns, Save, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import {
  fetchStory,
  fetchAllStories,
  upsertStory,
  deleteStory,
  uploadStoryMedia,
  deleteStoryMedia,
} from '@/services/productStoryService.js';
import { invalidateStoryCache } from '@/hooks/useProductStory.js';

const SECTION_TYPES = [
  { type: 'quote', label: 'Quote', icon: Quote },
  { type: 'text-image', label: 'Teks + Gambar', icon: Columns },
  { type: 'full-bleed', label: 'Full Bleed Image', icon: Image },
];

const DEFAULT_COLORS = { bg: '#1a0f14', text: '#f5ede4', accent: '#c4917b' };

const emptyStory = (slug) => ({
  enabled: true,
  colors: { ...DEFAULT_COLORS },
  hero: { eyebrow: '', headline: '', headlineScript: '', subtitle: '' },
  music: { src: null, label: '' },
  video: { src: null, poster: null },
  sections: [],
  _slug: slug,
});

const storyFromRow = (row) => ({
  enabled: row.enabled,
  colors: { bg: row.color_bg, text: row.color_text, accent: row.color_accent },
  hero: {
    eyebrow: row.hero_eyebrow || '',
    headline: row.hero_headline || '',
    headlineScript: row.hero_headline_script || '',
    subtitle: row.hero_subtitle || '',
  },
  music: { src: row.music_url || null, label: row.music_label || '' },
  video: { src: row.video_url || null, poster: row.video_poster_url || null },
  sections: row.sections || [],
  _slug: row.product_slug,
});

// ── Color Swatch ──
const ColorInput = ({ label, value, onChange }) => (
  <label className="story-editor__color">
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    <span>{label}</span>
    <code>{value}</code>
  </label>
);

// ── Media Upload Button ──
const MediaUploadButton = ({ slug, category, accept, label, currentUrl, onUploaded }) => {
  const ref = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadStoryMedia(slug, category, file);
      onUploaded(url);
      toast.success(`${label} berhasil diupload`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  };

  const handleRemove = async () => {
    try {
      await deleteStoryMedia(slug, category);
      onUploaded(null);
      toast.success(`${label} dihapus`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="story-editor__media-upload">
      <div className="story-editor__media-label">{label}</div>
      {currentUrl ? (
        <div className="story-editor__media-preview">
          {accept.startsWith('image') ? (
            <img src={currentUrl} alt={label} />
          ) : accept.startsWith('audio') ? (
            <audio src={currentUrl} controls preload="none" />
          ) : (
            <video src={currentUrl} controls preload="none" style={{ maxWidth: '200px' }} />
          )}
          <div className="story-editor__media-actions">
            <Button size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={uploading}>
              <Upload className="h-3 w-3" /> Ganti
            </Button>
            <Button size="sm" variant="outline" onClick={handleRemove}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={uploading}>
          <Upload className="h-3 w-3" /> {uploading ? 'Uploading...' : `Upload ${label}`}
        </Button>
      )}
      <input ref={ref} type="file" accept={accept} onChange={handleFile} hidden />
    </div>
  );
};

// ── Section Editor ──
const SectionEditor = ({ section, index, slug, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const update = (key, value) => onChange(index, { ...section, [key]: value });
  const TypeIcon = SECTION_TYPES.find((t) => t.type === section.type)?.icon || Type;

  return (
    <div className="story-editor__section">
      <div className="story-editor__section-header">
        <div className="story-editor__section-drag">
          <button type="button" onClick={onMoveUp} disabled={isFirst} aria-label="Pindah ke atas">&#9650;</button>
          <button type="button" onClick={onMoveDown} disabled={isLast} aria-label="Pindah ke bawah">&#9660;</button>
        </div>
        <TypeIcon className="h-4 w-4" />
        <span className="story-editor__section-type">
          {SECTION_TYPES.find((t) => t.type === section.type)?.label || section.type}
        </span>
        <button type="button" className="story-editor__section-remove" onClick={onRemove} aria-label="Hapus section">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="story-editor__section-body">
        {section.type === 'quote' ? (
          <textarea
            value={section.text || ''}
            onChange={(e) => update('text', e.target.value)}
            placeholder="Tulis quote..."
            rows={3}
          />
        ) : section.type === 'text-image' ? (
          <>
            <div className="story-editor__row">
              <label>
                Layout
                <select value={section.layout || 'image-right'} onChange={(e) => update('layout', e.target.value)}>
                  <option value="image-right">Gambar kanan</option>
                  <option value="image-left">Gambar kiri</option>
                </select>
              </label>
            </div>
            <input
              type="text"
              value={section.eyebrow || ''}
              onChange={(e) => update('eyebrow', e.target.value)}
              placeholder="Eyebrow (contoh: TENTANG AROMA)"
            />
            <input
              type="text"
              value={section.heading || ''}
              onChange={(e) => update('heading', e.target.value)}
              placeholder="Heading"
            />
            <textarea
              value={section.body || ''}
              onChange={(e) => update('body', e.target.value)}
              placeholder="Body text..."
              rows={4}
            />
            <MediaUploadButton
              slug={slug}
              category={`section-${section.id}`}
              accept="image/*"
              label="Gambar Section"
              currentUrl={section.image}
              onUploaded={(url) => update('image', url)}
            />
          </>
        ) : section.type === 'full-bleed' ? (
          <>
            <MediaUploadButton
              slug={slug}
              category={`section-${section.id}`}
              accept="image/*"
              label="Full Bleed Image"
              currentUrl={section.image}
              onUploaded={(url) => update('image', url)}
            />
            <input
              type="text"
              value={section.caption || ''}
              onChange={(e) => update('caption', e.target.value)}
              placeholder="Caption (opsional)"
            />
          </>
        ) : null}
      </div>
    </div>
  );
};

// Section media is stored at `${slug}/section-${id}.ext`. Keying by a STABLE id (not the array
// index) means reordering sections no longer makes a replacement overwrite another section's file.
const makeSectionId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `s-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
);

const withSectionIds = (storyObj) => (
  storyObj
    ? { ...storyObj, sections: (storyObj.sections || []).map((s) => (s.id ? s : { ...s, id: makeSectionId() })) }
    : storyObj
);

// ── Main Page ──
const StoryEditorPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSlug = searchParams.get('product') || '';
  const catalogProducts = useCatalogProducts();
  const products = catalogProducts.filter(isProductVisibleInStorefront);

  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingStories, setExistingStories] = useState([]);
  const [showAddSection, setShowAddSection] = useState(false);

  useEffect(() => {
    fetchAllStories().then(setExistingStories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSlug) { setStory(null); return; }
    setLoading(true);
    fetchStory(selectedSlug)
      .then((row) => {
        setStory(withSectionIds(row ? storyFromRow(row) : emptyStory(selectedSlug)));
      })
      .catch(() => setStory(withSectionIds(emptyStory(selectedSlug))))
      .finally(() => setLoading(false));
  }, [selectedSlug]);

  const selectProduct = (slug) => {
    setSearchParams(slug ? { product: slug } : {});
  };

  const updateStory = useCallback((path, value) => {
    setStory((prev) => {
      if (!prev) return prev;
      const keys = path.split('.');
      const next = JSON.parse(JSON.stringify(prev));
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  }, []);

  const updateSection = useCallback((index, section) => {
    setStory((prev) => {
      if (!prev) return prev;
      const sections = [...prev.sections];
      sections[index] = section;
      return { ...prev, sections };
    });
  }, []);

  const addSection = (type) => {
    const base = { type, id: makeSectionId() };
    if (type === 'quote') base.text = '';
    if (type === 'text-image') Object.assign(base, { layout: 'image-right', eyebrow: '', heading: '', body: '', image: null });
    if (type === 'full-bleed') Object.assign(base, { image: null, caption: '' });
    setStory((prev) => prev ? { ...prev, sections: [...prev.sections, base] } : prev);
    setShowAddSection(false);
  };

  const removeSection = (index) => {
    setStory((prev) => prev ? { ...prev, sections: prev.sections.filter((_, i) => i !== index) } : prev);
  };

  const moveSection = (index, direction) => {
    setStory((prev) => {
      if (!prev) return prev;
      const sections = [...prev.sections];
      const target = index + direction;
      if (target < 0 || target >= sections.length) return prev;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...prev, sections };
    });
  };

  const handleSave = async () => {
    if (!story || !selectedSlug) return;
    setSaving(true);
    try {
      await upsertStory(selectedSlug, story);
      invalidateStoryCache(selectedSlug);
      toast.success('Story tersimpan!');
      fetchAllStories().then(setExistingStories).catch(() => {});
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSlug) return;
    if (!window.confirm('Hapus story page untuk produk ini?')) return;
    try {
      await deleteStory(selectedSlug);
      invalidateStoryCache(selectedSlug);
      setStory(null);
      selectProduct('');
      toast.success('Story dihapus');
      fetchAllStories().then(setExistingStories).catch(() => {});
    } catch (err) {
      toast.error(err.message);
    }
  };

  const slugify = (name) => String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  return (
    <AuthenticatedLayout>
      <Helmet><title>Story Editor — SOLIVAGANT Studio</title></Helmet>
      <div className="story-editor">
        <div className="story-editor__top">
          <div>
            <h1>Story Editor</h1>
            <p>Buat halaman immersive untuk setiap produk — cerita, musik, video, warna.</p>
          </div>
        </div>

        {/* Product selector */}
        <div className="story-editor__selector">
          <label>
            Pilih Produk
            <select value={selectedSlug} onChange={(e) => selectProduct(e.target.value)}>
              <option value="">— Pilih produk —</option>
              {products.map((p) => {
                const s = slugify(p.slug || p.name || p.id);
                const hasStory = existingStories.some((st) => st.product_slug === s);
                return (
                  <option key={p.id || s} value={s}>
                    {p.name} {hasStory ? '✦' : ''}
                  </option>
                );
              })}
            </select>
          </label>
          {selectedSlug ? (
            <a
              href={`/catalog/${selectedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="story-editor__preview-link"
            >
              <Eye className="h-4 w-4" /> Preview
            </a>
          ) : null}
        </div>

        {loading ? <p className="story-editor__loading">Memuat story...</p> : null}

        {story && !loading ? (
          <div className="story-editor__form">
            {/* Enable toggle */}
            <div className="story-editor__toggle">
              <label>
                <input
                  type="checkbox"
                  checked={story.enabled}
                  onChange={(e) => updateStory('enabled', e.target.checked)}
                />
                Immersive page aktif
              </label>
            </div>

            {/* ── Colors ── */}
            <fieldset className="story-editor__fieldset">
              <legend>Color World</legend>
              <div className="story-editor__colors">
                <ColorInput label="Background" value={story.colors.bg} onChange={(v) => updateStory('colors.bg', v)} />
                <ColorInput label="Teks" value={story.colors.text} onChange={(v) => updateStory('colors.text', v)} />
                <ColorInput label="Aksen" value={story.colors.accent} onChange={(v) => updateStory('colors.accent', v)} />
              </div>
              <div className="story-editor__color-preview" style={{
                background: story.colors.bg,
                color: story.colors.text,
                borderColor: story.colors.accent,
              }}>
                <span style={{ color: story.colors.accent }}>EYEBROW</span>
                <strong>Headline Preview</strong>
                <span>Body text preview</span>
              </div>
            </fieldset>

            {/* ── Hero ── */}
            <fieldset className="story-editor__fieldset">
              <legend>Hero</legend>
              <input
                type="text"
                value={story.hero.eyebrow}
                onChange={(e) => updateStory('hero.eyebrow', e.target.value)}
                placeholder="Eyebrow (contoh: Sebuah surat yang tak pernah terkirim)"
              />
              <input
                type="text"
                value={story.hero.headline}
                onChange={(e) => updateStory('hero.headline', e.target.value)}
                placeholder="Headline (nama tampil di hero)"
              />
              <input
                type="text"
                value={story.hero.headlineScript}
                onChange={(e) => updateStory('hero.headlineScript', e.target.value)}
                placeholder="Aksara/script (opsional, contoh: ꦲꦪꦤ꧀ꦒ꧀)"
              />
              <textarea
                value={story.hero.subtitle}
                onChange={(e) => updateStory('hero.subtitle', e.target.value)}
                placeholder="Subtitle (tagline emosional)"
                rows={2}
              />
            </fieldset>

            {/* ── Music ── */}
            <fieldset className="story-editor__fieldset">
              <legend><Music className="h-4 w-4" /> Background Music</legend>
              <MediaUploadButton
                slug={selectedSlug}
                category="music"
                accept="audio/mpeg,audio/mp4,audio/ogg"
                label="Musik"
                currentUrl={story.music.src}
                onUploaded={(url) => updateStory('music.src', url)}
              />
              <input
                type="text"
                value={story.music.label}
                onChange={(e) => updateStory('music.label', e.target.value)}
                placeholder="Label musik (contoh: Ambient — Gamelan Sunyi)"
              />
            </fieldset>

            {/* ── Video ── */}
            <fieldset className="story-editor__fieldset">
              <legend><Video className="h-4 w-4" /> Floating Video</legend>
              <MediaUploadButton
                slug={selectedSlug}
                category="video"
                accept="video/mp4,video/webm"
                label="Video"
                currentUrl={story.video.src}
                onUploaded={(url) => updateStory('video.src', url)}
              />
              <MediaUploadButton
                slug={selectedSlug}
                category="video-poster"
                accept="image/*"
                label="Video Poster"
                currentUrl={story.video.poster}
                onUploaded={(url) => updateStory('video.poster', url)}
              />
            </fieldset>

            {/* ── Sections ── */}
            <fieldset className="story-editor__fieldset">
              <legend>Story Sections</legend>
              {story.sections.length === 0 ? (
                <p className="story-editor__empty">Belum ada section. Tambah section pertama di bawah.</p>
              ) : null}
              {story.sections.map((section, i) => (
                <SectionEditor
                  key={i}
                  section={section}
                  index={i}
                  slug={selectedSlug}
                  onChange={updateSection}
                  onRemove={() => removeSection(i)}
                  onMoveUp={() => moveSection(i, -1)}
                  onMoveDown={() => moveSection(i, 1)}
                  isFirst={i === 0}
                  isLast={i === story.sections.length - 1}
                />
              ))}

              <div className="story-editor__add-section">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddSection(!showAddSection)}
                >
                  <Plus className="h-3.5 w-3.5" /> Tambah Section <ChevronDown className="h-3 w-3" />
                </Button>
                {showAddSection ? (
                  <div className="story-editor__add-menu">
                    {SECTION_TYPES.map((t) => (
                      <button key={t.type} type="button" onClick={() => addSection(t.type)}>
                        <t.icon className="h-4 w-4" /> {t.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </fieldset>

            {/* ── Actions ── */}
            <div className="story-editor__actions">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan Story'}
              </Button>
              <Button variant="outline" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" /> Hapus Story
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </AuthenticatedLayout>
  );
};

export default StoryEditorPage;
