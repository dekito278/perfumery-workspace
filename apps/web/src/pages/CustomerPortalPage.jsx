import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ClipboardPaste, CreditCard, ExternalLink, FileCheck2, FileText, History, KeyRound, Loader2, PackageCheck, RefreshCw, Search, ShieldCheck, ShoppingBag, Sparkles, Truck, Upload, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import { paymentStatusLabels } from '@/utils/orderWorkflow.js';
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
  updateOrderPaymentStatus,
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

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-');

const statusLabels = getOrderStatusLabels();
const shipmentStatusLabels = getShipmentStatusLabels();
const bespokeProductionStatusLabels = getBespokeProductionStatusLabels();
const paymentProofStatusLabels = {
  missing: 'Belum upload bukti',
  submitted: 'Bukti terkirim',
  approved: 'Bukti disetujui',
  rejected: 'Bukti ditolak',
};
const paymentProofToneByStatus = {
  missing: 'warning',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
};

const progressSteps = [
  { key: 'created', label: 'Order dibuat' },
  { key: 'pending_payment', label: 'Menunggu bayar' },
  { key: 'paid', label: 'Sudah dibayar' },
  { key: 'processing', label: 'Diproses' },
  { key: 'shipped', label: 'Dikirim' },
  { key: 'completed', label: 'Selesai' },
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
  <StatusChip tone={getOrderStatusTone(status)}>
    {statusLabels[status] || status}
  </StatusChip>
);

const PaymentBadge = ({ status }) => (
  <StatusChip icon={CreditCard} tone={getPaymentStatusTone(status)}>
    {paymentStatusLabels[status] || status}
  </StatusChip>
);

const ShipmentBadge = ({ status }) => (
  <StatusChip icon={Truck} tone={getShipmentStatusTone(status)}>
    {shipmentStatusLabels[status] || status || 'Belum dikirim'}
  </StatusChip>
);

const PaymentProofBadge = ({ status }) => (
  <StatusChip icon={status === 'missing' ? Upload : FileCheck2} tone={paymentProofToneByStatus[status] || 'warning'}>
    {paymentProofStatusLabels[status] || status || paymentProofStatusLabels.missing}
  </StatusChip>
);

const getPaymentExperienceState = (order) => {
  if (!order) return null;
  if (order.status === 'cancelled') {
    return {
      label: 'Dibatalkan otomatis',
      title: 'Order dibatalkan',
      description: 'Order ini sudah tidak aktif. Pakai "Pesan lagi" untuk memasukkan itemnya ke keranjang dan checkout ulang.',
      className: 'border-slate-200 bg-slate-50 text-slate-800',
      iconClassName: 'bg-white text-slate-600',
      action: 'Pesan lagi',
    };
  }
  if (order.paymentStatus === 'paid') {
    return {
      label: 'Sudah dibayar',
      title: 'Pembayaran diterima',
      description: 'Order sudah masuk proses berikutnya. Pantau produksi atau pengiriman dari timeline.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      iconClassName: 'bg-white text-emerald-700',
      action: '',
    };
  }
  if (isManualTransferPayment(order.paymentProvider)) {
    const proofStatus = order.paymentProofStatus || 'missing';
    if (['submitted', 'approved'].includes(proofStatus)) {
      return {
        label: 'Menunggu verifikasi',
        title: 'Bukti transfer terkirim',
        description: 'Admin sedang mengecek bukti pembayaran. Status akan berubah setelah valid.',
        className: 'border-sky-200 bg-sky-50 text-sky-900',
        iconClassName: 'bg-white text-sky-700',
        action: 'Lihat bukti',
      };
    }
    return {
      label: 'Belum bayar manual',
      title: 'Upload bukti transfer',
      description: 'Transfer ke rekening yang tersedia, lalu upload bukti agar order bisa diverifikasi.',
      className: 'border-amber-200 bg-amber-50 text-amber-950',
      iconClassName: 'bg-white text-amber-700',
      action: 'Upload bukti',
    };
  }
  if (isDokuPaymentExpired(order) || order.paymentStatus === 'expired') {
    return {
      label: 'DOKU expired',
      title: 'Link pembayaran kedaluwarsa',
      description: 'Link DOKU hanya aktif sekitar 1 jam. Buat link baru untuk melanjutkan pembayaran.',
      className: 'border-rose-200 bg-rose-50 text-rose-900',
      iconClassName: 'bg-white text-rose-700',
      action: 'Buat link DOKU baru',
    };
  }
  return {
    label: 'Belum bayar',
    title: 'Menunggu pembayaran',
    description: 'Order sudah dibuat. Selesaikan pembayaran agar pesanan bisa diproses.',
    className: 'border-amber-200 bg-amber-50 text-amber-950',
    iconClassName: 'bg-white text-amber-700',
    action: 'Bayar sekarang',
  };
};

const PaymentExperiencePanel = ({ compact = false, order }) => {
  const state = getPaymentExperienceState(order);
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
  if (!isManualTransferPayment(order.paymentProvider)) return null;

  const status = order.paymentProofStatus || 'missing';
  const submitted = Boolean(order.paymentProofUrl) && ['submitted', 'approved'].includes(status);
  const rejected = status === 'rejected';
  const message = rejected
    ? 'Bukti transfer ditolak. Upload ulang bukti transfer dari halaman pembayaran.'
    : submitted
      ? 'Bukti transfer sudah terkirim dan sedang/selesai dicek admin.'
      : 'Bukti transfer belum diupload. Order manual baru diproses setelah bukti terkirim.';

  return (
    <div className={`mt-3 rounded-2xl border ${rejected || !submitted ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-100 bg-emerald-50 text-emerald-900'} ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-amber-700'}`}>
          {submitted ? <FileCheck2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-bold uppercase">Bukti transfer</div>
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
              Dikirim {formatDate(order.paymentProofUploadedAt)}
            </div>
          ) : null}
          {order.paymentProofNotes ? (
            <div className="mt-2 rounded-xl bg-white/75 px-3 py-2 text-xs font-semibold">
              Catatan admin: {order.paymentProofNotes}
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
    ? 'Transfer manual belum selesai'
    : dokuExpired
      ? 'Link DOKU sudah lewat 1 jam'
      : 'Pembayaran DOKU menunggu';
  const description = manualPayment
    ? 'Transfer ke rekening ini, lalu upload bukti dari tombol di bawah.'
    : dokuExpired
      ? 'Buat link DOKU baru supaya pembayaran bisa langsung dilanjutkan.'
      : 'Buka link pembayaran untuk menyelesaikan order.';

  return (
    <div className={`${compact ? 'mt-3 p-3' : 'mt-4 p-4'} rounded-2xl border border-amber-200 bg-amber-50 text-amber-950`}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white text-amber-700">
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">Aksi pembayaran</div>
          <h4 className={`${compact ? 'text-sm' : 'text-base'} mt-1 font-bold text-editorial-charcoal`}>{title}</h4>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-900">{description}</p>

          <div className={`${compact ? 'grid gap-2' : 'grid gap-3 sm:grid-cols-3'} mt-3`}>
            <div className="rounded-2xl bg-white/85 px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-amber-700">Order</div>
              <div className="mt-1 truncate text-xs font-bold text-editorial-charcoal">{order.orderNumber}</div>
            </div>
            <div className="rounded-2xl bg-white/85 px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-amber-700">Total bayar</div>
              <div className="mt-1 text-sm font-bold text-editorial-charcoal">{formatTotal(order.subtotal)}</div>
            </div>
            {dokuPayment ? (
              <div className="rounded-2xl bg-white/85 px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-amber-700">Batas link</div>
                <div className="mt-1 truncate text-xs font-bold text-editorial-charcoal">{expiresAt ? formatDate(expiresAt) : 'Sekitar 1 jam'}</div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/85 px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-amber-700">Rekening</div>
                <div className="mt-1 truncate text-xs font-bold text-editorial-charcoal">{transfer.bankName} {transfer.accountNumber}</div>
                <div className="mt-0.5 truncate text-[11px] font-semibold text-[#6b7280]">A/N {transfer.accountName}</div>
              </div>
            )}
          </div>

          <div className={`${compact ? 'grid gap-2' : 'flex flex-wrap gap-2'} mt-3`}>
            {manualPayment ? (
              <Link to={paymentPath} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-editorial-charcoal px-4 text-xs font-bold text-editorial-ivory">
                <Upload className="h-4 w-4" />
                Upload bukti transfer
              </Link>
            ) : dokuExpired ? (
              <button type="button" onClick={() => onRenewDokuPayment(order)} disabled={renewing} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-editorial-charcoal px-4 text-xs font-bold text-editorial-ivory disabled:opacity-60">
                {renewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Buat link DOKU baru
              </button>
            ) : (
              <Link to={paymentPath} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-editorial-charcoal px-4 text-xs font-bold text-editorial-ivory">
                <CreditCard className="h-4 w-4" />
                Bayar sekarang
              </Link>
            )}
            {dokuPayment && order.paymentUrl && !dokuExpired ? (
              <button type="button" onClick={() => onRenewDokuPayment(order)} disabled={renewing} className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-editorial-charcoal/15 bg-white px-4 text-xs font-bold text-editorial-charcoal disabled:opacity-60">
                {renewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Perbarui link
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderTimeline = ({ order, compact = false }) => {
  const activeStep = getActiveStep(order.status);
  const timeline = progressSteps.map((step, index) => {
    const done = activeStep >= index;
    const current = activeStep === index;
    let detail = done ? 'Sudah tercatat' : 'Menunggu tahap sebelumnya';
    if (step.key === 'created') detail = formatDate(order.createdAt);
    if (step.key === 'pending_payment') detail = order.paymentStatus === 'paid' ? 'Pembayaran sudah diterima' : 'Menunggu pembayaran selesai';
    if (step.key === 'paid') detail = paymentStatusLabels[order.paymentStatus] || order.paymentStatus || '-';
    if (step.key === 'processing') detail = shipmentStatusLabels[order.shipmentStatus] || statusLabels[order.status] || '-';
    if (step.key === 'shipped') detail = order.trackingNumber ? `${order.courierName || 'Kurir'} / ${order.trackingNumber}` : 'Resi akan muncul setelah paket dikirim';
    if (step.key === 'completed') detail = order.deliveredAt ? formatDate(order.deliveredAt) : 'Menunggu paket diterima';

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
              <div className="text-xs font-bold text-editorial-charcoal">{step.label}</div>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-[#6b7280]">{step.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const VoucherSummary = ({ order, compact = false }) => {
  const voucherSnapshot = getOrderVoucherSnapshot(order);
  if (!voucherSnapshot) return null;

  const shippingFee = getOrderShippingFee(order);
  return (
    <div className={`mt-3 rounded-2xl border border-editorial-charcoal/10 bg-editorial-ivory ${compact ? 'p-3 text-xs' : 'p-4 text-sm'} font-bold text-editorial-charcoal`}>
      <div className="flex justify-between gap-3">
        <span>Subtotal produk</span>
        <span>{formatTotal(getOrderProductsSubtotal(order))}</span>
      </div>
      <div className="mt-2 flex justify-between gap-3">
        <span>Voucher {voucherSnapshot.code}</span>
        <span>-{formatTotal(voucherSnapshot.discountAmount)}</span>
      </div>
      <div className="mt-2 flex justify-between gap-3 text-[#6b7280]">
        <span>Subtotal setelah voucher</span>
        <span>{formatTotal(getOrderSubtotalAfterVoucher(order))}</span>
      </div>
      {shippingFee ? (
        <div className="mt-2 flex justify-between gap-3 text-[#6b7280]">
          <span>Ongkir</span>
          <span>{formatTotal(shippingFee)}</span>
        </div>
      ) : null}
    </div>
  );
};

const OrderItems = ({ order, compact = false }) => {
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
                    <span className="block text-[11px] text-[#9ca3af] line-through">{formatTotal(line.originalTotal)}</span>
                    <span className="block">{formatTotal(line.discountedTotal)}</span>
                  </>
                ) : item.price || formatTotal(line.originalTotal)}
              </span>
            </div>
            {hasDiscount ? (
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-bold text-editorial-charcoal">
                <span>Setelah voucher: {formatTotal(line.discountedUnitPrice)} / item</span>
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
  const rows = bespokeDetailRows(item);
  if (!rows.length) return null;

  return (
    <div className={`${compact ? 'mt-3 p-3' : 'mt-4 p-4'} rounded-2xl bg-editorial-ivory`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-editorial-charcoal sm:text-xs">
        <Sparkles className="h-3.5 w-3.5" />
        Bespoke detail
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
  if (!isBespokeOrder(order)) return null;
  const currentStatus = order.bespokeProductionStatus || 'review_brief';
  const activeStep = getBespokeProductionStep(currentStatus);

  return (
    <div className={`${compact ? 'mt-3 p-3' : 'mt-4 p-4'} rounded-2xl border border-editorial-charcoal/10 bg-[#fbfaf7]`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-editorial-charcoal sm:text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          Bespoke production
        </div>
        <span className="rounded-full bg-editorial-ivory px-2.5 py-1 text-[10px] font-bold uppercase text-editorial-charcoal">
          {bespokeProductionStatusLabels[currentStatus] || currentStatus}
        </span>
      </div>
      <div className={`mt-3 grid grid-cols-6 ${compact ? 'gap-1' : 'gap-2'}`}>
        {bespokeProductionSteps.map((step, index) => {
          const done = activeStep >= index;
          return (
            <div key={step} className="min-w-0">
              <div className={`${compact ? 'h-1.5' : 'h-2'} rounded-full ${done ? 'bg-editorial-charcoal' : 'bg-stone-200'}`} />
              <div className={`mt-1 truncate font-bold uppercase ${compact ? 'text-[7px]' : 'text-[9px]'} ${done ? 'text-editorial-charcoal' : 'text-muted-foreground'}`}>
                {bespokeProductionStatusLabels[step]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ShipmentPanel = ({ order, compact = false }) => {
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
          Pengiriman
        </div>
        <ShipmentBadge status={order.shipmentStatus} />
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {order.courierName ? (
          <div className="rounded-xl bg-[#f8f7f4] px-3 py-2 text-sm font-semibold">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Kurir</div>
            <div className="mt-1 text-editorial-charcoal">{order.courierName}</div>
          </div>
        ) : null}
        {order.trackingNumber ? (
          <div className="rounded-xl bg-[#f8f7f4] px-3 py-2 text-sm font-semibold">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Resi</div>
            <div className="mt-1 text-editorial-charcoal">{order.trackingNumber}</div>
          </div>
        ) : null}
        {order.shippedAt ? (
          <div className="rounded-xl bg-[#f8f7f4] px-3 py-2 text-sm font-semibold">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Tanggal kirim</div>
            <div className="mt-1 text-editorial-charcoal">{formatDate(order.shippedAt)}</div>
          </div>
        ) : null}
        {order.deliveredAt ? (
          <div className="rounded-xl bg-[#f8f7f4] px-3 py-2 text-sm font-semibold">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Diterima</div>
            <div className="mt-1 text-editorial-charcoal">{formatDate(order.deliveredAt)}</div>
          </div>
        ) : null}
      </div>
      {order.trackingUrl ? (
        <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="mt-3 flex h-11 items-center justify-center gap-2 rounded-2xl bg-editorial-charcoal px-3 text-xs font-bold text-editorial-ivory">
          <ExternalLink className="h-4 w-4" />
          Track resi
        </a>
      ) : null}
      {!order.trackingUrl && courierSearchUrl ? (
        <a href={courierSearchUrl} target="_blank" rel="noreferrer" className="mt-3 flex h-11 items-center justify-center gap-2 rounded-2xl bg-editorial-charcoal px-3 text-xs font-bold text-editorial-ivory">
          <ExternalLink className="h-4 w-4" />
          Cari resi kurir
        </a>
      ) : null}
      <a href={buildPublicTrackingUrl(order.orderNumber)} target="_blank" rel="noreferrer" className="mt-2 flex h-11 items-center justify-center gap-2 rounded-2xl border border-editorial-charcoal/15 bg-white px-3 text-xs font-bold text-editorial-charcoal">
        <ExternalLink className="h-4 w-4" />
        Tracking publik
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
  const paymentPath = buildPaymentPath({ isMobileRoute, order });
  const canReorder = getOrderProductItems(order).length > 0;
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
          Upload bukti
        </Link>
      ) : null}
      {showOpenPayment ? (
        <Link to={paymentPath} className={primaryClass}>
          <CreditCard className="h-4 w-4" />
          Lanjut bayar
        </Link>
      ) : null}
      <Link to={invoicePath(order.orderNumber)} className={outlineClass}>
        <FileText className="h-4 w-4" />
        Unduh invoice
      </Link>
      {canTrackShipment(order) ? (
        <a href={order.trackingUrl} target="_blank" rel="noreferrer" className={primaryClass}>
          <ExternalLink className="h-4 w-4" />
          Lacak resi
        </a>
      ) : null}
      {!canTrackShipment(order) && courierSearchUrl ? (
        <a href={courierSearchUrl} target="_blank" rel="noreferrer" className={primaryClass}>
          <ExternalLink className="h-4 w-4" />
          Cari resi kurir
        </a>
      ) : null}
      <a href={buildPublicTrackingUrl(order.orderNumber)} target="_blank" rel="noreferrer" className={outlineClass}>
        <ExternalLink className="h-4 w-4" />
        Tracking publik
      </a>
      <button type="button" onClick={() => onReorder(order)} disabled={!canReorder} className={`${outlineClass} disabled:opacity-50`}>
        <ShoppingBag className="h-4 w-4" />
        Pesan lagi
      </button>
      {order.paymentProvider === 'doku' && ['unpaid', 'pending'].includes(order.paymentStatus) ? (
        <button type="button" onClick={() => onRefreshPayment(order)} disabled={refreshing} className={`${outlineClass} disabled:opacity-60`}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Cek pembayaran
        </button>
      ) : null}
    </div>
  );
};

const CustomerPortalPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, loginWithGoogle, rememberCustomerCode, logout } = useAuth();
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
      if (!silent) toast.error('Kode customer wajib diisi');
      return;
    }

    setLoading(true);
    setSearched(true);
    const result = await getCustomerPortalByCode(code);
    setLoading(false);

    if (!result) {
      setPortal(null);
      if (!silent) toast.error('Kode customer tidak ditemukan');
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
    if (!silent) toast.success(`${result.customer.customerCode} dimuat`);
  }, [setSearchParams]);

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
      toast.error(error.message || 'Gagal masuk dengan Google');
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
      toast.error('Nama dan kontak wajib diisi');
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
      toast.success('Profil & alamat tersimpan');
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan profil');
    } finally {
      setProfileLoading(false);
    }
  };

  const submitClaim = async (event) => {
    event.preventDefault();
    if (!claimCodeValue.trim()) {
      toast.error('Kode wajib diisi');
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
      toast.success(`${result.customer.customerCode} ditautkan ke akunmu`);
    } catch (error) {
      toast.error(error.message || 'Gagal menautkan kode');
    } finally {
      setClaimLoading(false);
    }
  };

  // Account + address book panel, shown to logged-in customers on both layouts.
  const renderAccountPanel = () => {
    if (!currentUser) return null;
    const inputClass = 'h-11 w-full rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-editorial-charcoal';
    return (
      <section className="mobile-card rounded-2xl border bg-white p-4 shadow-sm">
        <button type="button" onClick={() => setAccountPanelOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 text-left">
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-editorial-ivory text-editorial-charcoal">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase text-editorial-charcoal">Akun &amp; alamat</span>
              <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#6b7280]">{currentUser.email}</span>
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-editorial-paper px-3 py-1 text-[10px] font-bold uppercase text-editorial-charcoal">
            {accountPanelOpen ? 'Tutup' : 'Ubah'}
          </span>
        </button>
        {!accountPanelOpen ? null : (
        <div className="mt-3 border-t border-[#e5e7eb] pt-3">
        <form onSubmit={submitProfile} className="grid gap-2">
          <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Nama penerima" className={inputClass} />
          <input value={profileContact} onChange={(e) => setProfileContact(e.target.value)} placeholder="No. WhatsApp / telepon" className={inputClass} />
          <textarea value={profileAddress} onChange={(e) => setProfileAddress(e.target.value)} rows="2" placeholder="Alamat pengiriman lengkap" className={`${inputClass} h-auto py-2`} />
          <Button type="submit" disabled={profileLoading} className="h-11 rounded-2xl gap-2">
            {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
            Simpan alamat
          </Button>
        </form>

        <form onSubmit={submitClaim} className="mt-4 grid gap-2 border-t border-[#e5e7eb] pt-3">
          <div className="text-[11px] font-bold uppercase text-[#6b7280]">Punya kode order lama?</div>
          <input value={claimCodeValue} onChange={(e) => setClaimCodeValue(e.target.value.toUpperCase())} placeholder="SOLI09232" className={`${inputClass} uppercase tracking-[0.08em]`} />
          <input value={claimAnswer} onChange={(e) => setClaimAnswer(e.target.value)} placeholder="Jawaban keamanan (jika ada)" className={inputClass} />
          <Button type="submit" variant="outline" disabled={claimLoading} className="h-11 rounded-2xl gap-2 bg-white">
            {claimLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Tautkan kode ke akun
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
      toast.error('Browser belum mengizinkan tempel otomatis');
      return;
    }

    try {
      const pastedCode = (await navigator.clipboard.readText()).trim().toUpperCase();
      if (!pastedCode) {
        toast.warning('Clipboard kosong');
        return;
      }
      setCustomerCode(pastedCode);
      toast.success('Kode ditempel');
    } catch {
      toast.error('Kode belum bisa ditempel otomatis');
    }
  };

  const checkLastCustomerCode = async () => {
    const code = lastCustomerCode || readLastCustomerCode();
    if (!code) {
      toast.warning('Belum ada kode terakhir di perangkat ini');
      return;
    }
    setCustomerCode(code);
    await loadPortalForCode(code);
  };

  const copyCode = async () => {
    if (!portal?.customer?.customerCode) return;
    const copied = await copyTextToClipboard(portal.customer.customerCode);
    copied ? toast.success(`${portal.customer.customerCode} disalin`) : toast.error('Kode belum bisa disalin. Tekan lama kode lalu salin manual.');
  };

  const unlockPortal = async (event) => {
    event.preventDefault();
    if (!securityAnswer.trim()) {
      toast.error('Jawaban keamanan wajib diisi');
      return;
    }

    setSecurityLoading(true);
    const result = await verifyCustomerPortalSecurity(customerCode, securityAnswer);
    setSecurityLoading(false);

    if (!result) {
      toast.error('Jawaban keamanan salah');
      return;
    }

    setPortal(result);
    setSecurityQuestion(result.customer.securityQuestion || '');
    setSecurityAnswer('');
    toast.success('Dashboard customer terbuka');
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
      toast.success('Pertanyaan keamanan tersimpan');
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan pertanyaan keamanan');
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
      const statusLabel = paymentStatusLabels[result.paymentStatus] || result.paymentStatus || 'dicek';
      if (result.syncApplied) {
        toast.success(`Pembayaran ${statusLabel}`);
      } else {
        toast.warning('Pembayaran dicek, status belum berubah');
      }
    } catch (error) {
      toast.error(error.message || 'Gagal refresh pembayaran');
    } finally {
      setRefreshingPaymentOrder('');
    }
  };

  const renewDokuPayment = async (order) => {
    if (!order?.orderNumber) return;

    setRefreshingPaymentOrder(order.orderNumber);
    try {
      const checkout = await createDokuCheckout({
        order,
        amount: order.subtotal,
        customerName: order.customerName,
        contact: order.contact,
        items: order.items || [],
        callbackPath: isMobileRoute ? '/mobile/payment' : '/payment',
      });
      await updateOrderPaymentStatus(order.id || order.orderNumber, {
        paymentStatus: 'pending',
        paymentProvider: 'doku',
        paymentReference: checkout.requestId || '',
        paymentUrl: checkout.paymentUrl,
        paymentExpiresAt: checkout.paymentExpiresAt || '',
        paymentSessionId: checkout.paymentSessionId || '',
        paymentResponse: checkout.dokuResponse || {},
        status: 'pending_payment',
        audit: false,
      });
      await loadPortalForCode(portal?.customer?.customerCode || customerCode, { silent: true });
      toast.success('Link DOKU baru siap dipakai');
      navigate(buildPaymentPath({ isMobileRoute, order: { ...order, paymentProvider: 'doku' } }));
    } catch (error) {
      toast.error(error.message || 'Gagal membuat link DOKU baru');
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
      toast.error('Order ini belum punya item produk untuk dipesan lagi');
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

    toast.success(`Item dari ${order.orderNumber} masuk ke keranjang`);
    navigate(isMobileRoute ? '/mobile/checkout' : '/checkout');
  };


  if (isMobileRoute) {
    return (
      <MobileCommerceLayout>
        <Helmet>
          <title>Cek Order - Solivagant</title>
          <meta name="description" content="Cek progres order Solivagant dengan kode customer." />
        </Helmet>
        <main className="mobile-page space-y-4">
          <section className="mobile-soft-card overflow-hidden">
            <div className="relative overflow-hidden bg-[#121110] p-4 text-editorial-ivory">
              <div className="absolute -right-8 top-0 h-28 w-28 rounded-full border border-white/10" />
              <div className="absolute right-6 top-10 h-16 w-16 rounded-full border border-[#d6c68a]/20" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase text-[#cbd6c5]">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Lacak pesanan
                </div>
                <h1 className="mt-3 text-2xl font-bold leading-tight">Cek progress pesanan.</h1>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#cbd6c5]">
                  Status pembayaran, proses produksi, dan pengiriman dalam satu tempat.
                </p>
              </div>
            </div>
            <form onSubmit={loadPortal} className="grid gap-3 p-4">
              {/* Logged-in: greet + let orders take focus. Code lookup collapses into a small option. */}
              {currentUser ? (
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-editorial-ivory px-3 py-2 text-xs font-semibold text-editorial-charcoal">
                  <span className="min-w-0 truncate">Masuk sebagai {currentUser.email}</span>
                  <button type="button" onClick={logout} className="shrink-0 font-bold underline underline-offset-4">Keluar</button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white gap-2 text-sm font-bold" onClick={signInGoogle}>
                  <UserRound className="h-4 w-4" />
                  Masuk dengan Google
                </Button>
              )}

              {currentUser ? (
                <button type="button" onClick={() => setCodeSearchOpen((open) => !open)} className="flex items-center justify-between rounded-2xl border border-[#e5e7eb] bg-white px-3 py-2 text-[11px] font-bold uppercase text-[#6b7280]">
                  <span className="inline-flex items-center gap-2"><Search className="h-3.5 w-3.5" /> Cari pakai kode order</span>
                  <span>{codeSearchOpen ? 'Tutup' : 'Buka'}</span>
                </button>
              ) : null}

              {(!currentUser || codeSearchOpen) ? (
                <>
                  <label className="text-[10px] font-bold uppercase text-[#6b7280]">Kode customer</label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      value={customerCode}
                      onChange={(event) => setCustomerCode(event.target.value.toUpperCase())}
                      placeholder="SOLI09232"
                      className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-bold uppercase tracking-[0.08em] outline-none focus:border-editorial-charcoal"
                    />
                    <Button type="submit" className="h-12 rounded-2xl px-4" disabled={loading} aria-label="Cek kode customer">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2 text-xs font-bold" onClick={pasteCustomerCode}>
                      <ClipboardPaste className="h-4 w-4" />
                      Tempel kode
                    </Button>
                    <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2 text-xs font-bold" onClick={checkLastCustomerCode} disabled={loading || !lastCustomerCode}>
                      <History className="h-4 w-4" />
                      Cek terakhir
                    </Button>
                  </div>
                  {lastCustomerCode ? (
                    <button type="button" onClick={checkLastCustomerCode} className="text-left text-[11px] font-bold text-editorial-charcoal underline underline-offset-4">
                      Terakhir dipakai: {lastCustomerCode}
                    </button>
                  ) : null}
                  <p className="text-xs font-semibold leading-relaxed text-[#6b7280]">
                    Kode ini diberikan setelah checkout pertama.
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
                  <div className="text-[10px] font-bold uppercase text-editorial-charcoal">Cek keamanan</div>
                  <h2 className="mt-1 text-lg font-bold text-editorial-charcoal">Dashboard terlindungi</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">Jawab pertanyaan keamanan untuk membuka dashboard.</p>
                </div>
              </div>
              <form onSubmit={unlockPortal} className="mt-4 grid gap-3">
                <div className="rounded-2xl bg-editorial-paper p-3">
                  <div className="text-[10px] font-bold uppercase text-[#6b7280]">Pertanyaan</div>
                  <div className="mt-1 text-sm font-bold text-editorial-charcoal">{portal.customer.securityQuestion}</div>
                </div>
                <input
                  type="password"
                  autoComplete="off"
                  value={securityAnswer}
                  onChange={(event) => setSecurityAnswer(event.target.value)}
                  placeholder="Jawaban"
                  className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-editorial-charcoal"
                />
                <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={securityLoading}>
                  {securityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Buka
                </Button>
              </form>
            </section>
          ) : portal ? (
            <>
              <section className="mobile-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-editorial-charcoal">Selamat datang kembali</div>
                    <h2 className="mt-1 truncate text-lg font-bold text-editorial-charcoal">{portal.customer.customerName}</h2>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">{portal.customer.masked ? 'Detail disembunyikan demi keamanan' : portal.customer.contact}</p>
                  </div>
                  <button type="button" onClick={copyCode} className="shrink-0 rounded-2xl bg-editorial-charcoal px-3 py-2 text-xs font-bold tracking-[0.12em] text-editorial-ivory">
                    {portal.customer.customerCode}
                  </button>
                </div>
                {portal.customer.masked ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-relaxed text-amber-800">
                    Kamu melihat progres order via kode. Untuk lihat &amp; kelola detail lengkap (nama, kontak, alamat), <button type="button" onClick={signInGoogle} className="font-bold underline underline-offset-2">masuk dengan Google</button> pakai akun saat order.
                  </div>
                ) : null}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-editorial-charcoal/10 bg-editorial-paper p-3 text-center">
                    <div className="text-sm font-bold text-editorial-charcoal">{portal.orders.length}</div>
                    <div className="text-[10px] font-bold uppercase text-[#6b7280]">Pesanan</div>
                  </div>
                  <div className="rounded-2xl border border-editorial-charcoal/10 bg-editorial-ivory p-3 text-center">
                    <div className="text-sm font-bold text-editorial-charcoal">{activeOrders.length}</div>
                    <div className="text-[10px] font-bold uppercase text-editorial-charcoal">Aktif</div>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-center">
                    <div className="truncate text-xs font-bold text-amber-800">{latestOrder ? statusLabels[latestOrder.status] || latestOrder.status : '-'}</div>
                    <div className="text-[10px] font-bold uppercase text-amber-700">Terbaru</div>
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
                      <span className="block text-sm font-bold text-editorial-charcoal">{portal.customer.securityEnabledAt ? 'Dashboard terlindungi' : 'Proteksi dashboard'}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#6b7280]">Pertanyaan keamanan opsional.</span>
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-editorial-paper px-3 py-1 text-[10px] font-bold uppercase text-editorial-charcoal">
                    {securityFormOpen ? 'Tutup' : 'Buka'}
                  </span>
                </button>
                {securityFormOpen ? (
                  <form onSubmit={saveSecurity} className="mt-3 grid gap-2 border-t border-[#e5e7eb] pt-3">
                    {portal.customer.securityEnabledAt ? (
                      <input value={currentSecurityAnswer} onChange={(event) => setCurrentSecurityAnswer(event.target.value)} placeholder="Jawaban saat ini" className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-editorial-charcoal" />
                    ) : null}
                    <input value={securityQuestion} onChange={(event) => setSecurityQuestion(event.target.value)} placeholder="Pertanyaan keamanan" className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-editorial-charcoal" />
                    <input value={newSecurityAnswer} onChange={(event) => setNewSecurityAnswer(event.target.value)} placeholder="Jawaban" className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-editorial-charcoal" />
                    <Button type="submit" className="h-11 rounded-2xl gap-2" disabled={savingSecurity}>
                      {savingSecurity ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Simpan proteksi
                    </Button>
                  </form>
                ) : null}
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-bold text-editorial-charcoal">Progres order</h2>
                {portal.orders.map((order) => {
                  const bespoke = isBespokeOrder(order);
                  const bespokeItem = getBespokeItem(order);
                  return (
                    <article key={order.orderNumber} className="mobile-card overflow-hidden p-0">
                      <div className="border-b border-[#e5e7eb] bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-bold text-editorial-charcoal">{order.orderNumber}</h3>
                            <p className="mt-1 text-xs font-semibold text-[#6b7280]">{formatDate(order.createdAt)}</p>
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
                        <div className="text-[10px] font-bold uppercase text-[#6b7280]">{bespoke ? 'Parfum custom' : 'Item order'}</div>
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
                        <div className="text-[10px] font-bold uppercase text-editorial-charcoal">Self-service</div>
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
                    title="Belum ada order"
                    description="Order baru akan muncul setelah checkout."
                  />
                ) : null}
              </section>
            </>
          ) : (
            <section className="mobile-card p-5 text-center">
              {searched ? <Search className="mx-auto h-8 w-8 text-amber-700" /> : <ShoppingBag className="mx-auto h-8 w-8 text-amber-700" />}
              <h2 className="mt-3 text-lg font-bold text-editorial-charcoal">{searched ? 'Kode customer tidak ditemukan' : 'Dashboard tampil di sini'}</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                {searched ? 'Cek lagi kode SOLI yang dimasukkan.' : 'Masukkan kode customer untuk melihat progres order.'}
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
        <title>Cek Order - Solivagant</title>
        <meta name="description" content="Cek progres order Solivagant dengan kode customer." />
      </Helmet>
      <main className="min-h-screen bg-editorial-paper text-editorial-charcoal">
        <StorefrontHeader backTo="/home" backLabel="Beranda" actions={[{ to: '/catalog', label: 'Katalog' }]} />

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
          <div className="space-y-5">
            <div className="rounded-[28px] border border-editorial-charcoal/10 bg-white/70 p-6 shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-full border border-editorial-charcoal/15 bg-white px-3 py-1 text-xs font-bold uppercase text-editorial-charcoal">
                <UserRound className="h-4 w-4" />
                Portal customer
              </div>
              <h1 className="storefront-display-heading mt-5 text-4xl font-bold sm:text-5xl">Cek order dengan kode unik.</h1>
              <p className="mt-4 text-base font-medium leading-relaxed text-muted-foreground">
                Lihat status pembayaran, proses produksi, pengiriman, dan detail custom tanpa perlu akun terpisah.
              </p>
            </div>

            <form onSubmit={loadPortal} className="rounded-2xl border bg-white p-4 shadow-sm">
              <label className="text-xs font-bold uppercase text-muted-foreground">Kode customer</label>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={customerCode}
                  onChange={(event) => setCustomerCode(event.target.value.toUpperCase())}
                  placeholder="SOLI09232"
                  className="h-12 rounded-2xl border px-4 text-sm font-bold uppercase tracking-[0.08em] outline-none focus:border-editorial-charcoal"
                />
                <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Cek
                </Button>
              </div>
              <p className="mt-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                Kode ini diberikan setelah checkout pertama. Simpan untuk order berikutnya.
              </p>
              {currentUser ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-editorial-ivory px-4 py-2 text-xs font-semibold text-editorial-charcoal">
                  <span className="min-w-0 truncate">Masuk sebagai {currentUser.email}</span>
                  <button type="button" onClick={logout} className="shrink-0 font-bold underline underline-offset-4">Keluar</button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="mt-3 h-12 w-full rounded-2xl gap-2 text-sm font-bold" onClick={signInGoogle}>
                  <UserRound className="h-4 w-4" />
                  Masuk dengan Google
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
                    <div className="text-xs font-bold uppercase text-editorial-charcoal">Cek keamanan</div>
                    <h2 className="mt-1 text-2xl font-bold">Dashboard terlindungi</h2>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">
                      Customer ini sudah mengaktifkan pertanyaan keamanan. Jawab dulu untuk membuka dashboard.
                    </p>
                  </div>
                </div>
                <form onSubmit={unlockPortal} className="mt-5 grid gap-3">
                  <div className="rounded-2xl bg-editorial-paper p-4">
                    <div className="text-xs font-bold uppercase text-muted-foreground">Pertanyaan</div>
                    <div className="mt-1 text-base font-bold">{portal.customer.securityQuestion}</div>
                  </div>
                  <input
                    type="password"
                    autoComplete="off"
                    value={securityAnswer}
                    onChange={(event) => setSecurityAnswer(event.target.value)}
                    placeholder="Jawaban"
                    className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-editorial-charcoal"
                  />
                  <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={securityLoading}>
                    {securityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Buka dashboard
                  </Button>
                </form>
              </section>
            ) : portal ? (
              <>
                <section className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase text-editorial-charcoal">Selamat datang kembali</div>
                      <h2 className="mt-1 text-2xl font-bold">{portal.customer.customerName}</h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">{portal.customer.masked ? 'Detail disembunyikan demi keamanan' : portal.customer.contact}</p>
                      {portal.customer.masked ? (
                        <p className="mt-2 text-xs font-semibold leading-relaxed text-amber-800">
                          Untuk detail lengkap (nama, kontak, alamat), <button type="button" onClick={signInGoogle} className="font-bold underline underline-offset-2">masuk dengan Google</button> pakai akun saat order.
                        </p>
                      ) : null}
                    </div>
                    <button type="button" onClick={copyCode} className="rounded-2xl bg-editorial-charcoal px-5 py-4 text-center text-xl font-bold tracking-[0.16em] text-editorial-ivory">
                      {portal.customer.customerCode}
                    </button>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-editorial-charcoal/10 bg-editorial-paper p-4">
                      <div className="text-xs font-bold uppercase text-muted-foreground">Order</div>
                      <div className="mt-1 text-2xl font-bold">{portal.orders.length}</div>
                    </div>
                    <div className="rounded-2xl border border-editorial-charcoal/10 bg-editorial-ivory p-4">
                      <div className="text-xs font-bold uppercase text-muted-foreground">Aktif</div>
                      <div className="mt-1 text-2xl font-bold">{activeOrders.length}</div>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                      <div className="text-xs font-bold uppercase text-muted-foreground">Terbaru</div>
                      <div className="mt-1 text-sm font-bold">{latestOrder ? statusLabels[latestOrder.status] || latestOrder.status : '-'}</div>
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
                        <span className="block text-lg font-bold">{portal.customer.securityEnabledAt ? 'Dashboard terlindungi' : 'Proteksi dashboard'}</span>
                        <span className="mt-0.5 block text-sm font-semibold text-muted-foreground">Tambahkan pertanyaan keamanan hanya jika diperlukan.</span>
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-editorial-paper px-4 py-2 text-xs font-bold uppercase text-editorial-charcoal">
                      {securityFormOpen ? 'Tutup' : 'Buka'}
                    </span>
                  </button>
                  {securityFormOpen ? (
                    <form onSubmit={saveSecurity} className="mt-4 grid gap-3 border-t pt-4">
                      {portal.customer.securityEnabledAt ? (
                        <input
                          value={currentSecurityAnswer}
                          onChange={(event) => setCurrentSecurityAnswer(event.target.value)}
                          placeholder="Jawaban saat ini"
                          className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-editorial-charcoal"
                        />
                      ) : null}
                      <input
                        value={securityQuestion}
                        onChange={(event) => setSecurityQuestion(event.target.value)}
                        placeholder="Contoh: siapa nama hewan peliharaan saya?"
                        className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-editorial-charcoal"
                      />
                      <input
                        value={newSecurityAnswer}
                        onChange={(event) => setNewSecurityAnswer(event.target.value)}
                        placeholder="Jawaban"
                        className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-editorial-charcoal"
                      />
                      <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={savingSecurity}>
                        {savingSecurity ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Simpan proteksi
                      </Button>
                    </form>
                  ) : null}
                </section>

                <section className="rounded-2xl border bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-bold">Progres order</h2>
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
                              <p className="mt-1 text-sm font-semibold text-muted-foreground">{formatDate(order.createdAt)}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold uppercase text-muted-foreground">{order.quantity} item</div>
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
                                  <div className="text-xs font-bold uppercase text-editorial-charcoal">Self-service</div>
                                  <p className="mt-1 text-sm font-semibold text-muted-foreground">Kelola bukti bayar, invoice, tracking, dan reorder dari sini.</p>
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
                        title="Belum ada order"
                        description="Order baru akan muncul setelah checkout."
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
                      title={searched ? 'Kode customer tidak ditemukan' : 'Dashboard tampil di sini'}
                      description={searched ? 'Cek lagi kode SOLI yang kamu masukkan.' : 'Masukkan kode customer untuk melihat progres order.'}
                    />
                  </div>
                  <div className="grid content-center gap-3 bg-editorial-ivory p-5">
                    {[
                      ['1', 'Masukkan kode SOLI', 'Kode muncul setelah checkout pertama atau dari halaman sukses order.'],
                      ['2', 'Cek pembayaran dan produksi', 'Status bayar, bukti transfer, custom progress, dan resi tampil di satu tempat.'],
                      ['3', 'Pesan lagi lebih cepat', 'Item order lama langsung masuk keranjang, tinggal checkout.'],
                    ].map(([step, title, description]) => (
                      <div key={step} className="flex gap-3 rounded-2xl bg-white/82 p-3 shadow-sm shadow-editorial-charcoal/5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-editorial-charcoal text-xs font-bold text-editorial-ivory">{step}</span>
                        <span>
                          <span className="block text-sm font-bold text-editorial-charcoal">{title}</span>
                          <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#667264]">{description}</span>
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
