import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Edit3, PackagePlus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { featuredProducts, storefrontCategories } from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import {
  deleteCustomProduct,
  formatRupiah,
  resetCustomProducts,
  saveCustomProduct,
} from '@/services/productCatalogService.js';

const emptyProduct = {
  name: '',
  category: 'Fresh',
  priceNumber: 289000,
  stock: 10,
  size: '30 ml',
  notes: '',
  topNotes: '',
  heartNotes: '',
  baseNotes: '',
  description: '',
  tags: '',
  mood: '',
  featured: true,
};

const toEditableProduct = (product) => ({
  ...product,
  topNotes: product.topNotes.join(', '),
  heartNotes: product.heartNotes.join(', '),
  baseNotes: product.baseNotes.join(', '),
  variants: product.variants.join(', '),
  tags: product.tags.join(', '),
});

const ProductManagementPage = () => {
  const products = useCatalogProducts();
  const customProducts = useMemo(() => products.filter((product) => product.source === 'custom'), [products]);
  const [form, setForm] = useState(emptyProduct);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const resetForm = () => setForm(emptyProduct);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.notes.trim()) {
      toast.error('Product name and notes are required');
      return;
    }

    const product = saveCustomProduct({
      ...form,
      price: formatRupiah(form.priceNumber),
    });
    setForm(toEditableProduct(product));
    toast.success('Product saved to catalog');
  };

  const handleEdit = (product) => setForm(toEditableProduct(product));

  const handleDelete = (product) => {
    deleteCustomProduct(product.id);
    if (form.id === product.id) resetForm();
    toast.success('Product removed from custom catalog');
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Product Management - Dekito Studio</title>
        <meta name="description" content="Manage custom storefront products for Dekito Perfumery." />
      </Helmet>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <PackagePlus className="h-4 w-4 text-primary" />
              Storefront admin
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Product management</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Tambah produk custom untuk katalog e-commerce. Produk bawaan tetap ada sebagai seed, sementara produk custom tersimpan di browser storage.
            </p>
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
                  {storefrontCategories.map((category) => <option key={category.name}>{category.name}</option>)}
                </select>
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Price</span>
                <input type="number" value={form.priceNumber} onChange={(event) => updateField('priceNumber', Number(event.target.value))} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" />
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Stock</span>
                <input type="number" value={form.stock} onChange={(event) => updateField('stock', Number(event.target.value))} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" />
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Default size</span>
                <input value={form.size} onChange={(event) => updateField('size', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="30 ml" />
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-bold uppercase text-muted-foreground">Notes summary</span>
                <input value={form.notes} onChange={(event) => updateField('notes', event.target.value)} className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300" placeholder="Rose, musk, sandalwood" />
              </label>
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
              <Button type="submit" className="rounded-2xl gap-2"><Save className="h-4 w-4" />Save product</Button>
              <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={resetForm}><RotateCcw className="h-4 w-4" />Clear</Button>
            </div>
          </form>

          <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Custom products</h2>
              {customProducts.length ? <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={() => { resetCustomProducts(); resetForm(); toast.success('Custom products reset'); }}>Reset all</Button> : null}
            </div>
            <div className="mt-5 grid gap-3">
              {customProducts.map((product) => (
                <article key={product.id} className="rounded-2xl border bg-[#fbfaf7] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold">{product.name}</h3>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">{product.notes}</p>
                      <p className="mt-1 text-xs font-bold uppercase text-amber-700">{product.category} · {product.price} · {product.stock} left</p>
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
    </AuthenticatedLayout>
  );
};

export default ProductManagementPage;
