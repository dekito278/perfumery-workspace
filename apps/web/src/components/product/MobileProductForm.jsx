import TestimonialsField from '@/components/product/TestimonialsField.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import { compareAtPriceNote } from '@/utils/compareAtPrice.js';
import LocalizedNumberInput from '@/components/LocalizedNumberInput.jsx';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, ImageOff, ImagePlus, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { autoTierPriceMessage } from '@/utils/autoTierPrices.js';
import MobileAccordion from '@/components/mobile-ui/MobileAccordion.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning.js';
import {
  buildStockCorrection,
  formatRupiah,
  getProductBatchDetails,
  getProductFormulaId,
  getProductPublishChecklist,
  getPrimaryVariant,
  getProductSlugConflicts,
  getProductStorefrontPath,
  normalizeProduct,
  PRODUCT_DRAFT_TAG,
  saveCustomProduct,
} from '@/services/productCatalogService.js';
import { deleteProductImages, uploadProductImage } from '@/services/productImageStorageService.js';
import { formatQuantity } from '@/utils/formatting.js';
import { toProductFormState } from '@/utils/productFormState.js';
import WearPicker from '@/components/product/WearPicker.jsx';
import RelatedFragrancePicker from '@/components/product/RelatedFragrancePicker.jsx';
import TierPriceEditor from '@/components/product/TierPriceEditor.jsx';
import { confirmAction } from '@/utils/confirmAction.js';
import { snapshotProductForm } from '@/utils/productFormSnapshot.js';

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
  mood: '',
  intensity: 'Medium',
  launchYear: '',
  wear: {},
  topNotes: '',
  heartNotes: '',
  baseNotes: '',
  tags: '',
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
  featured: true,
  limited: false,
  reserve: false,
  testimonials: [],
  catalogVisible: true,
};

// One builder for both layouts — see utils/productFormState.js for what drifted and why.
export const toProductForm = toProductFormState;

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


const ProductFormSection = ({ children, title, description, action, defaultOpen = false }) => (
  <MobileAccordion
    title={title}
    meta={description}
    defaultOpen={defaultOpen}
  >
    <div className="grid gap-3">
      {action ? <div className="flex justify-end">{action}</div> : null}
      {children}
    </div>
  </MobileAccordion>
);

// The caption of a field. A span inside the field's own <label>: as a sibling <label> with no htmlFor it
// named nothing, and tapping it focused nothing.
const ProductInputLabel = ({ children }) => (
  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8b949e]">{children}</span>
);
const requiredMark = <span className="ml-1 normal-case tracking-normal text-amber-700">· wajib</span>;
const fieldHint = 'text-xs text-[#6b7280]';
// Every input in a variant row is named above it. With placeholders alone, a filled row read
// "30 ml | 429000 | 0 | 4" and nothing said which number was the stock.
const variantCaption = 'text-[10px] font-bold uppercase text-[#8b949e]';

/**
 * Shared mobile create/edit product form. `product` null → create; a product object → edit.
 * `onSaved(savedProduct)` fires after a successful save so the parent page can navigate.
 * `backTo` draws the way back inside the form, where it can ask before throwing away edits.
 */
const MobileProductForm = ({ product = null, onSaved, backTo = '' }) => {
  const navigate = useNavigate();
  const products = useCatalogProducts();
  const categories = useStorefrontCategories(products);
  const initialForm = useMemo(() => (product ? toProductForm(product) : emptyProduct), [product]);

  const [form, setForm] = useState(initialForm);
  const [savedFormSnapshot, setSavedFormSnapshot] = useState(() => snapshotProductForm(initialForm));
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    setForm(initialForm);
    setSavedFormSnapshot(snapshotProductForm(initialForm));
  }, [initialForm]);

  const linkedFormulaId = getProductFormulaId(form);
  const batchDetails = getProductBatchDetails(form);
  const totalVariantStock = (form.variants || []).reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
  const primaryVariantPrice = Number(getPrimaryVariant(form.variants || [])?.priceNumber || form.priceNumber || 0);
  const primarySize = getPrimaryVariant(form.variants || [])?.size || form.size;
  // Named, so the disabled save button can say what it is waiting for instead of "Lengkapi wajib".
  const missingRequired = [
    [form.name, 'Nama'],
    [form.category, 'Kategori'],
    [form.notes, 'Ringkasan aroma'],
  ].filter(([value]) => !String(value || '').trim()).map(([, label]) => label);
  const requiredReady = missingRequired.length === 0;
  const publishChecklist = useMemo(() => getProductPublishChecklist(form), [form]);
  const canPublish = publishChecklist.ready;
  const currentFormSnapshot = useMemo(() => snapshotProductForm(form), [form]);
  const hasUnsavedChanges = currentFormSnapshot !== savedFormSnapshot;
  const slugConflicts = useMemo(() => getProductSlugConflicts(form, products), [form, products]);

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
      // Seeded from the bottle that represents the product; the product-level price is derived now.
      priceNumber: Number(getPrimaryVariant(current.variants || [])?.priceNumber || current.priceNumber || 0),
      compareAtPriceNumber: Number(getPrimaryVariant(current.variants || [])?.compareAtPriceNumber || 0),
      stock: 0,
    }],
  }));
  const removeVariant = (index) => setForm((current) => ({
    ...current,
    variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
  }));
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
    event?.preventDefault();
    if (savingProduct) {
      return;
    }
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
      const nextPrimaryVariantPrice = Number(getPrimaryVariant(form.variants || [])?.priceNumber || form.priceNumber || 0);
      // Record a stock-correction audit entry on edit, same as desktop, so mobile stock changes are traceable.
      const previousProduct = products.find((item) => item.id === form.id);
      const stockCorrection = buildStockCorrection({ form, previousProduct });
      const stockCorrections = stockCorrection
        ? [stockCorrection, ...(form.stockCorrections || [])]
        : (form.stockCorrections || []);
      const saved = await saveCustomProduct({
        ...form,
        restockThreshold: Number(form.restockThreshold || 0),
        stockCorrections,
        priceNumber: nextPrimaryVariantPrice,
        compareAtPriceNumber: Number(getPrimaryVariant(form.variants || [])?.compareAtPriceNumber || 0),
        stock: totalVariantStock,
        size: getPrimaryVariant(form.variants || [])?.size || form.size,
        price: formatRupiah(nextPrimaryVariantPrice),
        tags: getTagsForVisibility(form.tags, form.catalogVisible),
      });
      // Same save-time reconciliation the desktop form does: storage files for images that were on the
      // product before but are no longer referenced would otherwise stay in the bucket forever, and the
      // buckets are admin-locked so nothing else cleans them up (audit round 7).
      const savedImages = new Set(saved.images || []);
      const removedImages = (previousProduct?.images || []).filter((url) => !savedImages.has(url));
      if (removedImages.length) {
        deleteProductImages(removedImages).catch((cleanupError) => console.warn('Product image cleanup skipped:', cleanupError.message || cleanupError));
      }
      const nextForm = toProductForm(saved);
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
    const previewPrice = Number(getPrimaryVariant(form.variants || [])?.priceNumber || form.priceNumber || 0);
    const preview = normalizeProduct({
      ...form,
      priceNumber: previewPrice,
      compareAtPriceNumber: Number(getPrimaryVariant(form.variants || [])?.compareAtPriceNumber || 0),
      stock: form.variants?.reduce((sum, variant) => sum + Number(variant.stock || 0), 0) || Number(form.stock || 0),
      size: getPrimaryVariant(form.variants || [])?.size || form.size,
      price: formatRupiah(previewPrice),
      tags: getTagsForVisibility(form.tags, form.catalogVisible),
    }, products);
    navigate(getProductStorefrontPath(preview), {
      state: {
        previewProduct: preview,
        previewMode: true,
        previewBackTo: '/mobile/studio/products',
      },
    });
  };

  return (
    <form id="mobile-product-form" onSubmit={handleSubmit} className="space-y-4">
      {backTo ? (
        <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white gap-2 text-xs font-bold" onClick={leaveForm}>
          <ArrowLeft className="h-4 w-4" />
          Daftar produk
        </Button>
      ) : null}
      <section className="mobile-soft-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">{product ? 'Edit produk' : 'Produk baru'}</div>
            <h2 className="mt-1 text-2xl font-bold text-editorial-charcoal">{form.name || 'Produk baru'}</h2>
            {hasUnsavedChanges ? (
              <div className="mt-2 w-fit rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-700">Belum disimpan</div>
            ) : null}
            <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">
              Simpan produk menyimpan semua bagian sekaligus. Harga member, reseller, dan luar negeri punya tombol simpan sendiri.
            </p>
          </div>
          <div className="grid shrink-0 gap-2">
            <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white px-3 text-xs gap-1" onClick={previewCurrentProduct}><ExternalLink className="h-3.5 w-3.5" />Pratinjau</Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-[#8b949e]">Harga</div>
            <div className="mt-1 truncate text-xs font-bold text-editorial-charcoal">{formatRupiah(primaryVariantPrice)}</div>
          </div>
          <div className="rounded-2xl bg-white px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-[#8b949e]">Stok</div>
            <div className="mt-1 truncate text-xs font-bold text-editorial-charcoal">{totalVariantStock}</div>
          </div>
          <div className="rounded-2xl bg-white px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-[#8b949e]">Status</div>
            <div className={`mt-1 truncate text-xs font-bold ${form.catalogVisible && canPublish ? 'text-emerald-700' : 'text-amber-700'}`}>{form.catalogVisible ? (canPublish ? 'Live' : 'Belum siap') : 'Draft'}</div>
          </div>
        </div>
      </section>

      {(linkedFormulaId || batchDetails.batchKey) ? (
      <ProductFormSection
        title="Sumber batch Studio"
        description="Produk ini berasal dari batch/formula studio. Gunakan konteks ini sebelum mengubah stok atau harga."
      >
        {linkedFormulaId ? (
          <button
            type="button"
            onClick={() => navigate(`/mobile/batches?formulaId=${encodeURIComponent(linkedFormulaId)}`)}
            className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-left text-xs font-bold text-amber-800"
          >
            <span className="block text-[10px] uppercase">Sumber batch Studio</span>
            <span className="mt-0.5 block text-[#1f2937]">Buka kalkulator batch terkait</span>
          </button>
        ) : null}
        {batchDetails.batchKey ? (
          <div className="rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-[#6b7280]">Sumber stok</div>
                <h3 className="mt-1 text-sm font-bold text-[#1f2937]">{batchDetails.movement || 'Batch masuk stok'}</h3>
              </div>
              {batchDetails.publishedAt ? (
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#6b7280]">
                  {new Date(batchDetails.publishedAt).toLocaleDateString('id-ID')}
                </span>
              ) : null}
            </div>
            {batchDetails.sku ? (
              <div className="mt-3 rounded-xl bg-white px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">SKU</div>
                <div className="mt-1 break-all text-xs font-bold text-[#1f2937]">{batchDetails.sku}</div>
              </div>
            ) : null}
            {batchDetails.batchCode ? (
              <div className="mt-2 rounded-xl bg-white px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Batch sumber</div>
                <div className="mt-1 break-all text-xs font-bold text-[#1f2937]">{batchDetails.batchCode}</div>
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Volume batch</div>
                <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatQuantity(batchDetails.targetMl, 0)} ml</div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Terpakai</div>
                <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatQuantity(batchDetails.usableMl || batchDetails.targetMl, 0)} ml</div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Botol</div>
                <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatQuantity(batchDetails.bottleMl, 0)} ml</div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Pengenceran</div>
                <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatQuantity(batchDetails.dilutionPercent, 1)}%</div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Susut</div>
                <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatQuantity(batchDetails.lossPercent, 1)}%</div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">HPP per botol</div>
                <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatRupiah(batchDetails.cogsPerBottle)}</div>
              </div>
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase text-editorial-charcoal">
              Stok awal {batchDetails.initialStock || 0} botol
            </div>
          </div>
        ) : null}
      </ProductFormSection>
      ) : null}

      <ProductFormSection
        title="Identitas"
        description="Nama, kategori, dan ringkasan aroma wajib diisi untuk menyimpan produk."
        defaultOpen
      >
        <label className="grid gap-1.5">
          <ProductInputLabel>Nama produk{requiredMark}</ProductInputLabel>
          <input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Contoh: La Tulipe" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
        </label>
        <label className="grid gap-1.5">
          <ProductInputLabel>Kategori (keluarga aroma){requiredMark}</ProductInputLabel>
          <select value={form.category} onChange={(event) => updateField('category', event.target.value)} className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300">
            <option value="">Pilih kategori</option>
            {categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
            {form.category && !categories.some((category) => category.name === form.category) ? <option value={form.category}>{form.category}</option> : null}
          </select>
          <span className={fieldHint}>Keluarga aroma untuk filter katalog. Label LIMITED dan RESERVE diatur dengan centang di bagian Tampil di toko.</span>
        </label>
        <label className="grid gap-1.5">
          <ProductInputLabel>Ringkasan aroma{requiredMark}</ProductInputLabel>
          <input value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Rose, musk, sandalwood" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
          <span className={fieldHint}>Satu baris di kartu katalog dan beranda.</span>
        </label>
        {/* Mood and intensity had no input on either form, so every product carried the system
            default — 18 of 18 read 'Custom perfume profile'. Anything keyed on mood later (choosing
            by occasion, a scent quiz) needs these filled, and they can only be filled here. */}
        {/* Untagged products cannot appear in the wardrobe at all — silence is not a yes — so this is
            the one place the "which bottle, when" page gets its data. A <div> on purpose: a <label>
            would pass every tap on its text to the first chip. */}
        <div className="grid gap-1.5">
          <ProductInputLabel>Cocok dipakai kapan</ProductInputLabel>
          <WearPicker compact value={form.wear} onChange={(next) => updateField('wear', next)} />
        </div>
        <label className="grid gap-1.5">
          <ProductInputLabel>Mood</ProductInputLabel>
          <input value={form.mood || ''} onChange={(event) => updateField('mood', event.target.value)} placeholder="Contoh: tenang, harian, hangat malam" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
          <span className={fieldHint}>Label kecil di halaman produk toko Indonesia. Kosongkan bila tidak perlu.</span>
        </label>
        <label className="grid gap-1.5">
          <ProductInputLabel>Intensitas</ProductInputLabel>
          <select value={form.intensity || 'Medium'} onChange={(event) => updateField('intensity', event.target.value)} className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300">
            {['Light', 'Medium', 'Medium strong', 'Strong'].map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5">
          <ProductInputLabel>Tahun rilis</ProductInputLabel>
          <input type="number" inputMode="numeric" min="1900" max="2100" value={form.launchYear ?? ''} onChange={(event) => updateField('launchYear', event.target.value)} placeholder="Contoh: 2025" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
          <span className={fieldHint}>Tampil di halaman produk sebagai &quot;Rilis …&quot;. Kosongkan bila belum pasti — tidak ditampilkan.</span>
        </label>
        <label className="grid gap-1.5">
          <ProductInputLabel>Konsentrasi</ProductInputLabel>
          <input list="mobile-product-concentrations" value={form.concentration || ''} onChange={(event) => updateField('concentration', event.target.value)} placeholder="Eau de Parfum" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
          <datalist id="mobile-product-concentrations">{['Eau de Parfum', 'Extrait de Parfum', 'Parfum', 'Eau de Toilette'].map((name) => <option key={name} value={name} />)}</datalist>
          <span className={fieldHint}>Tampil di daftar keterangan halaman produk.</span>
        </label>
      </ProductFormSection>

      <ProductFormSection
        title="Ukuran, harga, dan stok"
        description="Harga katalog dan total stok dihitung dari ukuran di bawah. Ubah per ukuran."
        action={<Button type="button" variant="outline" className="h-10 rounded-2xl bg-white gap-1 px-3 text-xs" onClick={addVariant}><Plus className="h-4 w-4" />Tambah ukuran</Button>}
      >
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
          <label className="grid min-w-0 gap-1.5">
            <ProductInputLabel>Harga katalog</ProductInputLabel>
            <input value={formatRupiah(primaryVariantPrice)} readOnly disabled className="h-11 w-full min-w-0 rounded-xl border border-[#e5e7eb] bg-[#f3f1ec] px-3 text-sm font-semibold text-muted-foreground outline-none" />
            <span className="text-[11px] font-semibold text-[#8b949e]">Otomatis dari ukuran termurah.</span>
          </label>
          <label className="grid min-w-0 gap-1.5">
            <ProductInputLabel>Stok total</ProductInputLabel>
            <input type="number" value={totalVariantStock} readOnly disabled className="h-11 w-full min-w-0 rounded-xl border border-[#e5e7eb] bg-[#f3f1ec] px-3 text-sm font-semibold text-muted-foreground outline-none" />
            <span className="text-[11px] font-semibold text-[#8b949e]">Otomatis dari stok semua ukuran.</span>
          </label>
        </div>
        <p className="text-[11px] font-semibold leading-relaxed text-[#6b7280]">Harga coret = harga lama yang dicoret di toko; kosongkan kalau tidak ada.</p>
        <div className="grid gap-2">
          {(form.variants || []).map((variant, index) => (
            <div key={variant.id || index} className="grid grid-cols-2 gap-2 rounded-2xl border bg-white p-2">
              <label className="grid gap-1">
                <span className={variantCaption}>Ukuran</span>
                <input value={variant.size} onChange={(event) => updateVariant(index, 'size', event.target.value)} placeholder="30 ml" className="h-10 min-w-0 rounded-xl border px-2 text-xs font-semibold outline-none focus:border-amber-300" />
              </label>
              <label className="grid gap-1">
                <span className={variantCaption}>Harga (Rp)</span>
                <LocalizedNumberInput value={variant.priceNumber} onChange={(value) => updateVariant(index, 'priceNumber', value)} placeholder="Harga jual" className="h-10 min-w-0 rounded-xl border px-2 text-xs font-semibold outline-none focus:border-amber-300" />
              </label>
              <label className="grid gap-1">
                <span className={variantCaption}>Harga coret (Rp)</span>
                <LocalizedNumberInput value={variant.compareAtPriceNumber || ''} onChange={(value) => updateVariant(index, 'compareAtPriceNumber', value)} placeholder="Kosong = tidak ada" className="h-10 min-w-0 rounded-xl border px-2 text-xs font-semibold outline-none focus:border-amber-300" />
              </label>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                <label className="grid gap-1">
                  <span className={variantCaption}>Stok (botol)</span>
                  <LocalizedNumberInput value={variant.stock} onChange={(value) => updateVariant(index, 'stock', value)} placeholder="0" className="h-10 min-w-0 rounded-xl border px-2 text-xs font-semibold outline-none focus:border-amber-300" />
                </label>
                <Button type="button" size="icon" variant="outline" aria-label={`Hapus ukuran ${variant.size || index + 1}`} className="h-10 w-10 rounded-xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeVariant(index)} disabled={(form.variants || []).length <= 1}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {compareAtPriceNote(variant) ? (
                <p className="col-span-2 text-[11px] font-semibold leading-relaxed text-amber-700">{compareAtPriceNote(variant)}</p>
              ) : null}
            </div>
          ))}
        </div>
        {/* Both were desktop-only, so a stock change made on the phone was recorded with no reason and the
            low-stock line could not be moved from the screen Dekito uses most. */}
        <label className="grid gap-1.5">
          <ProductInputLabel>Batas stok menipis</ProductInputLabel>
          <input type="number" inputMode="numeric" min="0" value={form.restockThreshold ?? ''} onChange={(event) => updateField('restockThreshold', Number(event.target.value))} className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
          <span className={fieldHint}>Stok di angka ini atau di bawahnya masuk daftar &quot;Hampir habis&quot;.</span>
        </label>
        <label className="grid gap-1.5">
          <ProductInputLabel>Catatan koreksi stok</ProductInputLabel>
          <input value={form.stockAdjustmentNote || ''} onChange={(event) => updateField('stockAdjustmentNote', event.target.value)} placeholder="Contoh: restock 20 botol dari batch Mei" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
          <span className={fieldHint}>Isi kalau kamu mengubah stok. Tercatat di riwayat stok.</span>
        </label>
      </ProductFormSection>

      <ProductFormSection
        title="Harga member, reseller, luar negeri"
        description="Harga khusus per ukuran. Punya tombol simpan sendiri, terpisah dari Simpan produk."
      >
        <TierPriceEditor productId={form.id || ''} variants={form.variants || []} compact />
      </ProductFormSection>

      <ProductFormSection
        title="Foto produk"
        description="Upload foto (dikompres ke WebP ringan) atau tempel alamat foto satu per baris."
      >
        <div className="rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
          <ProductVisual product={{ ...form, category: form.category, size: primarySize }} className="h-40" />
          <label className="mt-3 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border bg-white px-3 text-xs font-bold">
            <ImagePlus className="h-4 w-4" />
            {uploadingImage ? 'Mengupload...' : 'Upload foto'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={handleImageUpload} disabled={uploadingImage} />
          </label>
          {(form.images || []).length ? (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {form.images.map((image, index) => (
                <div key={image} className="relative overflow-hidden rounded-2xl border bg-white">
                  <img src={image} alt="" className="h-14 w-full object-cover" loading="lazy" decoding="async" width="120" height="56" />
                  {index === 0 ? <span className="absolute bottom-1 left-1 rounded-full bg-white/90 px-1.5 text-[9px] font-bold uppercase text-editorial-charcoal">Cover</span> : null}
                  <button type="button" onClick={() => removeImage(image)} className="absolute right-1 top-1 grid h-7 w-7 min-h-0 place-items-center rounded-full bg-white/90 text-rose-700" aria-label={`Hapus foto ${index + 1}`}>
                    <ImageOff className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-[11px] font-semibold leading-relaxed text-[#6b7280]">
            Upload otomatis dikompres ke WebP ringan sekitar 250 KB per foto. Foto pertama jadi cover katalog.
          </p>
          <label className="mt-3 grid gap-1.5">
            <ProductInputLabel>Alamat foto (satu per baris)</ProductInputLabel>
            <textarea value={(form.images || []).join('\n')} onChange={(event) => updateImagesFromText(event.target.value)} placeholder="https://.../depan.jpg" rows={4} className="w-full rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
          </label>
        </div>
      </ProductFormSection>

      <ProductFormSection
        title="Piramida aroma dan deskripsi"
        description="Pisahkan notes dengan koma. Deskripsi tampil di halaman produk."
      >
        <label className="grid gap-1.5">
          <ProductInputLabel>Top notes (pembuka)</ProductInputLabel>
          <input value={form.topNotes || ''} onChange={(event) => updateField('topNotes', event.target.value)} placeholder="Pisahkan dengan koma" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
        </label>
        <label className="grid gap-1.5">
          <ProductInputLabel>Heart notes (inti)</ProductInputLabel>
          <input value={form.heartNotes || ''} onChange={(event) => updateField('heartNotes', event.target.value)} placeholder="Pisahkan dengan koma" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
        </label>
        <label className="grid gap-1.5">
          <ProductInputLabel>Base notes (dasar)</ProductInputLabel>
          <input value={form.baseNotes || ''} onChange={(event) => updateField('baseNotes', event.target.value)} placeholder="Pisahkan dengan koma" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
        </label>
        <label className="grid gap-1.5">
          <ProductInputLabel>Deskripsi</ProductInputLabel>
          <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Cerita produk" rows={3} className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
        </label>
        <div className="grid gap-1.5 border-t border-[#e5e7eb] pt-3">
          <ProductInputLabel>Teks toko Inggris (/en)</ProductInputLabel>
          <span className={fieldHint}>Kolom yang kosong memakai teks Indonesia di atas.</span>
        </div>
        <label className="grid gap-1.5">
          <ProductInputLabel>Deskripsi (Inggris)</ProductInputLabel>
          <textarea value={form.descriptionEn || ''} onChange={(event) => updateField('descriptionEn', event.target.value)} placeholder="Product description in English" rows={3} className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
        </label>
        <label className="grid gap-1.5">
          <ProductInputLabel>Ringkasan aroma (Inggris)</ProductInputLabel>
          <input value={form.notesEn || ''} onChange={(event) => updateField('notesEn', event.target.value)} placeholder="Rose, musk, sandalwood" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
        </label>
        <label className="grid gap-1.5">
          <ProductInputLabel>Top notes (Inggris)</ProductInputLabel>
          <input value={form.topNotesEn || ''} onChange={(event) => updateField('topNotesEn', event.target.value)} placeholder="Pisahkan dengan koma" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
        </label>
        <label className="grid gap-1.5">
          <ProductInputLabel>Heart notes (Inggris)</ProductInputLabel>
          <input value={form.heartNotesEn || ''} onChange={(event) => updateField('heartNotesEn', event.target.value)} placeholder="Pisahkan dengan koma" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
        </label>
        <label className="grid gap-1.5">
          <ProductInputLabel>Base notes (Inggris)</ProductInputLabel>
          <input value={form.baseNotesEn || ''} onChange={(event) => updateField('baseNotesEn', event.target.value)} placeholder="Pisahkan dengan koma" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
        </label>
      </ProductFormSection>

      <ProductFormSection
        title="Kamu mungkin suka"
        description="Parfum yang ditawarkan di bawah halaman produk ini."
      >
        <RelatedFragrancePicker value={form.relatedFragrances} onChange={(next) => updateField('relatedFragrances', next)} products={products} productId={form.id} productSlug={form.slug} />
      </ProductFormSection>

      <ProductFormSection
        title="Label & tampil di toko"
        description="Draft tetap tersimpan di Studio tetapi tidak terlihat pembeli."
      >
        <div className={`rounded-2xl border p-3 ${canPublish ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <div className="flex items-start gap-2">
            {canPublish ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <div className="min-w-0">
              <div className="text-xs font-bold">{canPublish ? 'Siap tampil di toko' : 'Belum siap tampil di toko'}</div>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed opacity-80">
                {canPublish
                  ? `Alamat publik: /catalog/${publishChecklist.slug}`
                  : publishChecklist.blocking.map((item) => item.label).join(', ')}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {publishChecklist.items.map((item) => (
              <div key={item.key} className={`rounded-xl px-2 py-1.5 text-[10px] font-bold ${item.ok ? 'bg-white/75 text-emerald-800' : item.required ? 'bg-white/75 text-amber-800' : 'bg-white/60 text-[#6b7280]'}`}>
                {item.ok ? 'OK' : item.required ? 'Wajib' : 'Opsional'} · {item.label}
              </div>
            ))}
          </div>
        </div>
        {slugConflicts.length ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="text-xs font-bold">Alamat produk sudah dipakai</div>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed opacity-80">
                  Bentrok dengan {slugConflicts.map((item) => item.name).join(', ')}. Saat disimpan, alamatnya dibuat unik otomatis.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        <label className="flex items-start gap-3 rounded-2xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-800">
          <input type="checkbox" checked={Boolean(form.featured)} onChange={(event) => updateField('featured', event.target.checked)} className="mt-0.5" />
          <span>
            <span className="block">Pilihan di beranda</span>
            <span className="mt-0.5 block text-[10px] font-semibold opacity-75">Beranda memuat maks. 6 pilihan, urut katalog. Yang pertama jadi sorotan utama.</span>
          </span>
        </label>
        {/* A badge, kept apart from the scent family — see ProductForm for why. */}
        <label className="flex items-start gap-3 rounded-2xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-800">
          <input type="checkbox" checked={Boolean(form.limited)} onChange={(event) => updateField('limited', event.target.checked)} className="mt-0.5" />
          <span>
            <span className="block">Badge LIMITED</span>
            <span className="mt-0.5 block text-[10px] font-semibold opacity-75">Label LIMITED di kartu dan halaman produk.</span>
          </span>
        </label>
        {/* The Reserve line — see ProductForm for why it is a badge and not a category. */}
        <label className="flex items-start gap-3 rounded-2xl bg-stone-100 px-3 py-3 text-xs font-bold text-stone-800">
          <input type="checkbox" checked={Boolean(form.reserve)} onChange={(event) => updateField('reserve', event.target.checked)} className="mt-0.5" />
          <span>
            <span className="block">Lini RESERVE</span>
            <span className="mt-0.5 block text-[10px] font-semibold opacity-75">Label RESERVE untuk bahan alami yang langka.</span>
          </span>
        </label>
        <TestimonialsField value={form.testimonials} onChange={(next) => updateField('testimonials', next)} mobile />
        <label className={`flex items-start gap-3 rounded-2xl px-3 py-3 text-xs font-bold ${canPublish ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
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
            className="mt-0.5"
          />
          <span>
            <span className="block">Tampil di toko</span>
            <span className="mt-0.5 block text-[10px] font-semibold opacity-75">{canPublish ? 'Centang: muncul di toko setelah disimpan. Kosongkan: disimpan sebagai draft.' : 'Lengkapi checklist di atas dulu sebelum produk bisa tampil.'}</span>
          </span>
        </label>
      </ProductFormSection>

      <StickyBottomActionBar fixed reserveSpace aria-label="Aksi form produk">
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={resetForm} disabled={!hasUnsavedChanges}>Batalkan</Button>
          <Button type="button" className="h-12 min-w-0 rounded-2xl gap-2" onClick={handleSubmit} disabled={savingProduct || !requiredReady}>
            <Save className="h-4 w-4 shrink-0" />
            {/* Two short lines rather than one cut off: "Isi dulu: Nama, Kategori, Rin…" hid the very field
                it was asking for. */}
            <span className={`line-clamp-2 whitespace-normal text-left ${requiredReady ? '' : 'text-xs leading-tight'}`}>{savingProduct ? 'Menyimpan...' : requiredReady ? 'Simpan produk' : `Isi dulu: ${missingRequired.join(', ')}`}</span>
          </Button>
        </div>
        <Button type="button" variant="outline" className="mt-2 h-11 w-full rounded-2xl bg-white gap-2 text-xs font-bold" onClick={previewCurrentProduct}>
          <ExternalLink className="h-4 w-4" />
          Pratinjau di toko
        </Button>
      </StickyBottomActionBar>
    </form>
  );
};

export default MobileProductForm;
