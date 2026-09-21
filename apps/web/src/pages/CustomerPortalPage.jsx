import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ClipboardPaste, CreditCard, ExternalLink, FileCheck2, FileText, History, KeyRound, Loader2, PackageCheck, RefreshCw, Search, ShieldCheck, ShoppingBag, Sparkles, Truck, Upload, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useTierPrices } from '@/hooks/useStorefrontProducts.js';
import { Button } from '@/components/ui/button.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import { paymentStatusLabels } from '@/utils/orderWorkflow.js';
import { orderHasShipped } from '@/utils/trackingLead.js';
import StatusChip, { getOrderStatusTone, getPaymentStatusTone, getShipmentStatusTone } from '@/components/ui/status-chip.jsx';
import StorefrontHeader from '@/components/storefront/StorefrontHeader.jsx';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import {
  claimCustomerCode,
  getCustomerAccount,
  getCustomerPortalByCode,
  saveCustomerAccount,
  setCustomerPortalSecurity,
  verifyCustomerPortalSecurity,
} from '@/services/customerService.js';
import {
  getBespokeItem,
  getBespokeProductionStatusLabels,
  getOrderStatusLabels,
  getShipmentStatusLabels,
  isBespokeOrder,
} from '@/services/orderService.js';
import { buildCourierTrackingSearchUrl, buildPublicTrackingUrl } from '@/services/publicTrackingService.js';
import { createDokuCheckout, refreshDokuPaymentStatus } from '@/services/dokuCheckoutService.js';
import { addCartItem, isManualTransferPayment, MANUAL_TRANSFER_PAYMENT } from '@/services/cartService.js';
import { setAppliedVoucherCode } from '@/services/voucherService.js';
import { seedCheckoutDraft } from '@/hooks/useCheckoutFlow.js';
import {
  getOrderProductItems,
  getOrderProductsSubtotal,
  getOrderShippingFee,
  getOrderSubtotalAfterVoucher,
  getOrderVoucherSnapshot,
} from '@/utils/orderTotals.js';
import { getDiscountedVoucherCartLines } from '@/utils/cartVoucherPricing.js';
import { copyTextToClipboard } from '@/utils/clipboard.js';
import { publicErrorMessage } from '@/utils/publicErrorMessage.js';
import AskAtelierButton from '@/components/storefront/AskAtelierButton.jsx';
import useTranslate from '@/hooks/useTranslate.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDate = (value, t) => (value
  ? new Intl.DateTimeFormat(t('fmt.dateLocale'), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-');

// The service label maps are shared with Studio, which stays Indonesian. The storefront reads its own
// key maps instead, and falls back to the service label for a status nobody has translated yet.
const statusLabels = getOrderStatusLabels();
const shipmentStatusLabels = getShipmentStatusLabels();
const bespokeProductionStatusLabels = getBespokeProductionStatusLabels();
const orderStatusKeys = {
  draft: 'cust.st.draft',
  pending_payment: 'cust.st.pending_payment',
  paid: 'cust.st.paid',
  processing: 'cust.st.processing',
  shipped: 'cust.st.shipped',
  completed: 'cust.st.completed',
  cancelled: 'cust.st.cancelled',
};
const shipmentStatusKeys = {
  not_ready: 'cust.sh.not_ready',
  packing: 'cust.sh.packing',
  shipped: 'cust.sh.shipped',
  delivered: 'cust.sh.delivered',
};
const bespokeProductionKeys = {
  review_brief: 'cust.bp.review_brief',
  formula: 'cust.bp.formula',
  sample: 'cust.bp.sample',
  approval: 'cust.bp.approval',
  production: 'cust.bp.production',
  ready: 'cust.bp.ready',
};
const paymentStatusKeys = {
  unpaid: 'cust.ps.unpaid',
  pending: 'cust.ps.pending',
  paid: 'cust.ps.paid',
  failed: 'cust.ps.failed',
  expired: 'cust.ps.expired',
  refunded: 'cust.ps.refunded',
};
const paymentProofStatusKeys = {
  missing: 'cust.proofNotUploaded',
  submitted: 'cust.proofSent',
  approved: 'cust.proofApproved',
  rejected: 'cust.proofRejected',
};
const labelFrom = (keys, fallbacks, status, t) => (
  keys[status] ? t(keys[status]) : (fallbacks[status] || status || '')
);
const paymentProofToneByStatus = {
  missing: 'warning',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
};

const progressSteps = [
  { key: 'created', labelKey: 'cust.orderCreated' },
  { key: 'pending_payment', labelKey: 'cust.awaitingPayment' },
  { key: 'paid', labelKey: 'cust.paid' },
  { key: 'processing', labelKey: 'cust.processing' },
  { key: 'shipped', labelKey: 'cust.shipped' },
  { key: 'completed', labelKey: 'cust.done' },
];
const bespokeProductionSteps = ['review_brief', 'formula', 'sample', 'approval', 'production', 'ready'];
const buildPaymentPath = ({ isMobileRoute, order }) => `${isMobileRoute ? '/mobile/payment' : '/payment'}?order=${encodeURIComponent(order.orderNumber)}&payment=${isManualTransferPayment(order.paymentProvider) ? 'manual' : 'doku'}`;
const CUSTOMER_CODE_LAST_STORAGE_KEY = 'dekito.storefront.customerCode.last.v1';
const DOKU_PAYMENT_TTL_MINUTES = 60;
const isDokuPayment = (order) => order?.paymentProvider === 'doku';
const isPayableOrder = (order) => ['unpaid', 'pending'].includes(order?.paymentStatus);
const getDokuExpiryDate = (order) => {
  const explicitExpiry = order?.paymentExpiresAt ? new Date(order.paymentExpiresAt) : null;
  if (explicitExpiry && Number.isFinite(explicitExpiry.getTime())) return explicitExpiry;

  const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
  if (createdAt && Number.isFinite(createdAt.getTime())) {
    return new Date(createdAt.getTime() + (DOKU_PAYMENT_TTL_MINUTES * 60 * 1000));
  }

  return null;
};
const isDokuPaymentExpired = (order, now = new Date()) => {
  if (!isDokuPayment(order) || !isPayableOrder(order)) return false;
  const expiresAt = getDokuExpiryDate(order);
  return Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
};
const canOpenPayment = (order) => Boolean(
  isPayableOrder(order)
  && (order?.paymentUrl || isManualTransferPayment(order?.paymentProvider))
  && !isDokuPaymentExpired(order)
);
const canUploadPaymentProof = (order) => Boolean(
  isManualTransferPayment(order?.paymentProvider)
  && order?.paymentStatus !== 'paid'
  && !['submitted', 'approved'].includes(order?.paymentProofStatus || 'missing')
);
const canTrackShipment = (order) => Boolean(order?.trackingUrl && order?.trackingNumber);
const readLastCustomerCode = () => {
  if (typeof window === 'undefined') return '';

  try {
    return String(window.localStorage.getItem(CUSTOMER_CODE_LAST_STORAGE_KEY) || '').toUpperCase();
  } catch {
    return '';
  }
};
const writeLastCustomerCode = (code) => {
  if (typeof window === 'undefined' || !code) return;

  try {
    window.localStorage.setItem(CUSTOMER_CODE_LAST_STORAGE_KEY, String(code).toUpperCase());
  } catch {
    // Storage can be blocked in private browsing; the portal still works normally.
  }
};

const getActiveStep = (status) => {
  if (status === 'cancelled') return -1;
  const index = progressSteps.findIndex((step) => step.key === status);
  return index >= 0 ? index : 1;
};

const getBespokeProductionStep = (status) => {
  const index = bespokeProductionSteps.indexOf(status || 'review_brief');
  return index >= 0 ? index : 0;
};

const bespokeDetailRows = (item, t) => [
  [t('cust.scent'), item?.preferredNotes || item?.notes],
  [t('cust.occasion'), item?.occasion],
  [t('cust.size'), item?.size],
  [t('cust.bottle'), item?.bottleType],
  [t('cust.cap'), item?.capDesign],
  [t('cust.label'), item?.labelDesign],
  [t('cust.material'), item?.exoticMaterial],
].filter(([, value]) => value);

const StatusBadge = ({ status }) => {
  const { t } = useTranslate();
  return (
    <StatusChip tone={getOrderStatusTone(status)}>
      {labelFrom(orderStatusKeys, statusLabels, status, t)}
    </StatusChip>
  );
};

const PaymentBadge = ({ status }) => {
  const { t } = useTranslate();
  return (
    <StatusChip icon={CreditCard} tone={getPaymentStatusTone(status)}>
      {labelFrom(paymentStatusKeys, paymentStatusLabels, status, t)}
    </StatusChip>
  );
};

const ShipmentBadge = ({ status }) => {
  const { t } = useTranslate();
  return (
    <StatusChip icon={Truck} tone={getShipmentStatusTone(status)}>
      {labelFrom(shipmentStatusKeys, shipmentStatusLabels, status, t) || t('cust.notShipped')}
    </StatusChip>
  );
};

const PaymentProofBadge = ({ status }) => {
  const { t } = useTranslate();
  return (
    <StatusChip icon={status === 'missing' ? Upload : FileCheck2} tone={paymentProofToneByStatus[status] || 'warning'}>
      {t(paymentProofStatusKeys[status] || paymentProofStatusKeys.missing)}
    </StatusChip>
  );
};

const getPaymentExperienceState = (order, t) => {
  if (!order) return null;
  if (order.status === 'cancelled') {
    return {
      label: t('cust.autoCancelled'),
      title: t('cust.orderCancelled'),
      description: t('cust.cancelledBody'),
      className: 'border-slate-200 bg-slate-50 text-slate-800',
      iconClassName: 'bg-white text-slate-600',
      action: t('cust.orderAgain'),
    };
  }
  if (order.paymentStatus === 'paid') {
    return {
      label: t('cust.paid'),
      title: t('cust.paymentReceived'),
      description: t('cust.paymentReceivedBody'),
      className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      iconClassName: 'bg-white text-emerald-700',
      action: '',
    };
  }
  if (isManualTransferPayment(order.paymentProvider)) {
    const proofStatus = order.paymentProofStatus || 'missing';
    if (['submitted', 'approved'].includes(proofStatus)) {
      return {
        label: t('cust.awaitingCheck'),
        title: t('cust.proofSentTitle'),
        description: t('cust.proofSentBody'),
        className: 'border-sky-200 bg-sky-50 text-sky-900',
        iconClassName: 'bg-white text-sky-700',
        action: t('cust.viewProof'),
      };
    }
    return {
      label: t('cust.manualUnpaid'),
      title: t('cust.uploadProof'),
      description: t('cust.manualUnpaidBody'),
      className: 'border-amber-200 bg-amber-50 text-amber-950',
      iconClassName: 'bg-white text-amber-700',
      action: t('cust.uploadProofShort'),
    };
  }
  if (isDokuPaymentExpired(order) || order.paymentStatus === 'expired') {
    return {
      label: t('cust.dokuExpired'),
      title: t('cust.linkExpired'),
      description: t('cust.dokuHour'),
      className: 'border-rose-200 bg-rose-50 text-rose-900',
      iconClassName: 'bg-white text-rose-700',
      action: t('cust.newDokuLink'),
    };
  }
  return {
    label: t('cust.unpaid'),
    title: t('cust.awaitingPaymentTitle'),
    description: t('cust.awaitingPaymentBody'),
    className: 'border-amber-200 bg-amber-50 text-amber-950',
    iconClassName: 'bg-white text-amber-700',
    action: t('cust.payNow'),
  };
};

const PaymentExperiencePanel = ({ compact = false, order }) => {
  const { t } = useTranslate();
  const state = getPaymentExperienceState(order, t);
  if (!state) return null;

  return (
    <div className={`${compact ? 'mt-3 p-3' : 'mt-4 p-4'} rounded-2xl border ${state.className}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${state.iconClassName}`}>
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase">{state.label}</span>
            {state.action ? <span className="text-[10px] font-bold uppercase opacity-75">{state.action}</span> : null}
          </div>
          <h4 className={`${compact ? 'text-sm' : 'text-base'} mt-2 font-bold text-editorial-charcoal`}>{state.title}</h4>
          <p className="mt-1 text-xs font-semibold leading-relaxed opacity-85">{state.description}</p>
        </div>
      </div>
    </div>
  );
};

const MobileCustomerPortalSkeleton = () => (
  <>
    <section className="mobile-card p-4" aria-busy="true">
      <div className="mobile-catalog-skeleton h-4 w-32 rounded-full" />
      <div className="mobile-catalog-skeleton mt-3 h-7 w-48 rounded-full" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="mobile-catalog-skeleton h-16 rounded-2xl" />
        <div className="mobile-catalog-skeleton h-16 rounded-2xl" />
        <div className="mobile-catalog-skeleton h-16 rounded-2xl" />
      </div>
    </section>
    <section className="space-y-3">
      <div className="mobile-catalog-skeleton h-5 w-32 rounded-full" />
      <article className="mobile-card overflow-hidden p-0">
        <div className="border-b border-[#e5e7eb] bg-white p-4">
          <div className="mobile-catalog-skeleton h-5 w-36 rounded-full" />
          <div className="mobile-catalog-skeleton mt-2 h-3 w-24 rounded-full" />
        </div>
        <div className="grid gap-3 p-4">
          <div className="mobile-catalog-skeleton h-24 rounded-2xl" />
          <div className="mobile-catalog-skeleton h-28 rounded-2xl" />
          <div className="mobile-catalog-skeleton h-12 rounded-2xl" />
        </div>
      </article>
    </section>
  </>
);

const PaymentProofPanel = ({ order, compact = false }) => {
  const { t } = useTranslate();
  if (!isManualTransferPayment(order.paymentProvider)) return null;

  const status = order.paymentProofStatus || 'missing';
  const submitted = Boolean(order.paymentProofUrl) && ['submitted', 'approved'].includes(status);
  const rejected = status === 'rejected';
  const message = rejected
    ? t('cust.proofRejectedBody')
    : submitted
      ? t('cust.proofUnderReview')
      : t('cust.proofMissing');

  return (
    <div className={`mt-3 rounded-2xl border ${rejected || !submitted ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-100 bg-emerald-50 text-emerald-900'} ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-amber-700'}`}>
          {submitted ? <FileCheck2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-bold uppercase">{t('cust.proof')}</div>
            <PaymentProofBadge status={status} />
          </div>
          <p className="mt-1 text-xs font-semibold leading-relaxed">{message}</p>
          {order.paymentProofFileName ? (
            <div className="mt-2 truncate rounded-xl bg-white/75 px-3 py-2 text-xs font-bold">
              {order.paymentProofFileName}
            </div>
          ) : null}
          {order.paymentProofUploadedAt ? (
            <div className="mt-1 text-[11px] font-semibold opacity-80">
              {t('cust.sentOn', { date: formatDate(order.paymentProofUploadedAt, t) })}
            </div>
          ) : null}
          {order.paymentProofNotes ? (
            <div className="mt-2 rounded-xl bg-white/75 px-3 py-2 text-xs font-semibold">
              {t('cust.adminNote', { note: order.paymentProofNotes })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const PaymentTaskPanel = ({
  compact = false,
  isMobileRoute,
  onRenewDokuPayment,
  order,
  renewing = false,
}) => {
  const { t } = useTranslate();
  if (!order || !isPayableOrder(order)) return null;

  const paymentPath = buildPaymentPath({ isMobileRoute, order });
  const manualPayment = isManualTransferPayment(order.paymentProvider);
  const dokuPayment = isDokuPayment(order);
  const dokuExpired = isDokuPaymentExpired(order);
  const expiresAt = getDokuExpiryDate(order);
  const transfer = {
    bankName: order.paymentResponse?.bankName || MANUAL_TRANSFER_PAYMENT.bankName,
    accountNumber: order.paymentResponse?.accountNumber || MANUAL_TRANSFER_PAYMENT.accountNumber,
    accountName: order.paymentResponse?.accountName || MANUAL_TRANSFER_PAYMENT.accountName,
  };

  const title = manualPayment
    ? t('cust.manualIncomplete')
    : dokuExpired
      ? t('cust.dokuPastHour')
      : t('cust.dokuWaiting');
  const description = manualPayment
    ? t('cust.transferThenUpload')
    : dokuExpired
      ? t('cust.makeNewDoku')
      : t('cust.openPayLink');

  return (
    <div className={`${compact ? 'mt-3 p-3' : 'mt-4 p-4'} rounded-2xl border border-amber-200 bg-amber-50 text-amber-950`}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white text-amber-700">
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">{t('cust.payActions')}</div>
          <h4 className={`${compact ? 'text-sm' : 'text-base'} mt-1 font-bold text-editorial-charcoal`}>{title}</h4>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-900">{description}</p>

          <div className={`${compact ? 'grid gap-2' : 'grid gap-3 sm:grid-cols-3'} mt-3`}>
            <div className="rounded-2xl bg-white/85 px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-amber-700">{t('cust.order')}</div>
              <div className="mt-1 truncate text-xs font-bold text-editorial-charcoal">{order.orderNumber}</div>
            </div>
            <div className="rounded-2xl bg-white/85 px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-amber-700">{t('cust.totalDue')}</div>
              <div className="mt-1 text-sm font-bold text-editorial-charcoal">{formatTotal(order.subtotal)}</div>
            </div>
            {dokuPayment ? (
              <div className="rounded-2xl bg-white/85 px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-amber-700">{t('cust.linkDeadline')}</div>
                <div className="mt-1 truncate text-xs font-bold text-editorial-charcoal">{expiresAt ? formatDate(expiresAt, t) : t('cust.aboutAnHour')}</div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/85 px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-amber-700">{t('cust.account')}</div>
                <div className="mt-1 truncate text-xs font-bold text-editorial-charcoal">{transfer.bankName} {transfer.accountNumber}</div>
                <div className="mt-0.5 truncate text-[11px] font-semibold text-[#6b7280]">{t('cust.accountHolder', { name: transfer.accountName })}</div>
              </div>
            )}
          </div>

          <div className={`${compact ? 'grid gap-2' : 'flex flex-wrap gap-2'} mt-3`}>
            {manualPayment ? (
              <Link to={paymentPath} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-editorial-charcoal px-4 text-xs font-bold text-editorial-ivory">
                <Upload className="h-4 w-4" />
                {t('cust.uploadProof')}
              </Link>
            ) : dokuExpired ? (
              <button type="button" onClick={() => onRenewDokuPayment(order)} disabled={renewing} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-editorial-charcoal px-4 text-xs font-bold text-editorial-ivory disabled:opacity-60">
                {renewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t('cust.newDokuLink')}
              </button>
            ) : (
              <Link to={paymentPath} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-editorial-charcoal px-4 text-xs font-bold text-editorial-ivory">
                <CreditCard className="h-4 w-4" />
                {t('cust.payNow')}
              </Link>
            )}
            {dokuPayment && order.paymentUrl && !dokuExpired ? (
              <button type="button" onClick={() => onRenewDokuPayment(order)} disabled={renewing} className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-editorial-charcoal/15 bg-white px-4 text-xs font-bold text-editorial-charcoal disabled:opacity-60">
                {renewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t('cust.renewLink')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderTimeline = ({ order, compact = false }) => {
  const { t } = useTranslate();
  const activeStep = getActiveStep(order.status);
  const timeline = progressSteps.map((step, index) => {
    const done = activeStep >= index;
    const current = activeStep === index;
    let detail = done ? t('cust.recorded') : t('cust.waitingPrevious');
    if (step.key === 'created') detail = formatDate(order.createdAt, t);
    if (step.key === 'pending_payment') detail = order.paymentStatus === 'paid' ? t('cust.paymentDone') : t('cust.waitingPayment');
    if (step.key === 'paid') detail = labelFrom(paymentStatusKeys, paymentStatusLabels, order.paymentStatus, t) || '-';
    if (step.key === 'processing') detail = labelFrom(shipmentStatusKeys, shipmentStatusLabels, order.shipmentStatus, t) || labelFrom(orderStatusKeys, statusLabels, order.status, t) || '-';
    // "akan muncul" is a promise about the future. Printed under a step already marked Dikirim it is a
    // sentence about something that has already happened — and that is every shipped order in this shop,
    // because none of them carries a number.
    if (step.key === 'shipped') {
      detail = order.trackingNumber
        ? `${order.courierName || t('cust.courier')} / ${order.trackingNumber}`
        : t(orderHasShipped(order) ? 'cust.waybillMissing' : 'cust.waybillLater');
    }
    if (step.key === 'completed') detail = order.deliveredAt ? formatDate(order.deliveredAt, t) : t('cust.waitingDelivery');

    return { ...step, done, current, detail };
  });

  return (
    <div className={compact ? 'grid gap-2' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'}>
      {timeline.map((step, index) => (
        <div key={step.key} className={`rounded-2xl border px-3 py-3 ${step.done ? 'border-editorial-charcoal/20 bg-white' : 'border-stone-200 bg-stone-50'} ${step.current ? 'ring-2 ring-editorial-charcoal/15' : ''}`}>
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${step.done ? 'bg-editorial-charcoal text-white' : 'bg-stone-200 text-stone-500'}`}>
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-editorial-charcoal">{t(step.labelKey)}</div>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-[#6b7280]">{step.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const VoucherSummary = ({ order, compact = false }) => {
  const { t } = useTranslate();
  const voucherSnapshot = getOrderVoucherSnapshot(order);
  if (!voucherSnapshot) return null;

  const shippingFee = getOrderShippingFee(order);
  return (
    <div className={`mt-3 rounded-2xl border border-editorial-charcoal/10 bg-editorial-ivory ${compact ? 'p-3 text-xs' : 'p-4 text-sm'} font-bold text-editorial-charcoal`}>
      <div className="flex justify-between gap-3">
        <span>{t('cust.subtotalProducts')}</span>
        <span>{formatTotal(getOrderProductsSubtotal(order))}</span>
      </div>
      <div className="mt-2 flex justify-between gap-3">
        <span>{t('cust.voucherCode', { code: voucherSnapshot.code })}</span>
        <span>-{formatTotal(voucherSnapshot.discountAmount)}</span>
      </div>
      <div className="mt-2 flex justify-between gap-3 text-[#6b7280]">
        <span>{t('cust.subtotalAfterVoucher')}</span>
        <span>{formatTotal(getOrderSubtotalAfterVoucher(order))}</span>
      </div>
      {shippingFee ? (
        <div className="mt-2 flex justify-between gap-3 text-[#6b7280]">
          <span>{t('cust.shipping')}</span>
          <span>{formatTotal(shippingFee)}</span>
        </div>
      ) : null}
    </div>
  );
};

const OrderItems = ({ order, compact = false }) => {
  const { t } = useTranslate();
  const voucherSnapshot = getOrderVoucherSnapshot(order);
  const discountedLines = getDiscountedVoucherCartLines(
    getOrderProductItems(order),
    voucherSnapshot || {}
  );

  return (
    <div className="grid gap-2">
      {discountedLines.map((line) => {
        const item = line.item;
        const hasDiscount = line.discount > 0;

        return (
          <div key={`${order.orderNumber}-${item.slug || item.name}`} className={`rounded-2xl bg-white font-semibold ${compact ? 'border border-[#e5e7eb] px-3 py-2 text-xs' : 'px-3 py-2 text-sm'}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate">{item.name} x{item.quantity}</span>
              <span className="shrink-0 text-right text-amber-700">
                {hasDiscount ? (
                  <>
                    <span className="block text-[11px] text-[#6b7280] line-through">{formatTotal(line.originalTotal)}</span>
                    <span className="block">{formatTotal(line.discountedTotal)}</span>
                  </>
                ) : item.price || formatTotal(line.originalTotal)}
              </span>
            </div>
            {hasDiscount ? (
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-bold text-editorial-charcoal">
                <span>{t('cust.afterVoucherUnit', { price: formatTotal(line.discountedUnitPrice) })}</span>
                <span>-{formatTotal(line.discount)}</span>
              </div>
            ) : null}
          </div>
        );
      })}
      <VoucherSummary order={order} compact={compact} />
    </div>
  );
};

const BespokeDetailPanel = ({ item, compact = false }) => {
  const { t } = useTranslate();
  const rows = bespokeDetailRows(item, t);
  if (!rows.length) return null;

  return (
    <div className={`${compact ? 'mt-3 p-3' : 'mt-4 p-4'} rounded-2xl bg-editorial-ivory`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-editorial-charcoal sm:text-xs">
        <Sparkles className="h-3.5 w-3.5" />
        {t('cust.bespokeDetail')}
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {rows.map(([label, value]) => (
          <div key={label} className={`${compact ? 'grid grid-cols-[68px_1fr] gap-2 text-xs leading-snug' : 'rounded-xl bg-white/70 px-3 py-2 text-sm'} font-semibold`}>
            <span className={`${compact ? 'text-[#6b7280]' : 'block text-[10px] font-bold uppercase text-muted-foreground'}`}>{label}</span>
            <span className={`${compact ? 'text-[#1f2937]' : 'mt-1 block text-editorial-charcoal'}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const BespokeProductionPanel = ({ order, compact = false }) => {
  const { t } = useTranslate();
  if (!isBespokeOrder(order)) return null;
  const currentStatus = order.bespokeProductionStatus || 'review_brief';
  const activeStep = getBespokeProductionStep(currentStatus);

  return (
    <div className={`${compact ? 'mt-3 p-3' : 'mt-4 p-4'} rounded-2xl border border-editorial-charcoal/10 bg-[#fbfaf7]`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-editorial-charcoal sm:text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          {t('cust.bespokeProduction')}
        </div>
        <span className="rounded-full bg-editorial-ivory px-2.5 py-1 text-[10px] font-bold uppercase text-editorial-charcoal">
          {labelFrom(bespokeProductionKeys, bespokeProductionStatusLabels, currentStatus, t)}
        </span>
      </div>
      <div className={`mt-3 grid grid-cols-6 ${compact ? 'gap-1' : 'gap-2'}`}>
        {bespokeProductionSteps.map((step, index) => {
          const done = activeStep >= index;
          return (
            <div key={step} className="min-w-0">
              <div className={`${compact ? 'h-1.5' : 'h-2'} rounded-full ${done ? 'bg-editorial-charcoal' : 'bg-stone-200'}`} />
              <div className={`mt-1 truncate font-bold uppercase ${compact ? 'text-[7px]' : 'text-[9px]'} ${done ? 'text-editorial-charcoal' : 'text-muted-foreground'}`}>
                {labelFrom(bespokeProductionKeys, bespokeProductionStatusLabels, step, t)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ShipmentPanel = ({ order, compact = false }) => {
  const { t } = useTranslate();
  if (!order || order.shipmentStatus === 'not_ready') return null;
  const courierSearchUrl = buildCourierTrackingSearchUrl({
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
  });

  return (
    <div className={`${compact ? 'mt-3 p-3' : 'mt-4 p-4'} rounded-2xl border border-editorial-charcoal/10 bg-white`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-editorial-charcoal sm:text-xs">
          <Truck className="h-3.5 w-3.5" />
          {t('cust.delivery')}
        </div>
        <ShipmentBadge status={order.shipmentStatus} />
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {order.courierName ? (
          <div className="rounded-xl bg-[#f8f7f4] px-3 py-2 text-sm font-semibold">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">{t('cust.courier')}</div>
            <div className="mt-1 text-editorial-charcoal">{order.courierName}</div>
          </div>
        ) : null}
        {order.trackingNumber ? (
          <div className="rounded-xl bg-[#f8f7f4] px-3 py-2 text-sm font-semibold">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">{t('cust.waybill')}</div>
            <div className="mt-1 text-editorial-charcoal">{order.trackingNumber}</div>
          </div>
        ) : null}
        {order.shippedAt ? (
          <div className="rounded-xl bg-[#f8f7f4] px-3 py-2 text-sm font-semibold">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">{t('cust.shipDate')}</div>
            <div className="mt-1 text-editorial-charcoal">{formatDate(order.shippedAt, t)}</div>
          </div>
        ) : null}
        {order.deliveredAt ? (
          <div className="rounded-xl bg-[#f8f7f4] px-3 py-2 text-sm font-semibold">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">{t('cust.delivered')}</div>
            <div className="mt-1 text-editorial-charcoal">{formatDate(order.deliveredAt, t)}</div>
          </div>
        ) : null}
      </div>
      {order.trackingUrl ? (
        <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="mt-3 flex h-11 items-center justify-center gap-2 rounded-2xl bg-editorial-charcoal px-3 text-xs font-bold text-editorial-ivory">
          <ExternalLink className="h-4 w-4" />
          {t('cust.trackWaybill')}
        </a>
      ) : null}
      {!order.trackingUrl && courierSearchUrl ? (
        <a href={courierSearchUrl} target="_blank" rel="noreferrer" className="mt-3 flex h-11 items-center justify-center gap-2 rounded-2xl bg-editorial-charcoal px-3 text-xs font-bold text-editorial-ivory">
          <ExternalLink className="h-4 w-4" />
          {t('cust.searchWaybill')}
        </a>
      ) : null}
      <a href={buildPublicTrackingUrl(order.orderNumber)} target="_blank" rel="noreferrer" className="mt-2 flex h-11 items-center justify-center gap-2 rounded-2xl border border-editorial-charcoal/15 bg-white px-3 text-xs font-bold text-editorial-charcoal">
        <ExternalLink className="h-4 w-4" />
        {t('cust.publicTracking')}
      </a>
    </div>
  );
};

const SelfServiceActions = ({
  compact = false,
  isMobileRoute,
  invoicePath,
  onReorder,
  onRefreshPayment,
  order,
  refreshing = false,
}) => {
  const { t, isInternational } = useTranslate();
  const paymentPath = buildPaymentPath({ isMobileRoute, order });
  // Reorder fills the cart and sends the buyer to it. The English shop has no cart and /en/cart
  // redirects, so the button would quietly stock a basket nobody can open and drop the customer on the
  // catalogue — a dead end that looks like a bug rather than a policy.
  const canReorder = !isInternational && getOrderProductItems(order).length > 0;
  const showOpenPayment = canOpenPayment(order) && !(isManualTransferPayment(order.paymentProvider) && canUploadPaymentProof(order));
  const buttonClass = compact
    ? 'flex h-11 items-center justify-center gap-2 rounded-2xl text-xs font-bold'
    : 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold';
  const outlineClass = `${buttonClass} border border-editorial-charcoal/15 bg-white text-editorial-charcoal`;
  const primaryClass = `${buttonClass} bg-editorial-charcoal text-editorial-ivory`;
  const courierSearchUrl = buildCourierTrackingSearchUrl({
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
  });

  return (
    <div className={compact ? 'mt-3 grid gap-2' : 'mt-4 flex flex-wrap gap-2'}>
      {canUploadPaymentProof(order) ? (
        <Link to={paymentPath} className={primaryClass}>
          <Upload className="h-4 w-4" />
          {t('cust.uploadProofShort')}
        </Link>
      ) : null}
      {showOpenPayment ? (
        <Link to={paymentPath} className={primaryClass}>
          <CreditCard className="h-4 w-4" />
          {t('cust.continuePay')}
        </Link>
      ) : null}
      <Link to={invoicePath(order.orderNumber)} className={outlineClass}>
        <FileText className="h-4 w-4" />
        {t('cust.downloadInvoice')}
      </Link>
      {canTrackShipment(order) ? (
        <a href={order.trackingUrl} target="_blank" rel="noreferrer" className={primaryClass}>
          <ExternalLink className="h-4 w-4" />
          {t('cust.trackParcel')}
        </a>
      ) : null}
      {!canTrackShipment(order) && courierSearchUrl ? (
        <a href={courierSearchUrl} target="_blank" rel="noreferrer" className={primaryClass}>
          <ExternalLink className="h-4 w-4" />
          {t('cust.searchWaybill')}
        </a>
      ) : null}
      <a href={buildPublicTrackingUrl(order.orderNumber)} target="_blank" rel="noreferrer" className={outlineClass}>
        <ExternalLink className="h-4 w-4" />
        {t('cust.publicTracking')}
      </a>
      {/* Hidden rather than disabled in the English shop: a greyed button is still an offer, and this
          one cannot be honoured there at all. */}
      {isInternational ? null : (
        <button type="button" onClick={() => onReorder(order)} disabled={!canReorder} className={`${outlineClass} disabled:opacity-50`}>
          <ShoppingBag className="h-4 w-4" />
          {t('cust.orderAgain')}
        </button>
      )}
      {order.paymentProvider === 'doku' && ['unpaid', 'pending'].includes(order.paymentStatus) ? (
        <button type="button" onClick={() => onRefreshPayment(order)} disabled={refreshing} className={`${outlineClass} disabled:opacity-60`}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {t('cust.checkPayment')}
        </button>
      ) : null}
    </div>
  );
};

const CustomerPortalPage = () => {
  const { t, isInternational } = useTranslate();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, loginWithGoogle, rememberCustomerCode, logout } = useAuth();
  const { tier: priceTier } = useTierPrices();
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
  const [refreshingPaymentOrder, setRefreshingPaymentOrder] = useState('');
  const [securityFormOpen, setSecurityFormOpen] = useState(false);
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);
  const [codeSearchOpen, setCodeSearchOpen] = useState(false);
  const [lastCustomerCode, setLastCustomerCode] = useState(() => readLastCustomerCode());

  const latestOrder = portal?.orders?.[0];
  const isMobileRoute = location.pathname.startsWith('/mobile');
  const invoicePath = (orderNumber) => `${isMobileRoute ? '/mobile/customer/invoice' : '/customer/invoice'}/${orderNumber}?code=${encodeURIComponent(portal?.customer?.customerCode || customerCode)}`;
  const activeOrders = useMemo(() => (
    portal?.orders?.filter((order) => !['completed', 'cancelled'].includes(order.status)) || []
  ), [portal]);

  const lastLoadedCodeRef = useRef('');

  const loadPortalForCode = useCallback(async (code, { silent = false } = {}) => {
    if (!code.trim()) {
      if (!silent) toast.error(t('cust.codeRequired'));
      return;
    }

    setLoading(true);
    setSearched(true);
    const result = await getCustomerPortalByCode(code);
    setLoading(false);

    if (!result) {
      setPortal(null);
      if (!silent) toast.error(t('cust.codeNotFound'));
      return;
    }

    // Remember the resolved code so the setSearchParams() below (which updates the URL
    // and re-triggers the effect) doesn't cause a duplicate fetch + duplicate toast.
    lastLoadedCodeRef.current = result.customer.customerCode;
    setPortal(result);
    setSecurityAnswer('');
    setSecurityQuestion(result.customer.securityQuestion || '');
    setSecurityFormOpen(false);
    setCustomerCode(result.customer.customerCode);
    setLastCustomerCode(result.customer.customerCode);
    writeLastCustomerCode(result.customer.customerCode);
    setSearchParams({ code: result.customer.customerCode });
    if (!silent) toast.success(t('cust.codeLoaded', { code: result.customer.customerCode }));
  }, [setSearchParams, t]);

  useEffect(() => {
    if (initialCode && lastLoadedCodeRef.current !== initialCode) {
      lastLoadedCodeRef.current = initialCode;
      loadPortalForCode(initialCode);
    }
  }, [initialCode, loadPortalForCode]);

  // Logged-in customer: open the portal by their linked account (no code needed);
  // fall back to a code saved on their profile for legacy sessions.
  useEffect(() => {
    if (!currentUser || initialCode) return undefined;
    let cancelled = false;
    (async () => {
      const account = await getCustomerAccount();
      if (cancelled) return;
      if (account?.customer?.customerCode) {
        lastLoadedCodeRef.current = account.customer.customerCode;
        setPortal(account);
        setSearched(true);
        setCustomerCode(account.customer.customerCode);
        setSecurityQuestion(account.customer.securityQuestion || '');
        return;
      }
      const savedCode = currentUser?.user_metadata?.customer_code;
      if (savedCode && lastLoadedCodeRef.current !== savedCode) {
        lastLoadedCodeRef.current = savedCode;
        setCustomerCode(savedCode);
        loadPortalForCode(savedCode, { silent: true });
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser, initialCode, loadPortalForCode]);

  // Once a logged-in customer resolves a code, remember it on their profile so they
  // never have to type it again. user_metadata is user-editable, so this is the same
  // trust level as the existing code + security-question gate — not stronger.
  useEffect(() => {
    const code = portal?.customer?.customerCode;
    if (code && currentUser && currentUser.user_metadata?.customer_code !== code) {
      rememberCustomerCode(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal, currentUser]);

  const signInGoogle = async () => {
    try {
      await loginWithGoogle(`${window.location.origin}${isMobileRoute ? '/mobile/customer' : '/customer'}`);
    } catch (error) {
      toast.error(publicErrorMessage(error, t('cust.googleFail')));
    }
  };

  const [profileName, setProfileName] = useState('');
  const [profileContact, setProfileContact] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [claimCodeValue, setClaimCodeValue] = useState('');
  const [claimAnswer, setClaimAnswer] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);

  // Keep the account/address form in sync with the loaded customer.
  useEffect(() => {
    const customer = portal?.customer;
    setProfileName(customer?.customerName && customer.customerName !== 'Customer' ? customer.customerName : '');
    setProfileContact(customer?.contact && customer.contact !== '-' ? customer.contact : '');
    setProfileAddress(customer?.deliveryAddress || '');
  }, [portal]);

  const submitProfile = async (event) => {
    event.preventDefault();
    if (!profileName.trim() || !profileContact.trim()) {
      toast.error(t('cust.nameContactRequired'));
      return;
    }
    setProfileLoading(true);
    try {
      const result = await saveCustomerAccount({
        customerName: profileName,
        contact: profileContact,
        deliveryAddress: profileAddress,
      });
      lastLoadedCodeRef.current = result.customer.customerCode;
      setPortal(result);
      setSearched(true);
      setCustomerCode(result.customer.customerCode);
      toast.success(t('cust.profileSaved'));
    } catch (error) {
      toast.error(publicErrorMessage(error, t('cust.profileSaveFailed')));
    } finally {
      setProfileLoading(false);
    }
  };

  const submitClaim = async (event) => {
    event.preventDefault();
    if (!claimCodeValue.trim()) {
      toast.error(t('cust.codeFieldRequired'));
      return;
    }
    setClaimLoading(true);
    try {
      const result = await claimCustomerCode(claimCodeValue, claimAnswer);
      lastLoadedCodeRef.current = result.customer.customerCode;
      setPortal(result);
      setSearched(true);
      setCustomerCode(result.customer.customerCode);
      setClaimCodeValue('');
      setClaimAnswer('');
      toast.success(t('cust.codeLinked', { code: result.customer.customerCode }));
    } catch (error) {
      toast.error(publicErrorMessage(error, t('cust.linkFailed')));
    } finally {
      setClaimLoading(false);
    }
  };

  // Account + address book panel, shown to logged-in customers on both layouts.
  const renderAccountPanel = () => {
    if (!currentUser) return null;
    // "Harga member aktif" is a claim, so it comes from the server-resolved tier, never from being signed
    // in — a signed-in account whose tier row has not resolved yet is not told it has a price it may not.
    const memberActive = priceTier === 'member' || priceTier === 'reseller';
    const inputClass = 'h-11 w-full rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-editorial-charcoal';
    return (
      <section className="mobile-card rounded-2xl border bg-white p-4 shadow-sm">
        <button type="button" onClick={() => setAccountPanelOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 text-left">
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-editorial-ivory text-editorial-charcoal">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase text-editorial-charcoal">
                {t('cust.accountAddress')}
                {memberActive ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-800">{t('cust.memberActive')}</span> : null}
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#6b7280]">{currentUser.email}</span>
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-editorial-paper px-3 py-1 text-[10px] font-bold uppercase text-editorial-charcoal">
            {accountPanelOpen ? t('cust.close') : t('cust.edit')}
          </span>
        </button>
        {!accountPanelOpen ? null : (
        <div className="mt-3 border-t border-[#e5e7eb] pt-3">
        <form onSubmit={submitProfile} className="grid gap-2">
          <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder={t('cust.recipientName')} className={inputClass} />
          <input value={profileContact} onChange={(e) => setProfileContact(e.target.value)} placeholder={t('cust.phone')} className={inputClass} />
          <textarea value={profileAddress} onChange={(e) => setProfileAddress(e.target.value)} rows="2" placeholder={t('cust.fullAddress')} className={`${inputClass} h-auto py-2`} />
          <Button type="submit" disabled={profileLoading} className="h-11 rounded-2xl gap-2">
            {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
            {t('cust.saveAddress')}
          </Button>
        </form>

        <form onSubmit={submitClaim} className="mt-4 grid gap-2 border-t border-[#e5e7eb] pt-3">
          <div className="text-[11px] font-bold uppercase text-[#6b7280]">{t('cust.haveOldCode')}</div>
          <input value={claimCodeValue} onChange={(e) => setClaimCodeValue(e.target.value.toUpperCase())} placeholder="SOLI09232" className={`${inputClass} uppercase tracking-[0.08em]`} />
          <input value={claimAnswer} onChange={(e) => setClaimAnswer(e.target.value)} placeholder={t('cust.answerIfAny')} className={inputClass} />
          <Button type="submit" variant="outline" disabled={claimLoading} className="h-11 rounded-2xl gap-2 bg-white">
            {claimLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {t('cust.linkCode')}
          </Button>
        </form>
        </div>
        )}
      </section>
    );
  };

  const loadPortal = async (event) => {
    event?.preventDefault();
    await loadPortalForCode(customerCode);
  };

  const pasteCustomerCode = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      toast.error(t('cust.pasteBlocked'));
      return;
    }

    try {
      const pastedCode = (await navigator.clipboard.readText()).trim().toUpperCase();
      if (!pastedCode) {
        toast.warning(t('cust.clipboardEmpty'));
        return;
      }
      setCustomerCode(pastedCode);
      toast.success(t('cust.codePasted'));
    } catch {
      toast.error(t('cust.pasteFailed'));
    }
  };

  const checkLastCustomerCode = async () => {
    const code = lastCustomerCode || readLastCustomerCode();
    if (!code) {
      toast.warning(t('cust.noLastCode'));
      return;
    }
    setCustomerCode(code);
    await loadPortalForCode(code);
  };

  const copyCode = async () => {
    if (!portal?.customer?.customerCode) return;
    const copied = await copyTextToClipboard(portal.customer.customerCode);
    copied ? toast.success(t('cust.codeCopied', { code: portal.customer.customerCode })) : toast.error(t('cust.copyFailed'));
  };

  const unlockPortal = async (event) => {
    event.preventDefault();
    if (!securityAnswer.trim()) {
      toast.error(t('cust.securityAnswerRequired'));
      return;
    }

    setSecurityLoading(true);
    const result = await verifyCustomerPortalSecurity(customerCode, securityAnswer);
    setSecurityLoading(false);

    if (!result) {
      toast.error(t('cust.securityAnswerWrong'));
      return;
    }

    setPortal(result);
    setSecurityQuestion(result.customer.securityQuestion || '');
    setSecurityAnswer('');
    toast.success(t('cust.dashOpened'));
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
      toast.success(t('cust.securitySaved'));
    } catch (error) {
      toast.error(publicErrorMessage(error, t('cust.securitySaveFailed')));
    } finally {
      setSavingSecurity(false);
    }
  };

  const refreshPaymentStatus = async (order) => {
    if (!order?.orderNumber) return;

    setRefreshingPaymentOrder(order.orderNumber);
    try {
      const result = await refreshDokuPaymentStatus(order.orderNumber);
      await loadPortalForCode(portal?.customer?.customerCode || customerCode, { silent: true });
      const statusLabel = labelFrom(paymentStatusKeys, paymentStatusLabels, result.paymentStatus, t) || t('cust.paymentChecking');
      if (result.syncApplied) {
        toast.success(t('cust.paymentIs', { status: statusLabel }));
      } else {
        toast.warning(t('cust.paymentChecked'));
      }
    } catch (error) {
      toast.error(publicErrorMessage(error, t('cust.refreshFailed')));
    } finally {
      setRefreshingPaymentOrder('');
    }
  };

  const renewDokuPayment = async (order) => {
    if (!order?.orderNumber) return;

    setRefreshingPaymentOrder(order.orderNumber);
    try {
      // The endpoint mints the DOKU session AND persists it to the order with the service role, so the
      // return value is not needed here — reloading the portal picks up the new payment_url. The browser
      // copy of that write was filtered by RLS for every buyer and now throws (audit round 9).
      await createDokuCheckout({
        order,
        amount: order.subtotal,
        customerName: order.customerName,
        contact: order.contact,
        items: order.items || [],
        callbackPath: isMobileRoute ? '/mobile/payment' : '/payment',
      });
      await loadPortalForCode(portal?.customer?.customerCode || customerCode, { silent: true });
      toast.success(t('cust.dokuReady'));
      navigate(buildPaymentPath({ isMobileRoute, order: { ...order, paymentProvider: 'doku' } }));
    } catch (error) {
      toast.error(publicErrorMessage(error, t('cust.dokuFailed')));
    } finally {
      setRefreshingPaymentOrder('');
    }
  };

  // "Pesan lagi" fills the cart and hands the buyer to the normal checkout, instead of the second
  // checkout implementation that used to live here. That one priced the order in the browser and called
  // createOrder() directly, which is the third path around /api/orders/create and the reason anon INSERT
  // on storefront_orders could not be revoked (audit round 9). Going through the cart means the reorder
  // gets the same server-recomputed prices, live shipping quote, and stock/voucher validation as any
  // other order. reconcileCartLines reprices every line against the live catalog on read, so nothing
  // here needs to carry a price.
  const handleReorder = (order) => {
    const productItems = getOrderProductItems(order);
    if (!productItems.length) {
      toast.error(t('cust.noItemsToReorder'));
      return;
    }

    productItems.forEach((item) => {
      const quantity = Math.max(Number(item.quantity || 1), 1);
      addCartItem({
        id: item.productId || item.id || item.slug || item.name,
        slug: item.productSlug || item.slug,
        cartSlug: item.slug || item.productSlug || item.productId || item.name,
        productSlug: item.productSlug || item.slug,
        variantId: item.variantId || '',
        name: item.name,
        price: item.price,
        priceNumber: Number(item.priceNumber || 0),
        size: item.size || '',
        category: item.category || '',
        notes: item.notes || '',
      }, quantity);
    });

    // Hand the saved details to checkout. A portal visitor who came in with just a customer code is not
    // logged in, so checkout's own account prefill never fires for them.
    const customer = portal?.customer || {};
    seedCheckoutDraft({
      customerCode: customer.customerCode || customerCode,
      customerName: customer.customerName && customer.customerName !== 'Customer' ? customer.customerName : order.customerName,
      contact: customer.contact && customer.contact !== '-' ? customer.contact : order.contact,
      deliveryAddress: customer.deliveryAddress,
      deliveryArea: customer.deliveryArea,
      destinationSearch: customer.deliveryArea,
    });

    // Carry the old voucher code over as an intent only — checkout revalidates it against the DB and
    // drops it with a message if it no longer applies.
    const previousVoucher = getOrderVoucherSnapshot(order);
    if (previousVoucher?.code) {
      setAppliedVoucherCode(previousVoucher.code);
    }

    toast.success(t('cust.itemsToCart', { order: order.orderNumber }));
    navigate(isMobileRoute ? '/mobile/checkout' : '/checkout');
  };


  if (isMobileRoute) {
    return (
      <MobileCommerceLayout>
        <Helmet>
          <title>{t('cust.tab')}</title>
          <meta name="description" content={t('cust.meta')} />
        </Helmet>
        <main className="mobile-page space-y-4">
          <section className="mobile-soft-card overflow-hidden">
            <div className="relative overflow-hidden bg-[#121110] p-4 text-editorial-ivory">
              <div className="absolute -right-8 top-0 h-28 w-28 rounded-full border border-white/10" />
              <div className="absolute right-6 top-10 h-16 w-16 rounded-full border border-[#d6c68a]/20" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase text-[#cbd6c5]">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  {t('cust.trackOrders')}
                </div>
                <h1 className="mt-3 text-2xl font-bold leading-tight">{t('cust.checkProgress')}</h1>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#cbd6c5]">
                  {t('cust.oneplace')}
                </p>
                {/* Same reason as the desktop hero below, and this is the surface most of them are on:
                    the English shop has no checkout, so a reader abroad who reaches their account has
                    nowhere else to arrange an order from. The phone hero does not carry the sentence
                    that says so, which is exactly why the button had to be put here on purpose. */}
                {isInternational ? (
                  <AskAtelierButton
                    labelKey="intl.noticeCta"
                    draftKey="intl.noticeMessage"
                    className="mt-3 w-full"
                  />
                ) : null}
              </div>
            </div>
            <form onSubmit={loadPortal} className="grid gap-3 p-4">
              {/* Logged-in: greet + let orders take focus. Code lookup collapses into a small option. */}
              {currentUser ? (
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-editorial-ivory px-3 py-2 text-xs font-semibold text-editorial-charcoal">
                  <span className="min-w-0 truncate">{t('cust.signedInAs', { email: currentUser.email })}</span>
                  <button type="button" onClick={logout} className="shrink-0 font-bold underline underline-offset-4">{t('cust.signOut')}</button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white gap-2 text-sm font-bold" onClick={signInGoogle}>
                  <UserRound className="h-4 w-4" />
                  {t('cust.signInMember')}
                </Button>
              )}

              {currentUser ? (
                <button type="button" onClick={() => setCodeSearchOpen((open) => !open)} className="flex items-center justify-between rounded-2xl border border-[#e5e7eb] bg-white px-3 py-2 text-[11px] font-bold uppercase text-[#6b7280]">
                  <span className="inline-flex items-center gap-2"><Search className="h-3.5 w-3.5" /> {t('cust.findByCode')}</span>
                  <span>{codeSearchOpen ? t('cust.close') : t('cust.open')}</span>
                </button>
              ) : null}

              {(!currentUser || codeSearchOpen) ? (
                <>
                  <label className="text-[10px] font-bold uppercase text-[#6b7280]">{t('cust.customerCode')}</label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      value={customerCode}
                      onChange={(event) => setCustomerCode(event.target.value.toUpperCase())}
                      placeholder="SOLI09232"
                      className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-bold uppercase tracking-[0.08em] outline-none focus:border-editorial-charcoal"
                    />
                    <Button type="submit" className="h-12 rounded-2xl px-4" disabled={loading} aria-label={t('cust.checkCode')}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2 text-xs font-bold" onClick={pasteCustomerCode}>
                      <ClipboardPaste className="h-4 w-4" />
                      {t('cust.pasteCode')}
                    </Button>
                    <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2 text-xs font-bold" onClick={checkLastCustomerCode} disabled={loading || !lastCustomerCode}>
                      <History className="h-4 w-4" />
                      {t('cust.lastCheck')}
                    </Button>
                  </div>
                  {lastCustomerCode ? (
                    <button type="button" onClick={checkLastCustomerCode} className="text-left text-[11px] font-bold text-editorial-charcoal underline underline-offset-4">
                      {t('cust.lastUsed', { code: lastCustomerCode })}
                    </button>
                  ) : null}
                  <p className="text-xs font-semibold leading-relaxed text-[#6b7280]">
                    {t('cust.codeGiven')}
                  </p>
                </>
              ) : null}
            </form>
          </section>

          {loading ? (
            <MobileCustomerPortalSkeleton />
          ) : portal?.requiresSecurity ? (
            <section className="mobile-card p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-editorial-ivory text-editorial-charcoal">
                  <KeyRound className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-[10px] font-bold uppercase text-editorial-charcoal">{t('cust.securityCheck')}</div>
                  <h2 className="mt-1 text-lg font-bold text-editorial-charcoal">{t('cust.protectedDash')}</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">{t('cust.answerSecurity')}</p>
                </div>
              </div>
              <form onSubmit={unlockPortal} className="mt-4 grid gap-3">
                <div className="rounded-2xl bg-editorial-paper p-3">
                  <div className="text-[10px] font-bold uppercase text-[#6b7280]">{t('cust.question')}</div>
                  <div className="mt-1 text-sm font-bold text-editorial-charcoal">{portal.customer.securityQuestion}</div>
                </div>
                <input
                  type="password"
                  autoComplete="off"
                  value={securityAnswer}
                  onChange={(event) => setSecurityAnswer(event.target.value)}
                  placeholder={t('cust.answer')}
                  className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-editorial-charcoal"
                />
                <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={securityLoading}>
                  {securityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {t('cust.open')}
                </Button>
              </form>
            </section>
          ) : portal ? (
            <>
              <section className="mobile-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-editorial-charcoal">{t('cust.welcomeBack')}</div>
                    <h2 className="mt-1 truncate text-lg font-bold text-editorial-charcoal">{portal.customer.customerName}</h2>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">{portal.customer.masked ? t('cust.hiddenForSecurity') : portal.customer.contact}</p>
                  </div>
                  <button type="button" onClick={copyCode} className="shrink-0 rounded-2xl bg-editorial-charcoal px-3 py-2 text-xs font-bold tracking-[0.12em] text-editorial-ivory">
                    {portal.customer.customerCode}
                  </button>
                </div>
                {portal.customer.masked ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-relaxed text-amber-800">
                    {t('cust.maskedNoteMobile')} <button type="button" onClick={signInGoogle} className="font-bold underline underline-offset-2">{t('cust.withGoogle')}</button> {t('cust.withGoogleAccount')}
                  </div>
                ) : null}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-editorial-charcoal/10 bg-editorial-paper p-3 text-center">
                    <div className="text-sm font-bold text-editorial-charcoal">{portal.orders.length}</div>
                    <div className="text-[10px] font-bold uppercase text-[#6b7280]">{t('cust.orders')}</div>
                  </div>
                  <div className="rounded-2xl border border-editorial-charcoal/10 bg-editorial-ivory p-3 text-center">
                    <div className="text-sm font-bold text-editorial-charcoal">{activeOrders.length}</div>
                    <div className="text-[10px] font-bold uppercase text-editorial-charcoal">{t('cust.active')}</div>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-center">
                    <div className="truncate text-xs font-bold text-amber-800">{latestOrder ? labelFrom(orderStatusKeys, statusLabels, latestOrder.status, t) : '-'}</div>
                    <div className="text-[10px] font-bold uppercase text-amber-700">{t('cust.latest')}</div>
                  </div>
                </div>
              </section>

              <section className="mobile-card p-3">
                <button type="button" onClick={() => setSecurityFormOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 text-left">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-editorial-ivory text-editorial-charcoal">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-editorial-charcoal">{portal.customer.securityEnabledAt ? t('cust.protectedDash') : t('cust.dashProtection')}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#6b7280]">{t('cust.securityOptional')}</span>
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-editorial-paper px-3 py-1 text-[10px] font-bold uppercase text-editorial-charcoal">
                    {securityFormOpen ? t('cust.close') : t('cust.open')}
                  </span>
                </button>
                {securityFormOpen ? (
                  <form onSubmit={saveSecurity} className="mt-3 grid gap-2 border-t border-[#e5e7eb] pt-3">
                    {portal.customer.securityEnabledAt ? (
                      <input value={currentSecurityAnswer} onChange={(event) => setCurrentSecurityAnswer(event.target.value)} placeholder={t('cust.currentAnswer')} className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-editorial-charcoal" />
                    ) : null}
                    <input value={securityQuestion} onChange={(event) => setSecurityQuestion(event.target.value)} placeholder={t('cust.securityQuestion')} className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-editorial-charcoal" />
                    <input value={newSecurityAnswer} onChange={(event) => setNewSecurityAnswer(event.target.value)} placeholder={t('cust.answer')} className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-editorial-charcoal" />
                    <Button type="submit" className="h-11 rounded-2xl gap-2" disabled={savingSecurity}>
                      {savingSecurity ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      {t('cust.saveProtection')}
                    </Button>
                  </form>
                ) : null}
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-bold text-editorial-charcoal">{t('cust.orderProgress')}</h2>
                {portal.orders.map((order) => {
                  const bespoke = isBespokeOrder(order);
                  const bespokeItem = getBespokeItem(order);
                  return (
                    <article key={order.orderNumber} className="mobile-card overflow-hidden p-0">
                      <div className="border-b border-[#e5e7eb] bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-bold text-editorial-charcoal">{order.orderNumber}</h3>
                            <p className="mt-1 text-xs font-semibold text-[#6b7280]">{formatDate(order.createdAt, t)}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <StatusBadge status={order.status} />
                            <PaymentBadge status={order.paymentStatus} />
                            {isManualTransferPayment(order.paymentProvider) ? <PaymentProofBadge status={order.paymentProofStatus || 'missing'} /> : null}
                            {order.shipmentStatus && order.shipmentStatus !== 'not_ready' ? <ShipmentBadge status={order.shipmentStatus} /> : null}
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[10px] font-bold uppercase text-[#6b7280]">{bespoke ? t('cust.customPerfume') : t('cust.orderItems')}</div>
                        <div className="text-sm font-bold text-editorial-charcoal">{formatTotal(order.subtotal)}</div>
                      </div>
                      <div className="mt-3">
                        <OrderItems order={order} compact />
                      </div>
                      <BespokeDetailPanel item={bespokeItem} compact />
                      <BespokeProductionPanel order={order} compact />
                      <PaymentExperiencePanel order={order} compact />
                      <PaymentTaskPanel
                        compact
                        isMobileRoute={isMobileRoute}
                        onRenewDokuPayment={renewDokuPayment}
                        order={order}
                        renewing={refreshingPaymentOrder === order.orderNumber}
                      />
                      <PaymentProofPanel order={order} compact />
                      <ShipmentPanel order={order} compact />
                      <div className="mt-3 rounded-2xl border border-editorial-charcoal/10 bg-editorial-paper p-3">
                        <div className="text-[10px] font-bold uppercase text-editorial-charcoal">{t('cust.selfService')}</div>
                        <SelfServiceActions
                          compact
                          isMobileRoute={isMobileRoute}
                          invoicePath={invoicePath}
                          onRefreshPayment={refreshPaymentStatus}
                          onReorder={handleReorder}
                          order={order}
                          refreshing={refreshingPaymentOrder === order.orderNumber}
                        />
                      </div>
                      <div className="mt-4">
                        <OrderTimeline order={order} compact />
                      </div>
                      </div>
                    </article>
                  );
                })}
                {!portal.orders.length ? (
                  <StateBlock
                    className="mobile-card"
                    icon={PackageCheck}
                    title={t('cust.noOrders')}
                    description={t('cust.noOrdersBody')}
                  />
                ) : null}
              </section>
            </>
          ) : (
            <section className="mobile-card p-5 text-center">
              {searched ? <Search className="mx-auto h-8 w-8 text-amber-700" /> : <ShoppingBag className="mx-auto h-8 w-8 text-amber-700" />}
              <h2 className="mt-3 text-lg font-bold text-editorial-charcoal">{searched ? t('cust.codeNotFound') : t('cust.memberWaiting')}</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                {searched ? t('cust.checkSoliCode') : t('cust.memberWaitingBody')}
              </p>
            </section>
          )}

          {renderAccountPanel()}
        </main>
      </MobileCommerceLayout>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t('cust.tab')}</title>
        <meta name="description" content={t('cust.meta')} />
      </Helmet>
      <main className="min-h-screen bg-editorial-paper text-editorial-charcoal">
        <StorefrontHeader backTo="/home" backLabel={t('cust.home')} actions={[{ to: '/catalog', label: t('cust.catalog') }]} />

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
          <div className="space-y-5">
            <div className="rounded-[28px] border border-editorial-charcoal/10 bg-white/70 p-6 shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-full border border-editorial-charcoal/15 bg-white px-3 py-1 text-xs font-bold uppercase text-editorial-charcoal">
                <UserRound className="h-4 w-4" />
                {t('cust.eyebrow')}
              </div>
              <h1 className="storefront-display-heading mt-5 text-4xl font-bold sm:text-5xl">{t('cust.heroTitle')}</h1>
              <p className="mt-4 text-base font-medium leading-relaxed text-muted-foreground">
                {t('cust.heroBody')}
              </p>
              {/* The English shop has no checkout: that sentence tells a reader abroad their order is
                  arranged on WhatsApp, so the way to arrange one belongs under it rather than in the
                  footer. The Indonesian sentence says nothing of the kind — there is a checkout — so
                  there is nothing here to answer. */}
              {isInternational ? (
                <AskAtelierButton
                  labelKey="intl.noticeCta"
                  draftKey="intl.noticeMessage"
                  className="mt-4 w-full sm:w-auto"
                />
              ) : null}
            </div>

            <form onSubmit={loadPortal} className="rounded-2xl border bg-white p-4 shadow-sm">
              <label className="text-xs font-bold uppercase text-muted-foreground">{t('cust.customerCode')}</label>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={customerCode}
                  onChange={(event) => setCustomerCode(event.target.value.toUpperCase())}
                  placeholder="SOLI09232"
                  className="h-12 rounded-2xl border px-4 text-sm font-bold uppercase tracking-[0.08em] outline-none focus:border-editorial-charcoal"
                />
                <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {t('cust.check')}
                </Button>
              </div>
              <p className="mt-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                {t('cust.codeGivenKeep')}
              </p>
              {currentUser ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-editorial-ivory px-4 py-2 text-xs font-semibold text-editorial-charcoal">
                  <span className="min-w-0 truncate">{t('cust.signedInAs', { email: currentUser.email })}</span>
                  <button type="button" onClick={logout} className="shrink-0 font-bold underline underline-offset-4">{t('cust.signOut')}</button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="mt-3 h-12 w-full rounded-2xl gap-2 text-sm font-bold" onClick={signInGoogle}>
                  <UserRound className="h-4 w-4" />
                  {t('cust.signInMember')}
                </Button>
              )}
            </form>
            {renderAccountPanel()}
          </div>

          <div className="space-y-4">
            {portal?.requiresSecurity ? (
              <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-editorial-ivory text-editorial-charcoal">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-bold uppercase text-editorial-charcoal">{t('cust.securityCheck')}</div>
                    <h2 className="mt-1 text-2xl font-bold">{t('cust.protectedDash')}</h2>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">
                      {t('cust.securityOnBody')}
                    </p>
                  </div>
                </div>
                <form onSubmit={unlockPortal} className="mt-5 grid gap-3">
                  <div className="rounded-2xl bg-editorial-paper p-4">
                    <div className="text-xs font-bold uppercase text-muted-foreground">{t('cust.question')}</div>
                    <div className="mt-1 text-base font-bold">{portal.customer.securityQuestion}</div>
                  </div>
                  <input
                    type="password"
                    autoComplete="off"
                    value={securityAnswer}
                    onChange={(event) => setSecurityAnswer(event.target.value)}
                    placeholder={t('cust.answer')}
                    className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-editorial-charcoal"
                  />
                  <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={securityLoading}>
                    {securityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {t('cust.openDashboard')}
                  </Button>
                </form>
              </section>
            ) : portal ? (
              <>
                <section className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase text-editorial-charcoal">{t('cust.welcomeBack')}</div>
                      <h2 className="mt-1 text-2xl font-bold">{portal.customer.customerName}</h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">{portal.customer.masked ? t('cust.hiddenForSecurity') : portal.customer.contact}</p>
                      {portal.customer.masked ? (
                        <p className="mt-2 text-xs font-semibold leading-relaxed text-amber-800">
                          {t('cust.forFullDetails')} <button type="button" onClick={signInGoogle} className="font-bold underline underline-offset-2">{t('cust.withGoogle')}</button> {t('cust.withGoogleAccount')}
                        </p>
                      ) : null}
                    </div>
                    <button type="button" onClick={copyCode} className="rounded-2xl bg-editorial-charcoal px-5 py-4 text-center text-xl font-bold tracking-[0.16em] text-editorial-ivory">
                      {portal.customer.customerCode}
                    </button>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-editorial-charcoal/10 bg-editorial-paper p-4">
                      <div className="text-xs font-bold uppercase text-muted-foreground">{t('cust.order')}</div>
                      <div className="mt-1 text-2xl font-bold">{portal.orders.length}</div>
                    </div>
                    <div className="rounded-2xl border border-editorial-charcoal/10 bg-editorial-ivory p-4">
                      <div className="text-xs font-bold uppercase text-muted-foreground">{t('cust.active')}</div>
                      <div className="mt-1 text-2xl font-bold">{activeOrders.length}</div>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                      <div className="text-xs font-bold uppercase text-muted-foreground">{t('cust.latest')}</div>
                      <div className="mt-1 text-sm font-bold">{latestOrder ? labelFrom(orderStatusKeys, statusLabels, latestOrder.status, t) : '-'}</div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border bg-white p-4 shadow-sm">
                  <button type="button" onClick={() => setSecurityFormOpen((open) => !open)} className="flex w-full items-center justify-between gap-4 text-left">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-editorial-ivory text-editorial-charcoal">
                        <ShieldCheck className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-lg font-bold">{portal.customer.securityEnabledAt ? t('cust.protectedDash') : t('cust.dashProtection')}</span>
                        <span className="mt-0.5 block text-sm font-semibold text-muted-foreground">{t('cust.addSecurityIf')}</span>
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-editorial-paper px-4 py-2 text-xs font-bold uppercase text-editorial-charcoal">
                      {securityFormOpen ? t('cust.close') : t('cust.open')}
                    </span>
                  </button>
                  {securityFormOpen ? (
                    <form onSubmit={saveSecurity} className="mt-4 grid gap-3 border-t pt-4">
                      {portal.customer.securityEnabledAt ? (
                        <input
                          value={currentSecurityAnswer}
                          onChange={(event) => setCurrentSecurityAnswer(event.target.value)}
                          placeholder={t('cust.currentAnswer')}
                          className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-editorial-charcoal"
                        />
                      ) : null}
                      <input
                        value={securityQuestion}
                        onChange={(event) => setSecurityQuestion(event.target.value)}
                        placeholder={t('cust.securityPlaceholder')}
                        className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-editorial-charcoal"
                      />
                      <input
                        value={newSecurityAnswer}
                        onChange={(event) => setNewSecurityAnswer(event.target.value)}
                        placeholder={t('cust.answer')}
                        className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-editorial-charcoal"
                      />
                      <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={savingSecurity}>
                        {savingSecurity ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        {t('cust.saveProtection')}
                      </Button>
                    </form>
                  ) : null}
                </section>

                <section className="rounded-2xl border bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-bold">{t('cust.orderProgress')}</h2>
                  <div className="mt-4 grid gap-4">
                    {portal.orders.map((order) => {
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
                                {isManualTransferPayment(order.paymentProvider) ? <PaymentProofBadge status={order.paymentProofStatus || 'missing'} /> : null}
                                {order.shipmentStatus && order.shipmentStatus !== 'not_ready' ? <ShipmentBadge status={order.shipmentStatus} /> : null}
                              </div>
                              <p className="mt-1 text-sm font-semibold text-muted-foreground">{formatDate(order.createdAt, t)}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold uppercase text-muted-foreground">{t('cust.itemCount', { count: order.quantity })}</div>
                              <div className="text-lg font-bold">{formatTotal(order.subtotal)}</div>
                            </div>
                            </div>
                          </div>

                          <div className="p-4">
                            <OrderItems order={order} />
                            {bespoke ? <BespokeDetailPanel item={bespokeItem} /> : null}
                            <BespokeProductionPanel order={order} />
                            <PaymentExperiencePanel order={order} />
                            <PaymentTaskPanel
                              isMobileRoute={isMobileRoute}
                              onRenewDokuPayment={renewDokuPayment}
                              order={order}
                              renewing={refreshingPaymentOrder === order.orderNumber}
                            />
                            <PaymentProofPanel order={order} />
                            <ShipmentPanel order={order} />
                            <div className="mt-4 rounded-2xl border border-editorial-charcoal/10 bg-editorial-paper p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-xs font-bold uppercase text-editorial-charcoal">{t('cust.selfService')}</div>
                                  <p className="mt-1 text-sm font-semibold text-muted-foreground">{t('cust.manageHere')}</p>
                                </div>
                              </div>
                              <SelfServiceActions
                                isMobileRoute={isMobileRoute}
                                invoicePath={invoicePath}
                                onRefreshPayment={refreshPaymentStatus}
                                onReorder={handleReorder}
                                order={order}
                                refreshing={refreshingPaymentOrder === order.orderNumber}
                              />
                            </div>
                            <div className="mt-5">
                              <OrderTimeline order={order} />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                    {!portal.orders.length ? (
                      <StateBlock
                        className="bg-[#fbfaf7]"
                        icon={PackageCheck}
                        title={t('cust.noOrders')}
                        description={t('cust.noOrdersBody')}
                      />
                    ) : null}
                  </div>
                </section>
              </>
            ) : (
              <section className="overflow-hidden rounded-[28px] border border-editorial-charcoal/10 bg-white shadow-sm">
                <div className="grid gap-0 lg:grid-cols-[1fr_0.9fr]">
                  <div className="grid min-h-[236px] place-items-center border-b border-editorial-charcoal/10 bg-[#fbfaf7] px-6 py-8 text-center lg:border-b-0 lg:border-r">
                    <StateBlock
                      className="border-0 bg-transparent p-0 shadow-none"
                      icon={searched ? Search : ShoppingBag}
                      title={searched ? t('cust.codeNotFound') : t('cust.memberWaiting')}
                      description={searched ? t('cust.checkSoliCodeYours') : t('cust.memberWaitingBody')}
                    />
                  </div>
                  <div className="grid content-center gap-3 bg-editorial-ivory p-5">
                    {[
                      ['1', 'cust.signInGoogle', 'cust.memberNow'],
                      ['2', 'cust.checkPayProd', 'cust.checkPayProdBody'],
                      ['3', 'cust.reorderFast', 'cust.reorderFastBody'],
                    ].map(([step, titleKey, descriptionKey]) => (
                      <div key={step} className="flex gap-3 rounded-2xl bg-white/82 p-3 shadow-sm shadow-editorial-charcoal/5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-editorial-charcoal text-xs font-bold text-editorial-ivory">{step}</span>
                        <span>
                          <span className="block text-sm font-bold text-editorial-charcoal">{t(titleKey)}</span>
                          <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#667264]">{t(descriptionKey)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        </section>
      </main>
    </>
  );
};

export default CustomerPortalPage;
