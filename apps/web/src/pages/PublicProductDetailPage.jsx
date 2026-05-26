import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { findPublicFragrance, publicFragrances, publicProductAliases } from '@/data/publicStorefront.js';
import { useCart } from '@/hooks/useCart.js';

const relatedFor = (product) => publicFragrances
  .filter((item) => item.slug !== product.slug)
  .slice(0, 3);

const PublicProductDetailPage = () => {
  const { slug = '' } = useParams();
  const location = useLocation();
  const aliasSlug = publicProductAliases[location.pathname.replace(/\/$/, '')];
  const product = findPublicFragrance(aliasSlug || slug);
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
        <header className="editorial-header">
          <Link to="/home" className="editorial-wordmark">SOLIVAGANT</Link>
          <nav className="editorial-nav" aria-label="Storefront navigation">
            <Link to="/catalog">Collection</Link>
            <Link to="/bespoke">Bespoke</Link>
            <Link to="/materials">Materials</Link>
            <Link to="/journal">Journal</Link>
            <Link to="/track-order">Track Order</Link>
          </nav>
          <Link to="/cart" className="editorial-cart-button"><ShoppingBag className="h-4 w-4" />Cart</Link>
        </header>

        <section className="editorial-section editorial-product-detail">
          <div className="editorial-featured__visual">
            <ProductVisual product={product} className="editorial-featured__product" priority />
          </div>
          <div className="editorial-featured__copy">
            <p className="editorial-eyebrow">{product.category}</p>
            <h1>{product.name}</h1>
            <p>{product.story}</p>
            <div className="editorial-notes-grid">
              <div><span>Top</span><p>{product.topNotes.join(', ')}</p></div>
              <div><span>Heart</span><p>{product.heartNotes.join(', ')}</p></div>
              <div><span>Base</span><p>{product.baseNotes.join(', ')}</p></div>
            </div>
            <div className="editorial-feature-list">
              <span>{product.mood}</span>
              <span>{product.concentration}</span>
              <span>{product.variants.join(' / ')}</span>
              <span>{product.price}</span>
            </div>
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
            {relatedFor(product).map((item) => (
              <article key={item.slug} className="editorial-product-card">
                <ProductVisual product={item} className="editorial-product-card__visual" imageFit="cover" />
                <div className="editorial-product-card__body">
                  <span>{item.category}</span>
                  <h3>{item.name}</h3>
                  <p>{item.character}</p>
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
