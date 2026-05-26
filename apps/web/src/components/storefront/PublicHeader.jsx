import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/useCart.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';

const PublicHeader = () => {
  const { items, removeItem, summary } = useCart();
  const catalogProducts = useCatalogProducts();
  const productsLoading = Boolean(catalogProducts.loading);
  const validCartSlugs = useMemo(() => new Set(
    catalogProducts
      .filter(isProductVisibleInStorefront)
      .flatMap((product) => [product.slug, ...(product.variants || []).map((variant) => variant.cartSlug || `${product.slug}-${variant.id || variant.size}`)])
      .filter(Boolean)
  ), [catalogProducts]);

  useEffect(() => {
    if (productsLoading || !items.length) return;
    items
      .filter((item) => !validCartSlugs.has(item.productSlug || item.slug) && !validCartSlugs.has(item.slug))
      .forEach((item) => removeItem(item.slug));
  }, [items, productsLoading, removeItem, validCartSlugs]);

  return (
    <header className="editorial-header">
      <Link to="/home" className="editorial-wordmark" aria-label="SOLIVAGANT home">
        SOLIVAGANT
      </Link>
      <nav className="editorial-nav" aria-label="Public storefront navigation">
        <Link to="/catalog">Collection</Link>
        <Link to="/bespoke">Bespoke ritual</Link>
        <Link to="/materials">Raw material archive</Link>
        <Link to="/journal">Journal</Link>
        <Link to="/track-order">Track Order</Link>
      </nav>
      <Link to="/cart" className="editorial-cart-button" aria-label={`Cart, ${summary.quantity} item`}>
        <ShoppingBag className="h-4 w-4" />
        {'Cart '}
        {summary.quantity > 0 ? <span className="editorial-cart-count">{summary.quantity}</span> : null}
      </Link>
    </header>
  );
};

export default PublicHeader;
