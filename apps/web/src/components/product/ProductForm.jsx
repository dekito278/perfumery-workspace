import TestimonialsField from '@/components/product/TestimonialsField.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import { compareAtPriceNote } from '@/utils/compareAtPrice.js';
import LocalizedNumberInput from '@/components/LocalizedNumberInput.jsx';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ExternalLink, ImageOff, ImagePlus, PackagePlus, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { autoTierPriceMessage } from '@/utils/autoTierPrices.js';
import { Button } from '@/components/ui/button.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { getScheduledPricesForProduct } from '@/services/priceScheduleService.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning.js';
import {
  buildStockCorrection,
  formatRupiah,
  getProductPublishChecklist,
  getPrimaryVariant,
  getProductSlugConflicts,
  getProductStorefrontPath,
  normalizeProduct,
  PRODUCT_DRAFT_TAG,
  saveCustomProduct,
} from '@/services/productCatalogService.js';
import { deleteProductImages, uploadProductImage } from '@/services/productImageStorageService.js';
import WearPicker from '@/components/product/WearPicker.jsx';
import RelatedFragrancePicker from '@/components/product/RelatedFragrancePicker.jsx';
import TierPriceEditor from '@/components/product/TierPriceEditor.jsx';
import { confirmAction } from '@/utils/confirmAction.js';
import { snapshotProductForm } from '@/utils/productFormSnapshot.js';
import { toProductFormState } from '@/utils/productFormState.js';

export const emptyProduct = {
  name: '',
  category: '',
  priceNumber: 289000,
  compareAtPriceNumber: 0,
  stock: 10,
  restockThreshold: 5,
  stockAdjustmentNote: '',
  stockCorrections: [],
  size: '30 ml',
  variants: [
    { id: '10-ml', size: '10 ml', priceNumber: 129000, compareAtPriceNumber: 0, stock: 5 },
    { id: '30-ml', size: '30 ml', priceNumber: 289000, compareAtPriceNumber: 0, stock: 10 },
  ],
  notes: '',
  topNotes: '',
  heartNotes: '',
  baseNotes: '',
  description: '',
  descriptionEn: '',
  notesEn: '',
  topNotesEn: '',
  heartNotesEn: '',
  baseNotesEn: '',
  concentration: 'Eau de Parfum',
  relatedFragrances: [],
  imageUrl: '',
  images: [],
  tags: '',
  mood: '',
  intensity: 'Medium',
  launchYear: '',
  wear: {},
  featured: true,
  limited: false,
  reserve: false,
  testimonials: [],
  catalogVisible: true,
};

// One builder for both layouts — see utils/productFormState.js for what drifted and why.
export const toEditableProduct = toProductFormState;

const getTagsForVisibility = (tags, catalogVisible) => {
  const nextTags = String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => tag.toLowerCase() !== PRODUCT_DRAFT_TAG.toLowerCase());

  if (!catalogVisible) {
    nextTags.unshift(PRODUCT_DRAFT_TAG);
  }

  return [...new Set(nextTags)];
};


// The schedule box used to print the raw row: "retail (30-ml) → Rp 569.000".
const SCHEDULED_TIER_NAMES = { retail: 'Harga retail', member: 'Harga member', reseller: 'Harga reseller', overseas: 'Harga luar negeri' };
const scheduledPriceLabel = (row, variants = []) => {
  const size = (variants || []).find((variant) => String(variant.id) === String(row.variantId))?.size || row.variantId;
  return [SCHEDULED_TIER_NAMES[row.tier] || row.tier, size].filter(Boolean).join(' · ');
};

/**
 * Shared create/edit product form. `product` null → create; a product object → edit.
 * `onSaved(savedProduct)` fires after a successful save so the parent page can navigate.
 * `backTo` draws the way back to the list INSIDE the form, where it can ask before throwing away edits:
 * the pages' own back button navigated straight out, past the "Belum disimpan" badge, without a word.
 */
const ProductForm = ({ product = null, onSaved, backTo = '' }) => {
  const navigate = useNavigate();
  const products = useCatalogProducts();
  const categories = useStorefrontCategories(products);
  const initialForm = useMemo(() => (product ? toEditableProduct(product) : emptyProduct), [product]);

  const [form, setForm] = useState(initialForm);
  const [savedFormSnapshot, setSavedFormSnapshot] = useState(() => snapshotProductForm(initialForm));
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  // Re-seed when the edited product resolves (e.g. catalog finished loading on a deep-linked edit URL).
  useEffect(() => {
    setForm(initialForm);
    setSavedFormSnapshot(snapshotProductForm(initialForm));
  }, [initialForm]);

  const publishChecklist = useMemo(() => getProductPublishChecklist(form), [form]);
  const canPublish = publishChecklist.ready;
  const currentFormSnapshot = useMemo(() => snapshotProductForm(form), [form]);
  const hasUnsavedChanges = currentFormSnapshot !== savedFormSnapshot;
  const slugConflicts = useMemo(() => getProductSlugConflicts(form, products), [form, products]);
  // Stock lives per-variant; the product-level number is just their sum. Single source of truth so the
  // storefront (which reads variant stock) never disagrees with what admin shows.
  const variantStockTotal = (form.variants || []).reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
  // What the catalog will show. Derived, never typed: the save has taken it from the variants since #124,
  // so an editable field here was a box that quietly did nothing.
  const primaryPrice = Number(getPrimaryVariant(form.variants || [])?.priceNumber || form.priceNumber || 0);
  const primarySize = getPrimaryVariant(form.variants || [])?.size || form.size;

  // A price with a date on it, which this form cannot otherwise show. storefront_prices_for_me prefers a
  // dated row over an undated one, so once the date has passed the shop charges the scheduled number and
  // the field above goes on accepting edits that change nothing a buyer sees. Until 2026-10-23 that
  // happened in silence; whatever the schedule holds, this says so.
  const [scheduledPrices, setScheduledPrices] = useState([]);
  useEffect(() => {
    let active = true;
    if (!product?.id) { setScheduledPrices([]); return () => { active = false; }; }
    getScheduledPricesForProduct(product.id).then((rows) => { if (active) setScheduledPrices(rows); });
    return () => { active = false; };
  }, [product?.id]);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateVariant = (index, key, value) => setForm((current) => ({
    ...current,
    variants: current.variants.map((variant, variantIndex) => (
      variantIndex === index ? { ...variant, [key]: ['priceNumber', 'compareAtPriceNumber', 'stock'].includes(key) ? Number(value) : value } : variant
    )),
  }));
  const addVariant = () => setForm((current) => ({
    ...current,
    variants: [...current.variants, {
      id: `variant-${Date.now()}`,
      size: '50 ml',
      // Seeded from the bottle that represents the product, since the product-level price is no longer
      // an input anyone can edit — it is derived from these rows.
      priceNumber: Number(getPrimaryVariant(current.variants || [])?.priceNumber || current.priceNumber || 0),
      compareAtPriceNumber: Number(getPrimaryVariant(current.variants || [])?.compareAtPriceNumber || 0),
      stock: 0,
    }],
  }));
  const removeVariant = (index) => setForm((current) => ({
    ...current,
    variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
  }));

  // Every way out asks while the form differs from what was saved: back button, sidebar, back gesture, tab close.
  useUnsavedChangesWarning(hasUnsavedChanges, 'Ada perubahan produk yang belum disimpan. Tinggalkan halaman ini dan buang perubahannya?');

  const confirmDiscardChanges = async () => (
    !hasUnsavedChanges || confirmAction({
      title: 'Buang perubahan?',
      message: 'Ada perubahan produk yang belum disimpan. Lanjut dan buang perubahan?',
      confirmText: 'Buang',
      destructive: true,
    })
  );

  const resetForm = async () => {
    if (!await confirmDiscardChanges()) return;
    setForm(initialForm);
    setSavedFormSnapshot(snapshotProductForm(initialForm));
  };

  const leaveForm = () => navigate(backTo);

  const updateImagesFromText = (value) => {
    const images = value.split('\n').map((item) => item.trim()).filter(Boolean);
    setForm((current) => ({ ...current, images, imageUrl: images[0] || '' }));
  };
  // One tap to change the catalogue cover (the first photo). It used to mean reordering lines of URLs in the
  // text box below — and six live perfumes led with a white name card on a dark shop (audit, 13 Nov 2026).
  const makeCover = (imageUrl) => setForm((current) => {
    const images = [imageUrl, ...(current.images || []).filter((image) => image !== imageUrl)];
    return { ...current, images, imageUrl: images[0] || '' };
  });
  const removeImage = (imageUrl) => setForm((current) => {
    const images = (current.images || []).filter((image) => image !== imageUrl);
    return { ...current, images, imageUrl: images[0] || '' };
  });

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    setUploadingImage(true);
    try {
      const uploadedImages = await Promise.all(files.map((file) => uploadProductImage(file, form.name)));
      setForm((current) => {
        const images = [...new Set([...(current.images || []), ...uploadedImages])];
        return { ...current, images, imageUrl: images[0] || '' };
      });
      toast.success('Foto produk diupload');
    } catch (error) {
      toast.error(error.message || 'Gagal upload foto produk');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.category.trim() || !form.notes.trim()) {
      toast.error('Nama produk, kategori, dan ringkasan aroma wajib diisi');
      return;
    }
    if (form.catalogVisible && !publishChecklist.ready) {
      toast.error(`Produk belum siap tampil di toko: ${publishChecklist.blocking[0]?.message || 'lengkapi data wajib.'}`);
      return;
    }

    setSavingProduct(true);
    try {
      const previousProduct = products.find((item) => item.id === form.id);
      const stockCorrection = buildStockCorrection({ form, previousProduct });
      const stockCorrections = stockCorrection
        ? [stockCorrection, ...(form.stockCorrections || [])]
        : (form.stockCorrections || []);
      const saved = await saveCustomProduct({
        ...form,
        internalTags: form.internalTags,
        restockThreshold: Number(form.restockThreshold || 0),
        stockCorrections,
        tags: getTagsForVisibility(form.tags, form.catalogVisible),
        priceNumber: Number(getPrimaryVariant(form.variants || [])?.priceNumber || form.priceNumber || 0),
        compareAtPriceNumber: Number(getPrimaryVariant(form.variants || [])?.compareAtPriceNumber || 0),
        stock: variantStockTotal,
        size: getPrimaryVariant(form.variants || [])?.size || form.size,
        price: formatRupiah(form.priceNumber),
      });
      const nextForm = toEditableProduct(saved);
      // Save-time reconciliation: drop storage files for images that were on the product before but
      // are no longer referenced after this save, so removed/replaced images aren't orphaned.
      const savedImages = new Set(saved.images || []);
      const removedImages = (previousProduct?.images || []).filter((url) => !savedImages.has(url));
      if (removedImages.length) {
        deleteProductImages(removedImages).catch((cleanupError) => console.warn('Product image cleanup skipped:', cleanupError.message || cleanupError));
      }
      setForm(nextForm);
      setSavedFormSnapshot(snapshotProductForm(nextForm));
      toast.success(stockCorrection ? 'Produk tersimpan dan koreksi stok dicatat' : form.catalogVisible ? 'Produk tersimpan dan tampil di katalog' : 'Produk tersimpan sebagai draft');
      // The product saved; its member and export prices may not have. Reported, never swallowed.
      const tierMessage = autoTierPriceMessage(saved.autoTierPrices);
      if (tierMessage) toast[tierMessage.level](tierMessage.text);
      onSaved?.(saved);
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan produk');
    } finally {
      setSavingProduct(false);
    }
  };

  // Leaving for the preview drops unsaved edits like any other way out (the page reloads from the saved
  // row on return), so the shared prompt asks — it used to promise the edits were merely "not in the catalogue yet".
  const previewCurrentProduct = () => {
    const preview = normalizeProduct({
      ...form,
      tags: getTagsForVisibility(form.tags, form.catalogVisible),
      priceNumber: Number(getPrimaryVariant(form.variants || [])?.priceNumber || form.priceNumber || 0),
      compareAtPriceNumber: Number(getPrimaryVariant(form.variants || [])?.compareAtPriceNumber || 0),
      stock: variantStockTotal,
      size: getPrimaryVariant(form.variants || [])?.size || form.size,
    }, products);
    navigate(getProductStorefrontPath(preview), {
      state: {
        previewProduct: preview,
        previewMode: true,
        previewBackTo: '/studio/products',
      },
    });
  };

  // Every field gets a name above it, never only a placeholder: the placeholder disappears the moment the
  // box is filled, and a variant row then read "30 ml | 429000 | 0 | 4" with nothing saying which number
  // was the stock. Reported by Dekito 2026-11-08 ("di kasih nama biar gak salah").
  const caption = 'text-xs font-bold uppercase text-muted-foreground';
  const hint = 'mt-1 block text-[11px] font-semibold text-muted-foreground';
  const required = <span className="ml-1 normal-case text-amber-700">· wajib</span>;
  const variantCaption = 'text-[10px] font-bold uppercase text-muted-foreground';

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border bg-white/90 p-5 shadow-sm">
      {backTo ? (
        <Button type="button" variant="ghost" className="-ml-3 mb-3 h-10 gap-2" onClick={leaveForm}>
          <ArrowLeft className="h-4 w-4" />
          Daftar produk
        </Button>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase text-muted-foreground">{product ? 'Edit produk' : 'Tambah produk'}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold sm:text-3xl">{form.name || 'Produk baru'}</h1>
            {hasUnsavedChanges ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-700">Belum disimpan</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Simpan produk menyimpan keempat tab sekaligus. Harga member, reseller, dan luar negeri punya tombol simpan sendiri di tab Harga &amp; stok.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={previewCurrentProduct}><ExternalLink className="h-4 w-4" />Pratinjau</Button>
          <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={resetForm} disabled={!hasUnsavedChanges}><RotateCcw className="h-4 w-4" />Batalkan perubahan</Button>
        </div>
      </div>

      <Tabs defaultValue="utama" className="mt-5">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-editorial-paper p-1 lg:grid-cols-4">
          <TabsTrigger value="utama" className="rounded-xl text-xs font-bold">Utama</TabsTrigger>
          <TabsTrigger value="commercial" className="rounded-xl text-xs font-bold">Harga &amp; stok</TabsTrigger>
          <TabsTrigger value="media" className="rounded-xl text-xs font-bold">Foto</TabsTrigger>
          <TabsTrigger value="story" className="rounded-xl text-xs font-bold">Aroma &amp; tampil di toko</TabsTrigger>
        </TabsList>

        <TabsContent value="utama" className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={caption}>Nama produk{required}</span>
            <input value={form.name} onChange={(event) => updateField('name', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Contoh: La Tulipe" />
          </label>
          <label>
            <span className={caption}>Kategori (keluarga aroma){required}</span>
            <select value={form.category} onChange={(event) => updateField('category', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300">
              <option value="">Pilih kategori</option>
              {categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
              {form.category && !categories.some((category) => category.name === form.category) ? <option value={form.category}>{form.category}</option> : null}
            </select>
            <span className={hint}>Keluarga aroma untuk filter katalog. Label LIMITED dan RESERVE diatur dengan centang di tab Aroma &amp; tampil di toko.</span>
          </label>
          <label>
            <span className={caption}>Ringkasan aroma{required}</span>
            <input value={form.notes} onChange={(event) => updateField('notes', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Rose, musk, sandalwood" />
            <span className={hint}>Satu baris di kartu katalog dan beranda.</span>
          </label>
          {/* A <div>, not a <label>: a label hands every click on its own text to the first control inside
              it, so tapping "Cocok dipakai kapan", "Momen", "Waktu" or "Cuaca" silently switched "Kerja"
              on or off. Measured on L'iris, 2026-11-08. */}
          <div className="sm:col-span-2">
            <span className={caption}>Cocok dipakai kapan</span>
            <div className="mt-2">
              <WearPicker value={form.wear} onChange={(next) => updateField('wear', next)} />
            </div>
          </div>
          <label>
            <span className={caption}>Mood</span>
            <input value={form.mood || ''} onChange={(event) => updateField('mood', event.target.value)} placeholder="Contoh: tenang, harian, hangat malam" className="mt-2 h-11 w-full rounded-2xl border px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <span className={hint}>Label kecil di halaman produk toko Indonesia. Kosongkan bila tidak perlu.</span>
          </label>
          <label>
            <span className={caption}>Intensitas</span>
            <select value={form.intensity || 'Medium'} onChange={(event) => updateField('intensity', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-3 text-sm font-semibold outline-none focus:border-amber-300">
              {['Light', 'Medium', 'Medium strong', 'Strong'].map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
            <span className={hint}>Tampil di halaman produk, mis. &quot;Intensitas medium&quot;.</span>
          </label>
          <label>
            <span className={caption}>Tahun rilis</span>
            <input type="number" inputMode="numeric" min="1900" max="2100" value={form.launchYear ?? ''} onChange={(event) => updateField('launchYear', event.target.value)} placeholder="Contoh: 2025" className="mt-2 h-11 w-full rounded-2xl border px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <span className={hint}>Tampil di halaman produk sebagai &quot;Rilis …&quot;. Kosongkan bila belum pasti — tidak ditampilkan.</span>
          </label>
          <label>
            <span className={caption}>Konsentrasi</span>
            <input list="product-concentrations" value={form.concentration || ''} onChange={(event) => updateField('concentration', event.target.value)} placeholder="Eau de Parfum" className="mt-2 h-11 w-full rounded-2xl border px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <datalist id="product-concentrations">{['Eau de Parfum', 'Extrait de Parfum', 'Parfum', 'Eau de Toilette'].map((name) => <option key={name} value={name} />)}</datalist>
            <span className={hint}>Tampil di daftar keterangan halaman produk.</span>
          </label>
        </TabsContent>

        <TabsContent value="commercial" className="mt-5 grid gap-4 sm:grid-cols-2">
          {scheduledPrices.length ? (
            <div className="sm:col-span-2 rounded-2xl border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Harga terjadwal
              </div>
              <ul className="mt-2 grid gap-1 text-[12px] font-semibold text-amber-900">
                {scheduledPrices.map((row) => (
                  <li key={`${row.variantId}-${row.tier}-${row.effectiveAt}`}>
                    {scheduledPriceLabel(row, form.variants)} → {formatRupiah(row.priceNumber)}
                    {' '}{row.inForce ? 'sudah berlaku sejak' : 'mulai'}{' '}
                    {row.effectiveAt ? new Date(row.effectiveAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] font-semibold text-amber-800">
                {scheduledPrices.some((row) => row.inForce)
                  ? 'Harga terjadwal yang sudah berlaku MENGALAHKAN harga di bawah — mengubah angka di bawah tidak akan terlihat di toko sampai jadwalnya dibersihkan.'
                  : 'Pada tanggal itu harga di toko berubah sendiri, apa pun yang tertulis di bawah.'}
              </p>
            </div>
          ) : null}
          <label>
            <span className={caption}>Harga katalog</span>
            <input value={formatRupiah(primaryPrice)} readOnly disabled className="mt-2 h-11 w-full rounded-2xl border bg-[#f3f1ec] px-4 text-sm font-semibold text-muted-foreground outline-none" />
            <span className={hint}>Otomatis dari varian termurah di bawah. Ubah harga per ukuran.</span>
          </label>
          <label>
            <span className={caption}>Stok total</span>
            <input type="number" value={variantStockTotal} readOnly disabled className="mt-2 h-11 w-full rounded-2xl border bg-[#f3f1ec] px-4 text-sm font-semibold text-muted-foreground outline-none" />
            <span className={hint}>Otomatis dari total stok varian di bawah. Ubah stok per ukuran.</span>
          </label>
          <div className="sm:col-span-2 rounded-2xl border bg-[#fbfaf7] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={caption}>Varian: ukuran, harga, stok</div>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Satu baris per ukuran botol. Harga coret = harga lama yang dicoret di toko; kosongkan kalau tidak ada.</p>
              </div>
              <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white gap-2" onClick={addVariant}><Plus className="h-4 w-4" />Tambah ukuran</Button>
            </div>
            <div className="mt-3 grid gap-2">
              {(form.variants || []).map((variant, index) => (
                <div key={variant.id || index} className="grid items-end gap-2 rounded-2xl border bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <label className="grid gap-1">
                    <span className={variantCaption}>Ukuran</span>
                    <input value={variant.size} onChange={(event) => updateVariant(index, 'size', event.target.value)} placeholder="30 ml" className="h-10 rounded-xl border px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  </label>
                  <label className="grid gap-1">
                    <span className={variantCaption}>Harga (Rp)</span>
                    <LocalizedNumberInput value={variant.priceNumber} onChange={(value) => updateVariant(index, 'priceNumber', value)} placeholder="Harga jual" className="h-10 rounded-xl border px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  </label>
                  <label className="grid gap-1">
                    <span className={variantCaption}>Harga coret (Rp)</span>
                    <LocalizedNumberInput value={variant.compareAtPriceNumber || ''} onChange={(value) => updateVariant(index, 'compareAtPriceNumber', value)} placeholder="Kosong = tidak ada" className="h-10 rounded-xl border px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  </label>
                  <label className="grid gap-1">
                    <span className={variantCaption}>Stok (botol)</span>
                    <LocalizedNumberInput value={variant.stock} onChange={(value) => updateVariant(index, 'stock', value)} placeholder="0" className="h-10 rounded-xl border px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  </label>
                  <Button type="button" size="icon" variant="outline" aria-label={`Hapus ukuran ${variant.size || index + 1}`} title="Hapus ukuran ini" className="h-10 w-10 rounded-xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeVariant(index)} disabled={(form.variants || []).length <= 1}><Trash2 className="h-4 w-4" /></Button>
                  {compareAtPriceNote(variant) ? (
                    <p className="text-xs font-semibold text-amber-700 sm:col-span-5">{compareAtPriceNote(variant)}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <label>
            <span className={caption}>Batas stok menipis</span>
            <input type="number" min="0" value={form.restockThreshold} onChange={(event) => updateField('restockThreshold', Number(event.target.value))} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" />
            <span className={hint}>Stok di angka ini atau di bawahnya masuk daftar &quot;Hampir habis&quot;.</span>
          </label>
          <label>
            <span className={caption}>Catatan koreksi stok</span>
            <input value={form.stockAdjustmentNote} onChange={(event) => updateField('stockAdjustmentNote', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Contoh: restock 20 botol dari batch Mei" />
            <span className={hint}>Isi kalau kamu mengubah stok. Tercatat di halaman Stok &amp; riwayat.</span>
          </label>
          <div className="sm:col-span-2 rounded-2xl border bg-[#fbfaf7] p-4">
            <div className={caption}>Harga member, reseller, luar negeri</div>
            <p className="mb-3 mt-1 text-xs font-semibold text-muted-foreground">Harga khusus per ukuran. Kosong berarti pembeli membayar harga retail di atas.</p>
            <TierPriceEditor productId={form.id || ''} variants={form.variants || []} />
          </div>
        </TabsContent>

        <TabsContent value="media" className="mt-5">
          <div className="grid gap-4 rounded-2xl border bg-[#fbfaf7] p-4 sm:grid-cols-[0.9fr_1.1fr]">
            <ProductVisual product={{ ...form, category: form.category, size: primarySize }} className="min-h-[220px]" />
            <div className="grid content-start gap-3">
              <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border bg-white px-4 text-sm font-bold">
                <ImagePlus className="h-4 w-4" />
                {uploadingImage ? 'Mengupload...' : 'Upload foto'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
              {(form.images || []).length ? (
                <div className="grid grid-cols-4 gap-2">
                  {form.images.map((image, index) => (
                    <div key={image} className="relative overflow-hidden rounded-2xl border bg-white">
                      <img src={image} alt="" className="h-16 w-full object-cover" />
                      {index === 0 ? <span className="absolute bottom-1 left-1 rounded-full bg-white/90 px-1.5 text-[9px] font-bold uppercase text-editorial-charcoal">Cover</span> : (
                    <button type="button" onClick={() => makeCover(image)} className="absolute bottom-1 left-1 min-h-0 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-editorial-charcoal" aria-label={`Jadikan foto ${index + 1} cover`} title="Jadikan cover">Jadikan cover</button>
                  )}
                      <button type="button" onClick={() => removeImage(image)} className="absolute right-1 top-1 grid h-7 w-7 min-h-0 place-items-center rounded-full bg-white/90 text-rose-700" aria-label={`Hapus foto ${index + 1}`} title="Hapus foto">
                        <ImageOff className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="text-xs font-semibold text-muted-foreground">
                JPG, PNG, WebP, atau GIF sampai 15 MB per file. Upload otomatis dikompres ke WebP ringan sekitar 250 KB; foto pertama menjadi cover katalog.
              </p>
              <label>
                <span className={caption}>Alamat foto (satu per baris)</span>
                <textarea value={(form.images || []).join('\n')} onChange={(event) => updateImagesFromText(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-amber-300" placeholder={'https://.../depan.jpg\nhttps://.../detail.jpg'} />
                <span className={hint}>Terisi sendiri setelah upload. Ubah urutan baris untuk mengganti cover.</span>
              </label>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="story" className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className={`sm:col-span-2 rounded-2xl border p-4 ${canPublish ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <div className="flex items-start gap-3">
              {canPublish ? <PackagePlus className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
              <div className="min-w-0">
                <div className="text-sm font-bold">{canPublish ? 'Siap tampil di toko' : 'Belum siap tampil di toko'}</div>
                <p className="mt-1 text-xs font-semibold leading-relaxed opacity-80">
                  {canPublish
                    ? `Alamat publik: /catalog/${publishChecklist.slug}`
                    : publishChecklist.blocking.map((item) => item.label).join(', ')}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {publishChecklist.items.map((item) => (
                <div key={item.key} className={`rounded-xl px-3 py-2 text-xs font-bold ${item.ok ? 'bg-white/75 text-emerald-800' : item.required ? 'bg-white/75 text-amber-800' : 'bg-white/60 text-muted-foreground'}`}>
                  {item.ok ? 'OK' : item.required ? 'Wajib' : 'Opsional'} · {item.label}
                </div>
              ))}
            </div>
          </div>
          {slugConflicts.length ? (
            <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="text-sm font-bold">Alamat produk sudah dipakai</div>
                  <p className="mt-1 text-xs font-semibold leading-relaxed opacity-80">
                    Bentrok dengan {slugConflicts.map((item) => item.name).join(', ')}. Saat disimpan, alamatnya dibuat unik otomatis supaya link produk tidak saling menimpa.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {[
            ['topNotes', 'Top notes (pembuka)'],
            ['heartNotes', 'Heart notes (inti)'],
            ['baseNotes', 'Base notes (dasar)'],
          ].map(([key, label]) => (
            <label key={key}>
              <span className={caption}>{label}</span>
              <input value={form[key] || ''} onChange={(event) => updateField(key, event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Pisahkan dengan koma" />
            </label>
          ))}
          <label>
            <span className={caption}>Tag internal</span>
            <input value={form.tags || ''} onChange={(event) => updateField('tags', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Pisahkan dengan koma" />
            <span className={hint}>Tidak tampil di toko.</span>
          </label>
          <label className="sm:col-span-2">
            <span className={caption}>Deskripsi</span>
            <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Cerita produk" />
            <span className={hint}>Tampil di halaman produk. Paragraf pertama juga dipakai bila produk ini jadi sorotan beranda.</span>
          </label>
          <div className="sm:col-span-2 border-t pt-4">
            <div className={caption}>Teks toko Inggris (/en)</div>
            <p className="mt-1 text-xs text-muted-foreground">Kolom yang kosong memakai teks Indonesia di atas.</p>
          </div>
          <label className="sm:col-span-2">
            <span className={caption}>Deskripsi (Inggris)</span>
            <textarea value={form.descriptionEn || ''} onChange={(event) => updateField('descriptionEn', event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Product description in English" />
          </label>
          <label className="sm:col-span-2">
            <span className={caption}>Ringkasan aroma (Inggris)</span>
            <input value={form.notesEn || ''} onChange={(event) => updateField('notesEn', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Rose, musk, sandalwood" />
          </label>
          {[
            ['topNotesEn', 'Top notes (Inggris)'],
            ['heartNotesEn', 'Heart notes (Inggris)'],
            ['baseNotesEn', 'Base notes (Inggris)'],
          ].map(([key, label]) => (
            <label key={key}>
              <span className={caption}>{label}</span>
              <input value={form[key] || ''} onChange={(event) => updateField(key, event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Pisahkan dengan koma" />
            </label>
          ))}
          <div className="sm:col-span-2 grid gap-2 border-t pt-4">
            <div className={caption}>Kamu mungkin suka</div>
            <p className="-mt-1 text-xs text-muted-foreground">Parfum yang ditawarkan di bawah halaman produk ini.</p>
            <RelatedFragrancePicker value={form.relatedFragrances} onChange={(next) => updateField('relatedFragrances', next)} products={products} productId={form.id} productSlug={form.slug} />
          </div>
          {/* The three marks a buyer sees, side by side. They used to share a two-column grid with the
              testimonials, which stretched "Lini RESERVE" into a tall empty box beside them. */}
          <div className="sm:col-span-2 grid gap-3 border-t pt-4 sm:grid-cols-3">
            <label className="flex items-start gap-3 rounded-2xl border bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              <input type="checkbox" checked={Boolean(form.featured)} onChange={(event) => updateField('featured', event.target.checked)} className="mt-1" />
              <span>
                <span className="block">Pilihan di beranda</span>
                <span className="mt-1 block text-xs font-semibold opacity-75">Beranda memuat maks. 6 pilihan, urut katalog. Yang pertama jadi sorotan utama.</span>
              </span>
            </label>
            {/* A badge, kept apart from the scent family. "Limited" used to live in the category field and
                occupy the seat the filter pills read, so ten perfumes could not be found by what they smell
                of — Maskumambang is a white floral that never appeared under FLORAL. */}
            <label className="flex items-start gap-3 rounded-2xl border bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              <input type="checkbox" checked={Boolean(form.limited)} onChange={(event) => updateField('limited', event.target.checked)} className="mt-1" />
              <span>
                <span className="block">Badge LIMITED</span>
                <span className="mt-1 block text-xs font-semibold opacity-75">Label LIMITED di kartu dan halaman produk.</span>
              </span>
            </label>
            {/* Solivagant Reserve: a LINE, not a price tier and not a scent family — Dekito's own words,
                "jalan kecil yang aku buka buat bahan-bahan alami yang langka". It behaves exactly like
                LIMITED: badge on the card, and a pill that appears only once something wears it. */}
            <label className="flex items-start gap-3 rounded-2xl border bg-stone-100 px-4 py-3 text-sm font-bold text-stone-800">
              <input type="checkbox" checked={Boolean(form.reserve)} onChange={(event) => updateField('reserve', event.target.checked)} className="mt-1" />
              <span>
                <span className="block">Lini RESERVE</span>
                <span className="mt-1 block text-xs font-semibold opacity-75">Label RESERVE untuk bahan alami yang langka.</span>
              </span>
            </label>
          </div>
          <div className="sm:col-span-2">
            <TestimonialsField value={form.testimonials} onChange={(next) => updateField('testimonials', next)} />
          </div>
          <label className={`sm:col-span-2 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${canPublish ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
            <input
              type="checkbox"
              checked={Boolean(form.catalogVisible)}
              onChange={(event) => {
                if (event.target.checked && !canPublish) {
                  toast.error(`Belum bisa tampil di toko: ${publishChecklist.blocking[0]?.message || 'lengkapi data wajib.'}`);
                  updateField('catalogVisible', false);
                  return;
                }
                updateField('catalogVisible', event.target.checked);
              }}
              className="mt-1"
            />
            <span>
              <span className="block">Tampil di toko</span>
              <span className="mt-1 block text-xs font-semibold opacity-75">{canPublish ? 'Centang: muncul di toko setelah disimpan. Kosongkan: disimpan sebagai draft, tidak terlihat pembeli.' : 'Lengkapi checklist di atas dulu sebelum produk bisa tampil.'}</span>
            </span>
          </label>
        </TabsContent>
      </Tabs>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="submit" className="rounded-2xl gap-2" disabled={savingProduct}><Save className="h-4 w-4" />{savingProduct ? 'Menyimpan...' : 'Simpan produk'}</Button>
        <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={previewCurrentProduct}><ExternalLink className="h-4 w-4" />Pratinjau</Button>
        <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={resetForm} disabled={!hasUnsavedChanges}><RotateCcw className="h-4 w-4" />Batalkan perubahan</Button>
      </div>
    </form>
  );
};

export default ProductForm;
