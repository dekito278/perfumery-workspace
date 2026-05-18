import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { BadgePercent, CalendarDays, Edit3, Plus, Save, Search, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';
import { Button } from '@/components/ui/button.jsx';
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
    document.querySelector('[data-mobile-primary-scroller="true"]')?.scrollTo({ top: 0, behavior: 'smooth' });
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
          </div>
        </section>

        <form onSubmit={submitVoucher} className="mobile-card space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold">{draft.id ? 'Edit voucher' : 'Buat voucher'}</h2>
              <p className="mt-0.5 text-xs font-semibold text-[#6b7280]">Voucher tersimpan lokal dan langsung dipakai checkout.</p>
            </div>
            <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-2xl bg-white" onClick={resetDraft} aria-label="Buat voucher baru">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

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

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button type="submit" className="h-12 rounded-2xl gap-2">
              <Save className="h-4 w-4" />
              Simpan
            </Button>
            <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4" onClick={resetDraft}>
              Reset
            </Button>
          </div>
        </form>

        <section className="space-y-3">
          <div className="mobile-card p-3">
            <label className="flex h-11 items-center gap-2 rounded-2xl border bg-white px-3">
              <Search className="h-4 w-4 text-[#8b949e]" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari kode voucher"
                className="min-h-0 flex-1 bg-transparent text-sm font-semibold outline-none"
              />
            </label>
          </div>

          {filteredVouchers.map((voucher) => {
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
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-2xl bg-white" onClick={() => editVoucher(voucher)} aria-label={`Edit voucher ${voucher.code}`}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-2xl bg-white" onClick={() => toggleVoucher(voucher)} aria-label={`${voucher.active ? 'Nonaktifkan' : 'Aktifkan'} voucher ${voucher.code}`}>
                      {voucher.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeVoucher(voucher)} aria-label={`Hapus voucher ${voucher.code}`}>
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
                    <span className="block text-[10px] font-bold uppercase text-[#8b949e]">Expiry</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(voucher.expiresAt)}</span>
                  </div>
                  <div className="rounded-2xl bg-[#f7f8f2] px-3 py-2">
                    <span className="block text-[10px] font-bold uppercase text-[#8b949e]">Usage</span>
                    {limitLabel}
                  </div>
                </div>
              </article>
            );
          })}

          {!filteredVouchers.length ? (
            <MobileStatePanel
              tone="empty"
              icon={BadgePercent}
              title={vouchers.length ? 'Voucher tidak ditemukan' : 'Belum ada voucher'}
              description={vouchers.length ? 'Ubah pencarian untuk melihat voucher lain.' : 'Buat voucher pertama dari form di atas.'}
            />
          ) : null}
        </section>
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileVoucherManagementPage;
