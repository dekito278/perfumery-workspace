import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, PackagePlus, Search, ShoppingBag, WandSparkles } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { catalogSortOptions, storefrontSegments } from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import { cn } from '@/lib/utils.js';
import {
  formatRupiah,
  getProductLowStock,
  getVisibleProductTags,
  isProductVisibleInStorefront,
} from '@/services/productCatalogService.js';

const sortProducts = (products, sort) => {
  const nextProducts = [...products];
  if (sort === 'price-low') return nextProducts.sort((a, b) => a.priceNumber - b.priceNumber);
  if (sort === 'price-high') return nextProducts.sort((a, b) => b.priceNumber - a.priceNumber);
  if (sort === 'name') return nextProducts.sort((a, b) => a.name.localeCompare(b.name));
  return nextProducts.sort((a, b) => Number(b.featured) - Number(a.featured) || b.popularity - a.popularity);
};

const CatalogPage = () => {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState(searchParams.get('segment') || 'all');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [sort, setSort] = useState('featured');
  const allCatalogProducts = useCatalogProducts();
  const catalogProducts = useMemo(() => allCatalogProducts.filter(isProductVisibleInStorefront), [allCatalogProducts]);
  const categories = useStorefrontCategories(catalogProducts);
  const catalogLoading = Boolean(allCatalogProducts.loading);
  const hasCatalogProducts = catalogProducts.length > 0;

  const products = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sortProducts(catalogProducts.filter((product) => {
      const matchesSegment = segment === 'all'
        || (segment === 'limited' && (product.featured || product.stock <= 8))
        || (segment === 'regular' && !product.featured && product.stock > 0);
      const matchesCategory = category === 'All' || product.category === category;
      const searchable = [product.name, product.category, product.notes, product.mood, product.description, ...getVisibleProductTags(product)].join(' ').toLowerCase();
      return matchesSegment && matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    }), sort);
  }, [catalogProducts, category, query, segment, sort]);

  return (
    <>
      <Helmet>
        <title>Catalog - Solivagant</title>
        <meta name="description" content="Browse Solivagant catalog by scent family, price, and profile." />
      </Helmet>
      <main className="min-h-screen bg-[#f7f8f2] text-[#0b130c]">
        <section className="border-b border-[#263d27]/15 bg-[#050705] text-[#eef2e8]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/home" className="inline-flex items-center">
              <img src="/brand/solivagant-logo.png" alt="Solivagant" className="h-11 w-32 rounded-xl object-contain" />
            </Link>
            <div className="flex items-center gap-2">
              <Link to="/cart" className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/8" aria-label="Open cart"><ShoppingBag className="h-4 w-4" /></Link>
              <Link to="/home" className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-[#eef2e8]">Home</Link>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-[#263d27]">Shop</div>
              <h1 className="mt-1 text-4xl font-bold">Katalog parfum</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
                Cari berdasarkan aroma, notes, harga, atau mood.
              </p>
            </div>
            <label className="flex h-12 w-full max-w-md items-center gap-2 rounded-2xl border bg-white px-4 shadow-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes or product" className="min-h-0 flex-1 bg-transparent text-sm font-semibold outline-none" />
            </label>
          </div>
          {hasCatalogProducts ? (
            <section className="mt-6 rounded-2xl border border-[#263d27]/10 bg-white/86 p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase text-[#6b7280]">Type</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[{ name: 'All', filter: 'all' }, ...storefrontSegments.filter((item) => item.filter !== 'bespoke')].map((item) => (
                      <button key={item.filter} type="button" onClick={() => setSegment(item.filter)} className={cn('h-10 rounded-2xl border px-4 text-sm font-bold transition', segment === item.filter ? 'border-[#263d27] bg-[#263d27] text-white shadow-sm' : 'bg-white text-muted-foreground hover:border-[#263d27]/30 hover:text-[#263d27]')}>
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="shrink-0">
                  <div className="text-[11px] font-bold uppercase text-[#6b7280]">Sort</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {catalogSortOptions.map((option) => (
                      <button key={option.value} type="button" onClick={() => setSort(option.value)} className={cn('h-10 rounded-2xl border px-3 text-xs font-bold transition', sort === option.value ? 'border-[#263d27] bg-[#263d27] text-white shadow-sm' : 'bg-white text-muted-foreground hover:border-[#263d27]/30 hover:text-[#263d27]')}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-[#263d27]/10 pt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-bold uppercase text-[#6b7280]">Scent family</div>
                  <div className="text-xs font-bold text-[#263d27]">{products.length} shown</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['All', ...categories.map((item) => item.name)].map((item) => (
                    <button key={item} type="button" onClick={() => setCategory(item)} className={cn('h-10 rounded-2xl border px-4 text-sm font-bold transition', category === item ? 'border-[#263d27]/30 bg-[#eef2e8] text-[#263d27] shadow-sm' : 'bg-white text-muted-foreground hover:border-[#263d27]/30 hover:text-[#263d27]')}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <article key={product.id} className="group overflow-hidden rounded-2xl border border-stone-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-[#263d27]/18 hover:shadow-xl hover:shadow-[#263d27]/8">
                <ProductVisual product={product} />
                <div className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold">{product.name}</h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">{product.notes}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {product.compareAtPriceNumber > product.priceNumber ? <div className="text-xs font-bold text-muted-foreground line-through">{formatRupiah(product.compareAtPriceNumber)}</div> : null}
                      <div className="text-sm font-bold">{product.price}</div>
                      <div className={cn('mt-1 text-xs font-bold', getProductLowStock(product) ? 'text-rose-700' : 'text-muted-foreground')}>{product.stock > 0 ? `${product.stock} tersisa` : 'Habis'}</div>
                    </div>
                  </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                    {product.variants.slice(0, 4).map((variant) => (
                      <span key={variant.id || variant.size} className="rounded-full bg-[#eef2e8] px-2.5 py-1 text-[10px] font-bold uppercase text-[#263d27]">{variant.size}</span>
                    ))}
                    {getProductLowStock(product) ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase text-rose-700">Mau habis</span> : null}
                  </div>
                    <Link to={`/products/${product.slug}`} className="mt-4 inline-flex h-10 items-center gap-2 rounded-2xl bg-[#263d27] px-4 text-sm font-bold text-white transition group-hover:bg-[#1c301d]">
                    Lihat produk
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
          {!products.length ? (
            <div className="mt-8 overflow-hidden rounded-[28px] border border-[#263d27]/12 bg-white text-center shadow-sm">
              <div className="bg-[#050705] px-6 py-10 text-[#eef2e8]">
                <img src="/brand/solivagant-logo.png" alt="Solivagant" className="mx-auto h-16 w-48 rounded-2xl object-contain" />
                <h2 className="mt-6 text-2xl font-bold">
                  {catalogLoading ? 'Memuat koleksi parfum' : hasCatalogProducts ? 'Produk tidak ditemukan' : 'Belum ada parfum tersedia'}
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-relaxed text-[#cbd6c5]">
                  {catalogLoading
                    ? 'Sebentar, kami sedang mengambil daftar parfum terbaru.'
                    : hasCatalogProducts
                    ? 'Coba kategori, tipe shop, atau kata kunci aroma lain.'
                    : 'Koleksi public akan tampil di sini setelah produk ditambahkan dari Studio. Customer masih bisa mulai dari request bespoke.'}
                </p>
              </div>
              {!catalogLoading ? (
              <div className="flex flex-wrap justify-center gap-3 px-6 py-6">
                {hasCatalogProducts ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setSegment('all');
                      setCategory('All');
                      setSort('featured');
                    }}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#263d27] px-5 text-sm font-bold text-[#eef2e8]"
                  >
                    Reset filter
                    <Search className="h-4 w-4" />
                  </button>
                ) : (
                  <Link to="/login" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#263d27] px-5 text-sm font-bold text-[#eef2e8]">
                    Tambah produk
                    <PackagePlus className="h-4 w-4" />
                  </Link>
                )}
                <Link to="/bespoke" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#263d27]/15 bg-white px-5 text-sm font-bold text-[#0b130c]">
                  Request bespoke
                  <WandSparkles className="h-4 w-4" />
                </Link>
              </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
};

export default CatalogPage;
