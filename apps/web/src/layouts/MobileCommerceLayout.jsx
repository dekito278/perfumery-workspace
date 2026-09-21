import RegionSwitch from '@/components/storefront/RegionSwitch.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import React, { useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Beaker, BookOpenText, Home, MessageCircle, Search, ShoppingBag, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCart } from '@/hooks/useCart.js';
import { useMobileCommercePrefetch } from '@/hooks/useMobileCommercePrefetch.js';
import { useMobileKeyboardAvoidance } from '@/hooks/useMobileKeyboardAvoidance.js';
import { useMobileKeyboardState } from '@/hooks/useMobileKeyboardState.js';
import { useMobileFormEnhancements } from '@/hooks/useMobileFormEnhancements.js';
import { useMobileTouchFeedback } from '@/hooks/useMobileTouchFeedback.js';
import { cn } from '@/lib/utils.js';

// The English shop takes its orders on WhatsApp, so it has no cart tab — /mobile/cart redirects there
// anyway, and a tab that bounces you back is worse than no tab.
// Tailwind scans source text, so the class names have to appear literally somewhere — a computed
// `grid-cols-${n}` compiles to nothing.
const navGridColumns = { 5: 'grid-cols-5', 6: 'grid-cols-6' };

const commerceNavItemsFor = (isInternational) => [
  { path: '/mobile/dashboard', labelKey: 'nav.home', icon: Home },
  { path: '/mobile/catalog', labelKey: 'nav.shop', icon: Search, aliases: ['/mobile/products'] },
  { path: '/mobile/articles', labelKey: 'nav.articles', icon: BookOpenText },
  { path: '/mobile/bespoke', labelKey: 'nav.bespokeShort', icon: MessageCircle },
  ...(isInternational ? [] : [{ path: '/mobile/cart', labelKey: 'nav.cart', icon: ShoppingBag }]),
  // Was "Cek Order": tracking is what an account DOES, not why anyone opens one. The reason is the price.
  { path: '/mobile/customer', labelKey: 'nav.accountShort', icon: UserRound },
];

const preserveScrollOnCommerceTabTap = (path) => (
  path === '/mobile/dashboard' || path === '/mobile/catalog'
    || path === '/mobile/articles'
    ? { restoreScroll: true }
    : undefined
);

const MobileCommerceLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, isInternational } = useTranslate();
  const { isAdmin } = useAuth();
  const { summary } = useCart();
  const commerceNavItems = commerceNavItemsFor(isInternational);
  const keyboardActive = useMobileKeyboardState();
  useMobileKeyboardAvoidance();
  useMobileFormEnhancements();
  useMobileTouchFeedback();
  const ownerTapRef = useRef({ count: 0, lastTapAt: 0 });
  const shouldPrefetchCommerceData = [
    '/mobile/dashboard',
    '/mobile/catalog',
    '/mobile/products',
    '/mobile/cart',
  ].some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  useMobileCommercePrefetch({ prefetchCommerceData: shouldPrefetchCommerceData });

  const openOwnerAccess = () => {
    const now = Date.now();
    const nextCount = now - ownerTapRef.current.lastTapAt > 1800
      ? 1
      : ownerTapRef.current.count + 1;

    ownerTapRef.current = { count: nextCount, lastTapAt: now };

    if (nextCount >= 3) {
      ownerTapRef.current = { count: 0, lastTapAt: 0 };
      // isAdmin, not isAuthenticated: a signed-in BUYER sent to /mobile/studio is bounced straight back
      // out by ProtectedRoute, which looks like the shop breaking. The sign-in screen is the honest door
      // for anyone who is not the owner.
      navigate(isAdmin ? '/mobile/studio' : '/mobile/login');
    }
  };

  return (
    <div className={cn('mobile-app mobile-commerce-app', keyboardActive && 'mobile-keyboard-active')}>
      <div className="mobile-app-shell" data-mobile-primary-scroller="true">
        <header className="mobile-commerce-header">
          <button type="button" onClick={openOwnerAccess} className="mobile-commerce-brand m-editorial-brand" aria-label="Solivagant owner access">
            <span className="m-editorial-wordmark">SOLIVAGANT</span>
          </button>
          <RegionSwitch />
        </header>
        {children}
      </div>
      {/* The owner's way back to Studio — for the OWNER. Gated on isAuthenticated, it appeared for every
          signed-in buyer, and signing in is exactly what the member price asks them to do: a customer
          checking out saw an admin button floating over the total, and tapping it bounced them to their
          own account page. isAdmin is the same gate ProtectedRoute uses on the destination. */}
      {isAdmin ? (
        <Link
          to="/mobile/studio"
          className="mobile-studio-floating-link inline-flex h-10 items-center gap-2 rounded-2xl border border-editorial-stone/16 bg-white/95 px-3 text-xs font-bold text-editorial-charcoal shadow-sm backdrop-blur"
          aria-label="Kembali ke dashboard Studio"
        >
          <Beaker className="h-4 w-4" />
          Studio
        </Link>
      ) : null}
      {/* Columns counted from the list, not typed as a literal: dropping the cart tab from a grid still
          set to six left a sixth of the bar empty on the phone, and the next person to add a tab would
          have had to remember two places. */}
      <nav
        className={cn('mobile-bottom-nav mobile-commerce-bottom-nav grid gap-1 p-1.5', navGridColumns[commerceNavItems.length] || 'grid-cols-6')}
        aria-label={t('nav.mobileShopAria')}
      >
        {commerceNavItems.map((item) => {
          const Icon = item.icon;
          const activePaths = [item.path, ...(item.aliases || [])];
          const active = activePaths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));

          return (
            <Link
              key={item.path}
              to={item.path}
              state={preserveScrollOnCommerceTabTap(item.path)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-[14px] text-[9.5px] font-bold transition',
                active ? 'bg-editorial-ivory text-editorial-charcoal' : 'text-[#8b949e]'
              )}
            >
              <Icon className="h-[19px] w-[19px]" />
              {item.path === '/mobile/cart' && summary.quantity > 0 ? (
                <span className="absolute right-2 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[9px] font-black leading-none text-white">
                  {summary.quantity > 99 ? '99+' : summary.quantity}
                </span>
              ) : null}
              <span className="max-w-full truncate px-0.5">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default MobileCommerceLayout;
