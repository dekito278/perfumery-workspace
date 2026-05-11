import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, CreditCard, ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { getOrderById } from '@/services/orderService.js';
import { refreshDokuPaymentStatus } from '@/services/dokuCheckoutService.js';

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const paymentStatusLabels = {
  unpaid: 'Belum dibayar',
  pending: 'Menunggu pembayaran',
  paid: 'Pembayaran diterima',
  failed: 'Pembayaran gagal',
  expired: 'Pembayaran expired',
  refunded: 'Refunded',
};

const paymentStatusTone = {
  unpaid: {
    className: 'border-amber-200 bg-amber-50 text-amber-900',
    title: 'Menunggu pembayaran',
    description: 'Order sudah dibuat. Selesaikan pembayaran sebelum sesi kedaluwarsa.',
  },
  pending: {
    className: 'border-amber-200 bg-amber-50 text-amber-900',
    title: 'Menunggu pembayaran',
    description: 'Order sudah dibuat. Selesaikan pembayaran sebelum sesi kedaluwarsa.',
  },
  paid: {
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    title: 'Pembayaran diterima',
    description: 'Terima kasih. Order siap masuk proses packing setelah admin mengecek fulfillment.',
  },
  expired: {
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    title: 'Sesi pembayaran expired',
    description: 'Gunakan track order untuk cek status terbaru atau ulangi checkout jika perlu.',
  },
  failed: {
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    title: 'Pembayaran belum berhasil',
    description: 'Kamu bisa buka ulang pembayaran atau kembali ke cart untuk mencoba lagi.',
  },
  refunded: {
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    title: 'Pembayaran refunded',
    description: 'Status refund sudah tercatat di order.',
  },
};

const readPaymentSession = () => {
  try {
    const rawSession = sessionStorage.getItem(PAYMENT_SESSION_KEY);
    return rawSession ? JSON.parse(rawSession) : null;
  } catch {
    return null;
  }
};

const PaymentFrame = ({ session, compact = false }) => {
  const [frameStatus, setFrameStatus] = useState('loading');

  useEffect(() => {
    setFrameStatus('loading');
    const timeoutId = window.setTimeout(() => {
      setFrameStatus((current) => (current === 'loading' ? 'failed' : current));
    }, 12000);

    return () => window.clearTimeout(timeoutId);
  }, [session.paymentUrl]);

  const statusCopy = {
    loading: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      title: 'Memuat panel pembayaran',
      description: 'Sebentar ya, Solivagant sedang membuka sesi pembayaran aman.',
      className: 'border-[#263d27]/10 bg-[#eef2e8] text-[#263d27]',
    },
    ready: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      title: 'Panel pembayaran siap',
      description: 'Lanjutkan pembayaran di panel di bawah ini.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
    failed: {
      icon: <AlertCircle className="h-4 w-4" />,
      title: 'Panel pembayaran belum termuat',
      description: 'Browser bisa memblokir iframe pembayaran. Gunakan tombol cadangan untuk membukanya di tab baru.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    },
  }[frameStatus];
  const customerCode = session.customerCode || '';
  const orderTrackingPath = compact ? `/mobile/customer?code=${customerCode}` : `/customer?code=${customerCode}`;
  const currentPaymentTone = paymentStatusTone[session.paymentStatus || 'pending'] || paymentStatusTone.pending;
  const expiresAtLabel = formatDateTime(session.paymentExpiresAt);
  const copyCustomerCode = async () => {
    if (!customerCode) return;
    await navigator.clipboard.writeText(customerCode);
    toast.success(`${customerCode} copied`);
  };

  return (
    <section className={compact ? 'mobile-card overflow-hidden p-0' : 'overflow-hidden rounded-[28px] border border-[#263d27]/15 bg-white shadow-sm'}>
      <div className={compact ? 'border-b border-[#263d27]/10 bg-[#eef2e8] p-4' : 'border-b border-[#263d27]/10 bg-[#eef2e8] p-5'}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f7d61]">Secure checkout</div>
            <h1 className={compact ? 'mt-1 text-xl font-bold text-[#172016]' : 'mt-1 text-3xl font-bold text-[#172016]'}>Pembayaran Solivagant</h1>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-[#54604d]">
              Order tersimpan. Selesaikan pembayaran di panel ini tanpa meninggalkan nuansa Solivagant.
            </p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-[#263d27]">
            <ShieldCheck className="h-5 w-5" />
          </span>
        </div>
        <div className={compact ? 'mt-4 grid gap-2 text-xs font-bold text-[#263d27]' : 'mt-5 grid gap-3 sm:grid-cols-3'}>
          <div className="rounded-2xl bg-white/80 px-4 py-3">
            <div className="text-[10px] uppercase text-[#6f7d61]">Order</div>
            <div className="mt-1 truncate">{session.orderNumber || session.invoiceNumber}</div>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3">
            <div className="text-[10px] uppercase text-[#6f7d61]">Customer</div>
            <div className="mt-1 truncate">{session.customerCode || session.customerName || '-'}</div>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3">
            <div className="text-[10px] uppercase text-[#6f7d61]">Total</div>
            <div className="mt-1">{formatTotal(session.amount)}</div>
          </div>
          {session.paymentStatus ? (
            <div className="rounded-2xl bg-white/80 px-4 py-3">
              <div className="text-[10px] uppercase text-[#6f7d61]">Status</div>
              <div className="mt-1 truncate">{paymentStatusLabels[session.paymentStatus] || session.paymentStatus}</div>
            </div>
          ) : null}
        </div>
        {customerCode ? (
          <div className={compact ? 'mt-4 rounded-2xl border border-[#263d27]/15 bg-white p-4' : 'mt-5 rounded-2xl border border-[#263d27]/15 bg-white p-5'}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f7d61]">Kode customer</div>
                <div className={compact ? 'mt-1 text-2xl font-bold tracking-[0.12em] text-[#263d27]' : 'mt-1 text-3xl font-bold tracking-[0.16em] text-[#263d27]'}>
                  {customerCode}
                </div>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#54604d]">
                  Simpan kode ini untuk cek order dan checkout berikutnya tanpa isi ulang data.
                </p>
              </div>
              <Button type="button" variant="outline" className="shrink-0 rounded-2xl bg-[#f7f8f2] gap-2" onClick={copyCustomerCode}>
                <Copy className="h-4 w-4" />
                Copy kode
              </Button>
            </div>
          </div>
        ) : null}
        <div className={`mt-4 rounded-2xl border px-4 py-3 ${currentPaymentTone.className}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-bold">{currentPaymentTone.title}</div>
              <p className="mt-1 text-xs font-semibold leading-relaxed opacity-85">{currentPaymentTone.description}</p>
              {expiresAtLabel ? <p className="mt-2 text-[11px] font-bold uppercase opacity-80">Batas bayar: {expiresAtLabel}</p> : null}
            </div>
            {customerCode ? (
              <Link to={orderTrackingPath} className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 px-4 text-xs font-bold text-[#263d27]">
                Lacak order
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      <div className="border-b border-[#263d27]/10 bg-white px-4 py-3">
        <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${statusCopy.className}`}>
          <span className="mt-0.5 shrink-0">{statusCopy.icon}</span>
          <div>
            <div className="text-xs font-bold">{statusCopy.title}</div>
            <p className="mt-1 text-xs font-semibold leading-relaxed opacity-80">{statusCopy.description}</p>
          </div>
        </div>
      </div>
      <div className={compact ? 'h-[68dvh] bg-white' : 'h-[74dvh] bg-white'}>
        <iframe
          src={session.paymentUrl}
          title="Panel pembayaran"
          className="h-full w-full border-0"
          allow="payment *; clipboard-write"
          sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
          onLoad={() => setFrameStatus('ready')}
          onError={() => setFrameStatus('failed')}
        />
      </div>
      <div className={compact ? 'grid gap-2 border-t border-[#263d27]/10 bg-[#fbfaf7] p-3' : 'flex flex-wrap items-center justify-between gap-3 border-t border-[#263d27]/10 bg-[#fbfaf7] p-4'}>
        <p className="text-xs font-semibold leading-relaxed text-[#6b7280]">
          Kalau panel pembayaran tidak termuat oleh browser, gunakan tombol cadangan ini.
        </p>
        <div className="flex flex-wrap gap-2">
          {customerCode ? (
            <Link to={orderTrackingPath} className="inline-flex h-10 items-center rounded-2xl border bg-white px-4 text-sm font-bold text-[#263d27]">
              Lacak order
            </Link>
          ) : null}
          <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => window.open(session.paymentUrl, '_blank', 'noopener,noreferrer')}>
            <ExternalLink className="h-4 w-4" />
            Buka pembayaran
          </Button>
        </div>
      </div>
    </section>
  );
};

const EmptyPaymentState = ({ isMobile, orderNumber, loading = false, onRefresh }) => (
  <section className={isMobile ? 'mobile-card p-5 text-center' : 'mx-auto max-w-xl rounded-[28px] border bg-white p-8 text-center shadow-sm'}>
    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : orderNumber ? <CheckCircle2 className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
    </span>
    <h1 className={isMobile ? 'mt-4 text-xl font-bold text-[#172016]' : 'mt-4 text-3xl font-bold text-[#172016]'}>
      {orderNumber ? 'Pembayaran sedang diproses' : 'Belum ada sesi pembayaran'}
    </h1>
    <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">
      {orderNumber
        ? `Order ${orderNumber} sudah kembali ke Solivagant. Status final akan mengikuti notifikasi pembayaran.`
        : 'Mulai dari cart agar Solivagant bisa membuat order dan membuka panel pembayaran.'}
    </p>
    <div className="mt-5 flex justify-center gap-2">
      <Link to={isMobile ? '/mobile/catalog' : '/catalog'} className="inline-flex h-11 items-center rounded-2xl bg-[#263d27] px-5 text-sm font-bold text-[#eef2e8]">
        Buka katalog
      </Link>
      <Link to={isMobile ? '/mobile/customer' : '/customer'} className="inline-flex h-11 items-center rounded-2xl border bg-white px-5 text-sm font-bold text-[#263d27]">
        Lacak order
      </Link>
      {orderNumber && onRefresh ? (
        <button type="button" onClick={onRefresh} className="inline-flex h-11 items-center gap-2 rounded-2xl border bg-white px-5 text-sm font-bold text-[#263d27]">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      ) : null}
    </div>
  </section>
);

const PaymentPageContent = ({ isMobile }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const orderNumber = searchParams.get('order');
  const paymentReturn = searchParams.get('payment');

  const loadPaymentSession = async ({ syncStatus = false } = {}) => {
    const storedSession = readPaymentSession();
    if (syncStatus && orderNumber) {
      setRefreshingStatus(true);
      try {
        await refreshDokuPaymentStatus(orderNumber);
      } catch (error) {
        console.warn('Failed to refresh DOKU payment status:', error.message || error);
      } finally {
        setRefreshingStatus(false);
      }
    }

    if (storedSession?.paymentUrl && (!orderNumber || storedSession.orderNumber === orderNumber || storedSession.invoiceNumber === orderNumber)) {
      if (!orderNumber) {
        setSession(storedSession);
        return;
      }
    }

    if (!orderNumber) {
      setSession(storedSession);
      return;
    }

    setLoadingOrder(true);
    try {
      const order = await getOrderById(orderNumber);
      if (order?.paymentUrl) {
        const restoredSession = {
          paymentUrl: order.paymentUrl,
          invoiceNumber: order.orderNumber,
          orderNumber: order.orderNumber,
          customerCode: order.customerCode,
          amount: order.subtotal,
          customerName: order.customerName,
          paymentStatus: order.paymentStatus,
          paymentExpiresAt: order.paymentExpiresAt,
          paymentSessionId: order.paymentSessionId,
          createdAt: order.createdAt,
        };
        sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(restoredSession));
        setSession(restoredSession);
        return;
      }

      setSession(storedSession);
    } finally {
      setLoadingOrder(false);
    }
  };

  useEffect(() => {
    loadPaymentSession({ syncStatus: paymentReturn === 'doku' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber, paymentReturn]);

  const refreshPaymentSession = () => loadPaymentSession({ syncStatus: Boolean(orderNumber) });

  if (isMobile) {
    return (
      <MobileCommerceLayout>
        <Helmet>
          <title>Payment - Solivagant</title>
        </Helmet>
        <main className="mobile-page space-y-4">
          <MobileTopBar
            title="Pembayaran"
            subtitle={session?.orderNumber || orderNumber || 'Solivagant checkout'}
            eyebrow="Secure"
            onBack={() => navigate('/mobile/cart')}
            action={<CreditCard className="h-5 w-5 text-amber-700" />}
          />
          {session?.paymentUrl ? <PaymentFrame session={session} compact /> : <EmptyPaymentState isMobile orderNumber={orderNumber} loading={loadingOrder || refreshingStatus} onRefresh={refreshPaymentSession} />}
        </main>
      </MobileCommerceLayout>
    );
  }

  return (
    <>
      <Helmet>
        <title>Payment - Solivagant</title>
      </Helmet>
      <main className="min-h-screen bg-[#f7f8f2] text-[#0b130c]">
        <section className="border-b border-[#263d27]/15 bg-[#050705] text-[#eef2e8]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <button type="button" onClick={() => navigate('/cart')} className="inline-flex items-center gap-2 text-sm font-bold text-[#eef2e8]">
              <ArrowLeft className="h-4 w-4" />
              Keranjang
            </button>
            <Link to="/home" className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-[#eef2e8]">Beranda</Link>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {session?.paymentUrl ? <PaymentFrame session={session} /> : <EmptyPaymentState orderNumber={orderNumber} loading={loadingOrder || refreshingStatus} onRefresh={refreshPaymentSession} />}
        </section>
      </main>
    </>
  );
};

const PaymentPage = () => {
  const location = useLocation();
  const isMobile = useMemo(() => location.pathname.startsWith('/mobile'), [location.pathname]);

  return <PaymentPageContent isMobile={isMobile} />;
};

export default PaymentPage;
