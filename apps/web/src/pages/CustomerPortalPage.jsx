import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CreditCard, ExternalLink, FileCheck2, FileText, KeyRound, Loader2, PackageCheck, RefreshCw, Search, ShieldCheck, ShoppingBag, Sparkles, Truck, Upload, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import StatusChip, { getOrderStatusTone, getPaymentStatusTone, getShipmentStatusTone } from '@/components/ui/status-chip.jsx';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import {
  getCustomerPortalByCode,
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
import { refreshDokuPaymentStatus } from '@/services/dokuCheckoutService.js';
import { addCartItem, clearCart, isManualTransferPayment } from '@/services/cartService.js';
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
const paymentStatusLabels = {
  unpaid: 'Belum dibayar',
  pending: 'Menunggu bayar',
  paid: 'Sudah dibayar',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
  refunded: 'Refund',
};
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
const canOpenPayment = (order) => Boolean(
  ['unpaid', 'pending'].includes(order?.paymentStatus)
  && (order?.paymentUrl || isManualTransferPayment(order?.paymentProvider))
);
const canUploadPaymentProof = (order) => Boolean(
  isManualTransferPayment(order?.paymentProvider)
  && order?.paymentStatus !== 'paid'
  && !['submitted', 'approved'].includes(order?.paymentProofStatus || 'missing')
);
const canTrackShipment = (order) => Boolean(order?.trackingUrl && order?.trackingNumber);

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
        <div key={step.key} className={`rounded-2xl border px-3 py-3 ${step.done ? 'border-[#263d27]/20 bg-white' : 'border-stone-200 bg-stone-50'} ${step.current ? 'ring-2 ring-[#263d27]/15' : ''}`}>
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${step.done ? 'bg-[#263d27] text-white' : 'bg-stone-200 text-stone-500'}`}>
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#0b130c]">{step.label}</div>
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
    <div className={`mt-3 rounded-2xl border border-[#263d27]/10 bg-[#eef2e8] ${compact ? 'p-3 text-xs' : 'p-4 text-sm'} font-bold text-[#263d27]`}>
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
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-bold text-[#263d27]">
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

const BespokeProductionPanel = ({ order, compact = false }) => {
  if (!isBespokeOrder(order)) return null;
  const currentStatus = order.bespokeProductionStatus || 'review_brief';
  const activeStep = getBespokeProductionStep(currentStatus);

  return (
    <div className={`${compact ? 'mt-3 p-3' : 'mt-4 p-4'} rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7]`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27] sm:text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          Bespoke production
        </div>
        <span className="rounded-full bg-[#eef2e8] px-2.5 py-1 text-[10px] font-bold uppercase text-[#263d27]">
          {bespokeProductionStatusLabels[currentStatus] || currentStatus}
        </span>
      </div>
      <div className={`mt-3 grid grid-cols-6 ${compact ? 'gap-1' : 'gap-2'}`}>
        {bespokeProductionSteps.map((step, index) => {
          const done = activeStep >= index;
          return (
            <div key={step} className="min-w-0">
              <div className={`${compact ? 'h-1.5' : 'h-2'} rounded-full ${done ? 'bg-[#263d27]' : 'bg-stone-200'}`} />
              <div className={`mt-1 truncate font-bold uppercase ${compact ? 'text-[7px]' : 'text-[9px]'} ${done ? 'text-[#263d27]' : 'text-muted-foreground'}`}>
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

  return (
    <div className={`${compact ? 'mt-3 p-3' : 'mt-4 p-4'} rounded-2xl border border-[#263d27]/10 bg-white`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27] sm:text-xs">
          <Truck className="h-3.5 w-3.5" />
          Shipment
        </div>
        <ShipmentBadge status={order.shipmentStatus} />
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {order.courierName ? (
          <div className="rounded-xl bg-[#f8f7f4] px-3 py-2 text-sm font-semibold">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Kurir</div>
            <div className="mt-1 text-[#0b130c]">{order.courierName}</div>
          </div>
        ) : null}
        {order.trackingNumber ? (
          <div className="rounded-xl bg-[#f8f7f4] px-3 py-2 text-sm font-semibold">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Resi</div>
            <div className="mt-1 text-[#0b130c]">{order.trackingNumber}</div>
          </div>
        ) : null}
        {order.shippedAt ? (
          <div className="rounded-xl bg-[#f8f7f4] px-3 py-2 text-sm font-semibold">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Tanggal kirim</div>
            <div className="mt-1 text-[#0b130c]">{formatDate(order.shippedAt)}</div>
          </div>
        ) : null}
        {order.deliveredAt ? (
          <div className="rounded-xl bg-[#f8f7f4] px-3 py-2 text-sm font-semibold">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Delivered</div>
            <div className="mt-1 text-[#0b130c]">{formatDate(order.deliveredAt)}</div>
          </div>
        ) : null}
      </div>
      {order.trackingUrl ? (
        <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="mt-3 flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#263d27] px-3 text-xs font-bold text-[#eef2e8]">
          <ExternalLink className="h-4 w-4" />
          Track resi
        </a>
      ) : null}
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
  const buttonClass = compact
    ? 'flex h-11 items-center justify-center gap-2 rounded-2xl text-xs font-bold'
    : 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold';
  const outlineClass = `${buttonClass} border border-[#263d27]/15 bg-white text-[#263d27]`;
  const primaryClass = `${buttonClass} bg-[#263d27] text-[#eef2e8]`;

  return (
    <div className={compact ? 'mt-3 grid gap-2' : 'mt-4 flex flex-wrap gap-2'}>
      {canUploadPaymentProof(order) ? (
        <Link to={paymentPath} className={primaryClass}>
          <Upload className="h-4 w-4" />
          Upload bukti
        </Link>
      ) : null}
      {canOpenPayment(order) ? (
        <Link to={paymentPath} className={primaryClass}>
          <CreditCard className="h-4 w-4" />
          Lanjut bayar
        </Link>
      ) : null}
      <Link to={invoicePath(order.orderNumber)} className={outlineClass}>
        <FileText className="h-4 w-4" />
        Download invoice
      </Link>
      {canTrackShipment(order) ? (
        <a href={order.trackingUrl} target="_blank" rel="noreferrer" className={primaryClass}>
          <ExternalLink className="h-4 w-4" />
          Lacak resi
        </a>
      ) : null}
      <button type="button" onClick={() => onReorder(order)} disabled={!canReorder} className={`${outlineClass} disabled:opacity-50`}>
        <ShoppingBag className="h-4 w-4" />
        Reorder
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

  const latestOrder = portal?.orders?.[0];
  const isMobileRoute = location.pathname.startsWith('/mobile');
  const invoicePath = (orderNumber) => `${isMobileRoute ? '/mobile/customer/invoice' : '/customer/invoice'}/${orderNumber}?code=${encodeURIComponent(portal?.customer?.customerCode || customerCode)}`;
  const activeOrders = useMemo(() => (
    portal?.orders?.filter((order) => !['completed', 'cancelled'].includes(order.status)) || []
  ), [portal]);

  const loadPortalForCode = async (code, { silent = false } = {}) => {
    if (!code.trim()) {
      if (!silent) toast.error('Customer code is required');
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

    setPortal(result);
    setSecurityAnswer('');
    setSecurityQuestion(result.customer.securityQuestion || '');
    setSecurityFormOpen(false);
    setCustomerCode(result.customer.customerCode);
    setSearchParams({ code: result.customer.customerCode });
    if (!silent) toast.success(`${result.customer.customerCode} loaded`);
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

  const reorderOrder = (order) => {
    const productItems = getOrderProductItems(order);
    if (!productItems.length) {
      toast.error('Order ini belum punya item produk untuk reorder');
      return;
    }

    clearCart();
    productItems.forEach((item) => {
      addCartItem({
        id: item.productId || item.id || item.slug || item.name,
        slug: item.productSlug || item.slug || item.productId || item.name,
        cartSlug: item.slug || item.productSlug || item.productId || item.name,
        productSlug: item.productSlug || item.slug,
        variantId: item.variantId || '',
        name: item.name,
        price: item.price || formatTotal(item.priceNumber),
        priceNumber: item.priceNumber
          ? Number(item.priceNumber)
          : Number(item.totalPrice || 0) / Math.max(Number(item.quantity || 1), 1),
        size: item.size || '',
        category: item.category || '',
        notes: item.notes || '',
        maxStock: Number(item.maxStock || item.stock || 0),
      }, Math.max(Number(item.quantity || 1), 1));
    });
    toast.success(`${productItems.length} item dimasukkan ke keranjang`);
    navigate(isMobileRoute ? '/mobile/cart' : '/cart');
  };

  if (isMobileRoute) {
    return (
      <MobileCommerceLayout>
        <Helmet>
          <title>Dashboard Customer - Solivagant</title>
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
                <Button type="submit" className="h-12 rounded-2xl px-4" disabled={loading} aria-label="Cek kode customer">
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
                  <div className="text-[10px] font-bold uppercase text-[#263d27]">Cek keamanan</div>
                  <h2 className="mt-1 text-lg font-bold text-[#0b130c]">Dashboard terlindungi</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">Jawab pertanyaan keamanan untuk membuka dashboard.</p>
                </div>
              </div>
              <form onSubmit={unlockPortal} className="mt-4 grid gap-3">
                <div className="rounded-2xl bg-[#f7f8f2] p-3">
                  <div className="text-[10px] font-bold uppercase text-[#6b7280]">Pertanyaan</div>
                  <div className="mt-1 text-sm font-bold text-[#0b130c]">{portal.customer.securityQuestion}</div>
                </div>
                <input
                  value={securityAnswer}
                  onChange={(event) => setSecurityAnswer(event.target.value)}
                  placeholder="Jawaban"
                  className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-[#263d27]"
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
                    <div className="text-[10px] font-bold uppercase text-[#263d27]">Selamat datang kembali</div>
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
                    <input value={newSecurityAnswer} onChange={(event) => setNewSecurityAnswer(event.target.value)} placeholder="Jawaban" className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-[#263d27]" />
                    <Button type="submit" className="h-11 rounded-2xl gap-2" disabled={savingSecurity}>
                      {savingSecurity ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Simpan proteksi
                    </Button>
                  </form>
                ) : null}
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-bold text-[#0b130c]">Progres order</h2>
                {portal.orders.map((order) => {
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
                            {isManualTransferPayment(order.paymentProvider) ? <PaymentProofBadge status={order.paymentProofStatus || 'missing'} /> : null}
                            {order.shipmentStatus && order.shipmentStatus !== 'not_ready' ? <ShipmentBadge status={order.shipmentStatus} /> : null}
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[10px] font-bold uppercase text-[#6b7280]">{bespoke ? 'Parfum custom' : 'Item order'}</div>
                        <div className="text-sm font-bold text-[#0b130c]">{formatTotal(order.subtotal)}</div>
                      </div>
                      <div className="mt-3">
                        <OrderItems order={order} compact />
                      </div>
                      <BespokeDetailPanel item={bespokeItem} compact />
                      <BespokeProductionPanel order={order} compact />
                      <PaymentProofPanel order={order} compact />
                      <ShipmentPanel order={order} compact />
                      <div className="mt-3 rounded-2xl border border-[#263d27]/10 bg-[#f7f8f2] p-3">
                        <div className="text-[10px] font-bold uppercase text-[#263d27]">Self-service</div>
                        <SelfServiceActions
                          compact
                          isMobileRoute={isMobileRoute}
                          invoicePath={invoicePath}
                          onRefreshPayment={refreshPaymentStatus}
                          onReorder={reorderOrder}
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
              <h2 className="mt-3 text-lg font-bold text-[#0b130c]">{searched ? 'Kode customer tidak ditemukan' : 'Dashboard tampil di sini'}</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                {searched ? 'Cek lagi kode SOLI yang dimasukkan.' : 'Masukkan kode customer untuk melihat progres order.'}
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
            <Link to="/home" className="inline-flex items-center gap-2 text-sm font-bold text-[#eef2e8]"><ArrowLeft className="h-4 w-4" />Beranda</Link>
            <Link to="/catalog" className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-[#eef2e8]">Katalog</Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
          <div className="space-y-5">
            <div className="rounded-[28px] border border-[#263d27]/10 bg-white/70 p-6 shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#263d27]/15 bg-white px-3 py-1 text-xs font-bold uppercase text-[#263d27]">
                <UserRound className="h-4 w-4" />
                Portal customer
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">Cek order dengan kode unik.</h1>
              <p className="mt-4 text-base font-medium leading-relaxed text-muted-foreground">
                Lihat status payment, proses produksi, pengiriman, dan detail bespoke tanpa perlu akun terpisah.
              </p>
            </div>

            <form onSubmit={loadPortal} className="rounded-2xl border bg-white p-4 shadow-sm">
              <label className="text-xs font-bold uppercase text-muted-foreground">Kode customer</label>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={customerCode}
                  onChange={(event) => setCustomerCode(event.target.value.toUpperCase())}
                  placeholder="SOLI09232"
                  className="h-12 rounded-2xl border px-4 text-sm font-bold uppercase tracking-[0.08em] outline-none focus:border-[#263d27]"
                />
                <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Cek
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
                    <div className="text-xs font-bold uppercase text-[#263d27]">Cek keamanan</div>
                    <h2 className="mt-1 text-2xl font-bold">Dashboard terlindungi</h2>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">
                      Customer ini sudah mengaktifkan pertanyaan keamanan. Jawab dulu untuk membuka dashboard.
                    </p>
                  </div>
                </div>
                <form onSubmit={unlockPortal} className="mt-5 grid gap-3">
                  <div className="rounded-2xl bg-[#f7f8f2] p-4">
                    <div className="text-xs font-bold uppercase text-muted-foreground">Pertanyaan</div>
                    <div className="mt-1 text-base font-bold">{portal.customer.securityQuestion}</div>
                  </div>
                  <input
                    value={securityAnswer}
                    onChange={(event) => setSecurityAnswer(event.target.value)}
                    placeholder="Jawaban"
                    className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]"
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
                      <div className="text-xs font-bold uppercase text-[#263d27]">Selamat datang kembali</div>
                      <h2 className="mt-1 text-2xl font-bold">{portal.customer.customerName}</h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">{portal.customer.contact}</p>
                    </div>
                    <button type="button" onClick={copyCode} className="rounded-2xl bg-[#263d27] px-5 py-4 text-center text-xl font-bold tracking-[0.16em] text-[#eef2e8]">
                      {portal.customer.customerCode}
                    </button>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[#263d27]/10 bg-[#f7f8f2] p-4">
                      <div className="text-xs font-bold uppercase text-muted-foreground">Order</div>
                      <div className="mt-1 text-2xl font-bold">{portal.orders.length}</div>
                    </div>
                    <div className="rounded-2xl border border-[#263d27]/10 bg-[#eef2e8] p-4">
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
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
                        <ShieldCheck className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-lg font-bold">{portal.customer.securityEnabledAt ? 'Dashboard terlindungi' : 'Proteksi dashboard'}</span>
                        <span className="mt-0.5 block text-sm font-semibold text-muted-foreground">Tambahkan pertanyaan keamanan hanya jika diperlukan.</span>
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[#f7f8f2] px-4 py-2 text-xs font-bold uppercase text-[#263d27]">
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
                        placeholder="Jawaban"
                        className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]"
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
                            <PaymentProofPanel order={order} />
                            <ShipmentPanel order={order} />
                            <div className="mt-4 rounded-2xl border border-[#263d27]/10 bg-[#f7f8f2] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-xs font-bold uppercase text-[#263d27]">Self-service</div>
                                  <p className="mt-1 text-sm font-semibold text-muted-foreground">Kelola bukti bayar, invoice, tracking, dan reorder dari sini.</p>
                                </div>
                              </div>
                              <SelfServiceActions
                                isMobileRoute={isMobileRoute}
                                invoicePath={invoicePath}
                                onRefreshPayment={refreshPaymentStatus}
                                onReorder={reorderOrder}
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
              <StateBlock
                icon={searched ? Search : ShoppingBag}
                title={searched ? 'Kode customer tidak ditemukan' : 'Dashboard tampil di sini'}
                description={searched ? 'Cek lagi kode SOLI yang kamu masukkan.' : 'Masukkan kode customer untuk melihat progres order.'}
              />
            )}
          </div>
        </section>
      </main>
    </>
  );
};

export default CustomerPortalPage;
