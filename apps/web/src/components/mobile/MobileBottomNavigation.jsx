import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Beaker,
  BadgeCheck,
  BadgePercent,
  BookOpenText,
  ClipboardCheck,
  Calculator,
  Globe2,
  LayoutDashboard,
  LibraryBig,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  ShoppingBag,
  Store,
  Truck,
  UsersRound,
  ImagePlus,
  WandSparkles,
  ListChecks,
} from 'lucide-react';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import { cn } from '@/lib/utils.js';
import { MOBILE_NAV_GROUP_PATHS, activeNavGroup, mostSpecificPath } from '@/utils/mobileNavActive.js';

const navGroups = [
  {
    id: 'commerce',
    label: 'E-commerce',
    icon: ShoppingBag,
    description: 'Produk, order, customer, bespoke, dan tampilan home.',
    paths: MOBILE_NAV_GROUP_PATHS.commerce,
    items: [
      { path: '/mobile/studio/products', label: 'Produk', helper: 'Kelola produk katalog', icon: PackagePlus },
      { path: '/mobile/studio/orders', label: 'Orders', helper: 'Antrean order dari checkout', icon: PackageCheck },
      { path: '/mobile/studio/fulfillment', label: 'Fulfillment', helper: 'Packing dan pengiriman', icon: PackageOpen },
      { path: '/mobile/studio/customers', label: 'Customer', helper: 'Cari kode customer', icon: UsersRound },
      { path: '/mobile/studio/bespoke', label: 'Bespoke', helper: 'Botol, cap, label', icon: WandSparkles },
      { path: '/mobile/studio/vouchers', label: 'Vouchers', helper: 'Kode promo', icon: BadgePercent },
      { path: '/mobile/studio/member-codes', label: 'Kode member', helper: 'Satu kode per komunitas', icon: BadgeCheck },
      { path: '/mobile/studio/shipping', label: 'Ongkir', helper: 'Gratis ongkir dan area', icon: Truck },
      { path: '/mobile/studio/export-shipping', label: 'Ekspor', helper: 'Order dan ongkir luar negeri', icon: Globe2 },
      { path: '/mobile/journal', label: 'Journal', helper: 'Tulis dan publish artikel', icon: BookOpenText },
      { path: '/home', label: 'Toko', helper: 'Preview home customer', icon: Store },
    ],
  },
  {
    id: 'studio',
    label: 'Studio',
    icon: Beaker,
    description: 'Formula, bahan baku, dan validasi.',
    paths: MOBILE_NAV_GROUP_PATHS.studio,
    items: [
      { path: '/mobile/studio', label: 'Dasbor', helper: 'Ringkasan Studio', icon: LayoutDashboard },
      { path: '/mobile/journal', label: 'Journal', helper: 'Artikel, akord, ide', icon: BookOpenText },
      { path: '/mobile/formulas', label: 'Formula', helper: 'Komposer dan daftar formula', icon: Beaker },
      { path: '/mobile/batches', label: 'Batch', helper: 'Produksi dan stok draf', icon: Calculator },
      { path: '/mobile/raw-materials', label: 'Bahan baku', helper: 'Pustaka bahan baku', icon: LibraryBig },
      { path: '/mobile/validation', label: 'Validasi', helper: 'Catatan uji dan masukan', icon: ClipboardCheck },
      { path: '/mobile/studio/site-images', label: 'Gambar situs', helper: 'Hero, mood, dan banner', icon: ImagePlus },
      { path: '/mobile/studio/site-facts', label: 'Fakta Toko', helper: 'Bespoke, kota, footer, kategori', icon: ListChecks },
    ],
  },
];

const MobileBottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [openGroupId, setOpenGroupId] = useState(null);
  const openGroup = navGroups.find((group) => group.id === openGroupId);

  // Most specific wins — see utils/mobileNavActive.js for why "starts with" lit both tabs.
  const activeGroupId = activeNavGroup(location.pathname);
  const isGroupActive = (group) => group.id === activeGroupId;
  const isItemActive = (item, items) => item.path === mostSpecificPath(location.pathname, items.map((entry) => entry.path));

  const navigateTo = (path) => {
    setOpenGroupId(null);
    navigate(path);
  };

  return (
    <>
      <nav className="mobile-bottom-nav grid grid-cols-2 gap-2 p-1.5" aria-label="Navigasi Studio">
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
        title={openGroup?.label || 'Navigasi'}
        description={openGroup?.description}
      >
        {openGroup ? (
          <div className="grid grid-cols-2 gap-3 pb-2">
            {openGroup.items.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item, openGroup.items);
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
