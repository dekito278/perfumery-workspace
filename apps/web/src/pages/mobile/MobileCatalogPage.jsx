import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, PackagePlus, Search, ShoppingBag, SlidersHorizontal, WandSparkles } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { catalogSortOptions, storefrontSegments } from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import { cn } from '@/lib/utils.js';

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
  const products = useCatalogProducts();
  const categories = useStorefrontCategories(products);
  const catalogLoading = Boolean(products.loading);
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
        ...product.tags,
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
        <MobileTopBar
          title="Catalog"
          subtitle={`${filteredProducts.length} products`}
          eyebrow="Shop"
          action={<button type="button" onClick={() => navigate('/mobile/cart')} aria-label="Open cart"><ShoppingBag className="h-5 w-5 text-[#263d27]" /></button>}
        />

        <section className="mobile-card p-2">
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
        </section>

        {hasCatalogProducts ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Shop type</h2>
            <span className="text-xs font-bold text-[#263d27]">Regular / limited</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[{ name: 'All', filter: 'all' }, ...storefrontSegments.filter((item) => item.filter !== 'bespoke')].map((item) => (
              <button
                key={item.filter}
                type="button"
                onClick={() => updateFilters({ segment: item.filter })}
                className={cn(
                  'min-h-[44px] rounded-2xl border px-3 py-2 text-xs font-bold',
                  segment === item.filter
                    ? 'border-[#263d27]/30 bg-[#eef2e8] text-[#263d27]'
                    : 'border-[#e5e7eb] bg-white text-[#6b7280]'
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>
        ) : null}

        {hasCatalogProducts && categories.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Scent family</h2>
            <SlidersHorizontal className="h-4 w-4 text-[#8b949e]" />
          </div>
          <div className="mobile-segment-scroll flex gap-2 overflow-x-auto pb-1">
            {['All', ...categories.map((item) => item.name)].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => updateFilters({ category: item })}
                className={cn(
                  'h-10 shrink-0 rounded-2xl border px-4 text-xs font-bold',
                  category === item
                    ? 'border-[#263d27]/30 bg-[#eef2e8] text-[#263d27]'
                    : 'border-[#e5e7eb] bg-white text-[#6b7280]'
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </section>
        ) : null}

        {hasCatalogProducts ? (
        <section className="mobile-card p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-[#6b7280]">
            <ArrowUpDown className="h-4 w-4" />
            Sort
          </div>
          <div className="grid grid-cols-2 gap-2">
            {catalogSortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateFilters({ sort: option.value })}
                className={cn(
                  'h-10 rounded-2xl border text-xs font-bold',
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
          {filteredProducts.map((product) => (
            <article key={product.id} className="mobile-card min-w-0 overflow-hidden p-2">
              <button type="button" onClick={() => navigate(`/mobile/products/${product.slug}`)} className="block w-full text-left">
                <ProductVisual product={product} className="aspect-square rounded-2xl" bottleClassName="left-4 top-4 h-16 w-8 rounded-[1rem]" label={false} />
                <div className="mt-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[#0b130c]">{product.name}</h3>
                    <p className="mt-1 text-[11px] font-semibold leading-snug text-[#6b7280]">{product.notes}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#0b130c]">{product.price}</div>
                    <div className="text-[10px] font-bold text-[#8b949e]">{product.stock} left</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {product.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[10px] font-bold uppercase text-[#6b7280]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            </article>
          ))}
          {!filteredProducts.length ? (
            <div className="mobile-card col-span-2 overflow-hidden text-center">
              <div className="bg-[#050705] p-5 text-[#eef2e8]">
                <img src="/brand/solivagant-logo.png" alt="Solivagant" className="mx-auto h-14 w-40 rounded-2xl object-contain" />
                <h3 className="mt-5 text-lg font-bold">
                  {catalogLoading ? 'Memuat koleksi parfum' : hasCatalogProducts ? 'No products found' : 'Belum ada parfum tersedia'}
                </h3>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#cbd6c5]">
                  {catalogLoading
                    ? 'Sebentar, kami sedang mengambil daftar parfum terbaru.'
                    : hasCatalogProducts
                    ? 'Coba kategori atau keyword aroma lain.'
                    : 'Produk public akan tampil setelah ditambahkan dari Studio. Customer tetap bisa mulai dari bespoke request.'}
                </p>
              </div>
              {!catalogLoading ? (
              <div className="grid grid-cols-2 gap-2 p-3">
                {hasCatalogProducts ? (
                  <Button className="rounded-2xl" onClick={() => updateFilters({ query: '', segment: 'all', category: 'All', sort: 'featured' })}>
                    Reset filters
                  </Button>
                ) : (
                  <Button className="rounded-2xl gap-2" onClick={() => navigate('/mobile/login')}>
                    Add product
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

        <Link to="/mobile/dashboard" className="mobile-card flex items-center justify-between p-3 text-sm font-bold text-[#0b130c]">
          Back to storefront
          <ShoppingBag className="h-4 w-4 text-[#263d27]" />
        </Link>
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileCatalogPage;
