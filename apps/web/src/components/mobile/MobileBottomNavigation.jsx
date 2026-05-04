import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Beaker, Calculator, ClipboardCheck, ClipboardList, Home, LibraryBig } from 'lucide-react';
import { cn } from '@/lib/utils.js';

const navItems = [
  { path: '/mobile/dashboard', label: 'Home', icon: Home },
  { path: '/mobile/briefs', label: 'Briefs', icon: ClipboardList },
  { path: '/mobile/formulas', label: 'Formulas', icon: Beaker },
  { path: '/mobile/batches', label: 'Batch', icon: Calculator },
  { path: '/mobile/raw-materials', label: 'Materials', icon: LibraryBig },
  { path: '/mobile/validation', label: 'Valid', icon: ClipboardCheck },
];

const MobileBottomNavigation = () => {
  const location = useLocation();

  return (
    <nav className="mobile-bottom-nav grid grid-cols-6 gap-1 p-2" aria-label="Mobile app navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-[58px] flex-col items-center justify-center gap-1 rounded-2xl text-[9px] font-bold transition',
              active ? 'bg-amber-50 text-amber-700' : 'text-[#8b949e]'
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileBottomNavigation;
