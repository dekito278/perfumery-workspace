import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, PackagePlus, Search, WandSparkles } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { catalogSortOptions } from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import { cn } from '@/lib/utils.js';
import {
  formatRupiah,
  getProductLowStock,
  getVisibleProductTags,
  isProductVisibleInStorefront,
} from '@/services/productCatalogService.js';

const commerceCategoryNames = new Set(['limited', 'regular', 'limited perfume', 'regular perfume', 'all']);
const shopTypeOptions = [
  { name: 'All', filter: 'all' },
  { name: 'Regular', filter: 'regular' },
  { name: 'Limited', filter: 'limited' },
];

const sortProducts = (products, sort) => {
  const nextProducts = [...products];

  if (sort === 'price-low') return nextProducts.sort((a, b) => a.priceNumber - b.priceNumber);
  if (sort === 'price-high') return nextProducts.sort((a, b) => b.priceNumber - a.priceNumber);
  if (sort === 'name') return nextProducts.sort((a, b) => a.name.localeCompare(b.name));

  return nextProducts.sort((a, b) => Number(b.featured) - Number(a.featured) || b.popularity - a.popularity);
};

const MobileCatalogPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [segment, setSegment] = useState(searchParams.get('segment') || 'all');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [sort, setSort] = useState(searchParams.get('sort') || 'featured');
  const catalogProducts = useCatalogProducts();
  const products = useMemo(() => catalogProducts.filter(isProductVisibleInStorefront), [catalogProducts]);
  const categories = useStorefrontCategories(products);
  const scentFamilies = useMemo(() => (
    categories.filter((item) => !commerceCategoryNames.has(String(item.name || '').toLowerCase()))
  ), [categories]);
  const catalogLoading = Boolean(catalogProducts.loading);
  const hasCatalogProducts = products.length > 0;

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchingProducts = products.filter((product) => {
      const matchesSegment = segment === 'all'
        || (segment === 'limited' && (product.featured || product.stock <= 8))
        || (segment === 'regular' && !product.featured && product.stock > 0);
      const matchesCategory = category === 'All' || product.category === category;
      const searchableText = [
        product.name,
        product.category,
        product.notes,
        product.mood,
        product.description,
        ...getVisibleProductTags(product),
      ].join(' ').toLowerCase();
      return matchesSegment && matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });

    return sortProducts(matchingProducts, sort);
  }, [category, products, query, segment, sort]);

  const updateFilters = (next) => {
    const updated = {
      q: next.query ?? query,
      segment: next.segment ?? segment,
      category: next.category ?? category,
      sort: next.sort ?? sort,
    };
    setQuery(updated.q);
    setSegment(updated.segment);
    setCategory(updated.category);
    setSort(updated.sort);

    const params = new URLSearchParams();
    if (updated.q.trim()) params.set('q', updated.q.trim());
    if (updated.segment !== 'all') params.set('segment', updated.segment);
    if (updated.category !== 'All') params.set('category', updated.category);
    if (updated.sort !== 'featured') params.set('sort', updated.sort);
    setSearchParams(params, { replace: true });
  };

  return (
    <MobileCommerceLayout>
      <Helmet>
        <title>Catalog - Solivagant</title>
        <meta name="description" content="Browse Solivagant products by category, price, and scent profile." />
      </Helmet>
      <main className="mobile-page space-y-4">
        <section className="mobile-sticky-search">
          <div className="mobile-card p-2">
          <label className="flex h-12 items-center gap-2 rounded-2xl bg-[#f7f8f2] px-3">
            <Search className="h-4 w-4 text-[#8b949e]" />
            <input
              type="search"
              value={query}
              onChange={(event) => updateFilters({ query: event.target.value })}
              placeholder="Search by notes, mood, product"
              className="min-h-0 flex-1 bg-transparent text-sm font-semibold text-[#0b130c] outline-none placeholder:text-[#9ca3af]"
            />
          </label>
          {hasCatalogProducts ? (
            <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-2xl bg-[#f7f8f2] p-1">
              {shopTypeOptions.map((item) => (
                <button
                  key={item.filter}
                  type="button"
                  onClick={() => updateFilters({ segment: item.filter })}
                  style={{ minHeight: 36 }}
                  className={cn(
                    'h-9 rounded-xl px-2 py-1 text-[11px] font-bold leading-tight transition',
                    segment === item.filter
                      ? 'bg-white text-[#263d27] shadow-sm'
                      : 'text-[#7a8377]'
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ) : null}
          </div>
        </section>

        {hasCatalogProducts && scentFamilies.length ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase text-[#6b7280]">Shop family</h2>
            <span className="text-[10px] font-bold uppercase text-[#9ca3af]">{filteredProducts.length} shown</span>
          </div>
          <div className="mobile-segment-scroll flex gap-5 overflow-x-auto pb-2 pl-1 pr-4">
            {['All', ...scentFamilies.map((item) => item.name)].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => updateFilters({ category: item })}
                className={cn(
                  'relative h-8 shrink-0 px-0 text-sm font-bold transition',
                  category === item
                    ? 'text-[#263d27] after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-[#263d27]'
                    : 'text-[#7a8377]'
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </section>
        ) : null}

        {hasCatalogProducts ? (
        <section className="mobile-card p-2.5">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-[#6b7280]">
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {catalogSortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateFilters({ sort: option.value })}
                style={{ minHeight: 34 }}
                className={cn(
                  'h-[34px] rounded-xl border px-1.5 text-[10px] font-bold leading-tight',
                  sort === option.value
                    ? 'border-[#263d27] bg-[#263d27] text-white'
                    : 'border-[#e5e7eb] bg-white text-[#6b7280]'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
        ) : null}

        <section className="grid grid-cols-2 gap-3">
          {filteredProducts.map((product, index) => (
            <article key={product.id} className="mobile-card min-w-0 overflow-hidden p-2">
              <button type="button" onClick={() => navigate(`/mobile/products/${product.slug}`)} className="block w-full text-left">
                <ProductVisual product={product} className="aspect-square rounded-2xl" bottleClassName="left-4 top-4 h-16 w-8 rounded-[1rem]" label={false} priority={index < 4} />
                <div className="mt-2 flex min-h-[174px] flex-col">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[#0b130c]">{product.name}</h3>
                    <p className="mobile-line-clamp-2 mt-1 text-[11px] font-semibold leading-snug text-[#6b7280]">{product.notes}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div>
                      {product.compareAtPriceNumber > product.priceNumber ? <div className="text-[10px] font-bold text-[#9ca3af] line-through">{formatRupiah(product.compareAtPriceNumber)}</div> : null}
                      <div className="text-xs font-bold text-[#0b130c]">{product.price}</div>
                    </div>
                    <div className={cn('rounded-full px-2 py-1 text-[10px] font-bold', getProductLowStock(product) ? 'bg-rose-50 text-rose-700' : 'text-[#8b949e]')}>
                      {product.stock > 0 ? `${product.stock} tersisa` : 'Habis'}
                    </div>
                  </div>
                  <div className="mt-auto pt-2">
                  <div className="flex flex-wrap gap-1">
                    {product.variants.slice(0, 3).map((variant) => (
                      <span key={variant.id || variant.size} className="rounded-full bg-[#eef2e8] px-2 py-1 text-[10px] font-bold text-[#263d27]">{variant.size}</span>
                    ))}
                  </div>
                  {getProductLowStock(product) ? <div className="mt-2 text-[10px] font-bold uppercase text-rose-700">Mau habis</div> : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {getVisibleProductTags(product).slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[10px] font-bold uppercase text-[#6b7280]">
                        {tag}
                      </span>
                    ))}
                  </div>
                  </div>
                </div>
              </button>
            </article>
          ))}
          {!filteredProducts.length ? (
            <div className="mobile-card col-span-2 overflow-hidden text-center">
              <div className="bg-[#050705] p-5 text-[#eef2e8]">
                <img src="/brand/solivagant-logo.png" alt="Solivagant" className="mx-auto h-14 w-40 rounded-2xl object-contain" loading="lazy" decoding="async" />
                <h3 className="mt-5 text-lg font-bold">
                  {catalogLoading ? 'Memuat koleksi parfum' : hasCatalogProducts ? 'Produk tidak ditemukan' : 'Belum ada parfum tersedia'}
                </h3>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#cbd6c5]">
                  {catalogLoading
                    ? 'Sebentar, kami sedang mengambil daftar parfum terbaru.'
                    : hasCatalogProducts
                    ? 'Coba kategori atau kata kunci aroma lain.'
                    : 'Produk public akan tampil setelah ditambahkan dari Studio. Customer tetap bisa mulai dari bespoke request.'}
                </p>
              </div>
              {!catalogLoading ? (
              <div className="grid grid-cols-2 gap-2 p-3">
                {hasCatalogProducts ? (
                  <Button className="rounded-2xl" onClick={() => updateFilters({ query: '', segment: 'all', category: 'All', sort: 'featured' })}>
                    Reset filter
                  </Button>
                ) : (
                  <Button className="rounded-2xl gap-2" onClick={() => navigate('/mobile/login')}>
                    Tambah produk
                    <PackagePlus className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => navigate('/mobile/bespoke')}>
                  Bespoke
                  <WandSparkles className="h-4 w-4" />
                </Button>
              </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileCatalogPage;
