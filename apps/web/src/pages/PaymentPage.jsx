import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, CreditCard, ExternalLink, FileCheck2, Loader2, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { getOrderById, getPublicOrderPaymentSession, submitOrderPaymentProof, updateOrderPaymentStatus } from '@/services/orderService.js';
import { createDokuCheckout, refreshDokuPaymentStatus } from '@/services/dokuCheckoutService.js';
import { isManualTransferPayment, MANUAL_TRANSFER_PAYMENT } from '@/services/cartService.js';
import { uploadPaymentProof } from '@/services/paymentProofStorageService.js';
import { copyTextToClipboard } from '@/utils/clipboard.js';
import { getOrderProductsSubtotal, getOrderShippingFee, getOrderSubtotalAfterVoucher, getOrderVoucherSnapshot } from '@/utils/orderTotals.js';

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
  expired: 'Link kedaluwarsa',
  refunded: 'Refund',
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
    title: 'Link pembayaran kedaluwarsa',
    description: 'Cek order untuk melihat status terbaru atau buat pembayaran baru jika perlu.',
  },
  failed: {
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    title: 'Pembayaran belum berhasil',
    description: 'Kamu bisa buka ulang pembayaran atau kembali ke cart untuk mencoba lagi.',
  },
  refunded: {
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    title: 'Pembayaran refund',
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

const buildManualTransferFromOrder = (order) => ({
  paymentType: order.paymentProvider || MANUAL_TRANSFER_PAYMENT.provider,
  paymentProvider: order.paymentProvider || MANUAL_TRANSFER_PAYMENT.provider,
  invoiceNumber: order.orderNumber,
  orderNumber: order.orderNumber,
  customerCode: order.customerCode,
  amount: order.subtotal,
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
  shippingFee: getOrderShippingFee(order),
  manualTransfer: {
    bankName: order.paymentResponse?.bankName || MANUAL_TRANSFER_PAYMENT.bankName,
    accountNumber: order.paymentResponse?.accountNumber || MANUAL_TRANSFER_PAYMENT.accountNumber,
    accountName: order.paymentResponse?.accountName || MANUAL_TRANSFER_PAYMENT.accountName,
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
  paymentProofUrl: order.paymentProofUrl,
  paymentProofFileName: order.paymentProofFileName,
  paymentProofContentType: order.paymentProofContentType,
  paymentProofUploadedAt: order.paymentProofUploadedAt,
  paymentProofStatus: order.paymentProofStatus,
  paymentProofNotes: order.paymentProofNotes,
  voucherSnapshot: getOrderVoucherSnapshot(order),
  shippingFee: getOrderShippingFee(order),
  createdAt: order.createdAt || new Date().toISOString(),
});

const PaymentTotalBreakdown = ({ session, compact = false }) => {
  const voucherSnapshot = getOrderVoucherSnapshot(session);
  if (!voucherSnapshot) return null;

  const subtotalAfterVoucher = getOrderSubtotalAfterVoucher(session);
  const shippingFee = Number(session.shippingFee || 0);
  return (
    <div className={`mt-4 rounded-2xl border border-[#263d27]/10 bg-white/80 ${compact ? 'p-3 text-xs' : 'p-4 text-sm'} font-bold text-[#263d27]`}>
      <div className="flex justify-between gap-3">
        <span>Subtotal produk</span>
        <span>{formatTotal(getOrderProductsSubtotal(session))}</span>
      </div>
      <div className="mt-2 flex justify-between gap-3">
        <span>Voucher {voucherSnapshot.code}</span>
        <span>-{formatTotal(voucherSnapshot.discountAmount)}</span>
      </div>
      <div className="mt-2 flex justify-between gap-3 text-[#6b7280]">
        <span>Subtotal setelah voucher</span>
        <span>{formatTotal(subtotalAfterVoucher)}</span>
      </div>
      {shippingFee ? (
        <div className="mt-2 flex justify-between gap-3 text-[#6b7280]">
          <span>Ongkir</span>
          <span>{formatTotal(shippingFee)}</span>
        </div>
      ) : null}
      <div className="mt-3 flex justify-between gap-3 border-t border-[#263d27]/10 pt-3 text-[#0b130c]">
        <span>Total bayar</span>
        <span>{formatTotal(session.amount)}</span>
      </div>
    </div>
  );
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
    const copied = await copyTextToClipboard(customerCode);
    copied ? toast.success(`${customerCode} disalin`) : toast.error('Kode belum bisa disalin. Tekan lama kode lalu salin manual.');
  };

  return (
    <section className={compact ? 'mobile-card overflow-hidden p-0' : 'overflow-hidden rounded-[28px] border border-[#263d27]/15 bg-white shadow-sm'}>
      <div className={compact ? 'border-b border-[#263d27]/10 bg-[#eef2e8] p-4' : 'border-b border-[#263d27]/10 bg-[#eef2e8] p-5'}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f7d61]">Checkout aman</div>
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
        <PaymentTotalBreakdown session={session} compact={compact} />
        {customerCode ? (
          <div className={compact ? 'mt-4 rounded-2xl border border-[#263d27]/15 bg-white p-4' : 'mt-5 rounded-2xl border border-[#263d27]/15 bg-white p-5'}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f7d61]">Kode customer</div>
                <div className={compact ? 'mt-1 select-text text-2xl font-bold tracking-[0.12em] text-[#263d27]' : 'mt-1 select-text text-3xl font-bold tracking-[0.16em] text-[#263d27]'}>
                  {customerCode}
                </div>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#54604d]">
                  Simpan kode ini untuk cek order dan belanja berikutnya tanpa isi ulang data.
                </p>
              </div>
              <Button type="button" variant="outline" className="shrink-0 rounded-2xl bg-[#f7f8f2] gap-2" onClick={copyCustomerCode}>
                <Copy className="h-4 w-4" />
                Salin kode
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

const ManualTransferPanel = ({ session, compact = false, onProofSubmitted }) => {
  const [proofFile, setProofFile] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const customerCode = session.customerCode || '';
  const orderTrackingPath = compact ? `/mobile/customer?code=${customerCode}` : `/customer?code=${customerCode}`;
  const orderNumber = session.orderNumber || session.invoiceNumber;
  const proofStatus = session.paymentProofStatus || 'missing';
  const hasSubmittedProof = Boolean(session.paymentProofUrl) && ['submitted', 'approved'].includes(proofStatus);
  const needsProofUpload = !hasSubmittedProof;
  const transfer = {
    bankName: session.manualTransfer?.bankName || MANUAL_TRANSFER_PAYMENT.bankName,
    accountNumber: session.manualTransfer?.accountNumber || MANUAL_TRANSFER_PAYMENT.accountNumber,
    accountName: session.manualTransfer?.accountName || MANUAL_TRANSFER_PAYMENT.accountName,
  };

  const copyValue = async (label, value) => {
    if (!value) return;
    const copied = await copyTextToClipboard(String(value));
    copied ? toast.success(`${label} disalin`) : toast.error(`${label} belum bisa disalin. Tekan lama teks lalu salin manual.`);
  };

  const chooseProofFile = (event) => {
    const [file] = Array.from(event.target.files || []);
    setProofFile(file || null);
  };

  const submitProof = async () => {
    if (!proofFile) {
      toast.error('Pilih file bukti transfer dulu');
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
      setProofFile(null);
      toast.success('Bukti transfer terkirim. Admin akan cek pembayaran.');
    } catch (error) {
      toast.error(error.message || 'Gagal upload bukti transfer');
    } finally {
      setUploadingProof(false);
    }
  };

  return (
    <section className={compact ? 'mobile-card overflow-hidden p-0' : 'overflow-hidden rounded-[28px] border border-[#263d27]/15 bg-white shadow-sm'}>
      <div className={compact ? 'border-b border-[#263d27]/10 bg-[#eef2e8] p-4' : 'border-b border-[#263d27]/10 bg-[#eef2e8] p-5'}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f7d61]">Transfer manual</div>
            <h1 className={compact ? 'mt-1 text-xl font-bold text-[#172016]' : 'mt-1 text-3xl font-bold text-[#172016]'}>Pembayaran Solivagant</h1>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-[#54604d]">
              Transfer sesuai total bayar ke rekening di bawah, lalu wajib upload bukti transfer di halaman ini. Order baru masuk pengecekan admin setelah bukti transfer terkirim.
            </p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-[#263d27]">
            <CreditCard className="h-5 w-5" />
          </span>
        </div>
        {!compact ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/80 px-4 py-3">
                <div className="text-[10px] uppercase text-[#6f7d61]">Order</div>
                <div className="mt-1 truncate">{session.orderNumber || session.invoiceNumber}</div>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-3">
                <div className="text-[10px] uppercase text-[#6f7d61]">Customer</div>
                <div className="mt-1 truncate">{session.customerCode || session.customerName || '-'}</div>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-3">
                <div className="text-[10px] uppercase text-[#6f7d61]">Total transfer</div>
                <div className="mt-1">{formatTotal(session.amount)}</div>
              </div>
            </div>
            <PaymentTotalBreakdown session={session} compact={compact} />
          </>
        ) : null}
      </div>

      <div className={compact ? 'grid gap-3 p-4' : 'grid gap-4 p-5 lg:grid-cols-[1fr_0.8fr]'}>
        {customerCode ? (
          <div className={compact ? 'rounded-2xl border border-[#263d27]/15 bg-[#eef2e8] p-4' : 'rounded-2xl border border-[#263d27]/15 bg-[#eef2e8] p-5 lg:col-span-2'}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f7d61]">Kode customer</div>
                <div className={compact ? 'mt-1 select-text text-2xl font-bold tracking-[0.12em] text-[#263d27]' : 'mt-1 select-text text-3xl font-bold tracking-[0.16em] text-[#263d27]'}>
                  {customerCode}
                </div>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#54604d]">
                  Salin dan simpan kode ini. Kode dipakai untuk cek order dan belanja berikutnya tanpa isi ulang data.
                </p>
              </div>
              <Button type="button" variant="outline" className="shrink-0 rounded-2xl bg-white gap-2" onClick={() => copyValue('Kode customer', customerCode)}>
                <Copy className="h-4 w-4" />
                Salin kode
              </Button>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f7d61]">Rekening tujuan</div>
          <div className="mt-3 grid gap-3">
            <div className="rounded-2xl bg-white p-4">
              <div className="text-xs font-bold uppercase text-muted-foreground">Bank</div>
              <div className="mt-1 text-xl font-bold text-[#263d27]">{transfer.bankName}</div>
            </div>
            <button type="button" onClick={() => copyValue('Nomor rekening', transfer.accountNumber)} className="rounded-2xl border border-[#263d27]/10 bg-white p-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase text-muted-foreground">Nomor rekening</div>
                  <div className="mt-1 text-2xl font-bold tracking-[0.08em] text-[#263d27]">{transfer.accountNumber}</div>
                </div>
                <Copy className="h-4 w-4 text-[#263d27]" />
              </div>
            </button>
            <button type="button" onClick={() => copyValue('Nama rekening', transfer.accountName)} className="rounded-2xl border border-[#263d27]/10 bg-white p-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase text-muted-foreground">Atas nama</div>
                  <div className="mt-1 text-lg font-bold text-[#0b130c]">{transfer.accountName}</div>
                </div>
                <Copy className="h-4 w-4 text-[#263d27]" />
              </div>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="text-xs font-bold uppercase">Instruksi</div>
          <ol className="mt-3 grid gap-2 text-sm font-semibold leading-relaxed">
            <li>1. Transfer tepat sebesar {formatTotal(session.amount)}.</li>
            <li>2. Salin dan simpan kode customer untuk cek status order.</li>
            <li>3. Upload bukti transfer lewat form di bawah. Ini wajib untuk transfer manual.</li>
            <li>4. Admin akan cek bukti transfer dan memperbarui status pembayaran setelah valid.</li>
          </ol>
          <Button type="button" className="mt-4 w-full rounded-2xl gap-2" onClick={() => copyValue('Total transfer', Number(session.amount || 0))}>
            <Copy className="h-4 w-4" />
            Salin total transfer
          </Button>
          {customerCode && hasSubmittedProof ? (
            <Link to={orderTrackingPath} className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#263d27]/15 bg-white px-4 text-sm font-bold text-[#263d27]">
              Lacak order
            </Link>
          ) : null}
          {customerCode && needsProofUpload ? (
            <div className="mt-2 flex items-start gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-xs font-bold leading-relaxed text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Bukti transfer wajib dikirim dulu. Setelah upload berhasil, kamu bisa lanjut ke tracking order.
            </div>
          ) : null}
        </div>

        {compact ? (
          <div className="rounded-2xl border border-[#263d27]/10 bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f7d61]">Ringkasan order</div>
            <div className="mt-3 grid gap-2 text-xs font-bold text-[#263d27]">
              <div className="rounded-2xl bg-[#eef2e8] px-4 py-3">
                <div className="text-[10px] uppercase text-[#6f7d61]">Order</div>
                <div className="mt-1 truncate">{session.orderNumber || session.invoiceNumber}</div>
              </div>
              <div className="rounded-2xl bg-[#eef2e8] px-4 py-3">
                <div className="text-[10px] uppercase text-[#6f7d61]">Customer</div>
                <div className="mt-1 truncate">{session.customerCode || session.customerName || '-'}</div>
              </div>
            </div>
            <PaymentTotalBreakdown session={session} compact />
          </div>
        ) : null}

        <div id="mobile-payment-proof-section" className="rounded-2xl border border-[#263d27]/10 bg-white p-4">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${hasSubmittedProof ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {hasSubmittedProof ? <FileCheck2 className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-xs font-bold uppercase text-[#6f7d61]">Bukti transfer</div>
                {needsProofUpload ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Wajib</span> : null}
              </div>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#263d27]">
                {proofStatus === 'rejected'
                  ? 'Bukti sebelumnya ditolak. Upload ulang bukti transfer yang jelas.'
                  : hasSubmittedProof
                  ? 'Bukti transfer sudah terkirim. Tunggu admin mengecek pembayaran.'
                  : 'Bukti transfer wajib diupload agar pembayaran manual bisa dicek dan order diproses.'}
              </p>
              {proofStatus === 'rejected' && session.paymentProofNotes ? (
                <div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold leading-relaxed text-rose-800">
                  <span className="block text-[10px] font-bold uppercase text-rose-700">Alasan admin</span>
                  {session.paymentProofNotes}
                </div>
              ) : null}
              {session.paymentProofFileName ? (
                <div className="mt-2 truncate rounded-xl bg-[#eef2e8] px-3 py-2 text-xs font-bold text-[#263d27]">
                  {session.paymentProofFileName}
                </div>
              ) : null}
              {session.paymentProofUploadedAt ? (
                <div className="mt-1 text-[11px] font-semibold text-[#6f7d61]">
                  Dikirim {formatDateTime(session.paymentProofUploadedAt)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="sr-only">Upload bukti transfer</span>
              <input
                id="mobile-payment-proof-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={chooseProofFile}
                disabled={uploadingProof}
                required={needsProofUpload}
                aria-required={needsProofUpload}
                className="block w-full rounded-2xl border border-[#263d27]/15 bg-[#fbfaf7] px-3 py-2 text-sm font-semibold text-[#263d27] file:mr-3 file:rounded-xl file:border-0 file:bg-[#263d27] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#eef2e8]"
              />
            </label>
            {proofFile ? (
              <div className="truncate text-xs font-semibold text-[#6f7d61]">
                {proofFile.name}
              </div>
            ) : null}
            <Button type="button" className="h-11 rounded-2xl gap-2" onClick={submitProof} disabled={uploadingProof || !proofFile}>
              {uploadingProof ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {hasSubmittedProof ? 'Upload ulang bukti' : 'Upload bukti transfer'}
            </Button>
            <p className="text-[11px] font-semibold leading-relaxed text-[#6b7280]">
              Format JPG, PNG, WebP, atau PDF. Maksimal 5 MB.
            </p>
          </div>
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

const MobilePaymentSkeleton = () => (
  <section className="mobile-card overflow-hidden p-0" aria-busy="true">
    <div className="border-b border-[#263d27]/10 bg-[#eef2e8] p-4">
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const orderNumber = searchParams.get('order');
  const paymentReturn = searchParams.get('payment');
  const isSessionForOrder = (candidate) => (
    candidate && (!orderNumber || candidate.orderNumber === orderNumber || candidate.invoiceNumber === orderNumber)
  );

  const recoverDokuPaymentSession = async (order) => {
    if (!order?.orderNumber || order.paymentStatus === 'paid') {
      return null;
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
      const recoveredSession = buildDokuSessionFromCheckout(order, checkout);
      sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(recoveredSession));
      return recoveredSession;
    } catch (error) {
      console.warn('Failed to recover DOKU payment session:', error.message || error);
      return null;
    }
  };

  const loadPaymentSession = async ({ syncStatus = false } = {}) => {
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
  const sessionIsManual = isManualTransferPayment(session?.paymentProvider || session?.paymentType);
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
          <title>Payment - Solivagant</title>
        </Helmet>
        <main className="mobile-page mobile-payment-page space-y-4">
          <MobileTopBar
            title="Pembayaran"
            subtitle={session?.orderNumber || orderNumber || 'Solivagant checkout'}
            eyebrow="Secure"
            onBack={() => navigate('/mobile/cart')}
            action={<CreditCard className="h-5 w-5 text-amber-700" />}
          />
          {(loadingOrder || refreshingStatus) && !session ? <MobilePaymentSkeleton /> : isManualTransferPayment(session?.paymentProvider || session?.paymentType) ? (
            <ManualTransferPanel session={session} compact onProofSubmitted={setSession} />
          ) : session?.paymentUrl ? <PaymentFrame session={session} compact /> : <EmptyPaymentState isMobile orderNumber={orderNumber} loading={loadingOrder || refreshingStatus} onRefresh={refreshPaymentSession} />}
          {session ? (
            <StickyBottomActionBar
              fixed
              reserveSpace
              aria-label="Aksi pembayaran"
              className="mobile-payment-action-bar"
              contentClassName="rounded-2xl border-[#263d27]/10 bg-white/95"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-[#8b949e]">{sessionIsManual ? 'Transfer manual' : 'Pembayaran DOKU'}</p>
                  <p className="truncate text-lg font-bold leading-tight text-[#263d27]">{formatTotal(session.amount)}</p>
                  <p className="truncate text-[10px] font-bold text-amber-700">{paymentStatusLabels[session.paymentStatus || 'pending'] || 'Menunggu pembayaran'}</p>
                </div>
                <Button type="button" className="h-12 rounded-2xl gap-2 px-4" onClick={openPrimaryPaymentAction}>
                  {sessionIsManual ? <Upload className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                  {sessionIsManual ? 'Upload bukti' : 'Bayar DOKU'}
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
          {isManualTransferPayment(session?.paymentProvider || session?.paymentType) ? (
            <ManualTransferPanel session={session} onProofSubmitted={setSession} />
          ) : session?.paymentUrl ? <PaymentFrame session={session} /> : <EmptyPaymentState orderNumber={orderNumber} loading={loadingOrder || refreshingStatus} onRefresh={refreshPaymentSession} />}
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
