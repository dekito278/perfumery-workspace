import CardPrice from '@/components/storefront/CardPrice.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import StaleCatalogNotice from '@/components/storefront/StaleCatalogNotice.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import { CATALOG_PAGE_SIZE } from '@/utils/catalogPageSize.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { desktopCanonicalPath, toAbsoluteUrl } from '@/utils/seo.js';


export const MobileCatalogContent = ({ active = true }) => {
  const [searchParams] = useSearchParams();
  const initialFamily = searchParams.get('category') || searchParams.get('family') || '';
  const catalogProducts = useStorefrontProducts({ active });
  const { t } = useTranslate();
  // Mirror CatalogPage.jsx:35 — without this the page told the buyer "No fragrance matches" during the very
  // first fetch, and kept saying it forever if that fetch failed (audit round 7).
  const isLoading = Boolean(catalogProducts.loading) && !catalogProducts.length;
  const [activeCategory, setActiveCategory] = useState(
    initialFamily ? initialFamily.charAt(0).toUpperCase() + initialFamily.slice(1) : 'All'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(CATALOG_PAGE_SIZE);

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

  useEffect(() => { setVisibleCount(CATALOG_PAGE_SIZE); }, [activeCategory, searchTerm]);

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
          <title>{t('catalog.tab')}</title>
          <link rel="canonical" href={toAbsoluteUrl(desktopCanonicalPath('/mobile/catalog'))} />
          <meta name="description" content="Jelajahi koleksi fragrance SOLIVAGANT." />
        </Helmet>
      ) : null}

      <main className="mobile-page m-editorial-page">
        <StaleCatalogNotice stale={catalogProducts.stale} className="mx-4 mt-3" />
        {/* Header */}
        <section className="m-editorial-catalog-header">
          <p className="m-editorial-eyebrow">{t('catalog.eyebrow')}</p>
          <h1>{t('catalog.title')}</h1>
        </section>

        {/* Search */}
        <div className="m-editorial-catalog-search">
          <Search className="h-4 w-4" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('catalog.searchPlaceholder')}
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
              {cat === 'All' ? t('catalog.all') : cat}
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
                  <CardPrice product={product} className="m-editorial-product-card__price" memberClassName="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700" />
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
            <p className="m-editorial-eyebrow">{t('catalog.noResults')}</p>
            <h2>{t('catalog.noMatchMobile')}</h2>
            <button type="button" className="m-editorial-cta" onClick={() => { setActiveCategory('All'); setSearchTerm(''); }}>
              {t('catalog.resetFilter')}
            </button>
          </div>
        ) : (
          <div className="m-editorial-empty">
            <p className="m-editorial-eyebrow">{t('catalog.eyebrowWord')}</p>
            <h2>{t('catalog.notLoadedMobile')}</h2>
            <button
              type="button"
              className="m-editorial-cta"
              onClick={() => window.dispatchEvent(new CustomEvent('dekito:products-updated'))}
            >
              {t('catalog.retry')}
            </button>
          </div>
        )}

        {visible.length < filtered.length ? (
          <div className="m-editorial-load-more">
            <button type="button" className="m-editorial-cta" onClick={() => setVisibleCount((c) => c + CATALOG_PAGE_SIZE)}>
{t('catalog.showMore')} <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <span>{t('catalog.shownOf', { shown: visible.length, total: filtered.length })}</span>
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
