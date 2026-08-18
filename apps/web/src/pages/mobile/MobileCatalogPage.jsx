import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';

const PAGE_SIZE = 12;

export const MobileCatalogContent = ({ active = true }) => {
  const [searchParams] = useSearchParams();
  const initialFamily = searchParams.get('category') || searchParams.get('family') || '';
  const catalogProducts = useCatalogProducts({ active });
  // Mirror CatalogPage.jsx:35 — without this the page told the buyer "No fragrance matches" during the very
  // first fetch, and kept saying it forever if that fetch failed (audit round 7).
  const isLoading = Boolean(catalogProducts.loading) && !catalogProducts.length;
  const [activeCategory, setActiveCategory] = useState(
    initialFamily ? initialFamily.charAt(0).toUpperCase() + initialFamily.slice(1) : 'All'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const products = useMemo(() => {
    const visible = catalogProducts.filter(isProductVisibleInStorefront);
    return getPublicFragranceCatalog(visible);
  }, [catalogProducts]);

  const categories = useMemo(() => [
    'All',
    ...Array.from(new Set(products.map((p) => p.publicCategory || p.category).filter(Boolean))),
  ], [products]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
      const cat = product.publicCategory || product.category || '';
      if (activeCategory !== 'All' && cat !== activeCategory) return false;
      if (!q) return true;
      return [product.name, product.mood, product.category, ...(product.topNotes || []), ...(product.heartNotes || []), ...(product.baseNotes || [])]
        .join(' ').toLowerCase().includes(q);
    });
  }, [activeCategory, products, searchTerm]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [activeCategory, searchTerm]);

  // Sync family param
  useEffect(() => {
    if (initialFamily) {
      const cap = initialFamily.charAt(0).toUpperCase() + initialFamily.slice(1);
      if (categories.includes(cap)) setActiveCategory(cap);
    }
  }, [initialFamily, categories]);

  return (
    <>
      {active ? (
        <Helmet>
          <title>Koleksi - SOLIVAGANT</title>
          <meta name="description" content="Jelajahi koleksi fragrance SOLIVAGANT." />
        </Helmet>
      ) : null}

      <main className="mobile-page m-editorial-page">
        {/* Header */}
        <section className="m-editorial-catalog-header">
          <p className="m-editorial-eyebrow">KOLEKSI FRAGRANCE</p>
          <h1>Koleksi</h1>
        </section>

        {/* Search */}
        <div className="m-editorial-catalog-search">
          <Search className="h-4 w-4" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari notes, mood, atau nama..."
          />
        </div>

        {/* Category pills */}
        <div className="m-editorial-catalog-pills">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`m-editorial-pill ${cat === activeCategory ? 'is-active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {filtered.length ? (
          <div className="m-editorial-product-grid">
            {visible.map((product) => (
              <Link key={product.slug} to={`/mobile/products/${product.slug}`} className="m-editorial-product-card">
                <ProductVisual
                  product={product}
                  className="m-editorial-product-card__visual"
                  imageFit="cover"
                  label={false}
                  sizes="(max-width: 480px) 45vw, 200px"
                />
                <div className="m-editorial-product-card__info">
                  <span className="m-editorial-product-card__category">{product.category || 'Atelier'}</span>
                  <h3>{product.name}</h3>
                  <span className="m-editorial-product-card__price">{product.price}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : isLoading ? (
          <div className="m-editorial-product-grid" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="m-editorial-product-card">
                <div className="editorial-skel m-editorial-product-card__visual" />
                <div className="m-editorial-product-card__info">
                  <div className="editorial-skel skel-line skel-line--sm" />
                  <div className="editorial-skel skel-line skel-line--md" />
                </div>
              </div>
            ))}
          </div>
        ) : catalogProducts.length ? (
          <div className="m-editorial-empty">
            <p className="m-editorial-eyebrow">TIDAK ADA HASIL</p>
            <h2>Tidak ada fragrance yang cocok.</h2>
            <button type="button" className="m-editorial-cta" onClick={() => { setActiveCategory('All'); setSearchTerm(''); }}>
              Reset filter
            </button>
          </div>
        ) : (
          <div className="m-editorial-empty">
            <p className="m-editorial-eyebrow">KATALOG</p>
            <h2>Katalog belum bisa dimuat.</h2>
            <button
              type="button"
              className="m-editorial-cta"
              onClick={() => window.dispatchEvent(new CustomEvent('dekito:products-updated'))}
            >
              Coba lagi
            </button>
          </div>
        )}

        {visible.length < filtered.length ? (
          <div className="m-editorial-load-more">
            <button type="button" className="m-editorial-cta" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
              Tampilkan lagi <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <span>{visible.length} of {filtered.length}</span>
          </div>
        ) : null}
      </main>
    </>
  );
};

const MobileCatalogPage = () => (
  <MobileCommerceLayout>
    <MobileCatalogContent />
  </MobileCommerceLayout>
);

export default MobileCatalogPage;
