import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Beaker,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LibraryBig,
  PackageCheck,
  PackagePlus,
  ShoppingBag,
  Store,
  UsersRound,
  WandSparkles,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.jsx';
import { cn } from '@/lib/utils.js';

const navGroups = [
  {
    id: 'commerce',
    label: 'E-commerce',
    icon: ShoppingBag,
    description: 'Produk, order, checkout, dan layanan bespoke.',
    paths: ['/mobile/studio/products', '/mobile/studio/orders', '/mobile/studio/customers', '/mobile/dashboard', '/mobile/catalog', '/mobile/cart', '/mobile/bespoke', '/mobile/products'],
    items: [
      { path: '/mobile/studio/products', label: 'Products', helper: 'Manage catalog products', icon: PackagePlus },
      { path: '/mobile/studio/orders', label: 'Orders', helper: 'Order queue from checkout', icon: PackageCheck },
      { path: '/mobile/studio/customers', label: 'Customers', helper: 'Customer code lookup', icon: UsersRound },
      { path: '/mobile/dashboard', label: 'Preview home', helper: 'Public storefront view', icon: Store },
      { path: '/mobile/catalog', label: 'Preview shop', helper: 'Regular and limited products', icon: ShoppingBag },
      { path: '/mobile/cart', label: 'Preview cart', helper: 'Customer checkout flow', icon: CreditCard },
      { path: '/mobile/bespoke', label: 'Preview bespoke', helper: 'Custom perfume request', icon: WandSparkles },
    ],
  },
  {
    id: 'studio',
    label: 'Studio',
    icon: Beaker,
    description: 'Brief, formula, material, dan validation workspace.',
    paths: ['/mobile/studio', '/mobile/briefs', '/mobile/formulas', '/mobile/raw-materials', '/mobile/validation'],
    items: [
      { path: '/mobile/studio', label: 'Dashboard', helper: 'Studio overview', icon: LayoutDashboard },
      { path: '/mobile/briefs', label: 'Briefs', helper: 'Client/project direction', icon: ClipboardList },
      { path: '/mobile/formulas', label: 'Formulas', helper: 'Composer and formula list', icon: Beaker },
      { path: '/mobile/raw-materials', label: 'Materials', helper: 'Raw material library', icon: LibraryBig },
      { path: '/mobile/validation', label: 'Validate', helper: 'Testing and feedback logs', icon: ClipboardCheck },
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

      <Sheet open={Boolean(openGroup)} onOpenChange={(open) => !open && setOpenGroupId(null)}>
        <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto rounded-t-[28px] border-0 bg-[#fbfaf7] p-4">
          {openGroup ? (
            <>
              <SheetHeader className="pr-8 text-left">
                <SheetTitle>{openGroup.label}</SheetTitle>
                <SheetDescription>{openGroup.description}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-2 gap-3">
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
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default MobileBottomNavigation;
