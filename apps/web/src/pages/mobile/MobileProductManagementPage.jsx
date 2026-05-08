import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Edit3, ImageOff, ImagePlus, PackagePlus, Plus, Save, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import { deleteCustomProduct, formatRupiah, saveCustomProduct } from '@/services/productCatalogService.js';
import { uploadProductImage } from '@/services/productImageStorageService.js';
import { deleteStorefrontCategory, saveStorefrontCategory } from '@/services/storefrontCategoryService.js';

const emptyProduct = {
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
};

const MobileProductManagementPage = () => {
  const products = useCatalogProducts();
  const categories = useStorefrontCategories(products);
  const customProducts = useMemo(() => products.filter((product) => product.source === 'custom'), [products]);
  const categoryUsage = useMemo(() => products.reduce((usage, product) => {
    if (!product.category) return usage;
    usage.set(product.category.toLowerCase(), (usage.get(product.category.toLowerCase()) || 0) + 1);
    return usage;
  }, new Map()), [products]);
  const [form, setForm] = useState(emptyProduct);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

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
      toast.error('Name, category, and notes are required');
      return;
    }
    setSavingProduct(true);
    try {
      const product = await saveCustomProduct({
        ...form,
        priceNumber: Number(form.variants?.[0]?.priceNumber || form.priceNumber || 0),
        compareAtPriceNumber: Number(form.variants?.[0]?.compareAtPriceNumber || 0),
        stock: form.variants?.reduce((sum, variant) => sum + Number(variant.stock || 0), 0) || Number(form.stock || 0),
        size: form.variants?.[0]?.size || form.size,
        price: formatRupiah(form.priceNumber),
      });
      setForm({
        ...product,
        topNotes: product.topNotes.join(', '),
        heartNotes: product.heartNotes.join(', '),
        baseNotes: product.baseNotes.join(', '),
        variants: product.variants,
        tags: product.tags.join(', '),
        images: product.images || (product.imageUrl ? [product.imageUrl] : []),
      });
      toast.success('Product saved');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleEdit = (product) => setForm({
    ...product,
    topNotes: product.topNotes.join(', '),
    heartNotes: product.heartNotes.join(', '),
    baseNotes: product.baseNotes.join(', '),
    variants: product.variants,
    tags: product.tags.join(', '),
    images: product.images || (product.imageUrl ? [product.imageUrl] : []),
  });

  const handleDelete = async (product) => {
    await deleteCustomProduct(product.id);
    if (form.id === product.id) resetForm();
    toast.success('Product removed');
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    setSavingCategory(true);
    try {
      const category = await saveStorefrontCategory(categoryForm);
      setCategoryForm({ name: '', description: '' });
      if (!form.category) {
        updateField('category', category.name);
      }
      toast.success('Category saved');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleCategoryDelete = async (category) => {
    await deleteStorefrontCategory(category.id);
    if (form.category === category.name) {
      updateField('category', '');
    }
    toast.success('Category removed');
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet>
        <title>Products - Solivagant</title>
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title="Products" subtitle={`${products.length} catalog items`} eyebrow="Studio admin" action={<PackagePlus className="h-5 w-5 text-amber-700" />} />

        <form onSubmit={handleSubmit} className="mobile-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#1f2937]">{form.id ? 'Edit product' : 'Add product'}</h2>
            <Button type="button" variant="outline" className="h-9 rounded-2xl bg-white px-3 text-xs" onClick={resetForm}>New</Button>
          </div>
          <div className="mt-3 grid gap-3">
            <input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Product name" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <div className="grid grid-cols-2 gap-2">
              <select value={form.category} onChange={(event) => updateField('category', event.target.value)} className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300">
                <option value="">Category</option>
                {categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
                {form.category && !categories.some((category) => category.name === form.category) ? <option value={form.category}>{form.category}</option> : null}
              </select>
              <input type="number" value={form.priceNumber} onChange={(event) => updateField('priceNumber', Number(event.target.value))} className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
              <input type="number" value={form.compareAtPriceNumber || 0} onChange={(event) => updateField('compareAtPriceNumber', Number(event.target.value))} placeholder="Harga coret" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
              <input type="number" value={form.stock} onChange={(event) => updateField('stock', Number(event.target.value))} className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
              <input value={form.size} onChange={(event) => updateField('size', event.target.value)} placeholder="30 ml" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            </div>
            <div className="rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#1f2937]">Varian ukuran</h3>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#6b7280]">Ukuran, harga, harga coret, stok.</p>
                </div>
                <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white gap-1 px-3 text-xs" onClick={addVariant}><Plus className="h-4 w-4" />Add</Button>
              </div>
              <div className="mt-3 grid gap-2">
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
            </div>
            <input value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Notes summary" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <div className="rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
              <ProductVisual product={{ ...form, category: form.category, size: form.size }} className="h-40" />
              <textarea value={(form.images || []).join('\n')} onChange={(event) => updateImagesFromText(event.target.value)} placeholder="Product image URLs, one per line" rows={4} className="mt-3 w-full rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
              <label className="mt-2 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border bg-white px-3 text-xs font-bold">
                <ImagePlus className="h-4 w-4" />
                {uploadingImage ? 'Uploading...' : 'Upload images'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
              {(form.images || []).length ? (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {form.images.map((image) => (
                    <div key={image} className="relative overflow-hidden rounded-2xl border bg-white">
                      <img src={image} alt="" className="h-14 w-full object-cover" />
                      <button type="button" onClick={() => removeImage(image)} className="absolute right-1 top-1 grid h-7 w-7 min-h-0 place-items-center rounded-full bg-white/90 text-rose-700" aria-label="Remove image">
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
            <input value={form.topNotes || ''} onChange={(event) => updateField('topNotes', event.target.value)} placeholder="Top notes, comma separated" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <input value={form.heartNotes || ''} onChange={(event) => updateField('heartNotes', event.target.value)} placeholder="Heart notes, comma separated" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <input value={form.baseNotes || ''} onChange={(event) => updateField('baseNotes', event.target.value)} placeholder="Base notes, comma separated" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Description" rows={3} className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <label className="flex items-center gap-3 rounded-2xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-800">
              <input type="checkbox" checked={Boolean(form.featured)} onChange={(event) => updateField('featured', event.target.checked)} />
              Featured on home
            </label>
            <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={savingProduct}><Save className="h-4 w-4" />{savingProduct ? 'Saving...' : 'Save product'}</Button>
          </div>
        </form>

        <section className="mobile-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#1f2937]">Product categories</h2>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Buat kategori sendiri, lalu pilih di produk.</p>
            </div>
            <Tags className="h-5 w-5 text-amber-700" />
          </div>
          <form onSubmit={handleCategorySubmit} className="mt-3 grid gap-2">
            <input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} placeholder="Limited, Regular, Gift set..." className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <input value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} placeholder="Optional description" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <Button type="submit" className="h-11 rounded-2xl" disabled={savingCategory}>{savingCategory ? 'Saving...' : 'Add category'}</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((category) => {
              const usageCount = categoryUsage.get(category.name.toLowerCase()) || 0;
              const canDelete = category.source !== 'product' && usageCount === 0;
              return (
                <span key={category.name} className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] px-3 py-2 text-[11px] font-bold text-[#344054]">
                  {category.name}
                  <span className="text-[10px] text-[#8b949e]">{usageCount}</span>
                  {canDelete ? (
                    <button type="button" onClick={() => handleCategoryDelete(category)} className="text-rose-600" aria-label={`Delete ${category.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </span>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Daftar produk</h2>
            <span className="text-xs font-bold text-amber-700">{customProducts.length} produk</span>
          </div>
          {customProducts.map((product) => (
            <article key={product.id} className="mobile-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="grid min-w-0 flex-1 grid-cols-[72px_1fr] gap-3">
                  <ProductVisual product={product} className="h-20 rounded-2xl" label={false} />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[#1f2937]">{product.name}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">{product.notes}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {product.variants.slice(0, 3).map((variant) => (
                        <span key={variant.id || variant.size} className={`rounded-full px-2 py-1 text-[10px] font-bold ${variant.stock > 0 && variant.stock <= 5 ? 'bg-rose-50 text-rose-700' : 'bg-[#eef2e8] text-[#263d27]'}`}>
                          {variant.size}: {variant.stock}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] font-bold uppercase text-amber-700">{product.category} / {product.price} / total {product.stock}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl bg-white" onClick={() => handleEdit(product)} aria-label={`Edit ${product.name}`}><Edit3 className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => handleDelete(product)} aria-label={`Delete ${product.name}`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </article>
          ))}
          {!customProducts.length ? (
            <div className="mobile-card p-5 text-center">
              <h3 className="font-bold text-[#1f2937]">No custom products yet</h3>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Save one product above to publish it into catalog.</p>
            </div>
          ) : null}
        </section>
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileProductManagementPage;

