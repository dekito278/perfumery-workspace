import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ExternalLink, ImageOff, ImagePlus, PackagePlus, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import {
  formatRupiah,
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
import { deleteProductImages, uploadProductImage } from '@/services/productImageStorageService.js';

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
  imageUrl: '',
  images: [],
  tags: '',
  mood: '',
  featured: true,
  catalogVisible: true,
};

export const toEditableProduct = (product) => ({
  ...product,
  catalogVisible: !isProductDraft(product),
  topNotes: product.topNotes.join(', '),
  heartNotes: product.heartNotes.join(', '),
  baseNotes: product.baseNotes.join(', '),
  variants: product.variants,
  tags: getVisibleProductTags(product).join(', '),
  internalTags: product.tags.filter((tag) => !getVisibleProductTags(product).includes(tag)),
  restockThreshold: getProductRestockThreshold(product),
  stockAdjustmentNote: '',
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
  restockThreshold: Number(product.restockThreshold || 0),
  size: product.size || '',
  variants: product.variants || [],
  notes: product.notes || '',
  topNotes: product.topNotes || '',
  heartNotes: product.heartNotes || '',
  baseNotes: product.baseNotes || '',
  description: product.description || '',
  imageUrl: product.imageUrl || '',
  images: product.images || [],
  tags: product.tags || '',
  mood: product.mood || '',
  featured: Boolean(product.featured),
  catalogVisible: Boolean(product.catalogVisible),
});

const buildStockCorrection = ({ form, previousProduct }) => {
  if (!previousProduct) return null;
  const previousVariants = new Map((previousProduct.variants || []).map((variant) => [variant.id || variant.size, variant]));
  const changedVariants = (form.variants || []).map((variant) => {
    const previous = previousVariants.get(variant.id || variant.size) || {};
    const before = Number(previous.stock || 0);
    const after = Number(variant.stock || 0);
    if (before === after) return null;
    return {
      id: variant.id || variant.size,
      size: variant.size,
      before,
      after,
    };
  }).filter(Boolean);
  const previousStock = Number(previousProduct.stock || 0);
  const nextStock = (form.variants || []).reduce((sum, variant) => sum + Number(variant.stock || 0), 0) || Number(form.stock || 0);
  if (!changedVariants.length && previousStock === nextStock) return null;
  return {
    id: `stock-${Date.now()}`,
    at: new Date().toISOString(),
    actor: 'Admin',
    note: form.stockAdjustmentNote || 'Manual stock correction',
    previousStock,
    nextStock,
    variants: changedVariants,
  };
};

/**
 * Shared create/edit product form. `product` null → create; a product object → edit.
 * `onSaved(savedProduct)` fires after a successful save so the parent page can navigate.
 */
const ProductForm = ({ product = null, onSaved }) => {
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
      toast.success(files.length > 1 ? 'Product images uploaded' : 'Product image uploaded');
    } catch (error) {
      toast.error(error.message || 'Gagal upload gambar produk');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.category.trim() || !form.notes.trim()) {
      toast.error('Product name, category, and notes are required');
      return;
    }
    if (form.catalogVisible && !publishChecklist.ready) {
      toast.error(`Produk belum siap publish: ${publishChecklist.blocking[0]?.message || 'lengkapi data wajib.'}`);
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
        priceNumber: Number(form.variants?.[0]?.priceNumber || form.priceNumber || 0),
        compareAtPriceNumber: Number(form.variants?.[0]?.compareAtPriceNumber || 0),
        stock: form.variants?.reduce((sum, variant) => sum + Number(variant.stock || 0), 0) || Number(form.stock || 0),
        size: form.variants?.[0]?.size || form.size,
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
    const preview = normalizeProduct({
      ...form,
      tags: getTagsForVisibility(form.tags, form.catalogVisible),
      priceNumber: Number(form.variants?.[0]?.priceNumber || form.priceNumber || 0),
      compareAtPriceNumber: Number(form.variants?.[0]?.compareAtPriceNumber || 0),
      stock: form.variants?.reduce((sum, variant) => sum + Number(variant.stock || 0), 0) || Number(form.stock || 0),
      size: form.variants?.[0]?.size || form.size,
    }, products);
    navigate(getProductStorefrontPath(preview), {
      state: {
        previewProduct: preview,
        previewMode: true,
        previewBackTo: '/studio/products',
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border bg-white/90 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">{product ? 'Edit produk' : 'Tambah produk'}</h2>
            {hasUnsavedChanges ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-700">Belum disimpan</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Form dibagi per bagian supaya edit produk tidak terasa panjang.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={previewCurrentProduct}><ExternalLink className="h-4 w-4" />Preview</Button>
          <Button type="button" variant="outline" className="rounded-2xl" onClick={resetForm}>Reset</Button>
        </div>
      </div>

      <Tabs defaultValue="utama" className="mt-5">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-editorial-paper p-1 lg:grid-cols-4">
          <TabsTrigger value="utama" className="rounded-xl text-xs font-bold">Utama</TabsTrigger>
          <TabsTrigger value="commercial" className="rounded-xl text-xs font-bold">Harga & stok</TabsTrigger>
          <TabsTrigger value="media" className="rounded-xl text-xs font-bold">Media</TabsTrigger>
          <TabsTrigger value="story" className="rounded-xl text-xs font-bold">Aroma & publish</TabsTrigger>
        </TabsList>

        <TabsContent value="utama" className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-xs font-bold uppercase text-muted-foreground">Nama produk</span>
            <input value={form.name} onChange={(event) => updateField('name', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Nama produk" />
          </label>
          <label>
            <span className="text-xs font-bold uppercase text-muted-foreground">Kategori</span>
            <select value={form.category} onChange={(event) => updateField('category', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300">
              <option value="">Pilih kategori</option>
              {categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
              {form.category && !categories.some((category) => category.name === form.category) ? <option value={form.category}>{form.category}</option> : null}
            </select>
          </label>
          <label>
            <span className="text-xs font-bold uppercase text-muted-foreground">Default size</span>
            <input value={form.size} onChange={(event) => updateField('size', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="30 ml" />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-bold uppercase text-muted-foreground">Ringkasan notes</span>
            <input value={form.notes} onChange={(event) => updateField('notes', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Rose, musk, sandalwood" />
          </label>
        </TabsContent>

        <TabsContent value="commercial" className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-xs font-bold uppercase text-muted-foreground">Harga</span>
            <input type="number" value={form.priceNumber} onChange={(event) => updateField('priceNumber', Number(event.target.value))} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" />
          </label>
          <label>
            <span className="text-xs font-bold uppercase text-muted-foreground">Harga coret</span>
            <input type="number" value={form.compareAtPriceNumber || 0} onChange={(event) => updateField('compareAtPriceNumber', Number(event.target.value))} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" />
          </label>
          <label>
            <span className="text-xs font-bold uppercase text-muted-foreground">Stok</span>
            <input type="number" value={form.stock} onChange={(event) => updateField('stock', Number(event.target.value))} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" />
          </label>
          <label>
            <span className="text-xs font-bold uppercase text-muted-foreground">Restock threshold</span>
            <input type="number" value={form.restockThreshold} onChange={(event) => updateField('restockThreshold', Number(event.target.value))} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" />
          </label>
          <div className="sm:col-span-2 rounded-2xl border bg-[#fbfaf7] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase text-muted-foreground">Varian ukuran, harga, stok</div>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Buat 10 ml, 30 ml, 50 ml, 100 ml dalam satu produk.</p>
              </div>
              <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white gap-2" onClick={addVariant}><Plus className="h-4 w-4" />Varian</Button>
            </div>
            <div className="mt-3 grid gap-2">
              {(form.variants || []).map((variant, index) => (
                <div key={variant.id || index} className="grid gap-2 rounded-2xl border bg-white p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  <input value={variant.size} onChange={(event) => updateVariant(index, 'size', event.target.value)} placeholder="30 ml" className="h-10 rounded-xl border px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  <input type="number" value={variant.priceNumber} onChange={(event) => updateVariant(index, 'priceNumber', event.target.value)} placeholder="Harga" className="h-10 rounded-xl border px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  <input type="number" value={variant.compareAtPriceNumber || 0} onChange={(event) => updateVariant(index, 'compareAtPriceNumber', event.target.value)} placeholder="Harga coret" className="h-10 rounded-xl border px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  <input type="number" value={variant.stock} onChange={(event) => updateVariant(index, 'stock', event.target.value)} placeholder="Stok" className="h-10 rounded-xl border px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeVariant(index)} disabled={(form.variants || []).length <= 1}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
          <label className="sm:col-span-2">
            <span className="text-xs font-bold uppercase text-muted-foreground">Catatan koreksi stok</span>
            <input value={form.stockAdjustmentNote} onChange={(event) => updateField('stockAdjustmentNote', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Contoh: restock 20 botol dari batch Mei" />
          </label>
        </TabsContent>

        <TabsContent value="media" className="mt-5">
          <div className="grid gap-4 rounded-2xl border bg-[#fbfaf7] p-4 sm:grid-cols-[0.9fr_1.1fr]">
            <ProductVisual product={{ ...form, category: form.category, size: form.size }} className="min-h-[220px]" />
            <div className="grid content-start gap-3">
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Product image URLs</span>
                <textarea value={(form.images || []).join('\n')} onChange={(event) => updateImagesFromText(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-amber-300" placeholder={'https://.../front.jpg\nhttps://.../detail.jpg'} />
              </label>
              <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border bg-white px-4 text-sm font-bold">
                <ImagePlus className="h-4 w-4" />
                {uploadingImage ? 'Mengupload...' : 'Upload gambar'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
              {(form.images || []).length ? (
                <div className="grid grid-cols-4 gap-2">
                  {form.images.map((image) => (
                    <div key={image} className="relative overflow-hidden rounded-2xl border bg-white">
                      <img src={image} alt="" className="h-16 w-full object-cover" />
                      <button type="button" onClick={() => removeImage(image)} className="absolute right-1 top-1 grid h-7 w-7 min-h-0 place-items-center rounded-full bg-white/90 text-rose-700" aria-label="Remove image">
                        <ImageOff className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="text-xs font-semibold text-muted-foreground">
                JPG, PNG, WebP, atau GIF sampai 15 MB per file. Upload otomatis dikompres ke WebP ringan sekitar 250 KB; gambar pertama menjadi cover katalog.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="story" className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className={`sm:col-span-2 rounded-2xl border p-4 ${canPublish ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <div className="flex items-start gap-3">
              {canPublish ? <PackagePlus className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
              <div className="min-w-0">
                <div className="text-sm font-bold">{canPublish ? 'Siap publish ke katalog' : 'Belum siap tampil di katalog'}</div>
                <p className="mt-1 text-xs font-semibold leading-relaxed opacity-80">
                  {canPublish
                    ? `Slug publik: /products/${publishChecklist.slug}`
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
                  <div className="text-sm font-bold">Slug produk sudah dipakai</div>
                  <p className="mt-1 text-xs font-semibold leading-relaxed opacity-80">
                    Bentrok dengan {slugConflicts.map((item) => item.name).join(', ')}. Saat disimpan, slug akan dibuat unik otomatis supaya link produk tidak saling menimpa.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {[
            ['topNotes', 'Top notes'],
            ['heartNotes', 'Heart notes'],
            ['baseNotes', 'Base notes'],
            ['tags', 'Tags'],
          ].map(([key, label]) => (
            <label key={key}>
              <span className="text-xs font-bold uppercase text-muted-foreground">{label}</span>
              <input value={form[key] || ''} onChange={(event) => updateField(key, event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Pisahkan dengan koma" />
            </label>
          ))}
          <label className="sm:col-span-2">
            <span className="text-xs font-bold uppercase text-muted-foreground">Deskripsi</span>
            <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Deskripsi produk" />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            <input type="checkbox" checked={Boolean(form.featured)} onChange={(event) => updateField('featured', event.target.checked)} />
            Featured di home
          </label>
          <label className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${canPublish ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
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
              className="mt-1"
            />
            <span>
              <span className="block">Tampilkan di katalog customer</span>
              <span className="mt-1 block text-xs font-semibold opacity-75">{canPublish ? 'Produk akan langsung muncul di shop setelah disimpan.' : 'Lengkapi checklist dulu sebelum produk bisa dipublish.'}</span>
            </span>
          </label>
        </TabsContent>
      </Tabs>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="submit" className="rounded-2xl gap-2" disabled={savingProduct}><Save className="h-4 w-4" />{savingProduct ? 'Menyimpan...' : 'Simpan produk'}</Button>
        <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={previewCurrentProduct}><ExternalLink className="h-4 w-4" />Preview draft</Button>
        <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={resetForm}><RotateCcw className="h-4 w-4" />Reset</Button>
      </div>
    </form>
  );
};

export default ProductForm;
