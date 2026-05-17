import React, { useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Beaker, ClipboardCheck, Home, MessageCircle, Search, ShoppingBag, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useMobileCommercePrefetch } from '@/hooks/useMobileCommercePrefetch.js';
import { useMobileKeyboardAvoidance } from '@/hooks/useMobileKeyboardAvoidance.js';
import { useMobileKeyboardState } from '@/hooks/useMobileKeyboardState.js';
import { useMobileFormEnhancements } from '@/hooks/useMobileFormEnhancements.js';
import { useMobileTouchFeedback } from '@/hooks/useMobileTouchFeedback.js';
import { cn } from '@/lib/utils.js';

const commerceNavItems = [
  { path: '/mobile/dashboard', label: 'Home', icon: Home, keepAlive: true },
  { path: '/mobile/catalog', label: 'Shop', icon: Search, aliases: ['/mobile/products'], keepAlive: true },
  { path: '/mobile/bespoke', label: 'Bespoke', icon: MessageCircle },
  { path: '/mobile/cart', label: 'Cart', icon: ShoppingBag },
  { path: '/mobile/customer', label: 'Cek Order', icon: UserRound },
];

const MobileCommerceLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
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
    <div className={cn('mobile-app', keyboardActive && 'mobile-keyboard-active')}>
      <div className="mobile-app-shell" data-mobile-primary-scroller="true">
        <header className="mobile-commerce-header">
          <button type="button" onClick={openOwnerAccess} className="mobile-commerce-brand" aria-label="Solivagant owner access">
            <img src="/brand/solivagant-logo.png" alt="Solivagant" className="mobile-commerce-brand-logo" loading="eager" decoding="async" width="238" height="68" />
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => navigate('/mobile/customer')} aria-label="Check order" className="mobile-interactive mobile-pressable grid h-10 w-10 place-items-center rounded-2xl border border-[#e5e7eb] bg-white">
              <ClipboardCheck className="h-5 w-5 text-[#263d27]" />
            </button>
            <button type="button" onClick={() => navigate('/mobile/cart')} aria-label="Open cart" className="mobile-interactive mobile-pressable grid h-10 w-10 place-items-center rounded-2xl border border-[#e5e7eb] bg-white">
              <ShoppingBag className="h-5 w-5 text-[#263d27]" />
            </button>
          </div>
        </header>
        {children}
      </div>
      {isAuthenticated ? (
        <Link
          to="/mobile/studio"
          className="mobile-studio-floating-link inline-flex h-10 items-center gap-2 rounded-2xl border border-[#263d27]/16 bg-white/95 px-3 text-xs font-bold text-[#263d27] shadow-sm backdrop-blur"
          aria-label="Back to Studio dashboard"
        >
          <Beaker className="h-4 w-4" />
          Studio
        </Link>
      ) : null}
      <nav className="mobile-bottom-nav grid grid-cols-5 gap-1 p-1.5" aria-label="Mobile shop navigation">
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
                'flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-[14px] text-[9.5px] font-bold transition',
                active ? 'bg-[#eef2e8] text-[#263d27]' : 'text-[#8b949e]'
              )}
            >
              <Icon className="h-[19px] w-[19px]" />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default MobileCommerceLayout;
