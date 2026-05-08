import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Beaker, Home, MessageCircle, Search, ShoppingBag, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { cn } from '@/lib/utils.js';

const commerceNavItems = [
  { path: '/mobile/dashboard', label: 'Home', icon: Home },
  { path: '/mobile/catalog', label: 'Shop', icon: Search, aliases: ['/mobile/products'] },
  { path: '/mobile/bespoke', label: 'Bespoke', icon: MessageCircle },
  { path: '/mobile/cart', label: 'Cart', icon: ShoppingBag },
  { path: '/mobile/customer', label: 'Cek Order', icon: UserRound },
];

const MobileCommerceLayout = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="mobile-app">
      <div className="mobile-app-shell">
        {children}
      </div>
      {isAuthenticated ? (
        <Link
          to="/mobile/studio"
          className="fixed bottom-[76px] right-4 z-40 inline-flex h-10 items-center gap-2 rounded-2xl border border-[#263d27]/16 bg-white/95 px-3 text-xs font-bold text-[#263d27] shadow-sm backdrop-blur"
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
