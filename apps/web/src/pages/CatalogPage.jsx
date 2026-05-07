import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search, ShoppingBag } from 'lucide-react';
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

const CatalogPage = () => {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState(searchParams.get('segment') || 'all');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [sort, setSort] = useState('featured');
  const catalogProducts = useCatalogProducts();
  const categories = useStorefrontCategories(catalogProducts);

  const products = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sortProducts(catalogProducts.filter((product) => {
      const matchesSegment = segment === 'all'
        || (segment === 'limited' && (product.featured || product.stock <= 8))
        || (segment === 'regular' && !product.featured && product.stock > 0);
      const matchesCategory = category === 'All' || product.category === category;
      const searchable = [product.name, product.category, product.notes, product.mood, product.description, ...product.tags].join(' ').toLowerCase();
      return matchesSegment && matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    }), sort);
  }, [catalogProducts, category, query, segment, sort]);

  return (
    <>
      <Helmet>
        <title>Catalog - Dekito Perfumery</title>
        <meta name="description" content="Browse Dekito Perfumery catalog by scent family, price, and profile." />
      </Helmet>
      <main className="min-h-screen bg-[#fbfaf7] text-[#1f2937]">
        <section className="border-b border-stone-200 bg-white/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/home" className="text-sm font-bold uppercase text-amber-700">Dekito Perfumery</Link>
            <div className="flex items-center gap-2">
              <Link to="/cart" className="grid h-10 w-10 place-items-center rounded-2xl border bg-white" aria-label="Open cart"><ShoppingBag className="h-4 w-4" /></Link>
              <Link to="/home" className="rounded-2xl border bg-white px-4 py-2 text-sm font-bold">Home</Link>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-amber-700">Shop</div>
              <h1 className="mt-1 text-4xl font-bold">Perfume catalog</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
                Browse by scent family, notes, price, or mood.
              </p>
            </div>
            <label className="flex h-12 w-full max-w-md items-center gap-2 rounded-2xl border bg-white px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes or product" className="min-h-0 flex-1 bg-transparent text-sm font-semibold outline-none" />
            </label>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {[{ name: 'All', filter: 'all' }, ...storefrontSegments.filter((item) => item.filter !== 'bespoke')].map((item) => (
              <button key={item.filter} type="button" onClick={() => setSegment(item.filter)} className={cn('h-10 rounded-2xl border px-4 text-sm font-bold', segment === item.filter ? 'border-[#1f2937] bg-[#1f2937] text-white' : 'bg-white text-muted-foreground')}>
                {item.name}
              </button>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {['All', ...categories.map((item) => item.name)].map((item) => (
              <button key={item} type="button" onClick={() => setCategory(item)} className={cn('h-10 rounded-2xl border px-4 text-sm font-bold', category === item ? 'border-amber-300 bg-amber-50 text-amber-800' : 'bg-white text-muted-foreground')}>
                {item}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {catalogSortOptions.map((option) => (
              <button key={option.value} type="button" onClick={() => setSort(option.value)} className={cn('h-9 rounded-2xl border px-3 text-xs font-bold', sort === option.value ? 'border-[#1f2937] bg-[#1f2937] text-white' : 'bg-white text-muted-foreground')}>
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
                <ProductVisual product={product} />
                <div className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold">{product.name}</h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">{product.notes}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold">{product.price}</div>
                      <div className="text-xs font-bold text-muted-foreground">{product.stock} left</div>
                    </div>
                  </div>
                  <Link to={`/products/${product.slug}`} className="mt-4 inline-flex h-10 items-center gap-2 rounded-2xl bg-[#1f2937] px-4 text-sm font-bold text-white">
                    View product
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
          {!products.length ? (
            <div className="mt-8 rounded-2xl border bg-white p-8 text-center">
              <ShoppingBag className="mx-auto h-8 w-8 text-amber-700" />
              <h2 className="mt-3 text-xl font-bold">No products found</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Try another category or search keyword.</p>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
};

export default CatalogPage;
