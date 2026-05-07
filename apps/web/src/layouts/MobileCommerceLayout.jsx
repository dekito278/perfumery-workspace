import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, MessageCircle, Search, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils.js';

const commerceNavItems = [
  { path: '/mobile/dashboard', label: 'Home', icon: Home },
  { path: '/mobile/catalog', label: 'Shop', icon: Search, aliases: ['/mobile/products'] },
  { path: '/mobile/bespoke', label: 'Bespoke', icon: MessageCircle },
  { path: '/mobile/cart', label: 'Cart', icon: ShoppingBag },
];

const MobileCommerceLayout = ({ children }) => {
  const location = useLocation();

  return (
    <div className="mobile-app">
      <div className="mobile-app-shell">
        {children}
      </div>
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
                active ? 'bg-amber-50 text-amber-700' : 'text-[#8b949e]'
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
