import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Beaker, ClipboardCheck, LayoutDashboard, LibraryBig, PackageCheck, PackagePlus } from 'lucide-react';
import { cn } from '@/lib/utils.js';

const navItems = [
  { path: '/mobile/studio', label: 'Dashboard', icon: LayoutDashboard, aliases: ['/mobile/batches', '/mobile/production-costing'] },
  { path: '/mobile/studio/products', label: 'Products', icon: PackagePlus },
  { path: '/mobile/studio/orders', label: 'Orders', icon: PackageCheck },
  { path: '/mobile/formulas', label: 'Formulas', icon: Beaker },
  { path: '/mobile/raw-materials', label: 'Materials', icon: LibraryBig },
  { path: '/mobile/validation', label: 'Validate', icon: ClipboardCheck },
];

const MobileBottomNavigation = () => {
  const location = useLocation();

  return (
    <nav className="mobile-bottom-nav grid grid-cols-6 gap-1 p-1.5" aria-label="Mobile app navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const activePaths = [item.path, ...(item.aliases || [])];
        const active = activePaths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-[56px] flex-col items-center justify-center gap-1 rounded-2xl text-[9px] font-bold transition',
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
