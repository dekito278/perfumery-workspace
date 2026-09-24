import { useTranslate } from '@/hooks/useTranslate.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, Copy, CreditCard, ExternalLink, FileCheck2, Loader2, MessageCircle, QrCode, RefreshCw, ShieldCheck, Smartphone, Upload } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { Button } from '@/components/ui/button.jsx';
import { PAYMENT_RESERVATION_TTL_HOURS, getOrderById, getPublicOrderPaymentSession, isOrderClosedForPayment, submitOrderPaymentProof } from '@/services/orderService.js';
import { paymentDeadlineAt } from '@/utils/paymentDeadline.js';
import AskAtelierButton from '@/components/storefront/AskAtelierButton.jsx';
import { createDokuCheckout, refreshDokuPaymentStatus } from '@/services/dokuCheckoutService.js';
import { isManualTransferPayment, MANUAL_TRANSFER_PAYMENT, getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import { uploadPaymentProof } from '@/services/paymentProofStorageService.js';
import { copyTextToClipboard } from '@/utils/clipboard.js';
import {
  getOrderProductsSubtotal,
  getOrderShippingFee,
  getOrderShippingPromotionLabel,
  getOrderShippingSummary,
  getOrderSubtotalAfterVoucher,
  getOrderVoucherSnapshot,
} from '@/utils/orderTotals.js';

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

// What this buyer is actually asked to send.
//
// An international order is paid in dollars into a USD account, so every place this screen names an
// amount — the header, the instruction, the sticky bar, the success panel — has to name the dollars.
// Printing the rupiah beside a USD account number is how someone transfers the wrong number.
//
// The dollar figure rides on the order itself (payment_response.amountUsd), not on a rate read at page
// load: the buyer must see the same figure tomorrow as the day the order was written, whatever the
// market did overnight.
const payableAmount = (session) => {
  const usd = Number(session?.amountUsd || 0);
  return usd > 0 ? `US$${Math.round(usd)}` : formatTotal(session?.amount);
};
const formatDateTime = (value, t) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(t('fmt.dateLocale'), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

// Keys, not sentences. These are module-level constants, evaluated before any component exists, so they
// cannot call t(). They hold keys and the components translate them — which is also what lets one order's
// status read in whichever shop the buyer chose.
const paymentStatusKeys = {
  unpaid: 'pay.unpaid',
  pending: 'pay.awaiting',
  paid: 'pay.received',
  failed: 'pay.failed',
  expired: 'pay.linkExpired',
  refunded: 'pay.refunded',
};

const paymentStatusTone = {
  unpaid: {
    className: 'border-amber-200 bg-amber-50 text-amber-900',
    titleKey: 'pay.awaiting',
    bodyKey: 'pay.createdBody',
  },
  pending: {
    className: 'border-amber-200 bg-amber-50 text-amber-900',
    titleKey: 'pay.awaiting',
    bodyKey: 'pay.createdBody',
  },
  paid: {
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    titleKey: 'pay.received',
    bodyKey: 'pay.paidBody',
  },
  expired: {
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    titleKey: 'pay.expiredTitle',
    bodyKey: 'pay.expiredBody',
  },
  failed: {
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    titleKey: 'pay.failedTitle',
    bodyKey: 'pay.failedBody',
  },
  refunded: {
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    titleKey: 'pay.refundTitle',
    bodyKey: 'pay.refundBody',
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

const buildManualTransferFromOrder = (order) => ({
  paymentType: order.paymentProvider || MANUAL_TRANSFER_PAYMENT.provider,
  paymentProvider: order.paymentProvider || MANUAL_TRANSFER_PAYMENT.provider,
  invoiceNumber: order.orderNumber,
  orderNumber: order.orderNumber,
  customerCode: order.customerCode,
  amount: order.subtotal,
  amountUsd: Number(order.paymentResponse?.amountUsd || 0),
  customerName: order.customerName,
  paymentStatus: order.paymentStatus,
  paymentReference: order.paymentReference,
  paymentProofUrl: order.paymentProofUrl,
  paymentProofFileName: order.paymentProofFileName,
  paymentProofContentType: order.paymentProofContentType,
  paymentProofUploadedAt: order.paymentProofUploadedAt,
  paymentProofStatus: order.paymentProofStatus,
  paymentProofNotes: order.paymentProofNotes,
  voucherSnapshot: getOrderVoucherSnapshot(order),
  shippingSummary: getOrderShippingSummary(order),
  shippingFee: getOrderShippingFee(order),
  paymentExpiresAt: order.paymentExpiresAt || '',
  inventoryDeducted: Boolean(order.inventoryDeducted),
  status: order.status,
  manualTransfer: {
    bankName: order.paymentResponse?.bankName || MANUAL_TRANSFER_PAYMENT.bankName,
    accountNumber: order.paymentResponse?.accountNumber || MANUAL_TRANSFER_PAYMENT.accountNumber,
    accountName: order.paymentResponse?.accountName || MANUAL_TRANSFER_PAYMENT.accountName,
    swift: order.paymentResponse?.swift || '',
    amount: order.subtotal,
  },
  createdAt: order.createdAt,
});

const buildDokuSessionFromCheckout = (order, checkout) => ({
  paymentType: 'doku',
  paymentProvider: 'doku',
  paymentUrl: checkout.paymentUrl,
  invoiceNumber: checkout.invoiceNumber || order.orderNumber,
  orderNumber: order.orderNumber,
  customerCode: order.customerCode,
  amount: order.subtotal,
  customerName: order.customerName,
  paymentStatus: 'pending',
  paymentExpiresAt: checkout.paymentExpiresAt || '',
  paymentSessionId: checkout.paymentSessionId || '',
  inventoryDeducted: Boolean(order.inventoryDeducted),
  status: order.status,
  paymentProofUrl: order.paymentProofUrl,
  paymentProofFileName: order.paymentProofFileName,
  paymentProofContentType: order.paymentProofContentType,
  paymentProofUploadedAt: order.paymentProofUploadedAt,
  paymentProofStatus: order.paymentProofStatus,
  paymentProofNotes: order.paymentProofNotes,
  voucherSnapshot: getOrderVoucherSnapshot(order),
  shippingSummary: getOrderShippingSummary(order),
  shippingFee: getOrderShippingFee(order),
  createdAt: order.createdAt || new Date().toISOString(),
});

const PaymentTotalBreakdown = ({ session, compact = false }) => {
  const { t } = useTranslate();
  const voucherSnapshot = getOrderVoucherSnapshot(session);
  const shippingFee = Number(session.shippingFee || 0);
  const shippingSummary = getOrderShippingSummary(session);
  const shippingPromotionLabel = getOrderShippingPromotionLabel(session);
  const shouldShowShipping = Boolean(shippingFee || shippingSummary);
  if (!voucherSnapshot && !shouldShowShipping) return null;

  const subtotalAfterVoucher = getOrderSubtotalAfterVoucher(session);
  const fallbackProductsSubtotal = Math.max(Number(session.amount || 0) - shippingFee, 0);
  const productsSubtotal = getOrderProductsSubtotal(session) || fallbackProductsSubtotal;
  const displayedSubtotalAfterVoucher = subtotalAfterVoucher || fallbackProductsSubtotal;

  return (
    <div className={`mt-4 rounded-2xl border border-editorial-stone/10 bg-white/80 ${compact ? 'p-3 text-xs' : 'p-4 text-sm'} font-bold text-editorial-charcoal`}>
      <div className="flex justify-between gap-3">
        <span>{t("pay.subtotalProducts")}</span>
        <span>{formatTotal(productsSubtotal)}</span>
      </div>
      {voucherSnapshot ? (
        <>
          <div className="mt-2 flex justify-between gap-3">
            <span>Voucher {voucherSnapshot.code}</span>
            <span>-{formatTotal(voucherSnapshot.discountAmount)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3 text-[#6b7280]">
            <span>{t("pay.subtotalAfterVoucher")}</span>
            <span>{formatTotal(displayedSubtotalAfterVoucher)}</span>
          </div>
        </>
      ) : null}
      {shouldShowShipping ? (
        <div className="mt-2 flex justify-between gap-3 text-[#6b7280]">
          <span>{shippingPromotionLabel ? t("pay.shippingAfterPromo") : t("pay.shipping")}</span>
          <span>{formatTotal(shippingFee)}</span>
        </div>
      ) : null}
      {shippingPromotionLabel ? <p className="mt-1 text-[11px] font-bold text-emerald-700">{shippingPromotionLabel}</p> : null}
      <div className="mt-3 flex justify-between gap-3 border-t border-editorial-stone/10 pt-3 text-editorial-charcoal">
        <span>{t("pay.totalDue")}</span>
        <span className="text-right">
          {payableAmount(session)}
          {/* The rupiah stays visible under a dollar total — it is what the shop books, and a buyer
              comparing it to the product page should find the same pair of numbers there. */}
          {Number(session.amountUsd || 0) > 0
            ? <span className="ml-2 font-semibold text-[#6b7280]">{formatTotal(session.amount)}</span>
            : null}
        </span>
      </div>
    </div>
  );
};

// Shared success state. A paid order must never be shown a live payment panel again — the DOKU return
// URL lands back here with the order already paid, and the iframe invited a second payment for the same
// invoice (audit round 7).
const PaymentSuccessPanel = ({ compact = false, orderNumber, customerCode, method }) => {
  const { t } = useTranslate();
  return (
  <section className={compact ? 'mobile-card overflow-hidden p-0' : 'overflow-hidden rounded-[28px] border border-editorial-stone/15 bg-white shadow-sm'}>
    <div className="p-6 text-center sm:p-10">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <h1 className={compact ? 'mt-4 text-xl font-bold text-[#172016]' : 'mt-4 text-3xl font-bold text-[#172016]'}>{t("pay.received")}</h1>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-[#54604d]">
        {t('pay.thanks', { method: method ? ` ${method}` : '', order: orderNumber })}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        {customerCode ? (
          <Link to={compact ? `/mobile/customer?code=${customerCode}` : `/customer?code=${customerCode}`} className="inline-flex h-11 items-center rounded-2xl bg-editorial-charcoal px-5 text-sm font-bold text-editorial-paper">
            {t('track.title')}
          </Link>
        ) : null}
        <Link to={compact ? '/mobile/catalog' : '/catalog'} className="inline-flex h-11 items-center rounded-2xl border bg-white px-5 text-sm font-bold text-editorial-charcoal">
          {t('pay.shopAgain')}
        </Link>
      </div>
    </div>
  </section>
);
};

const PaymentFrame = ({ session, compact = false }) => {
  const { t } = useTranslate();
  const [frameStatus, setFrameStatus] = useState('loading');

  useEffect(() => {
    setFrameStatus('loading');
    // 12 seconds was declaring the panel blocked while it was still loading. Measured on a real
    // checkout: DOKU's page took about 20 to appear, so the shop told the buyer it was broken eight
    // seconds before it worked. A genuinely blocked iframe never fires onLoad at all, so this only has
    // to outlast a slow load — it does not have to be tight.
    const timeoutId = window.setTimeout(() => {
      setFrameStatus((current) => (current === 'loading' ? 'failed' : current));
    }, 30000);

    return () => window.clearTimeout(timeoutId);
  }, [session.paymentUrl]);

  // After the hooks, so the panel can flip to paid without changing hook order.
  if (session.paymentStatus === 'paid') {
    return (
      <PaymentSuccessPanel
        compact={compact}
        orderNumber={session.orderNumber || session.invoiceNumber}
        customerCode={session.customerCode || ''}
      />
    );
  }

  // titleKey/bodyKey, the same shape paymentStatusTone above uses and the same shape the JSX below
  // reads. It used to hold already-translated strings under `title`/`description` while the JSX asked
  // for `titleKey`/`bodyKey`, so every read was t(undefined) — which returns undefined, which React
  // renders as nothing. The banner above the payment panel was a coloured box with an icon and NO
  // WORDS, in both languages, for as long as the panel took to load. The line that matters most is the
  // blocked one: a buyer whose browser refuses the iframe was shown an amber box that never told them
  // the fallback button below it exists.
  const statusCopy = {
    loading: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      titleKey: 'pay.loadingPanel',
      bodyKey: 'pay.loadingPanelBody',
      className: 'border-editorial-stone/10 bg-editorial-ivory text-editorial-charcoal',
    },
    ready: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      titleKey: 'pay.panelReady',
      bodyKey: 'pay.panelReadyBody',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
    failed: {
      icon: <AlertCircle className="h-4 w-4" />,
      titleKey: 'pay.panelBlocked',
      bodyKey: 'pay.panelBlockedBody',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    },
  }[frameStatus];
  const customerCode = session.customerCode || '';
  const orderTrackingPath = compact ? `/mobile/customer?code=${customerCode}` : `/customer?code=${customerCode}`;
  const currentPaymentTone = paymentStatusTone[session.paymentStatus || 'pending'] || paymentStatusTone.pending;
  // Not session.paymentExpiresAt: manual transfer never has one, and it is the path where somebody is
  // about to move money into a reservation that expires.
  const expiresAtLabel = formatDateTime(paymentDeadlineAt(session, PAYMENT_RESERVATION_TTL_HOURS), t);
  const copyCustomerCode = async () => {
    if (!customerCode) return;
    const copied = await copyTextToClipboard(customerCode);
    copied ? toast.success(t("pay.copied", { label: customerCode })) : toast.error(t("pay.copyFailed"));
  };

  return (
    <section className={compact ? 'mobile-card overflow-hidden p-0' : 'overflow-hidden rounded-[28px] border border-editorial-stone/15 bg-white shadow-sm'}>
      <div className={compact ? 'border-b border-editorial-stone/10 bg-editorial-ivory p-4' : 'border-b border-editorial-stone/10 bg-editorial-ivory p-5'}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-editorial-muted">{t("pay.secureCheckout")}</div>
            <h1 className={compact ? 'mt-1 text-xl font-bold text-[#172016]' : 'mt-1 text-3xl font-bold text-[#172016]'}>{t("pay.solivagantPayment")}</h1>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-[#54604d]">
              {t('pay.savedBody')}
            </p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-editorial-charcoal">
            <ShieldCheck className="h-5 w-5" />
          </span>
        </div>
        <div className={compact ? 'mt-4 grid gap-2 text-xs font-bold text-editorial-charcoal' : 'mt-5 grid gap-3 sm:grid-cols-3'}>
          <div className="rounded-2xl bg-white/80 px-4 py-3">
            <div className="text-[10px] uppercase text-editorial-muted">{t('pay.order')}</div>
            <div className="mt-1 truncate">{session.orderNumber || session.invoiceNumber}</div>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3">
            <div className="text-[10px] uppercase text-editorial-muted">{t('pay.customer')}</div>
            <div className="mt-1 truncate">{session.customerCode || session.customerName || '-'}</div>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3">
            <div className="text-[10px] uppercase text-editorial-muted">Total</div>
            <div className="mt-1">{payableAmount(session)}</div>
          </div>
          {session.paymentStatus ? (
            <div className="rounded-2xl bg-white/80 px-4 py-3">
              <div className="text-[10px] uppercase text-editorial-muted">{t('pay.status')}</div>
              <div className="mt-1 truncate">{paymentStatusKeys[session.paymentStatus] ? t(paymentStatusKeys[session.paymentStatus]) : session.paymentStatus}</div>
            </div>
          ) : null}
        </div>
        <PaymentTotalBreakdown session={session} compact={compact} />
        <div className={`mt-4 rounded-2xl border px-4 py-3 ${currentPaymentTone.className}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-bold">{t(currentPaymentTone.titleKey)}</div>
              <p className="mt-1 text-xs font-semibold leading-relaxed opacity-85">{t(currentPaymentTone.bodyKey)}</p>
              {expiresAtLabel ? (
                <>
                  <p className="mt-2 text-[11px] font-bold uppercase opacity-80">{t('pay.deadline', { time: expiresAtLabel })}</p>
                  <p className="mt-1 text-[11px] font-semibold leading-relaxed opacity-80">{t('pay.deadlineNote')}</p>
                </>
              ) : null}
            </div>
            {customerCode ? (
              <Link to={orderTrackingPath} className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 px-4 text-xs font-bold text-editorial-charcoal">
                {t('track.title')}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      <div className="border-b border-editorial-stone/10 bg-white px-4 py-3">
        <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${statusCopy.className}`}>
          <span className="mt-0.5 shrink-0">{statusCopy.icon}</span>
          <div>
            <div className="text-xs font-bold">{t(statusCopy.titleKey)}</div>
            <p className="mt-1 text-xs font-semibold leading-relaxed opacity-80">{t(statusCopy.bodyKey)}</p>
          </div>
        </div>
      </div>
      <div className={compact ? 'h-[68dvh] bg-white' : 'h-[74dvh] bg-white'}>
        <iframe
          src={session.paymentUrl}
          title={t("pay.panel")}
          className="h-full w-full border-0"
          allow="payment *; clipboard-write"
          sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
          onLoad={() => setFrameStatus('ready')}
          onError={() => setFrameStatus('failed')}
        />
      </div>
      {customerCode ? (
        <div className="flex items-center justify-between gap-3 border-t border-editorial-stone/10 bg-white px-4 py-3">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-editorial-muted">{t("pay.customerCode")}</span>
            <div className="select-text text-lg font-bold tracking-[0.12em] text-editorial-charcoal">{customerCode}</div>
            <p className="text-[11px] font-semibold text-[#54604d]">{t("pay.saveCode")}</p>
          </div>
          <Button type="button" variant="outline" className="shrink-0 rounded-2xl bg-editorial-ivory gap-2" onClick={copyCustomerCode}>
            <Copy className="h-4 w-4" />
            {t('pay.copy')}
          </Button>
        </div>
      ) : null}
      <div className={compact ? 'grid gap-2 border-t border-editorial-stone/10 bg-[#fbfaf7] p-3' : 'flex flex-wrap items-center justify-between gap-3 border-t border-editorial-stone/10 bg-[#fbfaf7] p-4'}>
        <p className="text-xs font-semibold leading-relaxed text-[#6b7280]">
          {t('pay.fallbackHint')}
        </p>
        <div className="flex flex-wrap gap-2">
          {customerCode ? (
            <Link to={orderTrackingPath} className="inline-flex h-10 items-center rounded-2xl border bg-white px-4 text-sm font-bold text-editorial-charcoal">
              {t('track.title')}
            </Link>
          ) : null}
          <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => window.open(session.paymentUrl, '_blank', 'noopener,noreferrer')}>
            <ExternalLink className="h-4 w-4" />
            {t('pay.openPayment')}
          </Button>
        </div>
      </div>
    </section>
  );
};

const EWALLET_HINTS = ['GoPay', 'OVO', 'DANA', 'ShopeePay', 'LinkAja', 'm-banking'];

// Native QRIS — renders the DOKU QR string in our own UI (no DOKU hosted page). Payment is confirmed
// by the DOKU notification webhook flipping the order to paid; we poll the public order for that.
const QrisPanel = ({ session, compact = false, onPaid }) => {
  const { t } = useTranslate();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [remainingMs, setRemainingMs] = useState(() => {
    const exp = session.paymentExpiresAt ? new Date(session.paymentExpiresAt).getTime() : 0;
    return exp ? Math.max(exp - Date.now(), 0) : 0;
  });
  const [paid, setPaid] = useState(session.paymentStatus === 'paid');
  const customerCode = session.customerCode || '';
  const orderNumber = session.orderNumber || session.invoiceNumber;

  useEffect(() => {
    let alive = true;
    if (!session.qrContent) { setQrDataUrl(''); return undefined; }
    QRCode.toDataURL(session.qrContent, { margin: 1, width: 360, errorCorrectionLevel: 'M' })
      .then((url) => { if (alive) setQrDataUrl(url); })
      .catch(() => { if (alive) setQrDataUrl(''); });
    return () => { alive = false; };
  }, [session.qrContent]);

  useEffect(() => {
    if (!session.paymentExpiresAt) return undefined;
    const exp = new Date(session.paymentExpiresAt).getTime();
    const tick = () => setRemainingMs(Math.max(exp - Date.now(), 0));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [session.paymentExpiresAt]);

  useEffect(() => {
    if (paid || !orderNumber) return undefined;
    let alive = true;
    const check = async () => {
      try {
        const order = await getPublicOrderPaymentSession(orderNumber);
        if (alive && order?.paymentStatus === 'paid') {
          setPaid(true);
          onPaid?.(order);
        }
      } catch { /* keep polling quietly */ }
    };
    const id = window.setInterval(check, 5000);
    return () => { alive = false; window.clearInterval(id); };
  }, [orderNumber, paid, onPaid]);

  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  const expired = Boolean(session.paymentExpiresAt) && remainingMs <= 0;
  const pad = (n) => String(n).padStart(2, '0');

  const copyCustomerCode = async () => {
    if (!customerCode) return;
    const copied = await copyTextToClipboard(customerCode);
    copied ? toast.success(t("pay.copied", { label: customerCode })) : toast.error(t("pay.copyFailed"));
  };

  if (paid) {
    return <PaymentSuccessPanel compact={compact} orderNumber={orderNumber} customerCode={customerCode} method="QRIS" />;
  }

  return (
    <section className={compact ? 'mobile-card overflow-hidden p-0' : 'overflow-hidden rounded-[28px] border border-editorial-stone/15 bg-white shadow-sm'}>
      <div className={compact ? 'border-b border-editorial-stone/10 bg-editorial-ivory p-4' : 'border-b border-editorial-stone/10 bg-editorial-ivory p-5'}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-editorial-muted">{t("pay.qris")}</div>
            <h1 className={compact ? 'mt-1 text-xl font-bold text-[#172016]' : 'mt-1 text-3xl font-bold text-[#172016]'}>{t("pay.solivagantPayment")}</h1>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-[#54604d]">
              {t('pay.qrHint')}
            </p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-editorial-charcoal">
            <QrCode className="h-5 w-5" />
          </span>
        </div>
        <div className={compact ? 'mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-editorial-charcoal' : 'mt-5 grid gap-3 sm:grid-cols-3'}>
          <div className="rounded-2xl bg-white/80 px-4 py-3">
            <div className="text-[10px] uppercase text-editorial-muted">{t('pay.order')}</div>
            <div className="mt-1 truncate">{orderNumber}</div>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3">
            <div className="text-[10px] uppercase text-editorial-muted">{t('pay.customer')}</div>
            <div className="mt-1 truncate">{customerCode || session.customerName || '-'}</div>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-3">
            <div className="text-[10px] uppercase text-editorial-muted">Total</div>
            <div className="mt-1">{payableAmount(session)}</div>
          </div>
        </div>
        <PaymentTotalBreakdown session={session} compact={compact} />
      </div>

      <div className="grid gap-4 p-4 sm:p-6">
        {session.paymentExpiresAt ? (
          <div className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold ${expired ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            <Clock3 className="h-4 w-4" />
            {expired ? t("pay.qrExpired") : t("pay.finishIn", { time: `${pad(mins)}:${pad(secs)}` })}
          </div>
        ) : null}

        <div className="mx-auto w-full max-w-[360px] rounded-[24px] border border-editorial-stone/15 bg-white p-4 text-center shadow-sm">
          <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-editorial-muted">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-[#c0392b] text-[9px] font-bold text-white">Q</span>
            {t('pay.qrisOne')}
          </div>
          <div className="mt-3 grid aspect-square w-full place-items-center rounded-2xl bg-white">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={t("pay.qrisCode")} className="h-full w-full rounded-xl object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-editorial-muted">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-xs font-semibold">{t("pay.preparingQr")}</span>
              </div>
            )}
          </div>
          <div className="mt-3 text-[10px] font-bold uppercase text-editorial-muted">{t("pay.totalDue")}</div>
          <div className="text-2xl font-bold text-[#c0392b]">{payableAmount(session)}</div>
        </div>

        <div className="mx-auto flex max-w-[360px] flex-wrap items-center justify-center gap-1.5">
          {EWALLET_HINTS.map((name) => (
            <span key={name} className="rounded-full border border-editorial-stone/15 bg-editorial-ivory px-2.5 py-1 text-[11px] font-bold text-editorial-charcoal">{name}</span>
          ))}
        </div>

        <div className="mx-auto flex max-w-[360px] items-start gap-2 rounded-2xl border border-editorial-stone/10 bg-[#fbfaf7] px-4 py-3 text-xs font-semibold leading-relaxed text-[#54604d]">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-editorial-charcoal" />
          {t('pay.qrSteps')}
        </div>

        <div className="mx-auto flex max-w-[360px] items-center justify-center gap-2 text-xs font-bold text-editorial-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('pay.awaitingEllipsis')}
        </div>

        {customerCode ? (
          <div className="mx-auto flex w-full max-w-[360px] items-center justify-between gap-3 rounded-2xl border border-editorial-stone/10 bg-white px-4 py-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-editorial-muted">{t("pay.customerCode")}</span>
              <div className="select-text text-lg font-bold tracking-[0.12em] text-editorial-charcoal">{customerCode}</div>
            </div>
            <Button type="button" variant="outline" className="shrink-0 rounded-2xl bg-editorial-ivory gap-2" onClick={copyCustomerCode}>
              <Copy className="h-4 w-4" />
              {t('pay.copy')}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
};

const ManualTransferPanel = ({ session, compact = false, onProofSubmitted }) => {
  const { t } = useTranslate();
  const [proofFile, setProofFile] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const customerCode = session.customerCode || '';
  const orderTrackingPath = compact ? `/mobile/customer?code=${customerCode}` : `/customer?code=${customerCode}`;
  const orderNumber = session.orderNumber || session.invoiceNumber;
  // One source for the number, the same one the footer reads. Rendered only when configured.
  const whatsappNumber = getStorefrontWhatsAppNumber();
  // Cancelled, expired, failed or refunded: the same helper the rest of the app uses, including the
  // admin side, which refuses to approve a proof for one of these. Until now this screen ignored it and
  // went on handing out the bank account.
  const closedForPayment = isOrderClosedForPayment(session);
  const proofStatus = session.paymentProofStatus || 'missing';
  const hasSubmittedProof = Boolean(session.paymentProofUrl) && ['submitted', 'approved'].includes(proofStatus);
  const needsProofUpload = !hasSubmittedProof;
  const transfer = {
    bankName: session.manualTransfer?.bankName || MANUAL_TRANSFER_PAYMENT.bankName,
    accountNumber: session.manualTransfer?.accountNumber || MANUAL_TRANSFER_PAYMENT.accountNumber,
    accountName: session.manualTransfer?.accountName || MANUAL_TRANSFER_PAYMENT.accountName,
    // Only an international order carries these, and both are useless on a domestic one: a SWIFT code
    // means nothing for a BCA transfer, and the "OUR" charge option does not exist there either.
    swift: session.manualTransfer?.swift || '',
  };

  const copyValue = async (label, value) => {
    if (!value) return;
    const copied = await copyTextToClipboard(String(value));
    copied ? toast.success(t("pay.copied", { label })) : toast.error(t("pay.copyFailedLong", { label }));
  };

  const chooseProofFile = (event) => {
    const [file] = Array.from(event.target.files || []);
    setProofFile(file || null);
  };

  const submitProof = async () => {
    if (!proofFile) {
      toast.error(t("pay.pickFileFirst"));
      return;
    }

    setUploadingProof(true);
    try {
      const uploadedProof = await uploadPaymentProof({ file: proofFile, orderNumber });
      const updatedOrder = await submitOrderPaymentProof(orderNumber, {
        paymentProofUrl: uploadedProof.paymentProofUrl,
        fileName: uploadedProof.fileName,
        contentType: uploadedProof.contentType,
      });
      const nextSession = {
        ...session,
        paymentProofUrl: updatedOrder.paymentProofUrl || uploadedProof.paymentProofUrl,
        paymentProofFileName: updatedOrder.paymentProofFileName || uploadedProof.fileName,
        paymentProofContentType: updatedOrder.paymentProofContentType || uploadedProof.contentType,
        paymentProofUploadedAt: updatedOrder.paymentProofUploadedAt || uploadedProof.uploadedAt,
        paymentProofStatus: updatedOrder.paymentProofStatus || 'submitted',
        paymentProofNotes: updatedOrder.paymentProofNotes || '',
      };
      sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(nextSession));
      onProofSubmitted?.(nextSession);

      // Tell the owner. The proof is recorded by a Postgres RPC straight from here, so no server code
      // runs on this path and nothing else can send the alert — the webhook URL is a server secret. The
      // endpoint verifies the proof for itself; this only nudges it. Deliberately not awaited and never
      // surfaced: the upload has already succeeded, and a failed notification must not tell the buyer
      // otherwise.
      fetch('/api/orders/notify-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber }),
      }).catch(() => {});
      setProofFile(null);
      toast.success(t("pay.proofSent"));
    } catch (error) {
      toast.error(error.message || t("pay.proofFailed"));
    } finally {
      setUploadingProof(false);
    }
  };

  return (
    <section className={compact ? 'mobile-card overflow-hidden p-0' : 'overflow-hidden rounded-[28px] border border-editorial-stone/15 bg-white shadow-sm'}>
      <div className={compact ? 'border-b border-editorial-stone/10 bg-editorial-ivory p-4' : 'border-b border-editorial-stone/10 bg-editorial-ivory p-5'}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-editorial-muted">{t("pay.manualTransfer")}</div>
            <h1 className={compact ? 'mt-1 text-xl font-bold text-[#172016]' : 'mt-1 text-3xl font-bold text-[#172016]'}>{t("pay.solivagantPayment")}</h1>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-[#54604d]">
              {/* The lead sentence told a buyer to transfer to the account below. On a cancelled order
                  the account below is gone, so the sentence had to go with it. */}
              {t(closedForPayment ? 'pay.closedHint' : 'pay.manualHint')}
            </p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-editorial-charcoal">
            <CreditCard className="h-5 w-5" />
          </span>
        </div>
        {!compact ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/80 px-4 py-3">
                <div className="text-[10px] uppercase text-editorial-muted">{t('pay.order')}</div>
                <div className="mt-1 truncate">{session.orderNumber || session.invoiceNumber}</div>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-3">
                <div className="text-[10px] uppercase text-editorial-muted">{t('pay.customer')}</div>
                <div className="mt-1 truncate">{session.customerCode || session.customerName || '-'}</div>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-3">
                <div className="text-[10px] uppercase text-editorial-muted">{t("pay.transferTotal")}</div>
                <div className="mt-1">{payableAmount(session)}</div>
              </div>
            </div>
            <PaymentTotalBreakdown session={session} compact={compact} />
          </>
        ) : null}
      </div>

      <div className={compact ? 'grid gap-3 p-4' : 'grid gap-4 p-5 lg:grid-cols-[1fr_0.8fr]'}>
        {customerCode ? (
          <div className={compact ? 'rounded-2xl border border-editorial-stone/15 bg-editorial-ivory p-4' : 'rounded-2xl border border-editorial-stone/15 bg-editorial-ivory p-5 lg:col-span-2'}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-editorial-muted">{t("pay.customerCode")}</div>
                <div className={compact ? 'mt-1 select-text text-2xl font-bold tracking-[0.12em] text-editorial-charcoal' : 'mt-1 select-text text-3xl font-bold tracking-[0.16em] text-editorial-charcoal'}>
                  {customerCode}
                </div>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#54604d]">
                  {t('pay.keepCode')}
                </p>
              </div>
              <Button type="button" variant="outline" className="shrink-0 rounded-2xl bg-white gap-2" onClick={() => copyValue(t("pay.customerCode"), customerCode)}>
                <Copy className="h-4 w-4" />
                {t('pay.copyCode')}
              </Button>
            </div>
          </div>
        ) : null}

        {closedForPayment ? (
          <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-4 text-[#b91c1c]">
            <div className="text-xs font-bold uppercase">{t('pay.closedTitle')}</div>
            <p className="mt-2 text-sm font-semibold leading-relaxed">{t('pay.closedBody')}</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed">{t('pay.closedTransferred')}</p>
            <AskAtelierButton orderNumber={orderNumber} className="mt-3 w-full border-[#fecaca] bg-white text-[#b91c1c]" />
            <Link to={compact ? '/mobile/catalog' : '/catalog'} className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#fecaca] bg-white px-4 text-sm font-bold text-[#b91c1c]">
              {t('pay.closedShopAgain')}
            </Link>
          </div>
        ) : (
          <>
        <div className="rounded-2xl border border-editorial-stone/10 bg-[#fbfaf7] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-editorial-muted">{t("pay.bankAccount")}</div>
          <div className="mt-3 grid gap-3">
            <div className="rounded-2xl bg-white p-4">
              <div className="text-xs font-bold uppercase text-muted-foreground">Bank</div>
              <div className="mt-1 text-xl font-bold text-editorial-charcoal">{transfer.bankName}</div>
            </div>
            <button type="button" onClick={() => copyValue(t("pay.accountNumber"), transfer.accountNumber)} className="rounded-2xl border border-editorial-stone/10 bg-white p-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase text-muted-foreground">{t("pay.accountNumber")}</div>
                  <div className="mt-1 text-2xl font-bold tracking-[0.08em] text-editorial-charcoal">{transfer.accountNumber}</div>
                </div>
                <Copy className="h-4 w-4 text-editorial-charcoal" />
              </div>
            </button>
            {transfer.swift ? (
              <button type="button" onClick={() => copyValue(t("pay.swift"), transfer.swift)} className="rounded-2xl border border-editorial-stone/10 bg-white p-4 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase text-muted-foreground">{t("pay.swift")}</div>
                    <div className="mt-1 text-2xl font-bold tracking-[0.08em] text-editorial-charcoal">{transfer.swift}</div>
                  </div>
                  <Copy className="h-4 w-4 text-editorial-charcoal" />
                </div>
              </button>
            ) : null}
            <button type="button" onClick={() => copyValue(t("pay.accountNameLabel"), transfer.accountName)} className="rounded-2xl border border-editorial-stone/10 bg-white p-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase text-muted-foreground">{t("pay.accountName")}</div>
                  <div className="mt-1 text-lg font-bold text-editorial-charcoal">{transfer.accountName}</div>
                </div>
                <Copy className="h-4 w-4 text-editorial-charcoal" />
              </div>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          {transfer.swift ? (
            /* Dekito's own line, off the invoice he already sends by hand. "OUR" makes the SENDER pay every
               fee in the chain, so the amount arrives whole instead of losing $15-25 to an intermediary
               bank — an exact fix where the rounding in usdPrice.js is only a cushion. */
            <p className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-amber-900">
              {t('pay.ourCharges')}
            </p>
          ) : null}
          <div className="text-xs font-bold uppercase">{t('pay.instructions')}</div>
          <ol className="mt-3 grid gap-2 text-sm font-semibold leading-relaxed">
            <li>{t('pay.step1', { amount: payableAmount(session) })}</li>
            <li>{t('pay.step2')}</li>
            <li>{t('pay.step3')}</li>
            <li>{t('pay.step4')}</li>
          </ol>
          <Button type="button" className="mt-4 w-full rounded-2xl gap-2" onClick={() => copyValue(t("pay.transferTotal"), Number(session.amount || 0))}>
            <Copy className="h-4 w-4" />
            {t('pay.copyTotal')}
          </Button>
          {customerCode && hasSubmittedProof ? (
            <Link to={orderTrackingPath} className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-editorial-stone/15 bg-white px-4 text-sm font-bold text-editorial-charcoal">
              {t('track.title')}
            </Link>
          ) : null}
          {customerCode && needsProofUpload ? (
            <div className="mt-2 flex items-start gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-xs font-bold leading-relaxed text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {t('pay.proofBeforeTracking')}
            </div>
          ) : null}
          {/* The way out. This screen asks for an exact amount, a bank transfer and a mandatory upload,
              and carried no link to a person — no footer, nothing. Every other page in this shop offers
              "WhatsApp atelier"; the one where the money moves did not.
              Rendered only when a number is configured: a wa.me link with no recipient is a dead end, the
              same rule the footer follows. */}
          {whatsappNumber ? (
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(t('pay.stuckDraft', { order: orderNumber }))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 text-sm font-bold text-amber-900"
            >
              <MessageCircle className="h-4 w-4" />
              {t('pay.stuck')}
            </a>
          ) : null}
        </div>
          </>
        )}

        {compact ? (
          <div className="rounded-2xl border border-editorial-stone/10 bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-editorial-muted">{t("pay.orderSummary")}</div>
            <div className="mt-3 grid gap-2 text-xs font-bold text-editorial-charcoal">
              <div className="rounded-2xl bg-editorial-ivory px-4 py-3">
                <div className="text-[10px] uppercase text-editorial-muted">{t('pay.order')}</div>
                <div className="mt-1 truncate">{session.orderNumber || session.invoiceNumber}</div>
              </div>
              <div className="rounded-2xl bg-editorial-ivory px-4 py-3">
                <div className="text-[10px] uppercase text-editorial-muted">{t('pay.customer')}</div>
                <div className="mt-1 truncate">{session.customerCode || session.customerName || '-'}</div>
              </div>
            </div>
            <PaymentTotalBreakdown session={session} compact />
          </div>
        ) : null}

        <div id="mobile-payment-proof-section" className="rounded-2xl border border-editorial-stone/10 bg-white p-4">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${hasSubmittedProof ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {hasSubmittedProof ? <FileCheck2 className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-xs font-bold uppercase text-editorial-muted">{t("pay.proof")}</div>
                {needsProofUpload ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">{t('pay.requiredTag')}</span> : null}
              </div>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-editorial-charcoal">
                {proofStatus === 'rejected'
                  ? t("pay.proofRejected")
                  : hasSubmittedProof
                  ? t("pay.proofWaiting")
                  : t("pay.proofRequired")}
              </p>
              {proofStatus === 'rejected' && session.paymentProofNotes ? (
                <div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold leading-relaxed text-rose-800">
                  <span className="block text-[10px] font-bold uppercase text-rose-700">{t("pay.adminReason")}</span>
                  {session.paymentProofNotes}
                </div>
              ) : null}
              {session.paymentProofFileName ? (
                <div className="mt-2 truncate rounded-xl bg-editorial-ivory px-3 py-2 text-xs font-bold text-editorial-charcoal">
                  {session.paymentProofFileName}
                </div>
              ) : null}
              {session.paymentProofUploadedAt ? (
                <div className="mt-1 text-[11px] font-semibold text-editorial-muted">
                  {t("pay.sentOn", { date: formatDateTime(session.paymentProofUploadedAt, t) })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="sr-only">{t("pay.uploadProof")}</span>
              <input
                id="mobile-payment-proof-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={chooseProofFile}
                disabled={uploadingProof}
                required={needsProofUpload}
                aria-required={needsProofUpload}
                className="block w-full rounded-2xl border border-editorial-stone/15 bg-[#fbfaf7] px-3 py-2 text-sm font-semibold text-editorial-charcoal file:mr-3 file:rounded-xl file:border-0 file:bg-editorial-charcoal file:px-3 file:py-2 file:text-xs file:font-bold file:text-editorial-paper"
              />
            </label>
            {proofFile ? (
              <div className="truncate text-xs font-semibold text-editorial-muted">
                {proofFile.name}
              </div>
            ) : null}
            <Button type="button" className="h-11 rounded-2xl gap-2" onClick={submitProof} disabled={uploadingProof || !proofFile}>
              {uploadingProof ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {hasSubmittedProof ? t("pay.reuploadProof") : t("pay.uploadProof")}
            </Button>
            <p className="text-[11px] font-semibold leading-relaxed text-[#6b7280]">
              {t('pay.fileFormats')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

const EmptyPaymentState = ({ isMobile, orderNumber, orderFound = null, loading = false, onRefresh }) => {
  const { t } = useTranslate();
  return (
  <section className={isMobile ? 'mobile-card p-5 text-center' : 'mx-auto max-w-xl rounded-[28px] border bg-white p-8 text-center shadow-sm'}>
    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-editorial-ivory text-editorial-charcoal">
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : orderNumber ? <CheckCircle2 className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
    </span>
    <h1 className={isMobile ? 'mt-4 text-xl font-bold text-[#172016]' : 'mt-4 text-3xl font-bold text-[#172016]'}>
      {orderNumber
        ? (orderFound === false ? t("pay.orderNotFound") : t("pay.processing"))
        : t("pay.noSession")}
    </h1>
    <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">
      {orderNumber
        ? (orderFound === false
          ? t("pay.orderMissing", { order: orderNumber })
          : t("pay.orderReturned", { order: orderNumber }))
        : t("pay.noSessionBody")}
    </p>
    <div className="mt-5 flex justify-center gap-2">
      <Link to={isMobile ? '/mobile/catalog' : '/catalog'} className="inline-flex h-11 items-center rounded-2xl bg-editorial-charcoal px-5 text-sm font-bold text-editorial-paper">
        {t('mcheckout.openCatalog')}
      </Link>
      <Link to={isMobile ? '/mobile/customer' : '/customer'} className="inline-flex h-11 items-center rounded-2xl border bg-white px-5 text-sm font-bold text-editorial-charcoal">
        {t('track.title')}
      </Link>
      {orderNumber && onRefresh ? (
        <button type="button" onClick={onRefresh} className="inline-flex h-11 items-center gap-2 rounded-2xl border bg-white px-5 text-sm font-bold text-editorial-charcoal">
          <RefreshCw className="h-4 w-4" />
          {t('pay.refresh')}
        </button>
      ) : null}
    </div>
  </section>
);
};

const MobilePaymentSkeleton = () => (
  <section className="mobile-card overflow-hidden p-0" aria-busy="true">
    <div className="border-b border-editorial-stone/10 bg-editorial-ivory p-4">
      <div className="mobile-catalog-skeleton h-4 w-32 rounded-full" />
      <div className="mobile-catalog-skeleton mt-3 h-7 w-56 rounded-full" />
      <div className="mt-4 grid gap-2">
        <div className="mobile-catalog-skeleton h-14 rounded-2xl" />
        <div className="mobile-catalog-skeleton h-14 rounded-2xl" />
      </div>
    </div>
    <div className="grid gap-3 p-4">
      <div className="mobile-catalog-skeleton h-28 rounded-2xl" />
      <div className="mobile-catalog-skeleton h-40 rounded-2xl" />
      <div className="mobile-catalog-skeleton h-12 rounded-2xl" />
    </div>
  </section>
);

const PaymentPageContent = ({ isMobile }) => {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  // Whether the lookup actually found the order. Without this the page told anyone arriving with an
  // order number — a typo, an old link, a cancelled order — that their payment was being processed and
  // had "returned to Solivagant", which is a reassurance about something that does not exist.
  const [orderFound, setOrderFound] = useState(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const orderNumber = searchParams.get('order');
  const paymentReturn = searchParams.get('payment');
  const isSessionForOrder = useCallback((candidate) => (
    candidate && (!orderNumber || candidate.orderNumber === orderNumber || candidate.invoiceNumber === orderNumber)
  ), [orderNumber]);

  const recoverDokuPaymentSession = useCallback(async (order) => {
    if (!order?.orderNumber || order.paymentStatus === 'paid') {
      return null;
    }

    // The public RPC can omit payment_url, which used to make this mint a brand-new DOKU checkout on
    // every page load (multiple live invoices for one order, double-charge risk). Re-check the
    // authoritative order and reuse its existing, non-expired session before creating another.
    const fullOrder = order.paymentUrl
      ? order
      : (await getOrderById(order.orderNumber).catch(() => null)) || order;
    const existingExpiry = fullOrder.paymentExpiresAt ? new Date(fullOrder.paymentExpiresAt).getTime() : 0;
    const stillValid = existingExpiry ? existingExpiry > Date.now() : Boolean(fullOrder.paymentUrl);
    if (fullOrder.paymentUrl && stillValid) {
      const reusedSession = buildDokuSessionFromCheckout(fullOrder, {
        paymentUrl: fullOrder.paymentUrl,
        invoiceNumber: fullOrder.orderNumber,
        paymentExpiresAt: fullOrder.paymentExpiresAt || '',
        paymentSessionId: fullOrder.paymentSessionId || '',
      });
      sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(reusedSession));
      return reusedSession;
    }

    try {
      const checkout = await createDokuCheckout({
        order,
        amount: order.subtotal,
        customerName: order.customerName,
        contact: order.contact,
        items: order.items || [],
        callbackPath: isMobile ? '/mobile/payment' : '/payment',
      });
      // api/doku/checkout.js already persisted this payment session server-side with the service role;
      // the browser copy was filtered by RLS for every buyer and now throws (audit round 9).
      const recoveredSession = buildDokuSessionFromCheckout(order, checkout);
      sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(recoveredSession));
      return recoveredSession;
    } catch (error) {
      console.warn('Failed to recover DOKU payment session:', error.message || error);
      return null;
    }
  }, [isMobile]);

  const loadPaymentSession = useCallback(async ({ syncStatus = false } = {}) => {
    const storedSession = readPaymentSession();
    if (syncStatus && orderNumber && paymentReturn === 'doku') {
      setRefreshingStatus(true);
      try {
        await refreshDokuPaymentStatus(orderNumber);
      } catch (error) {
        console.warn('Failed to refresh DOKU payment status:', error.message || error);
      } finally {
        setRefreshingStatus(false);
      }
    }

    if ((storedSession?.paymentUrl || isManualTransferPayment(storedSession?.paymentProvider || storedSession?.paymentType)) && isSessionForOrder(storedSession)) {
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
      const order = await getPublicOrderPaymentSession(orderNumber) || await getOrderById(orderNumber);
      setOrderFound(Boolean(order));
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
          paymentProofUrl: order.paymentProofUrl,
          paymentProofFileName: order.paymentProofFileName,
          paymentProofContentType: order.paymentProofContentType,
          paymentProofUploadedAt: order.paymentProofUploadedAt,
          paymentProofStatus: order.paymentProofStatus,
          paymentProofNotes: order.paymentProofNotes,
          voucherSnapshot: getOrderVoucherSnapshot(order),
          shippingSummary: getOrderShippingSummary(order),
          shippingFee: getOrderShippingFee(order),
          createdAt: order.createdAt,
        };
        sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(restoredSession));
        setSession(restoredSession);
        return;
      }

      if (order && isManualTransferPayment(order.paymentProvider)) {
        const restoredManualSession = buildManualTransferFromOrder(order);
        sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(restoredManualSession));
        setSession(restoredManualSession);
        return;
      }

      if (order && order.paymentProvider === 'doku' && ['unpaid', 'pending'].includes(order.paymentStatus || 'unpaid')) {
        const recoveredDokuSession = await recoverDokuPaymentSession(order);
        if (recoveredDokuSession) {
          setSession(recoveredDokuSession);
          return;
        }
      }

      // Only fall back to the stored session when it belongs to THIS order — otherwise the page rendered
      // the previous buyer's (or the previous tab's) payment session under the requested order number
      // (audit round 7).
      setSession(isSessionForOrder(storedSession) ? storedSession : null);
    } catch (error) {
      console.warn('Failed to restore payment session:', error.message || error);
      // A lookup that threw leaves us genuinely unsure; say nothing rather than claim the order is gone.
      setOrderFound(null);
      // Fall back to any session we already had and tell the buyer, instead of
      // silently showing an empty "no payment session" state.
      setSession(isSessionForOrder(storedSession) ? storedSession : null);
      toast.error(t("pay.sessionLoadFailed"));
    } finally {
      setLoadingOrder(false);
    }
  }, [isSessionForOrder, orderNumber, paymentReturn, recoverDokuPaymentSession, t]);

  useEffect(() => {
    loadPaymentSession({ syncStatus: paymentReturn === 'doku' });
  }, [loadPaymentSession, paymentReturn]);

  const refreshPaymentSession = () => loadPaymentSession({ syncStatus: Boolean(orderNumber) });
  const sessionIsManual = isManualTransferPayment(session?.paymentProvider || session?.paymentType);
  const sessionIsQris = Boolean(session?.qrContent) || session?.paymentProvider === 'doku-qris';
  const openPrimaryPaymentAction = () => {
    if (!session) return;
    if (sessionIsManual) {
      document.getElementById('mobile-payment-proof-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => document.getElementById('mobile-payment-proof-input')?.click(), 280);
      return;
    }
    if (session.paymentUrl) {
      window.open(session.paymentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (isMobile) {
    return (
      <MobileCommerceLayout>
        <Helmet>
          <title>{t("pay.tab")}</title>
        </Helmet>
        <main className="mobile-page mobile-payment-page space-y-4">
          <MobileTopBar
            title={t('mcheckout.title')}
            subtitle={session?.orderNumber || orderNumber || 'Solivagant checkout'}
            eyebrow="Secure"
            onBack={() => navigate('/mobile/cart')}
            action={<CreditCard className="h-5 w-5 text-amber-700" />}
          />
          {(loadingOrder || refreshingStatus) && !session ? <MobilePaymentSkeleton /> : isManualTransferPayment(session?.paymentProvider || session?.paymentType) ? (
            <ManualTransferPanel session={session} compact onProofSubmitted={setSession} />
          ) : session?.qrContent ? <QrisPanel session={session} compact onPaid={setSession} /> : session?.paymentUrl ? <PaymentFrame session={session} compact /> : <EmptyPaymentState isMobile orderNumber={orderNumber} orderFound={orderFound} loading={loadingOrder || refreshingStatus} onRefresh={refreshPaymentSession} />}
          {session && !sessionIsQris ? (
            <StickyBottomActionBar
              fixed
              reserveSpace
              aria-label={t("pay.actions")}
              className="mobile-payment-action-bar"
              contentClassName="rounded-2xl border-editorial-stone/10 bg-white/95"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-[#8b949e]">{sessionIsManual ? t("pay.manualTransfer") : t("pay.dokuPayment")}</p>
                  <p className="truncate text-lg font-bold leading-tight text-editorial-charcoal">{payableAmount(session)}</p>
                  <p className="truncate text-[10px] font-bold text-amber-700">{t(paymentStatusKeys[session.paymentStatus || 'pending'] || 'pay.awaiting')}</p>
                </div>
                <Button type="button" className="h-12 rounded-2xl gap-2 px-4" onClick={openPrimaryPaymentAction}>
                  {sessionIsManual ? <Upload className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                  {sessionIsManual ? t("pay.uploadShort") : t("pay.payDoku")}
                </Button>
              </div>
            </StickyBottomActionBar>
          ) : null}
        </main>
      </MobileCommerceLayout>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t("pay.tab")}</title>
      </Helmet>
      <main className="solivagant-editorial-home">
        <PublicHeader />
        <section className="tracking-content" style={{ paddingTop: 'var(--space-block)' }}>
          {isManualTransferPayment(session?.paymentProvider || session?.paymentType) ? (
            <ManualTransferPanel session={session} onProofSubmitted={setSession} />
          ) : session?.qrContent ? <QrisPanel session={session} onPaid={setSession} /> : session?.paymentUrl ? <PaymentFrame session={session} /> : <EmptyPaymentState orderNumber={orderNumber} orderFound={orderFound} loading={loadingOrder || refreshingStatus} onRefresh={refreshPaymentSession} />}
        </section>
        <StorefrontFooter />
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
