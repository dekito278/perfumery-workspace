import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock3, Edit3, ImagePlus, ImageOff, PackagePlus, Plus, RotateCcw, Save, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { featuredProducts } from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import {
  deleteCustomProduct,
  formatRupiah,
  getProductRestockThreshold,
  getProductStockCorrections,
  getVisibleProductTags,
  resetCustomProducts,
  saveCustomProduct,
} from '@/services/productCatalogService.js';
import { uploadProductImage } from '@/services/productImageStorageService.js';

const emptyProduct = {
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
};

const toEditableProduct = (product) => ({
  ...product,
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

const ProductManagementPage = () => {
  const navigate = useNavigate();
  const products = useCatalogProducts();
  const categories = useStorefrontCategories(products);
  const customProducts = useMemo(() => products.filter((product) => product.source === 'custom'), [products]);
  const lowStockProducts = useMemo(() => customProducts.filter((product) => product.stock > 0 && product.stock <= getProductRestockThreshold(product)), [customProducts]);
  const stockCorrectionHistory = useMemo(() => customProducts.flatMap((product) => (
    getProductStockCorrections(product).map((event) => ({
      ...event,
      productId: product.id,
      productName: product.name,
      threshold: getProductRestockThreshold(product),
    }))
  )).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), [customProducts]);
  const categoryUsage = useMemo(() => products.reduce((usage, product) => {
    if (!product.category) return usage;
    usage.set(product.category.toLowerCase(), (usage.get(product.category.toLowerCase()) || 0) + 1);
    return usage;
  }, new Map()), [products]);
  const [form, setForm] = useState(emptyProduct);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

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

  const resetForm = () => setForm(emptyProduct);

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
      toast.error(error.message || 'Failed to upload product image');
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

    setSavingProduct(true);
    try {
      const previousProduct = products.find((product) => product.id === form.id);
      const stockCorrection = buildStockCorrection({ form, previousProduct });
      const stockCorrections = stockCorrection
        ? [stockCorrection, ...(form.stockCorrections || [])]
        : (form.stockCorrections || []);
      const product = await saveCustomProduct({
        ...form,
        internalTags: form.internalTags,
        restockThreshold: Number(form.restockThreshold || 0),
        stockCorrections,
        priceNumber: Number(form.variants?.[0]?.priceNumber || form.priceNumber || 0),
        compareAtPriceNumber: Number(form.variants?.[0]?.compareAtPriceNumber || 0),
        stock: form.variants?.reduce((sum, variant) => sum + Number(variant.stock || 0), 0) || Number(form.stock || 0),
        size: form.variants?.[0]?.size || form.size,
        price: formatRupiah(form.priceNumber),
      });
      setForm(toEditableProduct(product));
      toast.success(stockCorrection ? 'Product saved and stock correction logged' : 'Product saved to catalog');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleEdit = (product) => setForm(toEditableProduct(product));

  const handleDelete = async (product) => {
    await deleteCustomProduct(product.id);
    if (form.id === product.id) resetForm();
    toast.success('Product removed from custom catalog');
  };

  const handleResetAll = async () => {
    await resetCustomProducts();
    resetForm();
    toast.success('Custom products reset');
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Product Management - Solivagant</title>
        <meta name="description" content="Manage custom storefront products for Solivagant." />
      </Helmet>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <PackagePlus className="h-4 w-4 text-primary" />
              E-commerce
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Product management</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Tambah dan edit produk custom untuk katalog e-commerce. Product categories dikelola di halaman terpisah supaya struktur toko tetap rapi.
            </p>
            <div className="mt-5">
              <Button variant="outline" className="h-11 rounded-2xl gap-2 border-white/70 bg-white/80 px-5" onClick={() => navigate('/studio/product-categories')}>
                <Tags className="h-4 w-4" />
                Manage product categories
              </Button>
            </div>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">All catalog products</span><strong>{products.length}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Seed products</span><strong>{featuredProducts.length}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Custom products</span><strong>{customProducts.length}</strong></div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={handleSubmit} className="rounded-2xl border bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">{form.id ? 'Edit product' : 'Add product'}</h2>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={resetForm}>New</Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-xs font-bold uppercase text-muted-foreground">Name</span>
                <input value={form.name} onChange={(event) => updateField('name', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Product name" />
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Category</span>
                <select value={form.category} onChange={(event) => updateField('category', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300">
                  <option value="">Select category</option>
                  {categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
                  {form.category && !categories.some((category) => category.name === form.category) ? <option value={form.category}>{form.category}</option> : null}
                </select>
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Price</span>
                <input type="number" value={form.priceNumber} onChange={(event) => updateField('priceNumber', Number(event.target.value))} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" />
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Harga coret</span>
                <input type="number" value={form.compareAtPriceNumber || 0} onChange={(event) => updateField('compareAtPriceNumber', Number(event.target.value))} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" />
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Stock</span>
                <input type="number" value={form.stock} onChange={(event) => updateField('stock', Number(event.target.value))} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" />
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Restock threshold</span>
                <input type="number" value={form.restockThreshold} onChange={(event) => updateField('restockThreshold', Number(event.target.value))} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" />
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Default size</span>
                <input value={form.size} onChange={(event) => updateField('size', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="30 ml" />
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
                <span className="text-xs font-bold uppercase text-muted-foreground">Notes summary</span>
                <input value={form.notes} onChange={(event) => updateField('notes', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Rose, musk, sandalwood" />
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-bold uppercase text-muted-foreground">Catatan koreksi stok</span>
                <input value={form.stockAdjustmentNote} onChange={(event) => updateField('stockAdjustmentNote', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Contoh: restock 20 botol dari batch Mei" />
              </label>
              <div className="sm:col-span-2 grid gap-4 rounded-2xl border bg-[#fbfaf7] p-4 sm:grid-cols-[0.9fr_1.1fr]">
                <ProductVisual product={{ ...form, category: form.category, size: form.size }} className="min-h-[220px]" />
                <div className="grid content-start gap-3">
                  <label>
                    <span className="text-xs font-bold uppercase text-muted-foreground">Product image URLs</span>
                    <textarea value={(form.images || []).join('\n')} onChange={(event) => updateImagesFromText(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-amber-300" placeholder={'https://.../front.jpg\nhttps://.../detail.jpg'} />
                  </label>
                  <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border bg-white px-4 text-sm font-bold">
                    <ImagePlus className="h-4 w-4" />
                    {uploadingImage ? 'Uploading...' : 'Upload images'}
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
              {[
                ['topNotes', 'Top notes'],
                ['heartNotes', 'Heart notes'],
                ['baseNotes', 'Base notes'],
                ['tags', 'Tags'],
              ].map(([key, label]) => (
                <label key={key}>
                  <span className="text-xs font-bold uppercase text-muted-foreground">{label}</span>
                  <input value={form[key] || ''} onChange={(event) => updateField(key, event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Comma separated" />
                </label>
              ))}
              <label className="sm:col-span-2">
                <span className="text-xs font-bold uppercase text-muted-foreground">Description</span>
                <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Product description" />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                <input type="checkbox" checked={Boolean(form.featured)} onChange={(event) => updateField('featured', event.target.checked)} />
                Featured on home
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="submit" className="rounded-2xl gap-2" disabled={savingProduct}><Save className="h-4 w-4" />{savingProduct ? 'Saving...' : 'Save product'}</Button>
              <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={resetForm}><RotateCcw className="h-4 w-4" />Clear</Button>
            </div>
          </form>

          <div className="grid gap-6">
            <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Inventory ops</h2>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">Threshold restock, notifikasi low stock, dan riwayat koreksi stok.</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-rose-700" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-rose-50 px-4 py-3">
                  <div className="text-xs font-bold uppercase text-rose-700">Low stock</div>
                  <div className="mt-1 text-2xl font-bold text-rose-800">{lowStockProducts.length}</div>
                </div>
                <div className="rounded-2xl bg-amber-50 px-4 py-3">
                  <div className="text-xs font-bold uppercase text-amber-700">Corrections</div>
                  <div className="mt-1 text-2xl font-bold text-amber-800">{stockCorrectionHistory.length}</div>
                </div>
                <div className="rounded-2xl bg-[#eef2e8] px-4 py-3">
                  <div className="text-xs font-bold uppercase text-[#263d27]">Avg threshold</div>
                  <div className="mt-1 text-2xl font-bold text-[#263d27]">
                    {customProducts.length ? Math.round(customProducts.reduce((sum, product) => sum + getProductRestockThreshold(product), 0) / customProducts.length) : 0}
                  </div>
                </div>
              </div>
              {lowStockProducts.length ? (
                <div className="mt-4 grid gap-2">
                  {lowStockProducts.slice(0, 4).map((product) => (
                    <button key={product.id} type="button" onClick={() => handleEdit(product)} className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-left">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-[#1f2937]">{product.name}</span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-rose-700">{product.stock} / min {getProductRestockThreshold(product)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-[#fbfaf7] px-4 py-3 text-sm font-semibold text-muted-foreground">Semua custom product masih di atas restock threshold.</p>
              )}
              <div className="mt-5 border-t pt-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-[#263d27]">
                  <Clock3 className="h-4 w-4" />
                  Riwayat koreksi stok
                </div>
                <div className="grid gap-2">
                  {stockCorrectionHistory.slice(0, 5).map((event) => (
                    <div key={`${event.productId}-${event.id}`} className="rounded-2xl bg-[#fbfaf7] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#1f2937]">{event.productName}</div>
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">{event.note || 'Manual stock correction'}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-[#263d27]">{event.previousStock} -&gt; {event.nextStock}</span>
                      </div>
                    </div>
                  ))}
                  {!stockCorrectionHistory.length ? <p className="text-sm font-semibold text-muted-foreground">Belum ada koreksi stok manual yang tercatat.</p> : null}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Product categories</h2>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">Kategori tampil di sini sebagai reference. Kelola detailnya di halaman kategori.</p>
                </div>
                <Tags className="h-5 w-5 text-amber-700" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((category) => {
                  const usageCount = categoryUsage.get(category.name.toLowerCase()) || 0;
                  return (
                    <span key={category.name} className="inline-flex items-center gap-2 rounded-2xl border bg-[#fbfaf7] px-3 py-2 text-xs font-bold text-[#344054]">
                      {category.name}
                      <span className="text-[10px] uppercase text-muted-foreground">{usageCount} product</span>
                    </span>
                  );
                })}
              </div>
              <Button type="button" variant="outline" className="mt-5 h-11 rounded-2xl gap-2 bg-white" onClick={() => navigate('/studio/product-categories')}>
                <Tags className="h-4 w-4" />
                Open product categories
              </Button>
            </section>

          <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Daftar produk</h2>
              {customProducts.length ? <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={handleResetAll}>Reset all</Button> : null}
            </div>
            <div className="mt-5 grid gap-3">
              {customProducts.map((product) => (
                <article key={product.id} className="rounded-2xl border bg-[#fbfaf7] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid min-w-0 flex-1 grid-cols-[84px_1fr] gap-3">
                      <ProductVisual product={product} className="h-24 rounded-2xl" label={false} />
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold">{product.name}</h3>
                        <p className="mt-1 text-sm font-semibold text-muted-foreground">{product.notes}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {product.variants.slice(0, 4).map((variant) => (
                            <span key={variant.id || variant.size} className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${variant.stock > 0 && variant.stock <= 5 ? 'bg-rose-50 text-rose-700' : 'bg-[#eef2e8] text-[#263d27]'}`}>
                              {variant.size}: {variant.stock}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-xs font-bold uppercase text-amber-700">{product.category} / {product.price} / total {product.stock} left / min {getProductRestockThreshold(product)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" size="icon" variant="outline" className="rounded-2xl bg-white" onClick={() => handleEdit(product)} aria-label={`Edit ${product.name}`}><Edit3 className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="outline" className="rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => handleDelete(product)} aria-label={`Delete ${product.name}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </article>
              ))}
              {!customProducts.length ? (
                <div className="rounded-2xl border border-dashed bg-[#fbfaf7] p-6 text-center">
                  <h3 className="font-bold">No custom products yet</h3>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">Add one from the form to publish it into the catalog.</p>
                </div>
              ) : null}
            </div>
          </section>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default ProductManagementPage;

