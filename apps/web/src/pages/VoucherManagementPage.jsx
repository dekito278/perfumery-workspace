import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { BadgePercent, CalendarDays, CheckCircle2, Copy, Edit3, Plus, Save, Search, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import VoucherRealtimePreview from '@/components/vouchers/VoucherRealtimePreview.jsx';
import { Button } from '@/components/ui/button.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
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
  if (!voucher.active) return { label: 'Nonaktif', className: 'bg-stone-100 text-stone-700' };
  const expiryValue = String(voucher.expiresAt || '').trim();
  const expiryTime = expiryValue
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(expiryValue) ? `${expiryValue}T23:59:59.999` : expiryValue).getTime()
    : null;
  if (expiryTime && expiryTime < Date.now()) {
    return { label: 'Expired', className: 'bg-rose-50 text-rose-700' };
  }
  if (voucher.usageLimitTotal > 0 && voucher.usageCount >= voucher.usageLimitTotal) {
    return { label: 'Limit habis', className: 'bg-amber-50 text-amber-800' };
  }
  return { label: 'Aktif', className: 'bg-emerald-50 text-emerald-700' };
};

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

const VoucherManagementPage = () => {
  const [vouchers, setVouchers] = useState([]);
  const [usageRecords, setUsageRecords] = useState([]);
  const [orders, setOrders] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [searchTerm, setSearchTerm] = useState('');
  const [usageSearchTerm, setUsageSearchTerm] = useState('');
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

  const filteredVouchers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return vouchers;
    return vouchers.filter((voucher) => [
      voucher.code,
      voucher.discountType,
      voucher.active ? 'aktif' : 'nonaktif',
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [searchTerm, vouchers]);

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
    }
  };

  const editVoucher = (voucher) => {
    setDraft(toDraft(voucher));
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    try {
      const savedVoucher = await saveVoucher({ ...voucher, active: !voucher.active });
      toast.success(`${savedVoucher.code} ${savedVoucher.active ? 'diaktifkan' : 'dinonaktifkan'}`);
    } catch (error) {
      toast.error(error.message || 'Gagal mengubah status voucher');
    }
  };

  const removeVoucher = async (voucher) => {
    try {
      await deleteVoucher(voucher.id || voucher.code);
      if (draft.id === voucher.id || draft.code === voucher.code) {
        resetDraft();
      }
      toast.success(`Voucher ${voucher.code} dihapus`);
    } catch (error) {
      toast.error(error.message || 'Gagal menghapus voucher');
    }
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Vouchers - Solivagant</title>
        <meta name="description" content="Manage storefront vouchers for Solivagant checkout." />
      </Helmet>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <BadgePercent className="h-4 w-4 text-primary" />
              Storefront promo
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Voucher manager</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Kelola kode voucher untuk cart dan checkout. Voucher tersimpan di Supabase sehingga berlaku di semua device.
            </p>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Total voucher</span><strong>{stats.total}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Aktif</span><strong>{stats.active}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Pakai limit</span><strong>{stats.limited}</strong></div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
          <form onSubmit={submitVoucher} className="rounded-2xl border bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{draft.id ? 'Edit voucher' : 'Buat voucher'}</h2>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">Kode, nominal diskon, minimum order, expiry, status, dan limit penggunaan.</p>
              </div>
              <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={resetDraft}>
                <Plus className="h-4 w-4" />
                Baru
              </Button>
            </div>

            <Tabs defaultValue="rules" className="mt-5">
              <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-[#f7f8f2] p-1">
                <TabsTrigger value="rules" className="rounded-xl text-xs font-bold">Aturan</TabsTrigger>
                <TabsTrigger value="eligibility" className="rounded-xl text-xs font-bold">Eligibility</TabsTrigger>
                <TabsTrigger value="preview" className="rounded-xl text-xs font-bold">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="rules" className="mt-5 grid gap-4">
                <label className="grid gap-1 text-xs font-bold uppercase text-muted-foreground">
                  Kode voucher
                  <input
                    value={draft.code}
                    onChange={(event) => updateDraft('code', event.target.value)}
                    placeholder="SOLI10"
                    className="h-12 rounded-2xl border bg-white px-4 text-sm font-bold uppercase tracking-[0.08em] outline-none focus:border-amber-300"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-bold uppercase text-muted-foreground">
                    Tipe diskon
                    <select
                      value={draft.discountType}
                      onChange={(event) => updateDraft('discountType', event.target.value)}
                      className="h-12 rounded-2xl border bg-white px-4 text-sm font-bold outline-none focus:border-amber-300"
                    >
                      <option value={VOUCHER_DISCOUNT_TYPES.PERCENT}>Percent</option>
                      <option value={VOUCHER_DISCOUNT_TYPES.FIXED}>Fixed</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-bold uppercase text-muted-foreground">
                    Nilai diskon
                    <input
                      value={draft.discountValue}
                      onChange={(event) => updateDraft('discountValue', event.target.value)}
                      type="number"
                      min="0"
                      step="1"
                      placeholder={draft.discountType === VOUCHER_DISCOUNT_TYPES.PERCENT ? '10' : '25000'}
                      className="h-12 rounded-2xl border bg-white px-4 text-sm font-bold outline-none focus:border-amber-300"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-bold uppercase text-muted-foreground">
                    Minimum order
                    <input
                      value={draft.minimumOrder}
                      onChange={(event) => updateDraft('minimumOrder', event.target.value)}
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0"
                      className="h-12 rounded-2xl border bg-white px-4 text-sm font-bold outline-none focus:border-amber-300"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold uppercase text-muted-foreground">
                    Minimum quantity
                    <input
                      value={draft.minimumQuantity}
                      onChange={(event) => updateDraft('minimumQuantity', event.target.value)}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0 = tanpa minimum"
                      className="h-12 rounded-2xl border bg-white px-4 text-sm font-bold outline-none focus:border-amber-300"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <label className="grid gap-1 text-xs font-bold uppercase text-muted-foreground">
                    Usage limit total
                    <input
                      value={draft.usageLimitTotal}
                      onChange={(event) => updateDraft('usageLimitTotal', event.target.value)}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0 = tanpa limit"
                      className="h-12 rounded-2xl border bg-white px-4 text-sm font-bold outline-none focus:border-amber-300"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold uppercase text-muted-foreground">
                    Expiry date
                    <input
                      value={draft.expiresAt}
                      onChange={(event) => updateDraft('expiresAt', event.target.value)}
                      type="date"
                      className="h-12 rounded-2xl border bg-white px-4 text-sm font-bold outline-none focus:border-amber-300"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => updateDraft('active', !draft.active)}
                    className={`flex h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold ${draft.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-stone-200 bg-stone-50 text-stone-700'}`}
                  >
                    {draft.active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    {draft.active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="eligibility" className="mt-5 grid gap-3">
                <label className="grid gap-1 text-xs font-bold uppercase text-muted-foreground">
                  Produk tertentu
                  <textarea
                    value={draft.eligibleProductSlugs}
                    onChange={(event) => updateDraft('eligibleProductSlugs', event.target.value)}
                    placeholder="slug produk, pisahkan dengan koma. Kosong = semua produk"
                    rows={2}
                    className="rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-amber-300"
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase text-muted-foreground">
                  Kategori tertentu
                  <textarea
                    value={draft.eligibleCategories}
                    onChange={(event) => updateDraft('eligibleCategories', event.target.value)}
                    placeholder="nama kategori, pisahkan dengan koma. Kosong = semua kategori"
                    rows={2}
                    className="rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-amber-300"
                  />
                </label>
                <p className="rounded-2xl bg-[#f7f8f2] px-4 py-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                  Jika produk atau kategori diisi, voucher hanya memotong subtotal dan menghitung quantity item yang cocok.
                </p>
              </TabsContent>

              <TabsContent value="preview" className="mt-5">
                <VoucherRealtimePreview preview={voucherPreview} />
              </TabsContent>
            </Tabs>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="submit" className="h-12 rounded-2xl gap-2">
                <Save className="h-4 w-4" />
                Simpan voucher
              </Button>
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white" onClick={resetDraft}>
                Reset form
              </Button>
            </div>
          </form>

          <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold">Daftar voucher</h2>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">Klik edit untuk ubah detail, atau toggle status langsung dari daftar.</p>
              </div>
              <label className="relative block sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Cari kode voucher"
                  className="h-11 w-full rounded-2xl border bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-amber-300"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3">
              {filteredVouchers.map((voucher) => {
                const status = getVoucherStatus(voucher);
                const limitLabel = voucher.usageLimitTotal
                  ? `${voucher.usageCount}/${voucher.usageLimitTotal} dipakai`
                  : `${voucher.usageCount || 0} dipakai`;
                return (
                  <article key={voucher.id || voucher.code} className="rounded-2xl border bg-[#fbfaf7] p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold tracking-[0.08em] text-[#0b130c]">{voucher.code}</h3>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${status.className}`}>{status.label}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase text-[#263d27]">{voucher.discountType}</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm font-semibold text-[#263d27] sm:grid-cols-2">
                          <div className="rounded-2xl bg-white px-3 py-2">
                            <span className="block text-[10px] font-bold uppercase text-muted-foreground">Diskon</span>
                            {voucher.discountType === VOUCHER_DISCOUNT_TYPES.PERCENT ? `${voucher.discountValue}%` : formatTotal(voucher.discountValue)}
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2">
                            <span className="block text-[10px] font-bold uppercase text-muted-foreground">Minimum order</span>
                            {voucher.minimumOrder ? formatTotal(voucher.minimumOrder) : 'Tanpa minimum'}
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2">
                            <span className="block text-[10px] font-bold uppercase text-muted-foreground">Minimum quantity</span>
                            {voucher.minimumQuantity ? `${voucher.minimumQuantity} item` : 'Tanpa minimum'}
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2">
                            <span className="block text-[10px] font-bold uppercase text-muted-foreground">Expiry</span>
                            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(voucher.expiresAt)}</span>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2">
                            <span className="block text-[10px] font-bold uppercase text-muted-foreground">Pemakaian</span>
                            {limitLabel}
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2 sm:col-span-2">
                            <span className="block text-[10px] font-bold uppercase text-muted-foreground">Berlaku untuk</span>
                            {getVoucherRestrictionLabel(voucher)}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 xl:w-96">
                        <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => copyVoucherCode(voucher)}>
                          <Copy className="h-4 w-4" />
                          Salin
                        </Button>
                        <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => editVoucher(voucher)}>
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => toggleVoucher(voucher)}>
                          {voucher.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                          {voucher.active ? 'On' : 'Off'}
                        </Button>
                        <Button type="button" variant="outline" className="rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeVoucher(voucher)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {!filteredVouchers.length ? (
                <StateBlock
                  icon={CheckCircle2}
                  title={vouchers.length ? 'Voucher tidak ditemukan' : 'Belum ada voucher'}
                  description={vouchers.length ? 'Ubah pencarian untuk melihat voucher lain.' : 'Buat voucher pertama dari form di sebelah kiri.'}
                />
              ) : null}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border bg-white/90 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Analytics voucher</h2>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                Ringkasan performa penggunaan, revenue sebelum/sesudah diskon, top voucher, dan top customer.
              </p>
            </div>
            <div className="rounded-2xl bg-[#eef2e8] px-4 py-2 text-xs font-bold text-[#263d27]">
              Diskon total {formatTotal(voucherAnalytics.totalDiscount)}
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[#263d27]/10 bg-[#f7f8f2] p-4">
              <div className="text-xs font-bold uppercase text-muted-foreground">Total penggunaan</div>
              <div className="mt-1 text-3xl font-bold text-[#0b130c]">{voucherAnalytics.totalUsage}</div>
            </div>
            <div className="rounded-2xl border border-[#263d27]/10 bg-white p-4">
              <div className="text-xs font-bold uppercase text-muted-foreground">Revenue sebelum diskon</div>
              <div className="mt-1 text-2xl font-bold text-[#0b130c]">{formatTotal(voucherAnalytics.revenueBeforeDiscount)}</div>
            </div>
            <div className="rounded-2xl border border-[#263d27]/10 bg-[#eef2e8] p-4">
              <div className="text-xs font-bold uppercase text-muted-foreground">Revenue sesudah diskon</div>
              <div className="mt-1 text-2xl font-bold text-[#263d27]">{formatTotal(voucherAnalytics.revenueAfterDiscount)}</div>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <div className="text-xs font-bold uppercase text-amber-800">Selisih diskon</div>
              <div className="mt-1 text-2xl font-bold text-amber-800">{formatTotal(voucherAnalytics.totalDiscount)}</div>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-[#fbfaf7] p-4">
              <h3 className="text-base font-bold">Top voucher</h3>
              <div className="mt-3 grid gap-2">
                {voucherAnalytics.topVouchers.slice(0, 5).map((item, index) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold">
                    <span className="min-w-0 truncate"><span className="mr-2 text-muted-foreground">#{index + 1}</span>{item.label}</span>
                    <span className="shrink-0 text-right text-[#263d27]">{item.count}x / {formatTotal(item.discountTotal)}</span>
                  </div>
                ))}
                {!voucherAnalytics.topVouchers.length ? <p className="text-sm font-semibold text-muted-foreground">Belum ada voucher terpakai.</p> : null}
              </div>
            </div>
            <div className="rounded-2xl border bg-[#fbfaf7] p-4">
              <h3 className="text-base font-bold">Top customer</h3>
              <div className="mt-3 grid gap-2">
                {voucherAnalytics.topCustomers.slice(0, 5).map((item, index) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold">
                    <span className="min-w-0 truncate"><span className="mr-2 text-muted-foreground">#{index + 1}</span>{item.label}</span>
                    <span className="shrink-0 text-right text-[#263d27]">{item.count}x / {formatTotal(item.revenueAfterDiscount)}</span>
                  </div>
                ))}
                {!voucherAnalytics.topCustomers.length ? <p className="text-sm font-semibold text-muted-foreground">Belum ada customer memakai voucher.</p> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white/90 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Laporan penggunaan voucher</h2>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                Kode, order, customer, nominal diskon, dan waktu voucher dipakai.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="rounded-2xl bg-[#f7f8f2] px-4 py-2 text-xs font-bold text-[#263d27]">
                {usageStats.count} penggunaan / {formatTotal(usageStats.discountTotal)}
              </div>
              <label className="relative block sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={usageSearchTerm}
                  onChange={(event) => setUsageSearchTerm(event.target.value)}
                  placeholder="Cari kode, order, customer"
                  className="h-11 w-full rounded-2xl border bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-amber-300"
                />
              </label>
            </div>
          </div>

          {filteredUsageReport.length ? (
            <div className="mt-5 overflow-hidden rounded-2xl border">
              <table className="min-w-full divide-y text-sm">
                <thead className="bg-[#f7f8f2] text-left text-[11px] font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Kode</th>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Nominal diskon</th>
                    <th className="px-4 py-3">Waktu dipakai</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {filteredUsageReport.map((entry) => (
                    <tr key={entry.id || `${entry.voucherCode}-${entry.orderNumber}-${entry.usedAt}`}>
                      <td className="px-4 py-3 font-bold tracking-[0.08em] text-[#0b130c]">{entry.voucherCode}</td>
                      <td className="px-4 py-3 font-semibold text-[#263d27]">{entry.orderNumber || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#263d27]">{entry.customerName || '-'}</div>
                        {entry.customerCode ? <div className="text-xs font-semibold text-muted-foreground">{entry.customerCode}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#263d27]">
                        {entry.discountAmount ? formatTotal(entry.discountAmount) : '-'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-muted-foreground">{formatDateTime(entry.usedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <StateBlock
              className="mt-5"
              icon={CheckCircle2}
              title={usageReport.length ? 'Riwayat tidak ditemukan' : 'Belum ada penggunaan voucher'}
              description={usageReport.length ? 'Ubah pencarian untuk melihat penggunaan lain.' : 'Riwayat akan muncul setelah order memakai voucher.'}
            />
          )}
        </section>
      </div>
    </AuthenticatedLayout>
  );
};

export default VoucherManagementPage;
