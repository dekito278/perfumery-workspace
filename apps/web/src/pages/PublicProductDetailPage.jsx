import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useParams } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { findPublicFragrance, getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { useCart } from '@/hooks/useCart.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';

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

const PublicProductDetailPage = () => {
  const { slug = '' } = useParams();
  const studioProducts = useCatalogProducts();
  const visibleProducts = studioProducts.filter(isProductVisibleInStorefront);
  const catalog = getPublicFragranceCatalog(visibleProducts);
  const product = findPublicFragrance(slug, visibleProducts);
  const { addItem } = useCart();
  const [lastAddedSlug, setLastAddedSlug] = useState('');
  const revealRef = useScrollReveal();

  if (!product) {
    return <Navigate to="/not-found" replace />;
  }

  const handleAddToCart = (item) => {
    addItem(item, 1);
    setLastAddedSlug(item.slug);
    toast.success(`${item.name} masuk ke keranjang`, {
      description: 'Cart desktop sudah diperbarui.',
      action: { label: 'Lihat cart', onClick: () => { window.location.href = '/cart'; } },
    });
    window.setTimeout(() => {
      setLastAddedSlug((current) => (current === item.slug ? '' : current));
    }, 1800);
  };

  const related = relatedFor(product, catalog);

  return (
    <>
      <Helmet>
        <title>{product.name} - SOLIVAGANT</title>
        <meta name="description" content={`${product.name}: ${product.story}`} />
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <PublicHeader />

        {/* Breadcrumb */}
        <nav className="pdp-breadcrumb hero-animate-fade" aria-label="Breadcrumb">
          <Link to="/catalog">Collection</Link>
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

            {/* Notes pyramid */}
            <div className="pdp-notes" data-reveal>
              <div className="pdp-notes__row">
                <span className="pdp-notes__label">Top</span>
                <span className="pdp-notes__values">{product.topNotes.join(', ')}</span>
              </div>
              <div className="pdp-notes__row">
                <span className="pdp-notes__label">Heart</span>
                <span className="pdp-notes__values">{product.heartNotes.join(', ')}</span>
              </div>
              <div className="pdp-notes__row">
                <span className="pdp-notes__label">Base</span>
                <span className="pdp-notes__values">{product.baseNotes.join(', ')}</span>
              </div>
            </div>

            {/* Meta details */}
            <div className="pdp-meta" data-reveal>
              <span>{product.mood}</span>
              <span>{product.concentration}</span>
              <span>{product.sizeVariants.map((v) => v.size).join(' / ')}</span>
            </div>

            {product.materialHighlights?.length ? (
              <div className="pdp-materials" data-reveal>
                <p className="editorial-eyebrow">RAW MATERIAL HIGHLIGHTS</p>
                <div className="pdp-meta">
                  {product.materialHighlights.map((m) => <span key={m}>{m}</span>)}
                </div>
              </div>
            ) : null}

            <div className="pdp-actions" data-reveal>
              <button type="button" className="pdp-add-btn" onClick={() => handleAddToCart(product)}>
                {lastAddedSlug === product.slug ? (
                  <><CheckCircle2 className="h-4 w-4" /> Added to Cart</>
                ) : (
                  <><ShoppingBag className="h-4 w-4" /> Add to Cart &mdash; {product.price}</>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Related products */}
        {related.length ? (
          <section className="pdp-related" data-reveal>
            <div className="home-section__head">
              <p className="editorial-eyebrow">YOU MAY ALSO LIKE</p>
              <h2>Other quiet signatures</h2>
            </div>
            <div className="catalog-grid catalog-grid--four" data-reveal data-stagger-children>
              {related.map((item) => (
                <Link key={item.slug} to={`/catalog/${item.slug}`} className="catalog-card card-lift img-hover-zoom">
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
    </>
  );
};

export default PublicProductDetailPage;
