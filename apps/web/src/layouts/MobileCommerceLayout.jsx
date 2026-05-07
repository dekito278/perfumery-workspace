import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Beaker, Home, MessageCircle, Search, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { cn } from '@/lib/utils.js';

const commerceNavItems = [
  { path: '/mobile/dashboard', label: 'Home', icon: Home },
  { path: '/mobile/catalog', label: 'Shop', icon: Search, aliases: ['/mobile/products'] },
  { path: '/mobile/bespoke', label: 'Bespoke', icon: MessageCircle },
  { path: '/mobile/cart', label: 'Cart', icon: ShoppingBag },
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
          className="fixed bottom-[86px] right-4 z-40 inline-flex h-11 items-center gap-2 rounded-2xl border border-[#263d27]/20 bg-white px-4 text-xs font-bold text-[#263d27] shadow-lg"
          aria-label="Back to Studio dashboard"
        >
          <Beaker className="h-4 w-4" />
          Studio
        </Link>
      ) : null}
      <nav className="mobile-bottom-nav grid grid-cols-4 gap-1 p-1.5" aria-label="Mobile shop navigation">
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
                'flex h-[56px] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold transition',
                active ? 'bg-[#eef2e8] text-[#263d27]' : 'text-[#8b949e]'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default MobileCommerceLayout;
