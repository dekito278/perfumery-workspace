import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, ChevronDown, X } from 'lucide-react';
import { useCart } from '@/hooks/useCart.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { storefrontCategories } from '@/data/storefront.js';

const megaMenuColumns = [
  {
    title: 'Collection',
    links: [
      { label: 'All Fragrances', to: '/catalog' },
      { label: 'Bespoke Ritual', to: '/bespoke' },
    ],
  },
  {
    title: 'By Family',
    links: storefrontCategories.map((cat) => ({
      label: cat.name,
      to: `/catalog?family=${cat.name.toLowerCase()}`,
    })),
  },
  {
    title: 'Resources',
    links: [
      { label: 'Raw Material Archive', to: '/materials' },
      { label: 'Scent Guide', to: '/journal' },
    ],
  },
];

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

  const [megaOpen, setMegaOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const menuRef = useRef(null);
  const lastScrollY = useRef(0);
  const location = useLocation();

  // Close menu on route change
  useEffect(() => { setMegaOpen(false); }, [location.pathname]);

  // Header hide on scroll down, show on scroll up
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHeaderScrolled(y > 60);
      if (megaOpen) { lastScrollY.current = y; return; }
      if (y > lastScrollY.current && y > 120) {
        setHeaderHidden(true);
      } else if (y < lastScrollY.current - 4) {
        setHeaderHidden(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [megaOpen]);

  // Close on outside click
  useEffect(() => {
    if (!megaOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMegaOpen(false);
    };
    const handleEscape = (e) => { if (e.key === 'Escape') setMegaOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [megaOpen]);

  const toggleMega = useCallback(() => setMegaOpen((prev) => !prev), []);

  return (
    <header className={`editorial-header${headerHidden ? ' is-hidden' : ''}${headerScrolled ? ' is-scrolled' : ''}`} ref={menuRef}>
      <Link to="/home" className="editorial-wordmark" aria-label="SOLIVAGANT home">
        SOLIVAGANT
      </Link>

      <nav className="editorial-nav" aria-label="Public storefront navigation">
        <button
          type="button"
          className="editorial-nav__trigger"
          onClick={toggleMega}
          aria-expanded={megaOpen}
          aria-haspopup="true"
        >
          Shop <ChevronDown className={`editorial-nav__chevron ${megaOpen ? 'is-open' : ''}`} />
        </button>
        <Link to="/journal">Journal</Link>
      </nav>

      <Link to="/cart" className="editorial-cart-button" aria-label={`Cart, ${summary.quantity} item`}>
        <ShoppingBag className="h-4 w-4" />
        {summary.quantity > 0 ? <span className="editorial-cart-count">{summary.quantity}</span> : null}
      </Link>

      {megaOpen && (
        <div className="editorial-mega-menu" role="menu">
          <div className="editorial-mega-menu__inner">
            {megaMenuColumns.map((col) => (
              <div key={col.title} className="editorial-mega-menu__column">
                <span className="editorial-mega-menu__heading">{col.title}</span>
                {col.links.map((link) => (
                  <Link key={link.to} to={link.to} role="menuitem" onClick={() => setMegaOpen(false)}>
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <button type="button" className="editorial-mega-menu__close" onClick={() => setMegaOpen(false)} aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
};

export default PublicHeader;
