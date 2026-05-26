import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { featuredProducts } from '@/data/storefront.js';
import { useCart } from '@/hooks/useCart.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';

const getDescription = (product) => product.description || product.notes || product.mood || 'A quiet Solivagant composition for skin, atmosphere, and ritual.';

const CatalogPage = () => {
  const allProducts = useCatalogProducts();
  const { addItem } = useCart();
  const products = useMemo(() => {
    const visible = allProducts.filter(isProductVisibleInStorefront);
    return (visible.length ? visible : featuredProducts).slice(0, 12);
  }, [allProducts]);

  return (
    <>
      <Helmet>
        <title>Fragrance Collection - SOLIVAGANT</title>
        <meta name="description" content="Explore the SOLIVAGANT fragrance collection by perfumer Dekito." />
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

        <section className="editorial-page-hero">
          <p className="editorial-eyebrow">FRAGRANCE COLLECTION</p>
          <h1>Fragrance Collection</h1>
          <p>
            Limited perfume objects and quiet daily signatures composed from raw materials, memory, and the tactile rhythm of the atelier.
          </p>
        </section>

        <section className="editorial-section editorial-section--compact">
          <div className="editorial-product-grid">
            {products.map((product, index) => (
              <article key={product.id || product.slug} className="editorial-product-card">
                <ProductVisual product={product} className="editorial-product-card__visual" imageFit="cover" priority={index < 2} />
                <div className="editorial-product-card__body">
                  <span>{product.category || 'Atelier'}</span>
                  <h3>{product.name}</h3>
                  <p>{getDescription(product)}</p>
                  <dl>
                    <div>
                      <dt>Notes</dt>
                      <dd>{product.notes || 'Orris, woods, clean musk'}</dd>
                    </div>
                    <div>
                      <dt>Size / price</dt>
                      <dd>{product.size || '30 ml'} / {product.price || 'Rp 289.000'}</dd>
                    </div>
                  </dl>
                  <div className="editorial-product-card__actions">
                    <Link to={`/products/${product.slug}`}>View Details</Link>
                    <button type="button" onClick={() => addItem(product, 1)}>Add to Cart</button>
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

export default CatalogPage;
