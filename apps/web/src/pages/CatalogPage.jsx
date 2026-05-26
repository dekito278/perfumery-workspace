import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, SlidersHorizontal, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { useCart } from '@/hooks/useCart.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';

const getDescription = (product) => product.subtitle || product.description || product.notes || product.mood || 'A quiet Solivagant composition for skin, atmosphere, and ritual.';

const CatalogPage = () => {
  const allProducts = useCatalogProducts();
  const { addItem, summary } = useCart();
  const [lastAddedSlug, setLastAddedSlug] = useState('');
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const products = useMemo(() => {
    const visible = allProducts.filter(isProductVisibleInStorefront);
    return getPublicFragranceCatalog(visible).slice(0, 16);
  }, [allProducts]);
  const catalogCategories = useMemo(() => [
    'Semua',
    ...Array.from(new Set(products.map((product) => product.publicCategory).filter(Boolean))),
  ], [products]);
  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = activeCategory === 'Semua' || product.publicCategory === activeCategory;
      const searchable = [
        product.name,
        product.subtitle,
        product.description,
        product.notes,
        product.mood,
        product.character,
        product.category,
        product.publicCategory,
        product.concentration,
        ...(product.topNotes || []),
        ...(product.heartNotes || []),
        ...(product.baseNotes || []),
      ].join(' ').toLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
  }, [activeCategory, products, searchTerm]);
  const handleAddToCart = (product) => {
    addItem(product, 1);
    setLastAddedSlug(product.slug);
    toast.success(`${product.name} masuk ke keranjang`, {
      description: 'Cart desktop sudah diperbarui. Kamu bisa lanjut belanja atau cek keranjang.',
      action: {
        label: 'Lihat cart',
        onClick: () => { window.location.href = '/cart'; },
      },
    });
    window.setTimeout(() => {
      setLastAddedSlug((current) => (current === product.slug ? '' : current));
    }, 1800);
  };

  return (
    <>
      <Helmet>
        <title>Fragrance Collection - SOLIVAGANT</title>
        <meta name="description" content="Explore the SOLIVAGANT fragrance collection by perfumer Dekito." />
        <meta property="og:title" content="Fragrance Collection - SOLIVAGANT" />
        <meta property="og:description" content="Public SOLIVAGANT fragrance objects with notes pyramid, concentration, sizes, price, and atelier stories." />
      </Helmet>

      <main className="solivagant-editorial-home">
        <PublicHeader />

        <section className="editorial-page-hero">
          <p className="editorial-eyebrow">FRAGRANCE COLLECTION</p>
          <h1>Fragrance Collection</h1>
          <p>
            Limited perfume objects and quiet daily signatures composed from raw materials, memory, and the tactile rhythm of the atelier.
          </p>
        </section>

        <section className="editorial-section editorial-section--compact">
          <div className="editorial-catalog-toolbar" aria-label="Catalog filters">
            <div className="editorial-category-filter" role="list" aria-label="Product categories">
              {catalogCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={category === activeCategory ? 'is-active' : ''}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <label className="editorial-search-field">
              <span>Cari notes, mood, produk</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari notes, mood, produk"
              />
            </label>
            <button type="button" className="editorial-filter-button" aria-label="Apply catalog filters">
              <SlidersHorizontal className="h-4 w-4" />
              Filter
            </button>
            <Link to="/cart" className="editorial-cart-status">
              <ShoppingBag className="h-4 w-4" />
              {summary.quantity ? `${summary.quantity} item di cart` : 'Cart kosong'}
            </Link>
          </div>
          <div className="editorial-product-grid">
            {filteredProducts.map((product, index) => (
              <article key={product.id || product.slug} className="editorial-product-card">
                <div className="editorial-product-card__media">
                  <ProductVisual product={product} className="editorial-product-card__visual" imageFit="cover" priority={index < 2} />
                  <span className="editorial-product-badge">{product.badge}</span>
                </div>
                <div className="editorial-product-card__body">
                  <span>{product.category || 'Atelier'}</span>
                  <h3>{product.name}</h3>
                  <p>{getDescription(product)}</p>
                  <div className="editorial-product-pills">
                    <span>{product.publicStatus || product.availability}</span>
                    <span>{product.sizeVariants?.[0]?.size || product.size || '30 ml'}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>Notes</dt>
                      <dd>{product.notes || 'Orris, woods, clean musk'}</dd>
                    </div>
                    <div>
                      <dt>Size / price</dt>
                      <dd>{product.sizeVariants?.[0]?.size || product.size || '30 ml'} / {product.price || 'Rp 289.000'}</dd>
                    </div>
                  </dl>
                  <div className="editorial-product-card__actions">
                    <Link to={`/catalog/${product.slug}`}>View Details</Link>
                    <button
                      type="button"
                      className={lastAddedSlug === product.slug ? 'is-added' : ''}
                      onClick={() => handleAddToCart(product)}
                    >
                      {lastAddedSlug === product.slug ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Added
                        </>
                      ) : 'Add to Cart'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!filteredProducts.length ? (
            <div className="editorial-empty-state">
              <p className="editorial-eyebrow">NO MATCH</p>
              <h2>No fragrance matches this filter.</h2>
              <button type="button" className="editorial-button" onClick={() => { setActiveCategory('Semua'); setSearchTerm(''); }}>Reset Catalog</button>
            </div>
          ) : null}
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
