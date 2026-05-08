import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, KeyRound, Loader2, PackageCheck, Search, ShieldCheck, ShoppingBag, Sparkles, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import {
  getCustomerPortalByCode,
  setCustomerPortalSecurity,
  verifyCustomerPortalSecurity,
} from '@/services/customerService.js';
import { getBespokeItem, getOrderStatusLabels, isBespokeOrder } from '@/services/orderService.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-');

const statusLabels = getOrderStatusLabels();
const paymentStatusLabels = {
  unpaid: 'Belum dibayar',
  pending: 'Menunggu',
  paid: 'Lunas',
  failed: 'Gagal',
  expired: 'Expired',
  refunded: 'Refunded',
};

const statusSteps = ['pending_payment', 'paid', 'processing', 'shipped', 'completed'];

const getActiveStep = (status) => {
  if (status === 'cancelled') return -1;
  const index = statusSteps.indexOf(status);
  return index >= 0 ? index : 0;
};

const getPaymentTone = (status) => {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700';
  if (['failed', 'expired'].includes(status)) return 'bg-rose-50 text-rose-700';
  if (status === 'pending') return 'bg-amber-50 text-amber-700';
  return 'bg-stone-100 text-stone-600';
};

const bespokeDetailRows = (item) => [
  ['Aroma', item?.preferredNotes || item?.notes],
  ['Momen', item?.occasion],
  ['Ukuran', item?.size],
  ['Botol', item?.bottleType],
  ['Cap', item?.capDesign],
  ['Label', item?.labelDesign],
  ['Material', item?.exoticMaterial],
].filter(([, value]) => value);

const StatusBadge = ({ status }) => (
  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-800 sm:px-3 sm:text-xs">
    {statusLabels[status] || status}
  </span>
);

const PaymentBadge = ({ status }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase sm:px-3 sm:text-xs ${getPaymentTone(status)}`}>
    <CreditCard className="h-3 w-3" />
    {paymentStatusLabels[status] || status}
  </span>
);

const OrderProgressRail = ({ activeStep, compact = false }) => (
  <div className={`grid grid-cols-5 ${compact ? 'gap-1.5' : 'gap-2'}`}>
    {statusSteps.map((step, index) => {
      const done = activeStep >= index;
      return (
        <div key={step} className="min-w-0">
          <div className={`${compact ? 'h-1.5' : 'h-2'} rounded-full ${done ? 'bg-[#263d27]' : 'bg-stone-200'}`} />
          <div className={`mt-1 truncate font-bold uppercase ${compact ? 'text-[8px]' : 'text-[10px]'} ${done ? 'text-[#263d27]' : 'text-muted-foreground'}`}>
            {statusLabels[step] || step}
          </div>
        </div>
      );
    })}
  </div>
);

const OrderItems = ({ order, compact = false }) => (
  <div className="grid gap-2">
    {order.items.map((item) => (
      <div key={`${order.orderNumber}-${item.slug || item.name}`} className={`flex items-center justify-between gap-2 rounded-2xl bg-white font-semibold ${compact ? 'border border-[#e5e7eb] px-3 py-2 text-xs' : 'px-3 py-2 text-sm'}`}>
        <span className="min-w-0 truncate">{item.name} x{item.quantity}</span>
        <span className="shrink-0 text-amber-700">{item.price || '-'}</span>
      </div>
    ))}
  </div>
);

const BespokeDetailPanel = ({ item, compact = false }) => {
  const rows = bespokeDetailRows(item);
  if (!rows.length) return null;

  return (
    <div className={`${compact ? 'mt-3 p-3' : 'mt-4 p-4'} rounded-2xl bg-[#eef2e8]`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27] sm:text-xs">
        <Sparkles className="h-3.5 w-3.5" />
        Bespoke detail
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {rows.map(([label, value]) => (
          <div key={label} className={`${compact ? 'grid grid-cols-[68px_1fr] gap-2 text-xs leading-snug' : 'rounded-xl bg-white/70 px-3 py-2 text-sm'} font-semibold`}>
            <span className={`${compact ? 'text-[#6b7280]' : 'block text-[10px] font-bold uppercase text-muted-foreground'}`}>{label}</span>
            <span className={`${compact ? 'text-[#1f2937]' : 'mt-1 block text-[#0b130c]'}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CustomerPortalPage = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  const [customerCode, setCustomerCode] = useState(initialCode.toUpperCase());
  const [portal, setPortal] = useState(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [newSecurityAnswer, setNewSecurityAnswer] = useState('');
  const [currentSecurityAnswer, setCurrentSecurityAnswer] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [securityFormOpen, setSecurityFormOpen] = useState(false);

  const latestOrder = portal?.orders?.[0];
  const isMobileRoute = location.pathname.startsWith('/mobile');
  const activeOrders = useMemo(() => (
    portal?.orders?.filter((order) => !['completed', 'cancelled'].includes(order.status)) || []
  ), [portal]);

  const loadPortalForCode = async (code) => {
    if (!code.trim()) {
      toast.error('Customer code is required');
      return;
    }

    setLoading(true);
    setSearched(true);
    const result = await getCustomerPortalByCode(code);
    setLoading(false);

    if (!result) {
      setPortal(null);
      toast.error('Customer code not found');
      return;
    }

    setPortal(result);
    setSecurityAnswer('');
    setSecurityQuestion(result.customer.securityQuestion || '');
    setSecurityFormOpen(false);
    setCustomerCode(result.customer.customerCode);
    setSearchParams({ code: result.customer.customerCode });
    toast.success(`${result.customer.customerCode} loaded`);
  };

  useEffect(() => {
    if (initialCode) {
      loadPortalForCode(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPortal = async (event) => {
    event?.preventDefault();
    await loadPortalForCode(customerCode);
  };

  const copyCode = async () => {
    if (!portal?.customer?.customerCode) return;
    await navigator.clipboard.writeText(portal.customer.customerCode);
    toast.success(`${portal.customer.customerCode} copied`);
  };

  const unlockPortal = async (event) => {
    event.preventDefault();
    if (!securityAnswer.trim()) {
      toast.error('Security answer is required');
      return;
    }

    setSecurityLoading(true);
    const result = await verifyCustomerPortalSecurity(customerCode, securityAnswer);
    setSecurityLoading(false);

    if (!result) {
      toast.error('Security answer is incorrect');
      return;
    }

    setPortal(result);
    setSecurityQuestion(result.customer.securityQuestion || '');
    setSecurityAnswer('');
    toast.success('Customer dashboard unlocked');
  };

  const saveSecurity = async (event) => {
    event.preventDefault();
    if (!portal?.customer?.customerCode) return;

    setSavingSecurity(true);
    try {
      await setCustomerPortalSecurity({
        customerCode: portal.customer.customerCode,
        securityQuestion,
        securityAnswer: newSecurityAnswer,
        currentAnswer: currentSecurityAnswer,
      });
      setPortal((current) => ({
        ...current,
        customer: {
          ...current.customer,
          securityQuestion,
          securityEnabledAt: new Date().toISOString(),
        },
      }));
      setNewSecurityAnswer('');
      setCurrentSecurityAnswer('');
      setSecurityFormOpen(false);
      toast.success('Security question saved');
    } catch (error) {
      toast.error(error.message || 'Failed to save security question');
    } finally {
      setSavingSecurity(false);
    }
  };

  if (isMobileRoute) {
    return (
      <MobileCommerceLayout>
        <Helmet>
          <title>Customer Dashboard - Solivagant</title>
          <meta name="description" content="Check Solivagant order progress with a customer code." />
        </Helmet>
        <main className="mobile-page space-y-4">
          <section className="mobile-soft-card overflow-hidden">
            <div className="relative overflow-hidden bg-[#050705] p-4 text-[#eef2e8]">
              <div className="absolute -right-8 top-0 h-28 w-28 rounded-full border border-white/10" />
              <div className="absolute right-6 top-10 h-16 w-16 rounded-full border border-[#d6c68a]/20" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase text-[#cbd6c5]">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Order tracker
                </div>
                <h1 className="mt-3 text-2xl font-bold leading-tight">Cek progress pesanan.</h1>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#cbd6c5]">
                  Status payment, proses produksi, dan pengiriman dalam satu tempat.
                </p>
              </div>
            </div>
            <form onSubmit={loadPortal} className="grid gap-3 p-4">
              <label className="text-[10px] font-bold uppercase text-[#6b7280]">Customer code</label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={customerCode}
                  onChange={(event) => setCustomerCode(event.target.value.toUpperCase())}
                  placeholder="SOLI09232"
                  className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-bold uppercase tracking-[0.08em] outline-none focus:border-[#263d27]"
                />
                <Button type="submit" className="h-12 rounded-2xl px-4" disabled={loading} aria-label="Check customer code">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs font-semibold leading-relaxed text-[#6b7280]">
                Kode ini diberikan setelah checkout pertama.
              </p>
            </form>
          </section>

          {portal?.requiresSecurity ? (
            <section className="mobile-card p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
                  <KeyRound className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#263d27]">Security check</div>
                  <h2 className="mt-1 text-lg font-bold text-[#0b130c]">{portal.customer.customerName}</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">Jawab pertanyaan keamanan untuk membuka dashboard.</p>
                </div>
              </div>
              <form onSubmit={unlockPortal} className="mt-4 grid gap-3">
                <div className="rounded-2xl bg-[#f7f8f2] p-3">
                  <div className="text-[10px] font-bold uppercase text-[#6b7280]">Question</div>
                  <div className="mt-1 text-sm font-bold text-[#0b130c]">{portal.customer.securityQuestion}</div>
                </div>
                <input
                  value={securityAnswer}
                  onChange={(event) => setSecurityAnswer(event.target.value)}
                  placeholder="Your answer"
                  className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-[#263d27]"
                />
                <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={securityLoading}>
                  {securityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Unlock
                </Button>
              </form>
            </section>
          ) : portal ? (
            <>
              <section className="mobile-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-[#263d27]">Welcome back</div>
                    <h2 className="mt-1 truncate text-lg font-bold text-[#0b130c]">{portal.customer.customerName}</h2>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">{portal.customer.contact}</p>
                  </div>
                  <button type="button" onClick={copyCode} className="shrink-0 rounded-2xl bg-[#263d27] px-3 py-2 text-xs font-bold tracking-[0.12em] text-[#eef2e8]">
                    {portal.customer.customerCode}
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-[#263d27]/10 bg-[#f7f8f2] p-3 text-center">
                    <div className="text-sm font-bold text-[#0b130c]">{portal.orders.length}</div>
                    <div className="text-[10px] font-bold uppercase text-[#6b7280]">Orders</div>
                  </div>
                  <div className="rounded-2xl border border-[#263d27]/10 bg-[#eef2e8] p-3 text-center">
                    <div className="text-sm font-bold text-[#263d27]">{activeOrders.length}</div>
                    <div className="text-[10px] font-bold uppercase text-[#263d27]">Active</div>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-center">
                    <div className="truncate text-xs font-bold text-amber-800">{latestOrder ? statusLabels[latestOrder.status] || latestOrder.status : '-'}</div>
                    <div className="text-[10px] font-bold uppercase text-amber-700">Latest</div>
                  </div>
                </div>
              </section>

              <section className="mobile-card p-3">
                <button type="button" onClick={() => setSecurityFormOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 text-left">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-[#0b130c]">{portal.customer.securityEnabledAt ? 'Dashboard protected' : 'Protect dashboard'}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#6b7280]">Pertanyaan keamanan opsional.</span>
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[#f7f8f2] px-3 py-1 text-[10px] font-bold uppercase text-[#263d27]">
                    {securityFormOpen ? 'Close' : 'Open'}
                  </span>
                </button>
                {securityFormOpen ? (
                  <form onSubmit={saveSecurity} className="mt-3 grid gap-2 border-t border-[#e5e7eb] pt-3">
                    {portal.customer.securityEnabledAt ? (
                      <input value={currentSecurityAnswer} onChange={(event) => setCurrentSecurityAnswer(event.target.value)} placeholder="Current answer" className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-[#263d27]" />
                    ) : null}
                    <input value={securityQuestion} onChange={(event) => setSecurityQuestion(event.target.value)} placeholder="Pertanyaan keamanan" className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-[#263d27]" />
                    <input value={newSecurityAnswer} onChange={(event) => setNewSecurityAnswer(event.target.value)} placeholder="Answer" className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-[#263d27]" />
                    <Button type="submit" className="h-11 rounded-2xl gap-2" disabled={savingSecurity}>
                      {savingSecurity ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Save protection
                    </Button>
                  </form>
                ) : null}
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-bold text-[#0b130c]">Order progress</h2>
                {portal.orders.map((order) => {
                  const activeStep = getActiveStep(order.status);
                  const bespoke = isBespokeOrder(order);
                  const bespokeItem = getBespokeItem(order);
                  return (
                    <article key={order.orderNumber} className="mobile-card overflow-hidden p-0">
                      <div className="border-b border-[#e5e7eb] bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-bold text-[#0b130c]">{order.orderNumber}</h3>
                            <p className="mt-1 text-xs font-semibold text-[#6b7280]">{formatDate(order.createdAt)}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <StatusBadge status={order.status} />
                            <PaymentBadge status={order.paymentStatus} />
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[10px] font-bold uppercase text-[#6b7280]">{bespoke ? 'Custom perfume' : 'Order item'}</div>
                        <div className="text-sm font-bold text-[#0b130c]">{formatTotal(order.subtotal)}</div>
                      </div>
                      <div className="mt-3">
                        <OrderItems order={order} compact />
                      </div>
                      <BespokeDetailPanel item={bespokeItem} compact />
                      <div className="mt-4">
                        <OrderProgressRail activeStep={activeStep} compact />
                      </div>
                      </div>
                    </article>
                  );
                })}
                {!portal.orders.length ? (
                  <div className="mobile-card p-5 text-center">
                    <PackageCheck className="mx-auto h-7 w-7 text-amber-700" />
                    <h3 className="mt-3 font-bold text-[#0b130c]">No orders yet</h3>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">Order baru akan muncul setelah checkout.</p>
                  </div>
                ) : null}
              </section>
            </>
          ) : (
            <section className="mobile-card p-5 text-center">
              {searched ? <Search className="mx-auto h-8 w-8 text-amber-700" /> : <ShoppingBag className="mx-auto h-8 w-8 text-amber-700" />}
              <h2 className="mt-3 text-lg font-bold text-[#0b130c]">{searched ? 'Customer code not found' : 'Dashboard tampil di sini'}</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                {searched ? 'Cek lagi kode SOLI yang dimasukkan.' : 'Masukkan customer code untuk melihat progres order.'}
              </p>
            </section>
          )}
        </main>
      </MobileCommerceLayout>
    );
  }

  return (
    <>
      <Helmet>
        <title>Customer Dashboard - Solivagant</title>
        <meta name="description" content="Check Solivagant order progress with a customer code." />
      </Helmet>
      <main className="min-h-screen bg-[#f7f8f2] text-[#0b130c]">
        <section className="border-b border-[#263d27]/15 bg-[#050705] text-[#eef2e8]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/home" className="inline-flex items-center gap-2 text-sm font-bold text-[#eef2e8]"><ArrowLeft className="h-4 w-4" />Home</Link>
            <Link to="/catalog" className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-[#eef2e8]">Shop</Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
          <div className="space-y-5">
            <div className="rounded-[28px] border border-[#263d27]/10 bg-white/70 p-6 shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#263d27]/15 bg-white px-3 py-1 text-xs font-bold uppercase text-[#263d27]">
                <UserRound className="h-4 w-4" />
                Customer portal
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">Cek order dengan kode unik.</h1>
              <p className="mt-4 text-base font-medium leading-relaxed text-muted-foreground">
                Lihat status payment, proses produksi, pengiriman, dan detail bespoke tanpa perlu akun terpisah.
              </p>
            </div>

            <form onSubmit={loadPortal} className="rounded-2xl border bg-white p-4 shadow-sm">
              <label className="text-xs font-bold uppercase text-muted-foreground">Customer code</label>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={customerCode}
                  onChange={(event) => setCustomerCode(event.target.value.toUpperCase())}
                  placeholder="SOLI09232"
                  className="h-12 rounded-2xl border px-4 text-sm font-bold uppercase tracking-[0.08em] outline-none focus:border-[#263d27]"
                />
                <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Check
                </Button>
              </div>
              <p className="mt-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                Kode ini diberikan setelah checkout pertama. Simpan untuk order berikutnya.
              </p>
            </form>
          </div>

          <div className="space-y-4">
            {portal?.requiresSecurity ? (
              <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-bold uppercase text-[#263d27]">Security check</div>
                    <h2 className="mt-1 text-2xl font-bold">{portal.customer.customerName}</h2>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">
                      Customer ini sudah mengaktifkan pertanyaan keamanan. Jawab dulu untuk membuka dashboard.
                    </p>
                  </div>
                </div>
                <form onSubmit={unlockPortal} className="mt-5 grid gap-3">
                  <div className="rounded-2xl bg-[#f7f8f2] p-4">
                    <div className="text-xs font-bold uppercase text-muted-foreground">Question</div>
                    <div className="mt-1 text-base font-bold">{portal.customer.securityQuestion}</div>
                  </div>
                  <input
                    value={securityAnswer}
                    onChange={(event) => setSecurityAnswer(event.target.value)}
                    placeholder="Your answer"
                    className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]"
                  />
                  <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={securityLoading}>
                    {securityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Unlock dashboard
                  </Button>
                </form>
              </section>
            ) : portal ? (
              <>
                <section className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase text-[#263d27]">Welcome back</div>
                      <h2 className="mt-1 text-2xl font-bold">{portal.customer.customerName}</h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">{portal.customer.contact}</p>
                    </div>
                    <button type="button" onClick={copyCode} className="rounded-2xl bg-[#263d27] px-5 py-4 text-center text-xl font-bold tracking-[0.16em] text-[#eef2e8]">
                      {portal.customer.customerCode}
                    </button>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[#263d27]/10 bg-[#f7f8f2] p-4">
                      <div className="text-xs font-bold uppercase text-muted-foreground">Orders</div>
                      <div className="mt-1 text-2xl font-bold">{portal.orders.length}</div>
                    </div>
                    <div className="rounded-2xl border border-[#263d27]/10 bg-[#eef2e8] p-4">
                      <div className="text-xs font-bold uppercase text-muted-foreground">Active</div>
                      <div className="mt-1 text-2xl font-bold">{activeOrders.length}</div>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                      <div className="text-xs font-bold uppercase text-muted-foreground">Latest</div>
                      <div className="mt-1 text-sm font-bold">{latestOrder ? statusLabels[latestOrder.status] || latestOrder.status : '-'}</div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border bg-white p-4 shadow-sm">
                  <button type="button" onClick={() => setSecurityFormOpen((open) => !open)} className="flex w-full items-center justify-between gap-4 text-left">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
                        <ShieldCheck className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-lg font-bold">{portal.customer.securityEnabledAt ? 'Dashboard protected' : 'Protect dashboard'}</span>
                        <span className="mt-0.5 block text-sm font-semibold text-muted-foreground">Tambahkan pertanyaan keamanan hanya jika diperlukan.</span>
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[#f7f8f2] px-4 py-2 text-xs font-bold uppercase text-[#263d27]">
                      {securityFormOpen ? 'Close' : 'Open'}
                    </span>
                  </button>
                  {securityFormOpen ? (
                    <form onSubmit={saveSecurity} className="mt-4 grid gap-3 border-t pt-4">
                      {portal.customer.securityEnabledAt ? (
                        <input
                          value={currentSecurityAnswer}
                          onChange={(event) => setCurrentSecurityAnswer(event.target.value)}
                          placeholder="Current answer"
                          className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]"
                        />
                      ) : null}
                      <input
                        value={securityQuestion}
                        onChange={(event) => setSecurityQuestion(event.target.value)}
                        placeholder="Contoh: siapa nama hewan peliharaan saya?"
                        className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]"
                      />
                      <input
                        value={newSecurityAnswer}
                        onChange={(event) => setNewSecurityAnswer(event.target.value)}
                        placeholder="Answer"
                        className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]"
                      />
                      <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={savingSecurity}>
                        {savingSecurity ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Save protection
                      </Button>
                    </form>
                  ) : null}
                </section>

                <section className="rounded-2xl border bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-bold">Order progress</h2>
                  <div className="mt-4 grid gap-4">
                    {portal.orders.map((order) => {
                      const activeStep = getActiveStep(order.status);
                      const bespoke = isBespokeOrder(order);
                      const bespokeItem = getBespokeItem(order);
                      return (
                        <article key={order.orderNumber} className="overflow-hidden rounded-[24px] border bg-[#fbfaf7] shadow-sm">
                          <div className="border-b bg-white px-4 py-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-bold">{order.orderNumber}</h3>
                                <StatusBadge status={order.status} />
                                <PaymentBadge status={order.paymentStatus} />
                              </div>
                              <p className="mt-1 text-sm font-semibold text-muted-foreground">{formatDate(order.createdAt)}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold uppercase text-muted-foreground">{order.quantity} items</div>
                              <div className="text-lg font-bold">{formatTotal(order.subtotal)}</div>
                            </div>
                            </div>
                          </div>

                          <div className="p-4">
                            <OrderItems order={order} />
                            {bespoke ? <BespokeDetailPanel item={bespokeItem} /> : null}
                            <div className="mt-5">
                              <OrderProgressRail activeStep={activeStep} />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                    {!portal.orders.length ? (
                      <div className="rounded-2xl border border-dashed bg-[#fbfaf7] p-8 text-center">
                        <PackageCheck className="mx-auto h-8 w-8 text-amber-700" />
                        <h3 className="mt-3 font-bold">No orders yet</h3>
                        <p className="mt-1 text-sm font-medium text-muted-foreground">Order baru akan muncul setelah checkout.</p>
                      </div>
                    ) : null}
                  </div>
                </section>
              </>
            ) : (
              <section className="rounded-2xl border border-dashed bg-white p-8 text-center">
                {searched ? <Search className="mx-auto h-8 w-8 text-amber-700" /> : <ShoppingBag className="mx-auto h-8 w-8 text-amber-700" />}
                <h2 className="mt-3 text-xl font-bold">{searched ? 'Customer code not found' : 'Your dashboard appears here'}</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {searched ? 'Cek lagi kode SOLI yang kamu masukkan.' : 'Masukkan customer code untuk melihat progres order.'}
                </p>
              </section>
            )}
          </div>
        </section>
      </main>
    </>
  );
};

export default CustomerPortalPage;
