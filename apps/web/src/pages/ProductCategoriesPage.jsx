import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PackagePlus, Save, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import { deleteStorefrontCategory, saveStorefrontCategory } from '@/services/storefrontCategoryService.js';

const ProductCategoriesPage = () => {
  const navigate = useNavigate();
  const products = useCatalogProducts();
  const categories = useStorefrontCategories(products);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [savingCategory, setSavingCategory] = useState(false);

  const categoryUsage = useMemo(() => products.reduce((usage, product) => {
    if (!product.category) return usage;
    usage.set(product.category.toLowerCase(), (usage.get(product.category.toLowerCase()) || 0) + 1);
    return usage;
  }, new Map()), [products]);

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setSavingCategory(true);
    try {
      await saveStorefrontCategory(categoryForm);
      setCategoryForm({ name: '', description: '' });
      toast.success('Product category saved');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleCategoryDelete = async (category) => {
    await deleteStorefrontCategory(category.id);
    toast.success('Product category removed');
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Product Categories - Solivagant Studio</title>
        <meta name="description" content="Manage e-commerce product categories for the Solivagant storefront." />
      </Helmet>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="ghost" className="h-9 gap-2 rounded-2xl" onClick={() => navigate('/studio')}>
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
          <Button variant="outline" className="h-9 gap-2 rounded-2xl bg-white" onClick={() => navigate('/studio/products')}>
            <PackagePlus className="h-4 w-4" />
            Product management
          </Button>
        </div>

        <div className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <Tags className="h-4 w-4 text-primary" />
              E-commerce
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Product categories</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Kelola kategori produk public storefront secara terpisah dari product management. Kategori ini dipakai untuk filter katalog dan form produk.
            </p>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Categories</span><strong>{categories.length}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Catalog products</span><strong>{products.length}</strong></div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <form onSubmit={handleCategorySubmit} className="rounded-2xl border bg-white/90 p-5 shadow-sm">
            <h2 className="text-xl font-bold">Add category</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">
              Buat kategori seperti Regular, Limited, Gift Set, atau seasonal collection.
            </p>
            <label className="mt-5 block">
              <span className="text-xs font-bold uppercase text-muted-foreground">Category name</span>
              <input
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-amber-300"
                placeholder="Limited, Regular, Gift set..."
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase text-muted-foreground">Description</span>
              <textarea
                value={categoryForm.description}
                onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
                rows={4}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-amber-300"
                placeholder="Optional short description for storefront display"
              />
            </label>
            <Button type="submit" className="mt-5 h-11 rounded-2xl gap-2" disabled={savingCategory}>
              <Save className="h-4 w-4" />
              {savingCategory ? 'Saving...' : 'Save category'}
            </Button>
          </form>

          <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Current categories</h2>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">Kategori dari produk existing tetap tampil sebagai reference.</p>
              </div>
              <Tags className="h-5 w-5 text-amber-700" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {categories.map((category) => {
                const usageCount = categoryUsage.get(category.name.toLowerCase()) || 0;
                const canDelete = category.source !== 'product' && usageCount === 0;
                return (
                  <article key={category.name} className="rounded-2xl border bg-[#fbfaf7] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-[#101b10]">{category.name}</h3>
                        <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">
                          {category.description || 'No description yet'}
                        </p>
                        <p className="mt-3 text-xs font-bold uppercase text-amber-700">{usageCount} product</p>
                      </div>
                      {canDelete ? (
                        <Button type="button" size="icon" variant="outline" className="shrink-0 rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => handleCategoryDelete(category)} aria-label={`Delete ${category.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default ProductCategoriesPage;
