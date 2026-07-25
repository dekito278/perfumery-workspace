import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import TextReveal from '@/components/storefront/TextReveal.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { featuredProducts } from '@/data/storefront.js';
import { useCart } from '@/hooks/useCart.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useMicroInteractions } from '@/hooks/useParallax.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { buildBreadcrumbJsonLd, getSiteOrigin, toAbsoluteUrl } from '@/utils/seo.js';

const CatalogPage = () => {
  const fetchedProducts = useCatalogProducts();
  const allProducts = fetchedProducts.length ? fetchedProducts : featuredProducts;
  const [searchParams] = useSearchParams();
  const initialFamily = searchParams.get('family') || '';
  // Start at 'All'; the effect below promotes it to the URL family only when that
  // family is a real catalog category, so an unknown ?family= never yields an empty list.
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);
  const revealRef = useScrollReveal();
  const { magnetic, tilt, resetTilt } = useMicroInteractions();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [addedSlug, setAddedSlug] = useState('');
  const isLoading = Boolean(fetchedProducts.loading) && !fetchedProducts.length;

  const handleQuickAdd = useCallback((event, product) => {
    // The card is a <Link>; keep the click from navigating to the PDP.
    event.preventDefault();
    event.stopPropagation();
    if (product.publicStatus !== 'Available') {
      toast.error(`${product.name} sedang habis`);
      return;
    }
    addItem(product, 1);
    setAddedSlug(product.slug);
    toast.success(`${product.name} masuk ke keranjang`, {
      description: 'Keranjang sudah diperbarui.',
      action: { label: 'Lihat cart', onClick: () => navigate('/cart') },
    });
    window.setTimeout(() => {
      setAddedSlug((current) => (current === product.slug ? '' : current));
    }, 1800);
  }, [addItem, navigate]);

  const products = useMemo(() => {
    const visible = allProducts.filter(isProductVisibleInStorefront);
    return getPublicFragranceCatalog(visible);
  }, [allProducts]);

  const catalogCategories = useMemo(() => [
    'All',
    ...Array.from(new Set(products.map((p) => p.publicCategory || p.category).filter(Boolean))),
  ], [products]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
      const cat = product.publicCategory || product.category || '';
      const matchesCategory = activeCategory === 'All' || cat === activeCategory;
      if (!matchesCategory) return false;
      if (!query) return true;
      const searchable = [
        product.name, product.subtitle, product.description,
        product.notes, product.mood, product.category,
        ...(product.topNotes || []), ...(product.heartNotes || []), ...(product.baseNotes || []),
      ].join(' ').toLowerCase();
      return searchable.includes(query);
    });
  }, [activeCategory, products, searchTerm]);

  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);

  useEffect(() => { setVisibleCount(12); }, [activeCategory, searchTerm]);

  // Sync family param from homepage mood cards
  useEffect(() => {
    if (initialFamily) {
      const capitalized = initialFamily.charAt(0).toUpperCase() + initialFamily.slice(1);
      if (catalogCategories.includes(capitalized)) {
        setActiveCategory(capitalized);
      }
    }
  }, [initialFamily, catalogCategories]);

  const siteOrigin = getSiteOrigin();
  const catalogCanonical = toAbsoluteUrl('/catalog', siteOrigin);
  const catalogBreadcrumb = buildBreadcrumbJsonLd([
    { name: 'Beranda', path: '/home' },
    { name: 'Koleksi', path: '/catalog' },
  ], siteOrigin);

  return (
    <>
      <Helmet>
        <title>Fragrance Collection - SOLIVAGANT</title>
        <meta name="description" content="Explore the SOLIVAGANT fragrance collection by perfumer Dekito." />
        <link rel="canonical" href={catalogCanonical} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SOLIVAGANT" />
        <meta property="og:url" content={catalogCanonical} />
        <meta property="og:title" content="Fragrance Collection - SOLIVAGANT" />
        <meta property="og:description" content="Public SOLIVAGANT fragrance objects with notes, sizes, and pricing." />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(catalogBreadcrumb)}</script>
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <ScrollProgress />
        <PublicHeader />

        <section className="catalog-hero">
          <p className="editorial-eyebrow hero-animate-text hero-animate-text--d1">KOLEKSI FRAGRANCE</p>
          <TextReveal as="h1" text="Koleksi" />
          <p className="hero-animate-text hero-animate-text--d3">Objek parfum terbatas dan signature harian yang tenang dari atelier.</p>
        </section>

        <section className="catalog-section">
          {/* Toolbar: category pills + search */}
          <div className="catalog-toolbar">
            <div className="catalog-pills" role="list" aria-label="Filter berdasarkan kategori">
              {catalogCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`catalog-pill ${category === activeCategory ? 'is-active' : ''}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category === 'All' ? 'Semua' : category}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="catalog-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari notes, mood, atau nama..."
              aria-label="Cari fragrance berdasarkan nama, notes, atau mood"
            />
          </div>

          {/* Image-first product grid */}
          {isLoading ? (
            <div className="catalog-grid" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skel-card">
                  <div className="editorial-skel skel-card__img" />
                  <div className="editorial-skel skel-line skel-line--sm" />
                  <div className="editorial-skel skel-line skel-line--md" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length ? (
            <div className="catalog-grid" data-reveal data-stagger-children>
              {visibleProducts.map((product, index) => (
                <Link
                  key={product.slug || product.id}
                  to={`/catalog/${product.slug}`}
                  className="catalog-card card-lift card-tilt img-hover-zoom"
                  onMouseMove={tilt}
                  onMouseLeave={resetTilt}
                >
                  <div className="catalog-card__media">
                    <ProductVisual
                      product={product}
                      className="catalog-card__visual"
                      imageFit="cover"
                      priority={index < 4}
                      label={false}
                    />
                    <button
                      type="button"
                      className={`catalog-card__quick-add${addedSlug === product.slug ? ' is-added' : ''}`}
                      onClick={(event) => handleQuickAdd(event, product)}
                      aria-label={product.publicStatus !== 'Available' ? `${product.name} stok habis` : `Tambah ${product.name} ke keranjang`}
                      disabled={product.publicStatus !== 'Available'}
                    >
                      {product.publicStatus !== 'Available' ? (
                        <>Habis</>
                      ) : addedSlug === product.slug ? (
                        <><CheckCircle2 className="h-4 w-4" /> Ditambahkan</>
                      ) : (
                        <><Plus className="h-4 w-4" /> Keranjang</>
                      )}
                    </button>
                  </div>
                  <div className="catalog-card__info">
                    <span className="catalog-card__category">{product.category || 'Atelier'}</span>
                    <h3>{product.name}</h3>
                    <span className="catalog-card__price">{product.price || `Rp ${(product.priceNumber || 0).toLocaleString('id-ID')}`}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="catalog-empty">
              <p className="editorial-eyebrow">TIDAK ADA</p>
              <h2>Tidak ada fragrance yang cocok dengan filter ini.</h2>
              <button type="button" className="editorial-button" onClick={() => { setActiveCategory('All'); setSearchTerm(''); }}>
                Reset Katalog
              </button>
            </div>
          )}

          {visibleProducts.length < filteredProducts.length ? (
            <div className="catalog-load-more">
              <button type="button" className="editorial-button magnetic-hover" onClick={() => setVisibleCount((c) => c + 12)} onMouseMove={magnetic}>
                Tampilkan lagi <ArrowRight className="h-4 w-4" />
              </button>
              <span>{visibleProducts.length} dari {filteredProducts.length}</span>
            </div>
          ) : null}
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default CatalogPage;
