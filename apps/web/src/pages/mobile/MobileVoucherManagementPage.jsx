import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { BadgePercent, CalendarDays, Copy, Edit3, Plus, Save, Search, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileAccordion from '@/components/mobile-ui/MobileAccordion.jsx';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
import VoucherRealtimePreview from '@/components/vouchers/VoucherRealtimePreview.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { MOBILE_PAGE_SIZE } from '@/pages/mobile/mobilePageUtils.js';
import { getOrders } from '@/services/orderService.js';
import {
  deleteVoucher,
  getVoucherUsageRecords,
  getVouchers,
  migrateLocalVouchersToSupabase,
  normalizeVoucherCode,
  saveVoucher,
  VOUCHER_DISCOUNT_TYPES,
  VOUCHER_UPDATED_EVENT,
} from '@/services/voucherService.js';
import { buildVoucherPreview } from '@/utils/voucherPreview.js';
import { buildVoucherAnalytics, buildVoucherUsageReport } from '@/utils/voucherUsageReport.js';

const emptyDraft = {
  id: '',
  code: '',
  discountType: VOUCHER_DISCOUNT_TYPES.PERCENT,
  discountValue: '',
  minimumOrder: '',
  minimumQuantity: '',
  expiresAt: '',
  active: true,
  usageLimitTotal: '',
  eligibleProductSlugs: '',
  eligibleCategories: '',
};

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
  : 'Tanpa expiry');
const formatDateTime = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-');

const getVoucherStatus = (voucher) => {
  if (!voucher.active) return { key: 'inactive', label: 'Nonaktif', className: 'bg-stone-100 text-stone-700' };
  const expiryValue = String(voucher.expiresAt || '').trim();
  const expiryTime = expiryValue
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(expiryValue) ? `${expiryValue}T23:59:59.999` : expiryValue).getTime()
    : null;
  if (expiryTime && expiryTime < Date.now()) {
    return { key: 'expired', label: 'Expired', className: 'bg-rose-50 text-rose-700' };
  }
  if (voucher.usageLimitTotal > 0 && voucher.usageCount >= voucher.usageLimitTotal) {
    return { key: 'limit_reached', label: 'Limit habis', className: 'bg-amber-50 text-amber-800' };
  }
  return { key: 'active', label: 'Aktif', className: 'bg-emerald-50 text-emerald-700' };
};

const voucherStatusFilters = [
  { key: 'all', label: 'Semua' },
  { key: 'active', label: 'Aktif' },
  { key: 'expired', label: 'Expired' },
  { key: 'limit_reached', label: 'Limit habis' },
  { key: 'inactive', label: 'Nonaktif' },
];

const toDraft = (voucher) => ({
  id: voucher?.id || '',
  code: voucher?.code || '',
  discountType: voucher?.discountType || VOUCHER_DISCOUNT_TYPES.PERCENT,
  discountValue: voucher?.discountValue || '',
  minimumOrder: voucher?.minimumOrder || '',
  minimumQuantity: voucher?.minimumQuantity || '',
  expiresAt: voucher?.expiresAt || '',
  active: voucher?.active !== false,
  usageLimitTotal: voucher?.usageLimitTotal || '',
  eligibleProductSlugs: (voucher?.eligibleProductSlugs || []).join(', '),
  eligibleCategories: (voucher?.eligibleCategories || []).join(', '),
});

const getVoucherRestrictionLabel = (voucher) => {
  const products = voucher.eligibleProductSlugs || [];
  const categories = voucher.eligibleCategories || [];
  if (!products.length && !categories.length) return 'Semua produk';
  return [
    products.length ? `${products.length} produk` : '',
    categories.length ? `${categories.length} kategori` : '',
  ].filter(Boolean).join(' / ');
};

const StatChip = ({ label, value, tone = 'amber' }) => {
  const tones = {
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    blue: 'bg-blue-50 text-blue-800 border-blue-100',
  };

  return (
    <div className={`min-w-[104px] rounded-2xl border px-3 py-2 ${tones[tone] || tones.amber}`}>
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="mt-1 truncate text-[10px] font-bold uppercase">{label}</div>
    </div>
  );
};

const MobileVoucherManagementPage = () => {
  const [vouchers, setVouchers] = useState([]);
  const [usageRecords, setUsageRecords] = useState([]);
  const [orders, setOrders] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [usageSearchTerm, setUsageSearchTerm] = useState('');
  const [voucherVisibleCount, setVoucherVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const [usageVisibleCount, setUsageVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const [savingVoucher, setSavingVoucher] = useState(false);
  const products = useCatalogProducts({ editableOnly: true });

  const loadVouchers = async () => {
    try {
      await migrateLocalVouchersToSupabase();
      const [nextVouchers, nextUsageRecords, nextOrders] = await Promise.all([
        getVouchers(),
        getVoucherUsageRecords(),
        getOrders({ sweepExpiredReservations: false }),
      ]);
      setVouchers(nextVouchers);
      setUsageRecords(nextUsageRecords);
      setOrders(nextOrders);
    } catch (error) {
      toast.error(error.message || 'Gagal memuat voucher');
    }
  };

  useEffect(() => {
    loadVouchers();
    window.addEventListener(VOUCHER_UPDATED_EVENT, loadVouchers);
    return () => window.removeEventListener(VOUCHER_UPDATED_EVENT, loadVouchers);
  }, []);

  const stats = useMemo(() => ({
    total: vouchers.length,
    active: vouchers.filter((voucher) => getVoucherStatus(voucher).label === 'Aktif').length,
    limited: vouchers.filter((voucher) => Number(voucher.usageLimitTotal || 0) > 0).length,
  }), [vouchers]);

  const statusCounts = useMemo(() => (
    vouchers.reduce((counts, voucher) => {
      const status = getVoucherStatus(voucher);
      return {
        ...counts,
        [status.key]: (counts[status.key] || 0) + 1,
      };
    }, { all: vouchers.length, active: 0, expired: 0, limit_reached: 0, inactive: 0 })
  ), [vouchers]);

  const filteredVouchers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return vouchers.filter((voucher) => {
      const status = getVoucherStatus(voucher);
      const matchesStatus = statusFilter === 'all' || status.key === statusFilter;
      const matchesQuery = !query || [
        voucher.code,
        voucher.discountType,
        status.label,
        voucher.active ? 'aktif' : 'nonaktif',
      ].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [searchTerm, statusFilter, vouchers]);
  const visibleVouchers = useMemo(
    () => filteredVouchers.slice(0, voucherVisibleCount),
    [filteredVouchers, voucherVisibleCount]
  );

  const usageReport = useMemo(() => (
    buildVoucherUsageReport(usageRecords, orders)
  ), [orders, usageRecords]);

  const filteredUsageReport = useMemo(() => {
    const query = usageSearchTerm.trim().toLowerCase();
    if (!query) return usageReport;
    return usageReport.filter((entry) => [
      entry.voucherCode,
      entry.orderNumber,
      entry.customerName,
      entry.customerCode,
      entry.contact,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [usageReport, usageSearchTerm]);
  const visibleUsageReport = useMemo(
    () => filteredUsageReport.slice(0, usageVisibleCount),
    [filteredUsageReport, usageVisibleCount]
  );

  useEffect(() => {
    setVoucherVisibleCount(MOBILE_PAGE_SIZE);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    setUsageVisibleCount(MOBILE_PAGE_SIZE);
  }, [usageSearchTerm]);

  const usageStats = useMemo(() => ({
    count: usageReport.length,
    discountTotal: usageReport.reduce((sum, entry) => sum + Number(entry.discountAmount || 0), 0),
  }), [usageReport]);
  const voucherAnalytics = useMemo(() => buildVoucherAnalytics(usageReport), [usageReport]);
  const voucherPreview = useMemo(() => buildVoucherPreview(draft, products), [draft, products]);

  const updateDraft = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: field === 'code' ? normalizeVoucherCode(value) : value,
    }));
  };

  const resetDraft = () => setDraft(emptyDraft);

  const submitVoucher = async (event) => {
    event.preventDefault();
    if (savingVoucher) {
      return;
    }
    setSavingVoucher(true);
    try {
      const savedVoucher = await saveVoucher({
        ...draft,
        discountValue: Number(draft.discountValue || 0),
        minimumOrder: Number(draft.minimumOrder || 0),
        minimumQuantity: Number(draft.minimumQuantity || 0),
        usageLimitTotal: Number(draft.usageLimitTotal || 0),
        eligibleProductSlugs: draft.eligibleProductSlugs,
        eligibleCategories: draft.eligibleCategories,
      });
      setDraft(toDraft(savedVoucher));
      toast.success(`Voucher ${savedVoucher.code} tersimpan`);
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan voucher');
    } finally {
      setSavingVoucher(false);
    }
  };

  const editVoucher = (voucher) => {
    setDraft(toDraft(voucher));
    document.querySelector('[data-mobile-primary-scroller="true"]')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const copyVoucherCode = async (voucher) => {
    try {
      await navigator.clipboard.writeText(voucher.code);
      toast.success(`Kode ${voucher.code} disalin`);
    } catch (error) {
      toast.error('Gagal menyalin kode voucher');
    }
  };

  const toggleVoucher = async (voucher) => {
    if (savingVoucher) {
      return;
    }
    setSavingVoucher(true);
    try {
      const savedVoucher = await saveVoucher({ ...voucher, active: !voucher.active });
      toast.success(`${savedVoucher.code} ${savedVoucher.active ? 'diaktifkan' : 'dinonaktifkan'}`);
    } catch (error) {
      toast.error(error.message || 'Gagal mengubah status voucher');
    } finally {
      setSavingVoucher(false);
    }
  };

  const removeVoucher = async (voucher) => {
    if (savingVoucher) {
      return;
    }
    setSavingVoucher(true);
    try {
      await deleteVoucher(voucher.id || voucher.code);
      if (draft.id === voucher.id || draft.code === voucher.code) {
        resetDraft();
      }
      toast.success(`Voucher ${voucher.code} dihapus`);
    } catch (error) {
      toast.error(error.message || 'Gagal menghapus voucher');
    } finally {
      setSavingVoucher(false);
    }
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet>
        <title>Vouchers - Solivagant Studio</title>
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Vouchers"
          subtitle="Kode promo checkout"
          eyebrow="Storefront promo"
          action={<BadgePercent className="h-5 w-5 text-amber-600" />}
        />

        <section className="mobile-studio-hero p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase text-amber-700">Promo tools</div>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-[#142116]">Voucher manager</h1>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#68736a]">
                Buat kode diskon, minimum order, expiry, status, dan limit pemakaian.
              </p>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-amber-700 shadow-sm">
              <BadgePercent className="h-5 w-5" />
            </span>
          </div>
          <div className="mobile-horizontal-scroll mt-4 flex gap-2 overflow-x-auto pb-1">
            <StatChip label="Total" value={stats.total} />
            <StatChip label="Aktif" value={stats.active} tone="emerald" />
            <StatChip label="Pakai limit" value={stats.limited} tone="blue" />
            <StatChip label="Terpakai" value={usageStats.count} tone="emerald" />
          </div>
        </section>

        <form onSubmit={submitVoucher} className="mobile-card space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold">{draft.id ? 'Edit voucher' : 'Buat voucher'}</h2>
              <p className="mt-0.5 text-xs font-semibold text-[#6b7280]">Voucher tersimpan di Supabase dan langsung dipakai checkout.</p>
            </div>
            <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-2xl bg-white" onClick={resetDraft} aria-label="Buat voucher baru">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <MobileAccordion title="Aturan voucher" meta="Kode, diskon, minimum, expiry, limit, dan status." defaultOpen>
            <div className="grid gap-3">
              <label className="grid gap-1 text-[10px] font-bold uppercase text-[#6b7280]">
                Kode voucher
                <input
                  value={draft.code}
                  onChange={(event) => updateDraft('code', event.target.value)}
                  placeholder="SOLI10"
                  className="mobile-form-control uppercase tracking-[0.08em]"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-[10px] font-bold uppercase text-[#6b7280]">
                  Tipe
                  <select value={draft.discountType} onChange={(event) => updateDraft('discountType', event.target.value)} className="mobile-form-control">
                    <option value={VOUCHER_DISCOUNT_TYPES.PERCENT}>Percent</option>
                    <option value={VOUCHER_DISCOUNT_TYPES.FIXED}>Fixed</option>
                  </select>
                </label>
                <label className="grid gap-1 text-[10px] font-bold uppercase text-[#6b7280]">
                  Nilai
                  <input
                    value={draft.discountValue}
                    onChange={(event) => updateDraft('discountValue', event.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    placeholder={draft.discountType === VOUCHER_DISCOUNT_TYPES.PERCENT ? '10' : '25000'}
                    className="mobile-form-control"
                  />
                </label>
              </div>

              <label className="grid gap-1 text-[10px] font-bold uppercase text-[#6b7280]">
                Minimum order
                <input
                  value={draft.minimumOrder}
                  onChange={(event) => updateDraft('minimumOrder', event.target.value)}
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  className="mobile-form-control"
                />
              </label>

              <label className="grid gap-1 text-[10px] font-bold uppercase text-[#6b7280]">
                Minimum quantity
                <input
                  value={draft.minimumQuantity}
                  onChange={(event) => updateDraft('minimumQuantity', event.target.value)}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0 = tanpa minimum"
                  className="mobile-form-control"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-[10px] font-bold uppercase text-[#6b7280]">
                  Expiry
                  <input value={draft.expiresAt} onChange={(event) => updateDraft('expiresAt', event.target.value)} type="date" className="mobile-form-control" />
                </label>
                <label className="grid gap-1 text-[10px] font-bold uppercase text-[#6b7280]">
                  Limit
                  <input
                    value={draft.usageLimitTotal}
                    onChange={(event) => updateDraft('usageLimitTotal', event.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    className="mobile-form-control"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => updateDraft('active', !draft.active)}
                className={`flex h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold ${draft.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-stone-200 bg-stone-50 text-stone-700'}`}
              >
                {draft.active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                {draft.active ? 'Aktif' : 'Nonaktif'}
              </button>
            </div>
          </MobileAccordion>

          <MobileAccordion title="Produk eligible" meta="Batasi voucher ke slug produk atau kategori tertentu.">
            <div className="grid gap-3">
              <label className="grid gap-1 text-[10px] font-bold uppercase text-[#6b7280]">
                Produk tertentu
                <textarea
                  value={draft.eligibleProductSlugs}
                  onChange={(event) => updateDraft('eligibleProductSlugs', event.target.value)}
                  placeholder="slug produk, pisahkan koma. Kosong = semua"
                  rows={2}
                  className="mobile-form-control min-h-[76px] py-3"
                />
              </label>

              <label className="grid gap-1 text-[10px] font-bold uppercase text-[#6b7280]">
                Kategori tertentu
                <textarea
                  value={draft.eligibleCategories}
                  onChange={(event) => updateDraft('eligibleCategories', event.target.value)}
                  placeholder="nama kategori, pisahkan koma. Kosong = semua"
                  rows={2}
                  className="mobile-form-control min-h-[76px] py-3"
                />
              </label>
            </div>
          </MobileAccordion>

          <MobileAccordion title="Preview real-time" meta="Cek aturan berlaku, produk eligible, minimum, dan estimasi diskon.">
            <VoucherRealtimePreview preview={voucherPreview} />
          </MobileAccordion>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={savingVoucher}>
              <Save className="h-4 w-4" />
              {savingVoucher ? 'Menyimpan...' : 'Simpan'}
            </Button>
            <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4" onClick={resetDraft} disabled={savingVoucher}>
              Reset
            </Button>
          </div>
        </form>

        <section className="mobile-card space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#0b130c]">Analytics voucher</h2>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Penggunaan, revenue, top voucher, dan top customer.</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
              <BadgePercent className="h-4 w-4" />
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-[#f7f8f2] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-[#8b949e]">Penggunaan</div>
              <div className="mt-1 text-lg font-bold text-[#0b130c]">{voucherAnalytics.totalUsage}</div>
            </div>
            <div className="rounded-2xl bg-amber-50 px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-amber-700">Diskon</div>
              <div className="mt-1 text-sm font-bold text-amber-800">{formatTotal(voucherAnalytics.totalDiscount)}</div>
            </div>
            <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-[#e5e7eb]">
              <div className="text-[10px] font-bold uppercase text-[#8b949e]">Sebelum diskon</div>
              <div className="mt-1 text-sm font-bold text-[#0b130c]">{formatTotal(voucherAnalytics.revenueBeforeDiscount)}</div>
            </div>
            <div className="rounded-2xl bg-[#eef2e8] px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-[#263d27]">Sesudah diskon</div>
              <div className="mt-1 text-sm font-bold text-[#263d27]">{formatTotal(voucherAnalytics.revenueAfterDiscount)}</div>
            </div>
          </div>
          <div className="grid gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase text-[#6b7280]">Top voucher</div>
              <div className="mt-2 grid gap-2">
                {voucherAnalytics.topVouchers.slice(0, 3).map((item, index) => (
                  <div key={item.key} className="flex items-center justify-between gap-2 rounded-2xl bg-[#f7f8f2] px-3 py-2 text-xs font-bold">
                    <span className="min-w-0 truncate">#{index + 1} {item.label}</span>
                    <span className="shrink-0 text-[#263d27]">{item.count}x</span>
                  </div>
                ))}
                {!voucherAnalytics.topVouchers.length ? <p className="text-xs font-semibold text-[#6b7280]">Belum ada voucher terpakai.</p> : null}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-[#6b7280]">Top customer</div>
              <div className="mt-2 grid gap-2">
                {voucherAnalytics.topCustomers.slice(0, 3).map((item, index) => (
                  <div key={item.key} className="flex items-center justify-between gap-2 rounded-2xl bg-[#f7f8f2] px-3 py-2 text-xs font-bold">
                    <span className="min-w-0 truncate">#{index + 1} {item.label}</span>
                    <span className="shrink-0 text-[#263d27]">{item.count}x</span>
                  </div>
                ))}
                {!voucherAnalytics.topCustomers.length ? <p className="text-xs font-semibold text-[#6b7280]">Belum ada customer memakai voucher.</p> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="mobile-card space-y-3 p-3">
            <label className="flex h-11 items-center gap-2 rounded-2xl border bg-white px-3">
              <Search className="h-4 w-4 text-[#8b949e]" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari kode voucher"
                className="min-h-0 flex-1 bg-transparent text-sm font-semibold outline-none"
              />
            </label>
            <div className="mobile-horizontal-scroll flex gap-2 overflow-x-auto pb-1">
              {voucherStatusFilters.map((filter) => {
                const selected = statusFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setStatusFilter(filter.key)}
                    className={`min-h-10 shrink-0 rounded-2xl border px-3 text-xs font-bold ${selected ? 'border-[#263d27] bg-[#263d27] text-white' : 'border-[#e5e7eb] bg-white text-[#263d27]'}`}
                  >
                    {filter.label} ({statusCounts[filter.key] || 0})
                  </button>
                );
              })}
            </div>
          </div>

          {visibleVouchers.map((voucher) => {
            const status = getVoucherStatus(voucher);
            const limitLabel = voucher.usageLimitTotal
              ? `${voucher.usageCount}/${voucher.usageLimitTotal} dipakai`
              : `${voucher.usageCount || 0} dipakai`;
            return (
              <article key={voucher.id || voucher.code} className="mobile-card space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold tracking-[0.08em] text-[#0b130c]">{voucher.code}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${status.className}`}>{status.label}</span>
                      <span className="rounded-full bg-[#f7f8f2] px-2.5 py-1 text-[10px] font-bold uppercase text-[#263d27]">{voucher.discountType}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-2xl bg-white" onClick={() => copyVoucherCode(voucher)} aria-label={`Copy kode voucher ${voucher.code}`}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-2xl bg-white" onClick={() => editVoucher(voucher)} aria-label={`Edit voucher ${voucher.code}`}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-2xl bg-white" onClick={() => toggleVoucher(voucher)} aria-label={`${voucher.active ? 'Nonaktifkan' : 'Aktifkan'} voucher ${voucher.code}`} disabled={savingVoucher}>
                      {voucher.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeVoucher(voucher)} aria-label={`Hapus voucher ${voucher.code}`} disabled={savingVoucher}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-[#263d27]">
                  <div className="rounded-2xl bg-[#f7f8f2] px-3 py-2">
                    <span className="block text-[10px] font-bold uppercase text-[#8b949e]">Diskon</span>
                    {voucher.discountType === VOUCHER_DISCOUNT_TYPES.PERCENT ? `${voucher.discountValue}%` : formatTotal(voucher.discountValue)}
                  </div>
                  <div className="rounded-2xl bg-[#f7f8f2] px-3 py-2">
                    <span className="block text-[10px] font-bold uppercase text-[#8b949e]">Minimum</span>
                    {voucher.minimumOrder ? formatTotal(voucher.minimumOrder) : 'Tanpa minimum'}
                  </div>
                  <div className="rounded-2xl bg-[#f7f8f2] px-3 py-2">
                    <span className="block text-[10px] font-bold uppercase text-[#8b949e]">Qty minimum</span>
                    {voucher.minimumQuantity ? `${voucher.minimumQuantity} item` : 'Tanpa minimum'}
                  </div>
                  <div className="rounded-2xl bg-[#f7f8f2] px-3 py-2">
                    <span className="block text-[10px] font-bold uppercase text-[#8b949e]">Expiry</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(voucher.expiresAt)}</span>
                  </div>
                  <div className="rounded-2xl bg-[#f7f8f2] px-3 py-2">
                    <span className="block text-[10px] font-bold uppercase text-[#8b949e]">Usage</span>
                    {limitLabel}
                  </div>
                  <div className="col-span-2 rounded-2xl bg-[#f7f8f2] px-3 py-2">
                    <span className="block text-[10px] font-bold uppercase text-[#8b949e]">Berlaku untuk</span>
                    {getVoucherRestrictionLabel(voucher)}
                  </div>
                </div>
              </article>
            );
          })}

          {filteredVouchers.length ? (
            <PaginationOrLoadMore
              visibleCount={visibleVouchers.length}
              totalCount={filteredVouchers.length}
              onLoadMore={() => setVoucherVisibleCount((current) => current + MOBILE_PAGE_SIZE)}
            />
          ) : null}

          {!filteredVouchers.length ? (
            <MobileStatePanel
              tone="empty"
              icon={BadgePercent}
              title={vouchers.length ? 'Voucher tidak ditemukan' : 'Belum ada voucher'}
              description={vouchers.length ? 'Ubah pencarian atau filter status untuk melihat voucher lain.' : 'Buat voucher pertama dari form di atas.'}
            />
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="mobile-card space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[#0b130c]">Laporan penggunaan</h2>
                <p className="mt-1 text-xs font-semibold text-[#6b7280]">Kode, order, customer, diskon, dan waktu dipakai.</p>
              </div>
              <div className="shrink-0 rounded-2xl bg-emerald-50 px-3 py-2 text-right text-xs font-bold text-emerald-800">
                <div>{usageStats.count}x</div>
                <div className="mt-0.5 text-[10px]">{formatTotal(usageStats.discountTotal)}</div>
              </div>
            </div>
            <label className="flex h-11 items-center gap-2 rounded-2xl border bg-white px-3">
              <Search className="h-4 w-4 text-[#8b949e]" />
              <input
                value={usageSearchTerm}
                onChange={(event) => setUsageSearchTerm(event.target.value)}
                placeholder="Cari kode, order, customer"
                className="min-h-0 flex-1 bg-transparent text-sm font-semibold outline-none"
              />
            </label>
          </div>

          {visibleUsageReport.map((entry) => (
            <article key={entry.id || `${entry.voucherCode}-${entry.orderNumber}-${entry.usedAt}`} className="mobile-card space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold tracking-[0.08em] text-[#0b130c]">{entry.voucherCode}</h3>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280]">{entry.orderNumber || '-'}</p>
                </div>
                <div className="shrink-0 rounded-2xl bg-[#f7f8f2] px-3 py-2 text-right text-xs font-bold text-[#263d27]">
                  {entry.discountAmount ? formatTotal(entry.discountAmount) : '-'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-[#263d27]">
                <div className="rounded-2xl bg-[#f7f8f2] px-3 py-2">
                  <span className="block text-[10px] font-bold uppercase text-[#8b949e]">Customer</span>
                  <span className="block truncate">{entry.customerName || '-'}</span>
                </div>
                <div className="rounded-2xl bg-[#f7f8f2] px-3 py-2">
                  <span className="block text-[10px] font-bold uppercase text-[#8b949e]">Kode customer</span>
                  <span className="block truncate">{entry.customerCode || '-'}</span>
                </div>
                <div className="col-span-2 rounded-2xl bg-[#f7f8f2] px-3 py-2">
                  <span className="block text-[10px] font-bold uppercase text-[#8b949e]">Waktu dipakai</span>
                  {formatDateTime(entry.usedAt)}
                </div>
              </div>
            </article>
          ))}

          {filteredUsageReport.length ? (
            <PaginationOrLoadMore
              visibleCount={visibleUsageReport.length}
              totalCount={filteredUsageReport.length}
              onLoadMore={() => setUsageVisibleCount((current) => current + MOBILE_PAGE_SIZE)}
            />
          ) : null}

          {!filteredUsageReport.length ? (
            <MobileStatePanel
              tone="empty"
              icon={BadgePercent}
              title={usageReport.length ? 'Riwayat tidak ditemukan' : 'Belum ada penggunaan voucher'}
              description={usageReport.length ? 'Ubah pencarian untuk melihat penggunaan lain.' : 'Riwayat akan muncul setelah order memakai voucher.'}
            />
          ) : null}
        </section>
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileVoucherManagementPage;
