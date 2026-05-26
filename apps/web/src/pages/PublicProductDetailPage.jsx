import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import { findPublicFragrance, getPublicFragranceCatalog, publicProductAliases } from '@/data/publicStorefront.js';
import { useCart } from '@/hooks/useCart.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';

const relatedFor = (product, catalog) => {
  const relatedSlugs = product.relatedFragrances || [];
  const explicit = relatedSlugs
    .map((slug) => catalog.find((item) => item.slug === slug))
    .filter(Boolean);
  const contextual = catalog
    .filter((item) => item.slug !== product.slug && !explicit.some((related) => related.slug === item.slug))
    .slice(0, Math.max(0, 3 - explicit.length));

  return [...explicit, ...contextual].slice(0, 3);
};

const PublicProductDetailPage = () => {
  const { slug = '' } = useParams();
  const location = useLocation();
  const aliasSlug = publicProductAliases[location.pathname.replace(/\/$/, '')];
  const studioProducts = useCatalogProducts();
  const visibleProducts = studioProducts.filter(isProductVisibleInStorefront);
  const catalog = getPublicFragranceCatalog(visibleProducts);
  const product = findPublicFragrance(aliasSlug || slug, visibleProducts);
  const { addItem } = useCart();

  if (!product) {
    return <Navigate to="/not-found" replace />;
  }

  return (
    <>
      <Helmet>
        <title>{product.name} - SOLIVAGANT</title>
        <meta name="description" content={`${product.name}: ${product.story}`} />
      </Helmet>

      <main className="solivagant-editorial-home">
        <PublicHeader />

        <section className="editorial-section editorial-product-detail">
          <div className="editorial-featured__visual">
            <ProductVisual product={product} className="editorial-featured__product" priority />
          </div>
          <div className="editorial-featured__copy">
            <div className="editorial-detail-kicker">
              <p className="editorial-eyebrow">{product.category}</p>
              <span>{product.badge}</span>
              <span>{product.publicStatus || product.availability}</span>
            </div>
            <h1>{product.name}</h1>
            <p className="editorial-product-detail__price">{product.price}</p>
            <p>{product.story}</p>
            <div className="editorial-notes-grid">
              <div><span>Top</span><p>{product.topNotes.join(', ')}</p></div>
              <div><span>Heart</span><p>{product.heartNotes.join(', ')}</p></div>
              <div><span>Base</span><p>{product.baseNotes.join(', ')}</p></div>
            </div>
            <div className="editorial-feature-list">
              <span>{product.mood}</span>
              <span>{product.concentration}</span>
              <span>{product.sizeVariants.map((variant) => variant.size).join(' / ')}</span>
              <span>{product.price}</span>
            </div>
            {product.materialHighlights?.length ? (
              <>
                <p className="editorial-eyebrow">PUBLIC RAW MATERIAL HIGHLIGHTS</p>
              <div className="editorial-feature-list" aria-label="Public raw material highlights">
                {product.materialHighlights.map((material) => (
                  <span key={material}>{material}</span>
                ))}
              </div>
              </>
            ) : null}
            <div className="editorial-actions">
              <button type="button" className="editorial-button editorial-button--primary" onClick={() => addItem(product, 1)}>
                Add to Cart
                <ShoppingBag className="h-4 w-4" />
              </button>
              <Link to="/catalog" className="editorial-button">Back to Collection</Link>
            </div>
          </div>
        </section>

        <section className="editorial-section editorial-section--compact">
          <div className="editorial-section-heading">
            <p className="editorial-eyebrow">RELATED FRAGRANCES</p>
            <h2>Other quiet signatures.</h2>
          </div>
          <div className="editorial-product-grid editorial-product-grid--three">
            {relatedFor(product, catalog).map((item) => (
              <article key={item.slug} className="editorial-product-card">
                <ProductVisual product={item} className="editorial-product-card__visual" imageFit="cover" />
                <div className="editorial-product-card__body">
                  <span>{item.category}</span>
                  <h3>{item.name}</h3>
                  <p>{item.character || item.subtitle}</p>
                  <div className="editorial-product-card__actions">
                    <Link to={`/catalog/${item.slug}`}>View Details</Link>
                    <Link to="/cart">Cart</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="editorial-footer">
          <span>SOLIVAGANT by Dekito</span>
          <Link to="/bespoke">Book Bespoke Consultation <ArrowRight className="h-4 w-4" /></Link>
        </footer>
      </main>
    </>
  );
};

export default PublicProductDetailPage;
