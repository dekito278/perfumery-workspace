import React, { useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Beaker, ClipboardCheck, Home, MessageCircle, Search, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCart } from '@/hooks/useCart.js';
import { useMobileCommercePrefetch } from '@/hooks/useMobileCommercePrefetch.js';
import { useMobileKeyboardAvoidance } from '@/hooks/useMobileKeyboardAvoidance.js';
import { useMobileKeyboardState } from '@/hooks/useMobileKeyboardState.js';
import { useMobileFormEnhancements } from '@/hooks/useMobileFormEnhancements.js';
import { useMobileTouchFeedback } from '@/hooks/useMobileTouchFeedback.js';
import { cn } from '@/lib/utils.js';

const commerceNavItems = [
  { path: '/mobile/dashboard', label: 'Beranda', icon: Home, keepAlive: true },
  { path: '/mobile/catalog', label: 'Belanja', icon: Search, aliases: ['/mobile/products'], keepAlive: true },
  { path: '/mobile/bespoke', label: 'Custom', icon: MessageCircle },
  { path: '/mobile/cart', label: 'Keranjang', icon: ShoppingBag },
  { path: '/mobile/customer', label: 'Cek Order', icon: ClipboardCheck },
];

const MobileCommerceLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { summary } = useCart();
  const keyboardActive = useMobileKeyboardState();
  useMobileKeyboardAvoidance();
  useMobileFormEnhancements();
  useMobileTouchFeedback();
  const ownerTapRef = useRef({ count: 0, lastTapAt: 0 });
  useMobileCommercePrefetch();

  const openOwnerAccess = () => {
    const now = Date.now();
    const nextCount = now - ownerTapRef.current.lastTapAt > 1800
      ? 1
      : ownerTapRef.current.count + 1;

    ownerTapRef.current = { count: nextCount, lastTapAt: now };

    if (nextCount >= 3) {
      ownerTapRef.current = { count: 0, lastTapAt: 0 };
      navigate(isAuthenticated ? '/mobile/studio' : '/mobile/login');
    }
  };

  return (
    <div className={cn('mobile-app mobile-commerce-app', keyboardActive && 'mobile-keyboard-active')}>
      <div className="mobile-app-shell" data-mobile-primary-scroller="true">
        <header className="mobile-commerce-header">
          <button type="button" onClick={openOwnerAccess} className="mobile-commerce-brand" aria-label="Solivagant owner access">
            <img src="/brand/solivagant-logo.png" alt="Solivagant" className="mobile-commerce-brand-logo" loading="eager" decoding="async" width="238" height="68" />
          </button>
        </header>
        {children}
      </div>
      {isAuthenticated ? (
        <Link
          to="/mobile/studio"
          className="mobile-studio-floating-link inline-flex h-10 items-center gap-2 rounded-2xl border border-[#263d27]/16 bg-white/95 px-3 text-xs font-bold text-[#263d27] shadow-sm backdrop-blur"
          aria-label="Kembali ke dashboard Studio"
        >
          <Beaker className="h-4 w-4" />
          Studio
        </Link>
      ) : null}
      <nav className="mobile-bottom-nav grid grid-cols-5 gap-1 p-1.5" aria-label="Navigasi belanja mobile">
        {commerceNavItems.map((item) => {
          const Icon = item.icon;
          const activePaths = [item.path, ...(item.aliases || [])];
          const active = activePaths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));

          return (
            <Link
              key={item.path}
              to={item.path}
              state={item.keepAlive ? { restoreScroll: true } : undefined}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-[14px] text-[9.5px] font-bold transition',
                active ? 'bg-[#eef2e8] text-[#263d27]' : 'text-[#8b949e]'
              )}
            >
              <Icon className="h-[19px] w-[19px]" />
              {item.path === '/mobile/cart' && summary.quantity > 0 ? (
                <span className="absolute right-2 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[9px] font-black leading-none text-white">
                  {summary.quantity > 99 ? '99+' : summary.quantity}
                </span>
              ) : null}
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default MobileCommerceLayout;
