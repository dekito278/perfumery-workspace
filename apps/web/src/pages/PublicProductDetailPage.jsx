import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScentPyramid from '@/components/storefront/ScentPyramid.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import ImmersiveProductPage from '@/pages/ImmersiveProductPage.jsx';
import { findPublicFragrance, getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { getProductStory } from '@/data/stories/index.js';
import useProductStory from '@/hooks/useProductStory.js';
import { useCart } from '@/hooks/useCart.js';
import { useMicroInteractions } from '@/hooks/useParallax.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { formatRupiah, isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import {
  DEFAULT_SHARE_IMAGE,
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  getSiteOrigin,
  toAbsoluteUrl,
} from '@/utils/seo.js';

const relatedFor = (product, catalog) => {
  const relatedSlugs = product.relatedFragrances || [];
  const explicit = relatedSlugs
    .map((slug) => catalog.find((item) => item.slug === slug))
    .filter(Boolean);
  const contextual = catalog
    .filter((item) => item.slug !== product.slug && !explicit.some((r) => r.slug === item.slug))
    .slice(0, Math.max(0, 4 - explicit.length));
  return [...explicit, ...contextual].slice(0, 4);
};

const PublicProductDetailPage = ({ slug: slugProp = '' } = {}) => {
  const { slug: slugParam = '' } = useParams();
  const slug = slugProp || slugParam;
  const studioProducts = useCatalogProducts();
  const visibleProducts = studioProducts.filter(isProductVisibleInStorefront);
  const catalog = getPublicFragranceCatalog(visibleProducts);
  const product = findPublicFragrance(slug, visibleProducts);
  const productsLoading = Boolean(studioProducts.loading);
  const { story: supabaseStory, loading: storyLoading } = useProductStory(slug);
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [lastAddedSlug, setLastAddedSlug] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [showStickyBar, setShowStickyBar] = useState(false);
  const addBtnRef = useRef(null);
  const revealRef = useScrollReveal();
  const { magnetic, tilt, resetTilt } = useMicroInteractions();

  // Reveal a compact sticky buy-bar once the main add-to-cart button scrolls out of view.
  useEffect(() => {
    const target = addBtnRef.current;
    if (!target) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { rootMargin: '0px 0px -80px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [product?.slug]);

  if (!product) {
    // Don't 404 while the catalog is still loading (cold cache / shared deep link):
    // wait for the async fetch before deciding the product doesn't exist.
    if (productsLoading) {
      return (
        <>
          <PublicHeader />
          <main
            role="status"
            aria-live="polite"
            aria-busy="true"
            style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: '48px 24px' }}
          >
            <p className="editorial-eyebrow">Memuat produk…</p>
          </main>
          <StorefrontFooter />
        </>
      );
    }
    return <Navigate to="/not-found" replace />;
  }

  // Pick the selected size variant (default the first), so desktop buyers can choose size and are
  // charged that variant's price — matching mobile, instead of always the product default.
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const selectedVariant = variants.find((v) => (v.id || v.size) === selectedVariantId) || variants[0] || null;
  const selectedPrice = Number(selectedVariant?.priceNumber || product.priceNumber || 0);
  const selectedSize = selectedVariant?.size || product.size;
  const selectedVariantKey = selectedVariant?.id || selectedVariant?.size || '';
  const selectedPriceLabel = selectedPrice > 0 ? formatRupiah(selectedPrice) : product.price;
  // Public variants carry `availability` ('Available'|'Inquire'), not a raw stock count — use it so we
  // don't expose exact inventory. Fall back to the product-level publicStatus when there are no variants.
  const selectedAvailable = selectedVariant ? selectedVariant.availability === 'Available' : product.publicStatus === 'Available';
  const soldOut = !selectedAvailable;

  const handleAddToCart = () => {
    if (soldOut) {
      toast.error(`${product.name} sedang habis`);
      return;
    }
    addItem({
      ...product,
      cartSlug: `${product.slug}-${selectedVariant?.id || selectedSize}`,
      variantId: selectedVariant?.id || '',
      size: selectedSize,
      price: selectedPriceLabel,
      priceNumber: selectedPrice,
    }, 1);
    setLastAddedSlug(product.slug);
    toast.success(`${product.name} (${selectedSize}) masuk ke keranjang`, {
      description: 'Keranjang sudah diperbarui.',
      action: { label: 'Lihat cart', onClick: () => navigate('/cart') },
    });
    window.setTimeout(() => {
      setLastAddedSlug((current) => (current === product.slug ? '' : current));
    }, 1800);
  };

  const related = relatedFor(product, catalog);
  const productStory = supabaseStory || getProductStory(slug);

  if (storyLoading) {
    return (
      <>
        <PublicHeader />
        <main role="status" aria-live="polite" aria-busy="true" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
          <p className="editorial-eyebrow">Memuat...</p>
        </main>
        <StorefrontFooter />
      </>
    );
  }

  if (productStory) {
    return <ImmersiveProductPage product={product} story={productStory} />;
  }

  const siteOrigin = getSiteOrigin();
  const canonicalUrl = toAbsoluteUrl(`/catalog/${product.slug}`, siteOrigin);
  const shareImage = toAbsoluteUrl(product.imageUrl || product.images?.[0] || DEFAULT_SHARE_IMAGE, siteOrigin);
  const metaDescription = `${product.name} — ${product.subtitle || product.story || ''}`.trim().slice(0, 155);
  const productJsonLd = buildProductJsonLd(product, { origin: siteOrigin, canonicalUrl });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Beranda', path: '/home' },
    { name: 'Koleksi', path: '/catalog' },
    { name: product.name, path: `/catalog/${product.slug}` },
  ], siteOrigin);

  return (
    <>
      <Helmet>
        <title>{product.name} - SOLIVAGANT</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:site_name" content="SOLIVAGANT" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={`${product.name} - SOLIVAGANT`} />
        <meta property="og:description" content={metaDescription} />
        {shareImage ? <meta property="og:image" content={shareImage} /> : null}
        {shareImage ? <meta property="og:image:alt" content={product.name} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${product.name} - SOLIVAGANT`} />
        <meta name="twitter:description" content={metaDescription} />
        {shareImage ? <meta name="twitter:image" content={shareImage} /> : null}
        {product.priceNumber > 0 ? <meta property="product:price:amount" content={String(product.priceNumber)} /> : null}
        {product.priceNumber > 0 ? <meta property="product:price:currency" content="IDR" /> : null}
        {productJsonLd ? <script type="application/ld+json">{JSON.stringify(productJsonLd)}</script> : null}
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <ScrollProgress />
        <PublicHeader />

        {/* Breadcrumb */}
        <nav className="pdp-breadcrumb hero-animate-fade" aria-label="Breadcrumb">
          <Link to="/catalog">Koleksi</Link>
          <ChevronRight className="h-3 w-3" />
          <span>{product.name}</span>
        </nav>

        {/* Product detail — large image + info */}
        <section className="pdp-main">
          <div className="pdp-gallery img-hover-zoom hero-animate-image">
            <ProductVisual product={product} className="pdp-gallery__image" imageFit="cover" priority label={false} />
          </div>
          <div className="pdp-info">
            <p className="editorial-eyebrow hero-animate-text hero-animate-text--d1">{product.category}</p>
            <h1 className="hero-animate-text hero-animate-text--d2">{product.name}</h1>
            <p className="pdp-price hero-animate-text hero-animate-text--d3">{product.price}</p>
            <p className="pdp-story hero-animate-text hero-animate-text--d4">{product.story}</p>

            {/* Scent pyramid */}
            <div data-reveal>
              <ScentPyramid product={product} />
            </div>

            {/* Meta details */}
            <div className="pdp-meta" data-reveal>
              <span>{product.mood}</span>
              <span>{product.concentration}</span>
              <span>{(product.sizeVariants || []).map((v) => v.size).join(' / ')}</span>
            </div>

            {product.materialHighlights?.length ? (
              <div className="pdp-materials" data-reveal>
                <p className="editorial-eyebrow">RAW MATERIAL HIGHLIGHTS</p>
                <div className="pdp-meta">
                  {product.materialHighlights.map((m) => <span key={m}>{m}</span>)}
                </div>
              </div>
            ) : null}

            {variants.length > 1 ? (
              <div className="pdp-variants" data-reveal>
                <label className="editorial-eyebrow" htmlFor="pdp-variant-select">UKURAN</label>
                <select
                  id="pdp-variant-select"
                  value={selectedVariantKey}
                  onChange={(event) => setSelectedVariantId(event.target.value)}
                  className="pdp-variant-select"
                >
                  {variants.map((v) => {
                    const key = v.id || v.size;
                    return (
                      <option key={key} value={key}>
                        {v.size} — {formatRupiah(v.priceNumber)}{v.availability !== 'Available' ? ' (Habis)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : null}

            <div className="pdp-actions" data-reveal>
              <button ref={addBtnRef} type="button" className="pdp-add-btn magnetic-hover" onClick={() => handleAddToCart()} onMouseMove={magnetic} disabled={soldOut}>
                {soldOut ? (
                  <>Stok Habis</>
                ) : lastAddedSlug === product.slug ? (
                  <><CheckCircle2 className="h-4 w-4" /> Sudah di Keranjang</>
                ) : (
                  <><ShoppingBag className="h-4 w-4" /> Tambah ke Keranjang &mdash; {selectedPriceLabel}</>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Related products */}
        {related.length ? (
          <section className="pdp-related" data-reveal>
            <div className="home-section__head">
              <p className="editorial-eyebrow">MUNGKIN KAMU SUKA</p>
              <h2>Signature tenang lainnya</h2>
            </div>
            <div className="catalog-grid catalog-grid--four" data-reveal data-stagger-children>
              {related.map((item) => (
                <Link key={item.slug} to={`/catalog/${item.slug}`} className="catalog-card card-lift card-tilt img-hover-zoom" onMouseMove={tilt} onMouseLeave={resetTilt}>
                  <ProductVisual product={item} className="catalog-card__visual" imageFit="cover" label={false} />
                  <div className="catalog-card__info">
                    <span className="catalog-card__category">{item.category}</span>
                    <h3>{item.name}</h3>
                    <span className="catalog-card__price">{item.price}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <StorefrontFooter />
      </main>

      {/* Sticky buy-bar — appears after the main CTA scrolls away */}
      <div className={`pdp-sticky-bar${showStickyBar ? ' is-visible' : ''}`} aria-hidden={!showStickyBar}>
        <div className="pdp-sticky-bar__inner">
          <div className="pdp-sticky-bar__product">
            <div className="pdp-sticky-bar__thumb">
              <ProductVisual product={product} imageFit="cover" label={false} />
            </div>
            <div className="pdp-sticky-bar__text">
              <span className="pdp-sticky-bar__name">{product.name}</span>
              <span className="pdp-sticky-bar__price">{selectedPriceLabel}</span>
            </div>
          </div>
          <button
            type="button"
            className="pdp-add-btn magnetic-hover"
            onClick={() => handleAddToCart()}
            onMouseMove={magnetic}
            tabIndex={showStickyBar ? 0 : -1}
            disabled={soldOut}
          >
            {soldOut ? (
              <>Stok Habis</>
            ) : lastAddedSlug === product.slug ? (
              <><CheckCircle2 className="h-4 w-4" /> Sudah di Keranjang</>
            ) : (
              <><ShoppingBag className="h-4 w-4" /> Tambah ke Keranjang</>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default PublicProductDetailPage;
