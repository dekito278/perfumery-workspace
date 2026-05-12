import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Edit3, ImageOff, ImagePlus, Save, SlidersHorizontal, Trash2, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useBespokeSettings } from '@/hooks/useBespokeSettings.js';
import { uploadBespokeOptionImage } from '@/services/bespokeImageStorageService.js';
import { deleteBespokeOption, resetBespokeSettings, saveBespokeOption } from '@/services/bespokeSettingsService.js';
import { formatRupiah } from '@/services/productCatalogService.js';

const collections = [
  { key: 'bottleSizes', title: 'Ukuran botol', helper: '30 ml, 50 ml, dan harga dasar.' },
  { key: 'bottleTypes', title: 'Jenis botol', helper: 'Desain atau bentuk botol.' },
  { key: 'capDesigns', title: 'Desain cap', helper: 'Cap biasa, cap batu, custom akrilik.' },
  { key: 'labelDesigns', title: 'Desain label', helper: 'Label minimal, custom name, atau style lain.' },
  { key: 'exoticMaterials', title: 'Material eksotik', helper: 'Bahan tambahan yang menambah harga.' },
];

const emptyOption = {
  id: '',
  label: '',
  value: '',
  price: 0,
  description: '',
  imageUrl: '',
  enabled: true,
};

const MobileBespokeSettingsPage = () => {
  const settings = useBespokeSettings();
  const [activeCollection, setActiveCollection] = useState('bottleSizes');
  const [form, setForm] = useState(emptyOption);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const collection = collections.find((item) => item.key === activeCollection) || collections[0];
  const options = settings[activeCollection] || [];

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const resetForm = () => setForm(emptyOption);

  const handleEdit = (option) => setForm(option);

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const imageUrl = await uploadBespokeOptionImage(file, activeCollection, form.label || collection.title);
      updateField('imageUrl', imageUrl);
      toast.success('Gambar opsi tersimpan');
    } catch (error) {
      toast.error(error.message || 'Upload gambar gagal');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.label.trim()) {
      toast.error('Nama opsi wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const savedOption = await saveBespokeOption(activeCollection, {
        ...form,
        value: form.value || form.label,
        price: Number(form.price || 0),
      });
      setForm(savedOption);
      toast.success('Opsi bespoke tersimpan');
    } catch (error) {
      toast.error('Opsi bespoke gagal tersimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (option) => {
    setSaving(true);
    try {
      await deleteBespokeOption(activeCollection, option.id);
      if (form.id === option.id) resetForm();
      toast.success('Opsi dihapus');
    } catch (error) {
      toast.error('Opsi gagal dihapus');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await resetBespokeSettings();
      resetForm();
      toast.success('Bespoke settings dikembalikan ke default');
    } catch (error) {
      toast.error('Bespoke settings gagal direset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>Bespoke Settings - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title="Bespoke" subtitle="Custom wizard settings" eyebrow="E-commerce" action={<WandSparkles className="h-5 w-5 text-amber-700" />} />

        <section className="mobile-soft-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-[#263d27]">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-[#1f2937]">Atur step bespoke</h1>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                Semua opsi aktif akan muncul di wizard customer, dan harga otomatis masuk ke estimasi.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {collections.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveCollection(item.key);
                  resetForm();
                }}
                className={`min-h-[48px] rounded-2xl border px-3 py-2 text-left text-xs font-bold ${activeCollection === item.key ? 'border-[#263d27] bg-[#eef2e8] text-[#263d27]' : 'border-[#e5e7eb] bg-white text-[#6b7280]'}`}
              >
                {item.title}
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-xs font-semibold leading-relaxed text-[#6b7280]">
            Urutannya mengikuti wizard customer: ukuran botol, jenis botol, desain cap, desain label, lalu material eksotik opsional.
          </div>
        </section>

        <form onSubmit={handleSubmit} className="mobile-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#1f2937]">{form.id ? `Edit ${collection.title}` : `Tambah ${collection.title}`}</h2>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">{collection.helper}</p>
            </div>
            <Button type="button" variant="outline" className="h-9 rounded-2xl bg-white px-3 text-xs" onClick={resetForm}>New</Button>
          </div>
          <div className="mt-3 grid gap-2">
            <input value={form.label} onChange={(event) => updateField('label', event.target.value)} placeholder="Nama opsi" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <input value={form.value} onChange={(event) => updateField('value', event.target.value)} placeholder="Value internal, boleh sama dengan nama" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <input type="number" value={form.price} onChange={(event) => updateField('price', Number(event.target.value))} placeholder="Harga tambahan" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Deskripsi pendek untuk customer" rows={3} className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <div className="rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
              {form.imageUrl ? (
                <div className="relative overflow-hidden rounded-2xl border bg-white">
                  <img src={form.imageUrl} alt={form.label || 'Bespoke option'} className="h-36 w-full object-cover" loading="lazy" decoding="async" fetchPriority="low" width="360" height="144" />
                  <button type="button" onClick={() => updateField('imageUrl', '')} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-rose-700" aria-label="Remove option image">
                    <ImageOff className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="grid h-28 place-items-center rounded-2xl border border-dashed bg-white text-center text-xs font-bold text-[#6b7280]">
                  Belum ada gambar
                </div>
              )}
              <label className="mt-3 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border bg-white px-3 text-xs font-bold">
                <ImagePlus className="h-4 w-4" />
                {uploadingImage ? 'Uploading...' : 'Upload gambar'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
              <input value={form.imageUrl} onChange={(event) => updateField('imageUrl', event.target.value)} placeholder="Atau paste Image URL" className="mt-2 h-12 w-full rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-[#6b7280]">
                Untuk botol, cap, label, atau material. Upload otomatis dikompres ke WebP ringan.
              </p>
            </div>
            <label className="flex items-center gap-3 rounded-2xl bg-[#f8f7f4] px-3 py-3 text-xs font-bold text-[#1f2937]">
              <input type="checkbox" checked={Boolean(form.enabled)} onChange={(event) => updateField('enabled', event.target.checked)} />
              Tampilkan ke customer
            </label>
            <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={saving}><Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save option'}</Button>
          </div>
        </form>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#1f2937]">{collection.title}</h2>
              <p className="text-xs font-semibold text-[#6b7280]">{options.length} opsi</p>
            </div>
            <Button type="button" variant="ghost" className="h-9 px-2 text-xs" onClick={handleReset} disabled={saving}>Reset</Button>
          </div>
          {options.map((option) => (
            <article key={option.id} className="mobile-card p-3">
              <div className="flex items-start justify-between gap-3">
                {option.imageUrl ? <img src={option.imageUrl} alt={option.label} className="h-16 w-16 shrink-0 rounded-2xl object-cover" loading="lazy" decoding="async" fetchPriority="low" width="64" height="64" /> : null}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-[#1f2937]">{option.label}</h3>
                  <p className="mt-1 text-xs font-semibold leading-snug text-[#6b7280]">{option.description || '-'}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase text-amber-700">
                    {formatRupiah(option.price)} / {option.enabled ? 'active' : 'hidden'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl bg-white" onClick={() => handleEdit(option)} aria-label={`Edit ${option.label}`} disabled={saving}><Edit3 className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => handleDelete(option)} aria-label={`Delete ${option.label}`} disabled={saving}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </article>
          ))}
          {!options.length ? (
            <div className="mobile-card p-5 text-center">
              <h3 className="font-bold text-[#1f2937]">Belum ada opsi</h3>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Tambah opsi baru dari form di atas.</p>
            </div>
          ) : null}
        </section>
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileBespokeSettingsPage;
