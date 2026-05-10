import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Beaker,
  ClipboardCheck,
  ClipboardList,
  Calculator,
  LayoutDashboard,
  LibraryBig,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  ShoppingBag,
  Store,
  UsersRound,
  WandSparkles,
} from 'lucide-react';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import { cn } from '@/lib/utils.js';

const navGroups = [
  {
    id: 'commerce',
    label: 'E-commerce',
    icon: ShoppingBag,
    description: 'Produk, order, customer, bespoke, dan tampilan home.',
    paths: ['/mobile/studio/products', '/mobile/studio/orders', '/mobile/studio/fulfillment', '/mobile/studio/customers', '/mobile/studio/bespoke', '/mobile/dashboard', '/mobile/catalog', '/mobile/cart', '/mobile/bespoke', '/mobile/products'],
    items: [
      { path: '/mobile/studio/products', label: 'Products', helper: 'Manage catalog products', icon: PackagePlus },
      { path: '/mobile/studio/orders', label: 'Orders', helper: 'Order queue from checkout', icon: PackageCheck },
      { path: '/mobile/studio/fulfillment', label: 'Fulfillment', helper: 'Packing and shipping', icon: PackageOpen },
      { path: '/mobile/studio/customers', label: 'Customers', helper: 'Customer code lookup', icon: UsersRound },
      { path: '/mobile/studio/bespoke', label: 'Bespoke', helper: 'Bottle, cap, label', icon: WandSparkles },
      { path: '/mobile/dashboard', label: 'Storefront', helper: 'Customer home preview', icon: Store },
    ],
  },
  {
    id: 'studio',
    label: 'Studio',
    icon: Beaker,
    description: 'Brief, formula, material, dan validation workspace.',
    paths: ['/mobile/studio', '/mobile/briefs', '/mobile/formulas', '/mobile/batches', '/mobile/raw-materials', '/mobile/validation'],
    items: [
      { path: '/mobile/studio', label: 'Dashboard', helper: 'Studio overview', icon: LayoutDashboard },
      { path: '/mobile/briefs', label: 'Briefs', helper: 'Client/project direction', icon: ClipboardList },
      { path: '/mobile/formulas', label: 'Formulas', helper: 'Composer and formula list', icon: Beaker },
      { path: '/mobile/batches', label: 'Batches', helper: 'Production and stock draft', icon: Calculator },
      { path: '/mobile/raw-materials', label: 'Materials', helper: 'Raw material library', icon: LibraryBig },
      { path: '/mobile/validation', label: 'Validation', helper: 'Testing and feedback logs', icon: ClipboardCheck },
    ],
  },
];

const MobileBottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [openGroupId, setOpenGroupId] = useState(null);
  const openGroup = navGroups.find((group) => group.id === openGroupId);

  const isPathActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const isGroupActive = (group) => group.paths.some(isPathActive);

  const navigateTo = (path) => {
    setOpenGroupId(null);
    navigate(path);
  };

  return (
    <>
      <nav className="mobile-bottom-nav grid grid-cols-2 gap-2 p-1.5" aria-label="Mobile app navigation">
        {navGroups.map((group) => {
          const Icon = group.icon;
          const active = isGroupActive(group);
          return (
            <button
              key={group.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              aria-expanded={openGroupId === group.id}
              aria-haspopup="dialog"
              onClick={() => setOpenGroupId(group.id)}
              className={cn(
                'flex h-[58px] items-center justify-center gap-2 rounded-2xl text-xs font-bold transition',
                active ? 'bg-amber-50 text-amber-700' : 'text-[#8b949e]'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{group.label}</span>
            </button>
          );
        })}
      </nav>

      <MobileBottomSheet
        open={Boolean(openGroup)}
        onOpenChange={(open) => !open && setOpenGroupId(null)}
        title={openGroup?.label || 'Navigation'}
        description={openGroup?.description}
      >
        {openGroup ? (
          <div className="grid grid-cols-2 gap-3 pb-2">
            {openGroup.items.map((item) => {
              const Icon = item.icon;
              const active = isPathActive(item.path);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigateTo(item.path)}
                  className={cn(
                    'min-h-[92px] rounded-2xl border p-3 text-left transition',
                    active ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-[#e5e7eb] bg-white text-[#1f2937]'
                  )}
                >
                  <span className={cn(
                    'grid h-9 w-9 place-items-center rounded-2xl',
                    active ? 'bg-white text-amber-700' : 'bg-[#f8f7f4] text-[#6b7280]'
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="mt-2 block text-sm font-bold">{item.label}</span>
                  <span className="mt-1 block text-[11px] font-semibold leading-snug text-[#6b7280]">{item.helper}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </MobileBottomSheet>
    </>
  );
};

export default MobileBottomNavigation;
