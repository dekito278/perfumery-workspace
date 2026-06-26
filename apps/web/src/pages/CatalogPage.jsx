import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { featuredProducts } from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';

const CatalogPage = () => {
  const fetchedProducts = useCatalogProducts();
  const allProducts = fetchedProducts.length ? fetchedProducts : featuredProducts;
  const [searchParams] = useSearchParams();
  const initialFamily = searchParams.get('family') || '';
  const [activeCategory, setActiveCategory] = useState(initialFamily ? initialFamily.charAt(0).toUpperCase() + initialFamily.slice(1) : 'All');
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);
  const revealRef = useScrollReveal();

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

  return (
    <>
      <Helmet>
        <title>Fragrance Collection - SOLIVAGANT</title>
        <meta name="description" content="Explore the SOLIVAGANT fragrance collection by perfumer Dekito." />
        <meta property="og:title" content="Fragrance Collection - SOLIVAGANT" />
        <meta property="og:description" content="Public SOLIVAGANT fragrance objects with notes, sizes, and pricing." />
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <PublicHeader />

        <section className="catalog-hero">
          <p className="editorial-eyebrow hero-animate-text hero-animate-text--d1">FRAGRANCE COLLECTION</p>
          <h1 className="hero-animate-text hero-animate-text--d2">Collection</h1>
          <p className="hero-animate-text hero-animate-text--d3">Limited perfume objects and quiet daily signatures from the atelier.</p>
        </section>

        <section className="catalog-section">
          {/* Toolbar: category pills + search */}
          <div className="catalog-toolbar">
            <div className="catalog-pills" role="list" aria-label="Filter by category">
              {catalogCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`catalog-pill ${category === activeCategory ? 'is-active' : ''}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="catalog-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search notes, mood, name..."
            />
          </div>

          {/* Image-first product grid */}
          {filteredProducts.length ? (
            <div className="catalog-grid" data-reveal data-stagger-children>
              {visibleProducts.map((product, index) => (
                <Link key={product.slug || product.id} to={`/catalog/${product.slug}`} className="catalog-card card-lift img-hover-zoom">
                  <ProductVisual
                    product={product}
                    className="catalog-card__visual"
                    imageFit="cover"
                    priority={index < 4}
                    label={false}
                  />
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
              <p className="editorial-eyebrow">NO MATCH</p>
              <h2>No fragrance matches this filter.</h2>
              <button type="button" className="editorial-button" onClick={() => { setActiveCategory('All'); setSearchTerm(''); }}>
                Reset Catalog
              </button>
            </div>
          )}

          {visibleProducts.length < filteredProducts.length ? (
            <div className="catalog-load-more">
              <button type="button" className="editorial-button" onClick={() => setVisibleCount((c) => c + 12)}>
                Show more <ArrowRight className="h-4 w-4" />
              </button>
              <span>{visibleProducts.length} of {filteredProducts.length}</span>
            </div>
          ) : null}
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default CatalogPage;
