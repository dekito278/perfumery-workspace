import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Edit3, ImagePlus, PackagePlus, Save, Tags, Trash2 } from 'lucide-react';
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
  stock: 10,
  size: '30 ml',
  notes: '',
  topNotes: '',
  heartNotes: '',
  baseNotes: '',
  tags: '',
  description: '',
  imageUrl: '',
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
  const resetForm = () => setForm(emptyProduct);

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingImage(true);
    try {
      const imageUrl = await uploadProductImage(file, form.name);
      updateField('imageUrl', imageUrl);
      toast.success('Product image uploaded');
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
      const product = await saveCustomProduct({ ...form, price: formatRupiah(form.priceNumber) });
      setForm({
        ...product,
        topNotes: product.topNotes.join(', '),
        heartNotes: product.heartNotes.join(', '),
        baseNotes: product.baseNotes.join(', '),
        tags: product.tags.join(', '),
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
    tags: product.tags.join(', '),
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
        <title>Products - Solivagant Studio</title>
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
              <input type="number" value={form.stock} onChange={(event) => updateField('stock', Number(event.target.value))} className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
              <input value={form.size} onChange={(event) => updateField('size', event.target.value)} placeholder="30 ml" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            </div>
            <input value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Notes summary" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <div className="rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
              <ProductVisual product={{ ...form, category: form.category, size: form.size }} className="h-40" />
              <input value={form.imageUrl || ''} onChange={(event) => updateField('imageUrl', event.target.value)} placeholder="Product image URL" className="mt-3 h-12 w-full rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
              <label className="mt-2 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border bg-white px-3 text-xs font-bold">
                <ImagePlus className="h-4 w-4" />
                {uploadingImage ? 'Uploading...' : 'Upload image'}
                <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
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
            <h2 className="text-base font-bold">Custom products</h2>
            <span className="text-xs font-bold text-amber-700">{customProducts.length} Supabase items</span>
          </div>
          {customProducts.map((product) => (
            <article key={product.id} className="mobile-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="grid min-w-0 flex-1 grid-cols-[72px_1fr] gap-3">
                  <ProductVisual product={product} className="h-20 rounded-2xl" label={false} />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[#1f2937]">{product.name}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">{product.notes}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase text-amber-700">{product.category} · {product.price}</p>
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

