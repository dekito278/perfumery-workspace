import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, ImageOff, ImagePlus, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAccordion from '@/components/mobile-ui/MobileAccordion.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import {
  buildStockCorrection,
  formatRupiah,
  getProductBatchDetails,
  getProductFormulaId,
  getProductPublishChecklist,
  getProductRestockThreshold,
  getProductSlugConflicts,
  getProductStockCorrections,
  getProductStorefrontPath,
  getVisibleProductTags,
  isProductDraft,
  normalizeProduct,
  PRODUCT_DRAFT_TAG,
  saveCustomProduct,
} from '@/services/productCatalogService.js';
import { uploadProductImage } from '@/services/productImageStorageService.js';
import { formatQuantity } from '@/utils/formatting.js';

export const emptyProduct = {
  name: '',
  category: '',
  priceNumber: 289000,
  compareAtPriceNumber: 0,
  stock: 10,
  size: '30 ml',
  variants: [
    { id: '10-ml', size: '10 ml', priceNumber: 129000, compareAtPriceNumber: 0, stock: 5 },
    { id: '30-ml', size: '30 ml', priceNumber: 289000, compareAtPriceNumber: 0, stock: 10 },
  ],
  notes: '',
  topNotes: '',
  heartNotes: '',
  baseNotes: '',
  tags: '',
  description: '',
  imageUrl: '',
  images: [],
  featured: true,
  catalogVisible: true,
};

export const toProductForm = (product) => ({
  ...product,
  catalogVisible: !isProductDraft(product),
  topNotes: product.topNotes.join(', '),
  heartNotes: product.heartNotes.join(', '),
  baseNotes: product.baseNotes.join(', '),
  variants: product.variants,
  tags: getVisibleProductTags(product).join(', '),
  // Carry internal tags (batch key, formula id, SKU, stock movement, threshold, correction history)
  // separately — the visible `tags` string above strips them, and without this a mobile save would drop
  // every internal tag. Mirrors desktop toEditableProduct.
  internalTags: product.tags.filter((tag) => !getVisibleProductTags(product).includes(tag)),
  restockThreshold: getProductRestockThreshold(product),
  stockCorrections: getProductStockCorrections(product),
  images: product.images || (product.imageUrl ? [product.imageUrl] : []),
});

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

const snapshotProductForm = (product) => JSON.stringify({
  id: product.id || '',
  name: product.name || '',
  category: product.category || '',
  priceNumber: Number(product.priceNumber || 0),
  compareAtPriceNumber: Number(product.compareAtPriceNumber || 0),
  stock: Number(product.stock || 0),
  size: product.size || '',
  variants: product.variants || [],
  notes: product.notes || '',
  topNotes: product.topNotes || '',
  heartNotes: product.heartNotes || '',
  baseNotes: product.baseNotes || '',
  tags: product.tags || '',
  description: product.description || '',
  imageUrl: product.imageUrl || '',
  images: product.images || [],
  featured: Boolean(product.featured),
  catalogVisible: Boolean(product.catalogVisible),
});

const ProductFormSection = ({ children, eyebrow, title, description, action, defaultOpen = false }) => (
  <MobileAccordion
    title={eyebrow ? `${title} · ${eyebrow}` : title}
    meta={description}
    defaultOpen={defaultOpen}
  >
    <div className="grid gap-3">
      {action ? <div className="flex justify-end">{action}</div> : null}
      {children}
    </div>
  </MobileAccordion>
);

const ProductInputLabel = ({ children }) => (
  <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8b949e]">{children}</label>
);

/**
 * Shared mobile create/edit product form. `product` null → create; a product object → edit.
 * `onSaved(savedProduct)` fires after a successful save so the parent page can navigate.
 */
const MobileProductForm = ({ product = null, onSaved }) => {
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
  const primaryVariantPrice = Number(form.variants?.[0]?.priceNumber || form.priceNumber || 0);
  const requiredReady = Boolean(form.name.trim() && form.category.trim() && form.notes.trim());
  const publishChecklist = useMemo(() => getProductPublishChecklist(form), [form]);
  const canPublish = publishChecklist.ready;
  const currentFormSnapshot = useMemo(() => snapshotProductForm(form), [form]);
  const hasUnsavedChanges = currentFormSnapshot !== savedFormSnapshot;
  const slugConflicts = useMemo(() => getProductSlugConflicts(form, products), [form, products]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const confirmDiscardChanges = () => (
    !hasUnsavedChanges || window.confirm('Ada perubahan produk yang belum disimpan. Lanjut dan buang perubahan?')
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
    variants: [...current.variants, { id: `variant-${Date.now()}`, size: '50 ml', priceNumber: current.priceNumber, compareAtPriceNumber: current.compareAtPriceNumber || 0, stock: 0 }],
  }));
  const removeVariant = (index) => setForm((current) => ({
    ...current,
    variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
  }));
  const resetForm = () => {
    if (!confirmDiscardChanges()) return;
    setForm(initialForm);
    setSavedFormSnapshot(snapshotProductForm(initialForm));
  };

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
      toast.success('Gambar produk diupload');
    } catch (error) {
      toast.error(error.message || 'Gagal upload gambar produk');
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
      toast.error('Nama, kategori, dan ringkasan wajib diisi');
      return;
    }
    if (form.catalogVisible && !publishChecklist.ready) {
      toast.error(`Produk belum siap publish: ${publishChecklist.blocking[0]?.message || 'lengkapi data wajib.'}`);
      return;
    }
    setSavingProduct(true);
    try {
      const nextPrimaryVariantPrice = Number(form.variants?.[0]?.priceNumber || form.priceNumber || 0);
      // Record a stock-correction audit entry on edit, same as desktop, so mobile stock changes are traceable.
      const previousProduct = products.find((item) => item.id === form.id);
      const stockCorrection = buildStockCorrection({ form, previousProduct });
      const stockCorrections = stockCorrection
        ? [stockCorrection, ...(form.stockCorrections || [])]
        : (form.stockCorrections || []);
      const saved = await saveCustomProduct({
        ...form,
        stockCorrections,
        priceNumber: nextPrimaryVariantPrice,
        compareAtPriceNumber: Number(form.variants?.[0]?.compareAtPriceNumber || 0),
        stock: totalVariantStock,
        size: form.variants?.[0]?.size || form.size,
        price: formatRupiah(nextPrimaryVariantPrice),
        tags: getTagsForVisibility(form.tags, form.catalogVisible),
      });
      const nextForm = toProductForm(saved);
      setForm(nextForm);
      setSavedFormSnapshot(snapshotProductForm(nextForm));
      toast.success(form.catalogVisible ? 'Produk tersimpan dan tampil di katalog' : 'Produk tersimpan sebagai draft');
      onSaved?.(saved);
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan produk');
    } finally {
      setSavingProduct(false);
    }
  };

  const previewCurrentProduct = () => {
    if (hasUnsavedChanges && !window.confirm('Preview akan membuka halaman produk memakai data form saat ini. Perubahan belum tersimpan tetap belum masuk katalog. Lanjut preview?')) {
      return;
    }
    const previewPrice = Number(form.variants?.[0]?.priceNumber || form.priceNumber || 0);
    const preview = normalizeProduct({
      ...form,
      priceNumber: previewPrice,
      compareAtPriceNumber: Number(form.variants?.[0]?.compareAtPriceNumber || 0),
      stock: form.variants?.reduce((sum, variant) => sum + Number(variant.stock || 0), 0) || Number(form.stock || 0),
      size: form.variants?.[0]?.size || form.size,
      price: formatRupiah(previewPrice),
      tags: getTagsForVisibility(form.tags, form.catalogVisible),
    }, products);
    navigate(getProductStorefrontPath(preview, { mobile: true }), {
      state: {
        previewProduct: preview,
        previewMode: true,
        previewBackTo: '/mobile/studio/products',
      },
    });
  };

  return (
    <form id="mobile-product-form" onSubmit={handleSubmit} className="space-y-4">
      <section className="mobile-soft-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">{product ? 'Edit produk' : 'Produk baru'}</div>
            <h1 className="mt-1 text-2xl font-bold text-editorial-charcoal">{form.name || 'Buat item katalog'}</h1>
            {hasUnsavedChanges ? (
              <div className="mt-2 w-fit rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-700">Belum disimpan</div>
            ) : null}
            <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">
              Isi bagian penting dulu, lalu lengkapi visual dan cerita produk sebelum tampil di katalog.
            </p>
          </div>
          <div className="grid shrink-0 gap-2">
            <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white px-3 text-xs gap-1" onClick={previewCurrentProduct}><ExternalLink className="h-3.5 w-3.5" />Preview</Button>
            <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white px-3 text-xs" onClick={resetForm}>Reset</Button>
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
            <div className={`mt-1 truncate text-xs font-bold ${form.catalogVisible && canPublish ? 'text-emerald-700' : 'text-amber-700'}`}>{form.catalogVisible ? (canPublish ? 'Live' : 'Belum siap') : 'Draf'}</div>
          </div>
        </div>
      </section>

      {(linkedFormulaId || batchDetails.batchKey) ? (
      <ProductFormSection
        eyebrow="Sumber"
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
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Batch</div>
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
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Dilution</div>
                <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatQuantity(batchDetails.dilutionPercent, 1)}%</div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Susut</div>
                <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatQuantity(batchDetails.lossPercent, 1)}%</div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">COGS/bottle</div>
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
        eyebrow="Utama"
        title="Identitas"
        description="Nama, kategori, dan ringkasan adalah field wajib untuk menyimpan produk."
        defaultOpen
      >
        <div className="grid gap-1.5">
          <ProductInputLabel>Nama produk</ProductInputLabel>
          <input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Nama produk" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
        </div>
        <div className="grid gap-1.5">
          <ProductInputLabel>Kategori</ProductInputLabel>
          <select value={form.category} onChange={(event) => updateField('category', event.target.value)} className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300">
            <option value="">Kategori</option>
            {categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
            {form.category && !categories.some((category) => category.name === form.category) ? <option value={form.category}>{form.category}</option> : null}
          </select>
        </div>
        <div className="grid gap-1.5">
          <ProductInputLabel>Ringkasan notes</ProductInputLabel>
          <input value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Ringkasan singkat katalog" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
        </div>
      </ProductFormSection>

      <ProductFormSection
        eyebrow="Commercial"
        title="Varian, harga, dan stok"
        description="Varian pertama dipakai sebagai harga utama di katalog. Total stok dihitung dari semua varian."
        action={<Button type="button" variant="outline" className="h-10 rounded-2xl bg-white gap-1 px-3 text-xs" onClick={addVariant}><Plus className="h-4 w-4" />Tambah</Button>}
      >
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
          <div className="grid gap-1.5">
            <ProductInputLabel>Harga dasar</ProductInputLabel>
            <input type="number" value={form.priceNumber} onChange={(event) => updateField('priceNumber', Number(event.target.value))} className="h-11 rounded-xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
          </div>
          <div className="grid gap-1.5">
            <ProductInputLabel>Harga coret</ProductInputLabel>
            <input type="number" value={form.compareAtPriceNumber || 0} onChange={(event) => updateField('compareAtPriceNumber', Number(event.target.value))} placeholder="Harga coret" className="h-11 rounded-xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
          </div>
          <div className="grid gap-1.5">
            <ProductInputLabel>Stok total</ProductInputLabel>
            <input type="number" value={totalVariantStock} readOnly disabled className="h-11 rounded-xl border border-[#e5e7eb] bg-[#f3f1ec] px-3 text-sm font-semibold text-muted-foreground outline-none" />
            <span className="text-[11px] font-semibold text-[#8b949e]">Otomatis dari total stok varian. Ubah stok per ukuran di bawah.</span>
          </div>
          <div className="grid gap-1.5">
            <ProductInputLabel>Ukuran dasar</ProductInputLabel>
            <input value={form.size} onChange={(event) => updateField('size', event.target.value)} placeholder="30 ml" className="h-11 rounded-xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
          </div>
        </div>
        <div className="grid gap-2">
          {(form.variants || []).map((variant, index) => (
            <div key={variant.id || index} className="grid grid-cols-2 gap-2 rounded-2xl border bg-white p-2">
              <input value={variant.size} onChange={(event) => updateVariant(index, 'size', event.target.value)} placeholder="30 ml" className="h-10 rounded-xl border px-2 text-xs font-semibold outline-none focus:border-amber-300" />
              <input type="number" value={variant.priceNumber} onChange={(event) => updateVariant(index, 'priceNumber', event.target.value)} placeholder="Harga" className="h-10 rounded-xl border px-2 text-xs font-semibold outline-none focus:border-amber-300" />
              <input type="number" value={variant.compareAtPriceNumber || 0} onChange={(event) => updateVariant(index, 'compareAtPriceNumber', event.target.value)} placeholder="Harga coret" className="h-10 rounded-xl border px-2 text-xs font-semibold outline-none focus:border-amber-300" />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input type="number" value={variant.stock} onChange={(event) => updateVariant(index, 'stock', event.target.value)} placeholder="Stok" className="h-10 rounded-xl border px-2 text-xs font-semibold outline-none focus:border-amber-300" />
                <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeVariant(index)} disabled={(form.variants || []).length <= 1}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </ProductFormSection>

      <ProductFormSection
        eyebrow="Media"
        title="Visual produk"
        description="Preview gambar utama, upload WebP ringan, atau paste URL gambar satu per baris."
      >
        <div className="rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
          <ProductVisual product={{ ...form, category: form.category, size: form.size }} className="h-40" />
          <textarea value={(form.images || []).join('\n')} onChange={(event) => updateImagesFromText(event.target.value)} placeholder="URL gambar produk, satu per baris" rows={4} className="mt-3 w-full rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
          <label className="mt-2 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border bg-white px-3 text-xs font-bold">
            <ImagePlus className="h-4 w-4" />
            {uploadingImage ? 'Mengupload...' : 'Upload gambar'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={handleImageUpload} disabled={uploadingImage} />
          </label>
          {(form.images || []).length ? (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {form.images.map((image) => (
                <div key={image} className="relative overflow-hidden rounded-2xl border bg-white">
                  <img src={image} alt="" className="h-14 w-full object-cover" loading="lazy" decoding="async" width="120" height="56" />
                  <button type="button" onClick={() => removeImage(image)} className="absolute right-1 top-1 grid h-7 w-7 min-h-0 place-items-center rounded-full bg-white/90 text-rose-700" aria-label="Hapus gambar">
                    <ImageOff className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-[11px] font-semibold leading-relaxed text-[#6b7280]">
            Upload otomatis dikompres ke WebP ringan sekitar 250 KB per gambar.
          </p>
        </div>
      </ProductFormSection>

      <ProductFormSection
        eyebrow="Story"
        title="Profil aroma dan deskripsi"
        description="Gunakan koma untuk memisahkan notes. Deskripsi dipakai sebagai copy katalog."
      >
        <input value={form.topNotes || ''} onChange={(event) => updateField('topNotes', event.target.value)} placeholder="Top notes, pisahkan dengan koma" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
        <input value={form.heartNotes || ''} onChange={(event) => updateField('heartNotes', event.target.value)} placeholder="Heart notes, pisahkan dengan koma" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
        <input value={form.baseNotes || ''} onChange={(event) => updateField('baseNotes', event.target.value)} placeholder="Base notes, pisahkan dengan koma" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
        <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Deskripsi" rows={3} className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
      </ProductFormSection>

      <ProductFormSection
        eyebrow="Publishing"
        title="Visibilitas katalog"
        description="Draft tetap tersimpan di studio tetapi tidak muncul di shop customer."
      >
        <div className={`rounded-2xl border p-3 ${canPublish ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <div className="flex items-start gap-2">
            {canPublish ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <div className="min-w-0">
              <div className="text-xs font-bold">{canPublish ? 'Siap publish ke katalog' : 'Belum siap tampil di katalog'}</div>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed opacity-80">
                {canPublish
                  ? `Slug publik: /mobile/products/${publishChecklist.slug}`
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
                <div className="text-xs font-bold">Slug sudah dipakai</div>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed opacity-80">
                  Bentrok dengan {slugConflicts.map((item) => item.name).join(', ')}. Saat disimpan, slug akan dibuat unik otomatis.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        <label className="flex items-center gap-3 rounded-2xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-800">
          <input type="checkbox" checked={Boolean(form.featured)} onChange={(event) => updateField('featured', event.target.checked)} />
          Featured di home
        </label>
        <label className={`flex items-start gap-3 rounded-2xl px-3 py-3 text-xs font-bold ${canPublish ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
          <input
            type="checkbox"
            checked={Boolean(form.catalogVisible)}
            onChange={(event) => {
              if (event.target.checked && !canPublish) {
                toast.error(`Belum bisa publish: ${publishChecklist.blocking[0]?.message || 'lengkapi data wajib.'}`);
                updateField('catalogVisible', false);
                return;
              }
              updateField('catalogVisible', event.target.checked);
            }}
            className="mt-0.5"
          />
          <span>
            <span className="block">Tampilkan di katalog customer</span>
            <span className="mt-0.5 block text-[10px] font-semibold opacity-75">{canPublish ? 'Produk akan langsung muncul di shop setelah disimpan.' : 'Lengkapi checklist dulu sebelum produk bisa dipublish.'}</span>
          </span>
        </label>
      </ProductFormSection>

      <StickyBottomActionBar fixed reserveSpace keyboardBehavior="stay" aria-label="Aksi form produk">
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={resetForm}>Reset</Button>
          <Button type="button" className="h-12 rounded-2xl gap-2" onClick={handleSubmit} disabled={savingProduct || !requiredReady}>
            <Save className="h-4 w-4" />
            {savingProduct ? 'Menyimpan...' : requiredReady ? 'Simpan produk' : 'Lengkapi wajib'}
          </Button>
        </div>
        <Button type="button" variant="outline" className="mt-2 h-11 w-full rounded-2xl bg-white gap-2 text-xs font-bold" onClick={previewCurrentProduct}>
          <ExternalLink className="h-4 w-4" />
          Preview draft
        </Button>
      </StickyBottomActionBar>
    </form>
  );
};

export default MobileProductForm;
