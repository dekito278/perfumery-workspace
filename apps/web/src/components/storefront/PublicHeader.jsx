import RegionSwitch from '@/components/storefront/RegionSwitch.jsx';
import React, {useEffect, useState, useRef, useCallback} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, ChevronDown, X, Menu, UserRound } from 'lucide-react';
import BackToTop from '@/components/storefront/BackToTop.jsx';
import { useCart } from '@/hooks/useCart.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { storefrontCategories } from '@/data/storefront.js';
import { useTranslate } from '@/hooks/useTranslate.js';

// `titleKey`/`labelKey` go through the message file; a category name is product data, not copy, so it
// stays as it is written in Studio.
const megaMenuColumns = [
  {
    titleKey: 'pdp.collection',
    links: [
      { labelKey: 'nav.allFragrances', to: '/catalog' },
      { labelKey: 'nav.bespoke', to: '/bespoke' },
    ],
  },
  {
    titleKey: 'nav.byFamily',
    links: storefrontCategories.map((cat) => ({
      label: cat.name,
      to: `/catalog?family=${cat.name.toLowerCase()}`,
    })),
  },
  {
    titleKey: 'nav.other',
    links: [
      { labelKey: 'nav.journal', to: '/journal' },
      { labelKey: 'nav.account', to: '/customer' },
      { labelKey: 'nav.trackOrder', to: '/track-order' },
    ],
  },
];

const PublicHeader = () => {
  const { summary } = useCart();
  const { t } = useTranslate();
  const { currentUser } = useAuth();
  // The header used to delete any cart line whose slug was not in the visible catalog, silently. A shopper
  // whose product went out of stock or got unpublished just found their cart shorter, with no reason given
  // — and it ran only here, so desktop and mobile disagreed. reconcileCartLines now flags those lines
  // instead, the cart pages name them, and checkout refuses them (audit round 9).

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
    <div ref={menuRef} className={`editorial-header-wrap${headerHidden ? ' is-hidden' : ''}${headerScrolled ? ' is-scrolled' : ''}`}>
      <header className="editorial-header">
        <Link to="/home" className="editorial-wordmark" aria-label={t('nav.wordmarkAria')}>
          SOLIVAGANT
        </Link>

        <RegionSwitch className="mr-1" />
        <nav className="editorial-nav" aria-label={t('nav.storefrontAria')}>
          <button
            type="button"
            className="editorial-nav__trigger"
            onClick={toggleMega}
            aria-expanded={megaOpen}
            aria-haspopup="true"
          >
            {t('nav.shop')} <ChevronDown className={`editorial-nav__chevron ${megaOpen ? 'is-open' : ''}`} />
          </button>
          <Link to="/journal">{t('nav.journal')}</Link>
        </nav>

        <div className="editorial-header__actions">
          <button
            type="button"
            className="editorial-nav__hamburger"
            onClick={toggleMega}
            aria-expanded={megaOpen}
            aria-haspopup="true"
            aria-label={t(megaOpen ? 'nav.closeMenu' : 'nav.openMenu')}
          >
            {megaOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          {/* The one door to the account, on every storefront page. The only entry used to be "Lacak
              Pesanan" in the menu — framed as tracking, so nobody signed in for the price. */}
          <Link
            to="/customer"
            className="editorial-cart-button"
            aria-label={t(currentUser ? 'nav.account' : 'nav.accountSub')}
            title={t(currentUser ? 'nav.account' : 'nav.accountSub')}
          >
            <UserRound className="h-4 w-4" />
          </Link>
          <Link to="/cart" className="editorial-cart-button" aria-label={t('nav.cartAria', { count: summary.quantity })}>
            <ShoppingBag className="h-4 w-4" />
            {summary.quantity > 0 ? <span className="editorial-cart-count">{summary.quantity}</span> : null}
          </Link>
        </div>
      </header>

      {megaOpen && (
        <div className="editorial-mega-menu" role="menu">
          <div className="editorial-mega-menu__inner">
            {megaMenuColumns.map((col) => (
              <div key={col.titleKey} className="editorial-mega-menu__column">
                <span className="editorial-mega-menu__heading">{t(col.titleKey)}</span>
                {col.links.map((link) => (
                  <Link key={`${col.titleKey}-${link.to}`} to={link.to} role="menuitem" onClick={() => setMegaOpen(false)}>
                    {link.labelKey ? t(link.labelKey) : link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <button type="button" className="editorial-mega-menu__close" onClick={() => setMegaOpen(false)} aria-label={t('nav.closeMenu')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <BackToTop />
    </div>
  );
};

export default PublicHeader;
