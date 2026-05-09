import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CreditCard, ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { getOrderById } from '@/services/orderService.js';

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const paymentStatusLabels = {
  unpaid: 'Belum dibayar',
  pending: 'Menunggu pembayaran',
  paid: 'Pembayaran diterima',
  failed: 'Pembayaran gagal',
  expired: 'Pembayaran expired',
  refunded: 'Refunded',
};

const readPaymentSession = () => {
  try {
    const rawSession = sessionStorage.getItem(PAYMENT_SESSION_KEY);
    return rawSession ? JSON.parse(rawSession) : null;
  } catch {
    return null;
  }
};

const PaymentFrame = ({ session, compact = false }) => (
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
    </div>
    <div className={compact ? 'h-[68dvh] bg-white' : 'h-[74dvh] bg-white'}>
      <iframe
        src={session.paymentUrl}
        title="Panel pembayaran"
        className="h-full w-full border-0"
        allow="payment *; clipboard-write"
        sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
      />
    </div>
    <div className={compact ? 'grid gap-2 border-t border-[#263d27]/10 bg-[#fbfaf7] p-3' : 'flex flex-wrap items-center justify-between gap-3 border-t border-[#263d27]/10 bg-[#fbfaf7] p-4'}>
      <p className="text-xs font-semibold leading-relaxed text-[#6b7280]">
        Kalau panel pembayaran tidak termuat oleh browser, gunakan tombol cadangan ini.
      </p>
      <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => window.open(session.paymentUrl, '_blank', 'noopener,noreferrer')}>
        <ExternalLink className="h-4 w-4" />
        Buka pembayaran
      </Button>
    </div>
  </section>
);

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
        Open catalog
      </Link>
      <Link to={isMobile ? '/mobile/customer' : '/customer'} className="inline-flex h-11 items-center rounded-2xl border bg-white px-5 text-sm font-bold text-[#263d27]">
        Track order
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
  const orderNumber = searchParams.get('order');

  const loadPaymentSession = async () => {
    const storedSession = readPaymentSession();
    if (storedSession?.paymentUrl && (!orderNumber || storedSession.orderNumber === orderNumber || storedSession.invoiceNumber === orderNumber)) {
      setSession(storedSession);
      return;
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
    loadPaymentSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);

  if (isMobile) {
    return (
      <MobileCommerceLayout>
        <Helmet>
          <title>Payment - Solivagant</title>
        </Helmet>
        <main className="mobile-page space-y-4">
          <MobileTopBar
            title="Payment"
            subtitle={session?.orderNumber || orderNumber || 'Solivagant checkout'}
            eyebrow="Secure"
            onBack={() => navigate('/mobile/cart')}
            action={<CreditCard className="h-5 w-5 text-amber-700" />}
          />
          {session?.paymentUrl ? <PaymentFrame session={session} compact /> : <EmptyPaymentState isMobile orderNumber={orderNumber} loading={loadingOrder} onRefresh={loadPaymentSession} />}
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
              Cart
            </button>
            <Link to="/home" className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-[#eef2e8]">Home</Link>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {session?.paymentUrl ? <PaymentFrame session={session} /> : <EmptyPaymentState orderNumber={orderNumber} loading={loadingOrder} onRefresh={loadPaymentSession} />}
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
