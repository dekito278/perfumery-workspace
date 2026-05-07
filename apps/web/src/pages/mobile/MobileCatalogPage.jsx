import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Search, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { catalogSortOptions, storefrontCategories, storefrontSegments } from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
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
        <title>Catalog - Dekito Perfumery</title>
        <meta name="description" content="Browse Dekito Perfumery products by category, price, and scent profile." />
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Catalog"
          subtitle={`${filteredProducts.length} products`}
          eyebrow="Shop"
          action={<button type="button" onClick={() => navigate('/mobile/cart')} aria-label="Open cart"><ShoppingBag className="h-5 w-5 text-amber-700" /></button>}
        />

        <section className="mobile-card p-2">
          <label className="flex h-12 items-center gap-2 rounded-2xl bg-[#f8f7f4] px-3">
            <Search className="h-4 w-4 text-[#8b949e]" />
            <input
              type="search"
              value={query}
              onChange={(event) => updateFilters({ query: event.target.value })}
              placeholder="Search by notes, mood, product"
              className="min-h-0 flex-1 bg-transparent text-sm font-semibold text-[#1f2937] outline-none placeholder:text-[#9ca3af]"
            />
          </label>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Shop type</h2>
            <span className="text-xs font-bold text-amber-700">Regular / limited</span>
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
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-[#e5e7eb] bg-white text-[#6b7280]'
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Scent family</h2>
            <SlidersHorizontal className="h-4 w-4 text-[#8b949e]" />
          </div>
          <div className="mobile-segment-scroll flex gap-2 overflow-x-auto pb-1">
            {['All', ...storefrontCategories.map((item) => item.name)].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => updateFilters({ category: item })}
                className={cn(
                  'h-10 shrink-0 rounded-2xl border px-4 text-xs font-bold',
                  category === item
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-[#e5e7eb] bg-white text-[#6b7280]'
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

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
                    ? 'border-[#1f2937] bg-[#1f2937] text-white'
                    : 'border-[#e5e7eb] bg-white text-[#6b7280]'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          {filteredProducts.map((product) => (
            <article key={product.id} className="mobile-card min-w-0 overflow-hidden p-2">
              <button type="button" onClick={() => navigate(`/mobile/products/${product.slug}`)} className="block w-full text-left">
                <ProductVisual product={product} className="h-28 rounded-2xl" bottleClassName="left-4 top-4 h-16 w-8 rounded-[1rem]" label={false} />
                <div className="mt-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[#1f2937]">{product.name}</h3>
                    <p className="mt-1 text-[11px] font-semibold leading-snug text-[#6b7280]">{product.notes}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#1f2937]">{product.price}</div>
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
            <div className="mobile-card col-span-2 p-5 text-center">
              <h3 className="text-base font-bold text-[#1f2937]">No products found</h3>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Try another category or note keyword.</p>
              <Button className="mt-4 rounded-2xl" onClick={() => updateFilters({ query: '', segment: 'all', category: 'All', sort: 'featured' })}>
                Reset filters
              </Button>
            </div>
          ) : null}
        </section>

        <Link to="/mobile/dashboard" className="mobile-card flex items-center justify-between p-3 text-sm font-bold text-[#1f2937]">
          Back to storefront
          <ShoppingBag className="h-4 w-4 text-amber-700" />
        </Link>
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileCatalogPage;
