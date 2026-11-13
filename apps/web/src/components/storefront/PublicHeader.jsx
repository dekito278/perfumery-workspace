import RegionSwitch from '@/components/storefront/RegionSwitch.jsx';
import React, {useEffect, useState, useRef, useCallback} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { X, Menu, ShoppingBag } from 'lucide-react';
import BackToTop from '@/components/storefront/BackToTop.jsx';
import { useCart } from '@/hooks/useCart.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { storefrontCategories } from '@/data/storefront.js';
import PriceChangeNotice from '@/components/storefront/PriceChangeNotice.jsx';
import SwitchToEnglishHint from '@/components/storefront/SwitchToEnglishHint.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import { isMobileBrowser } from '@/utils/deviceRouting.js';
import { lockBodyScroll } from '@/utils/bodyScrollLock.js';

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
      // About and Help lived only in the footer, under a long page on a phone (third audit, 13 Nov 2026).
      { labelKey: 'nav.about', to: '/about' },
      { labelKey: 'nav.help', to: '/help' },
    ],
  },
];

const PublicHeader = () => {
  const { summary } = useCart();
  const { t } = useTranslate();
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const ownerTapRef = useRef({ count: 0, lastTapAt: 0 });
  // The header used to delete any cart line whose slug was not in the visible catalog, silently. A shopper
  // whose product went out of stock or got unpublished just found their cart shorter, with no reason given
  // — and it ran only here, so desktop and mobile disagreed. reconcileCartLines now flags those lines
  // instead, the cart pages name them, and checkout refuses them (audit round 9).

  const [megaOpen, setMegaOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
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

  // Close on outside click, on Escape (focus back on the button), and when keyboard focus leaves the
  // header and its menu. Fourth visitor audit, 13 Nov 2026: Tab walked out of the open menu onto
  // "LIHAT PARFUMNYA", hidden underneath it, and the page behind scrolled under the finger on a phone.
  useEffect(() => {
    if (!megaOpen) return undefined;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMegaOpen(false);
    };
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return;
      setMegaOpen(false);
      menuButtonRef.current?.focus();
    };
    const handleFocusOut = (e) => {
      if (e.relatedTarget && menuRef.current && !menuRef.current.contains(e.relatedTarget)) setMegaOpen(false);
    };
    const wrap = menuRef.current;
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    wrap?.addEventListener('focusout', handleFocusOut);
    // On a phone the menu covers the screen: the page behind it stays put while it is open.
    const phone = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches;
    let unlockScroll = null;
    if (phone) {
      const release = lockBodyScroll();
      unlockScroll = release;
    }
    // Where the panel starts, measured: it hangs below the header, and the header's height is whatever
    // the phone makes it. A guessed 80px left the last links ("Bantuan & kebijakan") under the browser's
    // own bottom bar, out of reach of any scroll (Dekito's screenshot, 14 Nov 2026).
    const placeMenu = () => {
      const top = Math.max(0, Math.round(wrap?.getBoundingClientRect().bottom || 0));
      wrap?.style.setProperty('--ng-menu-top', `${top}px`);
    };
    placeMenu();
    window.addEventListener('resize', placeMenu);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
      wrap?.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('resize', placeMenu);
      unlockScroll?.();
    };
  }, [megaOpen]);

  const toggleMega = useCallback(() => setMegaOpen((prev) => !prev), []);
  const skipToHeading = useCallback((event) => {
    const heading = document.querySelector('main h1') || document.querySelector('h1');
    if (!heading) return;
    event.preventDefault();
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus();
  }, []);

  // Three quick taps on the wordmark are the OWNER's way into Studio — the gesture the phone storefront's
  // header carried until it retired (2026-10-31), now on the one header every screen shares. The first
  // tap still goes home, as a wordmark should. isAdmin, not isAuthenticated: a signed-in buyer sent to
  // Studio is bounced straight back out by ProtectedRoute, so for anyone else the door is the sign-in page.
  const openOwnerAccess = (event) => {
    const now = Date.now();
    const count = now - ownerTapRef.current.lastTapAt > 1800 ? 1 : ownerTapRef.current.count + 1;
    ownerTapRef.current = { count, lastTapAt: now };
    if (count < 3) return;
    event.preventDefault();
    ownerTapRef.current = { count: 0, lastTapAt: 0 };
    const phone = isMobileBrowser();
    navigate(isAdmin ? (phone ? '/mobile/studio' : '/studio') : (phone ? '/mobile/login' : '/login'));
  };
  const navLinks = [
    { labelKey: 'nav.catalog', to: '/catalog' },
    { labelKey: 'nav.journal', to: '/journal' },
    { labelKey: 'nav.bespokeShort', to: '/bespoke' },
  ];
  const isCurrent = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <div ref={menuRef} className={`ng-header-wrap${headerHidden ? ' is-hidden' : ''}${headerScrolled ? ' is-scrolled' : ''}`}>
      {/* The first tab stop on every shop page: past the header to the page's own heading (seventh visitor
          audit, 13 Nov 2026: 19 presses to reach "Tambah ke keranjang", 10 to the first checkout field; only
          the catalogue had a skip link). Invisible until focused. */}
      <a href="#main-heading" className="skip-to-results" onClick={skipToHeading}>{t('nav.skipToContent')}</a>
      <PriceChangeNotice />
      <SwitchToEnglishHint />
      <header className="ng-header">
        {/* A box of its own so it can take half the slack the nav leaves without the link growing into it. */}
        <div className="ng-header__brand">
          <Link to="/home" className="ng-header__wordmark" aria-label={t('nav.wordmarkAria')} onClick={openOwnerAccess}>
            SOLIVAGANT
          </Link>
        </div>

        <nav className="ng-header__nav ng-mono" aria-label={t('nav.storefrontAria')}>
          {navLinks.map((link) => (
            <Link key={link.to} to={link.to} aria-current={isCurrent(link.to) ? 'page' : undefined}>{t(link.labelKey)}</Link>
          ))}
        </nav>

        <div className="ng-header__actions ng-mono">
          <RegionSwitch />
          {/* The owner's way back to Studio — for the owner only; isAdmin is the gate ProtectedRoute uses
              on the destination. A buyer who signed in for the member price never sees it. */}
          {isAdmin ? (
            <Link to={isMobileBrowser() ? '/mobile/studio' : '/studio'} className="ng-header__account">Studio</Link>
          ) : null}
          {/* The one door to the account, on every storefront page. The only entry used to be "Lacak
              Pesanan" in the menu — framed as tracking, so nobody signed in for the price. */}
          <Link
            to="/customer"
            className="ng-header__account"
            aria-label={t(currentUser ? 'nav.account' : 'nav.accountSub')}
            title={t(currentUser ? 'nav.account' : 'nav.accountSub')}
          >
            {t(currentUser ? 'nav.accountShort' : 'nav.signIn')}
          </Link>
          {/* Both shops have a cart since 2026-10-06. In the English shop it opens the international
              cart — dollars, a destination, the shipping — and hands the order to WhatsApp; the icon
              was hidden there from 18 Sep to 6 Oct, when the English shop sold only by enquiry. */}
          <Link to="/cart" className="ng-header__cart" aria-label={t('nav.cartAria', { count: summary.boughtQuantity })}>
            {/* Below 480px the bag and the count stand in for the label, which does not fit there. */}
            <ShoppingBag className="ng-header__cart-icon h-4 w-4" aria-hidden="true" />
            <span className="ng-header__cart-label">{t('nav.cartLabel', { count: summary.boughtQuantity })}</span>
            <span className="ng-header__cart-count">{summary.boughtQuantity}</span>
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            className="ng-header__menu-button"
            onClick={toggleMega}
            aria-expanded={megaOpen}
            aria-controls="site-menu"
            aria-label={t(megaOpen ? 'nav.closeMenu' : 'nav.openMenu')}
          >
            {megaOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {megaOpen && (
        // A panel of links, not an application menu: the ARIA menu role promised arrow-key behaviour it never
        // had, and told a screen reader the links were not links.
        <nav id="site-menu" className="ng-menu" aria-label={t('nav.siteMenu')}>
          <div className="ng-menu__inner">
            {megaMenuColumns.map((col) => (
              <div key={col.titleKey} className="ng-menu__column">
                <span className="ng-menu__heading ng-mono">{t(col.titleKey)}</span>
                {col.links.map((link) => (
                  <Link key={`${col.titleKey}-${link.to}`} to={link.to} aria-current={isCurrent(link.to) ? 'page' : undefined} onClick={() => setMegaOpen(false)}>
                    {link.labelKey ? t(link.labelKey) : link.label}
                  </Link>
                ))}
              </div>
            ))}
            <div className="ng-menu__column ng-mono">
              <span className="ng-menu__heading">{t('region.label')}</span>
              <RegionSwitch />
            </div>
          </div>
        </nav>
      )}

      <BackToTop />
    </div>
  );
};

export default PublicHeader;
