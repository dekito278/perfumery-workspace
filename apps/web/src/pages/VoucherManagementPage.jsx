import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { BadgePercent, CalendarDays, CheckCircle2, Edit3, Plus, Save, Search, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import {
  deleteVoucher,
  getVouchers,
  normalizeVoucherCode,
  saveVoucher,
  VOUCHER_DISCOUNT_TYPES,
  VOUCHER_UPDATED_EVENT,
} from '@/services/voucherService.js';

const emptyDraft = {
  id: '',
  code: '',
  discountType: VOUCHER_DISCOUNT_TYPES.PERCENT,
  discountValue: '',
  minimumOrder: '',
  expiresAt: '',
  active: true,
  usageLimitTotal: '',
};

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
  : 'Tanpa expiry');

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
  expiresAt: voucher?.expiresAt || '',
  active: voucher?.active !== false,
  usageLimitTotal: voucher?.usageLimitTotal || '',
});

const VoucherManagementPage = () => {
  const [vouchers, setVouchers] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [searchTerm, setSearchTerm] = useState('');

  const loadVouchers = () => setVouchers(getVouchers());

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

  const updateDraft = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: field === 'code' ? normalizeVoucherCode(value) : value,
    }));
  };

  const resetDraft = () => setDraft(emptyDraft);

  const submitVoucher = (event) => {
    event.preventDefault();
    try {
      const savedVoucher = saveVoucher({
        ...draft,
        discountValue: Number(draft.discountValue || 0),
        minimumOrder: Number(draft.minimumOrder || 0),
        usageLimitTotal: Number(draft.usageLimitTotal || 0),
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

  const toggleVoucher = (voucher) => {
    const savedVoucher = saveVoucher({ ...voucher, active: !voucher.active });
    toast.success(`${savedVoucher.code} ${savedVoucher.active ? 'diaktifkan' : 'dinonaktifkan'}`);
  };

  const removeVoucher = (voucher) => {
    deleteVoucher(voucher.id || voucher.code);
    if (draft.id === voucher.id || draft.code === voucher.code) {
      resetDraft();
    }
    toast.success(`Voucher ${voucher.code} dihapus`);
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
              Kelola kode voucher sederhana untuk mobile cart dan checkout. Voucher disimpan lokal dulu mengikuti tahap awal fitur.
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

            <div className="mt-5 grid gap-4">
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
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
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
            </div>

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
                            <span className="block text-[10px] font-bold uppercase text-muted-foreground">Expiry</span>
                            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(voucher.expiresAt)}</span>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2">
                            <span className="block text-[10px] font-bold uppercase text-muted-foreground">Usage</span>
                            {limitLabel}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 xl:w-72">
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
      </div>
    </AuthenticatedLayout>
  );
};

export default VoucherManagementPage;
