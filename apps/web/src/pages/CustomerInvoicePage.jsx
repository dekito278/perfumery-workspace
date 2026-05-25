import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, ExternalLink, FileText, Loader2, Printer, Search, ShieldCheck, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import StatusChip, { getPaymentStatusTone, getShipmentStatusTone } from '@/components/ui/status-chip.jsx';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import {
  getCustomerPortalByCode,
  verifyCustomerPortalSecurity,
} from '@/services/customerService.js';
import { getShipmentStatusLabels } from '@/services/orderService.js';
import { buildCourierTrackingSearchUrl, buildPublicTrackingUrl } from '@/services/publicTrackingService.js';
import {
  getOrderProductItems,
  getOrderProductsSubtotal,
  getOrderShippingFee,
  getOrderShippingPromotionLabel,
  getOrderShippingSummary,
  getOrderSubtotalAfterVoucher,
  getOrderVoucherSnapshot,
} from '@/utils/orderTotals.js';
import { getDiscountedVoucherCartLines } from '@/utils/cartVoucherPricing.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-');

const paymentStatusLabels = {
  unpaid: 'Belum dibayar',
  pending: 'Menunggu bayar',
  paid: 'Sudah dibayar',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
  refunded: 'Refund',
};
const shipmentStatusLabels = getShipmentStatusLabels();

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

const InvoiceCard = ({ customer, order, isMobile }) => {
  const voucherSnapshot = getOrderVoucherSnapshot(order);
  const productItems = getOrderProductItems(order);
  const discountedLines = voucherSnapshot
    ? getDiscountedVoucherCartLines(productItems, voucherSnapshot)
    : getDiscountedVoucherCartLines(productItems);
  const productsSubtotal = getOrderProductsSubtotal(order);
  const subtotalAfterVoucher = getOrderSubtotalAfterVoucher(order);
  const shippingFee = getOrderShippingFee(order);
  const shippingSummary = getOrderShippingSummary(order);
  const shippingPromotionLabel = getOrderShippingPromotionLabel(order);
  const shouldShowShipping = Boolean(shippingFee || shippingSummary);
  const courierSearchUrl = buildCourierTrackingSearchUrl({
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
  });

  return (
  <section className={`${isMobile ? 'mobile-card p-0' : 'rounded-[28px] border bg-white shadow-sm'} overflow-hidden`}>
    <div className="border-b border-[#e5e7eb] bg-[#050705] p-5 text-[#eef2e8] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase">
            <FileText className="h-3.5 w-3.5" />
            Invoice
          </div>
          <h1 className="mt-4 text-2xl font-bold sm:text-4xl">{order.orderNumber}</h1>
          <p className="mt-1 text-xs font-semibold text-[#cfd8cc] sm:text-sm">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <PaymentBadge status={order.paymentStatus} />
          {order.shipmentStatus && order.shipmentStatus !== 'not_ready' ? <ShipmentBadge status={order.shipmentStatus} /> : null}
        </div>
      </div>
    </div>

    <div className="p-5 sm:p-7">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#f8f7f4] p-4">
          <div className="text-[10px] font-bold uppercase text-[#6b7280]">Customer</div>
          <div className="mt-1 text-base font-bold text-[#0b130c]">{customer.customerName}</div>
          <div className="mt-1 text-sm font-semibold text-[#6b7280]">{customer.contact}</div>
        </div>
        <div className="rounded-2xl bg-[#f8f7f4] p-4">
          <div className="text-[10px] font-bold uppercase text-[#6b7280]">Pembayaran</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CreditCard className="h-4 w-4 text-[#263d27]" />
            <span className="text-base font-bold text-[#0b130c]">{paymentStatusLabels[order.paymentStatus] || order.paymentStatus}</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-[#6b7280]">{order.paymentProvider || 'manual'}{order.paymentReference ? ` / ${order.paymentReference}` : ''}</div>
        </div>
        <div className="rounded-2xl bg-[#f8f7f4] p-4">
          <div className="text-[10px] font-bold uppercase text-[#6b7280]">Pengiriman</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Truck className="h-4 w-4 text-[#263d27]" />
            <span className="text-base font-bold text-[#0b130c]">{shipmentStatusLabels[order.shipmentStatus] || order.shipmentStatus || 'Belum dikirim'}</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-[#6b7280]">
            {order.trackingNumber ? `${order.courierName || 'Kurir'} / ${order.trackingNumber}` : order.courierName || 'Resi akan muncul setelah dikirim'}
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[#e5e7eb]">
        <div className="grid grid-cols-[1fr_54px_86px] gap-2 bg-[#f8f7f4] px-3 py-2 text-[10px] font-bold uppercase text-[#6b7280] sm:grid-cols-[1fr_80px_120px_120px]">
          <span>Item</span>
          <span className="text-right">Qty</span>
          <span className="hidden text-right sm:block">Harga</span>
          <span className="text-right">Total</span>
        </div>
        {discountedLines.map((line) => {
          const item = line.item;
          const hasDiscount = line.discount > 0;

          return (
            <div key={`${order.orderNumber}-${item.slug || item.name}`} className="grid grid-cols-[1fr_54px_86px] gap-2 border-t border-[#e5e7eb] px-3 py-3 text-sm font-semibold sm:grid-cols-[1fr_80px_120px_120px]">
              <span className="min-w-0">
                <span className="block truncate font-bold text-[#0b130c]">{item.name}</span>
                {item.size ? <span className="mt-0.5 block text-xs text-[#6b7280]">{item.size}</span> : null}
                {hasDiscount ? <span className="mt-1 block text-[11px] font-bold text-[#263d27]">Diskon voucher -{formatTotal(line.discount)}</span> : null}
              </span>
              <span className="text-right text-[#1f2937]">{item.quantity || 1}</span>
              <span className="hidden text-right text-[#1f2937] sm:block">
                {hasDiscount ? (
                  <>
                    <span className="block text-[11px] text-[#9ca3af] line-through">{formatTotal(item.priceNumber)}</span>
                    <span className="block">{formatTotal(line.discountedUnitPrice)}</span>
                  </>
                ) : item.price || formatTotal(item.priceNumber)}
              </span>
              <span className="text-right font-bold text-amber-700">
                {hasDiscount ? (
                  <>
                    <span className="block text-[11px] text-[#9ca3af] line-through">{formatTotal(line.originalTotal)}</span>
                    <span className="block">{formatTotal(line.discountedTotal)}</span>
                  </>
                ) : formatTotal(line.originalTotal)}
              </span>
            </div>
          );
        })}
        {voucherSnapshot ? (
          <div className="grid grid-cols-[1fr_54px_86px] gap-2 border-t border-[#e5e7eb] bg-[#eef2e8] px-3 py-3 text-sm font-semibold sm:grid-cols-[1fr_80px_120px_120px]">
            <span className="min-w-0">
              <span className="block truncate font-bold text-[#263d27]">Voucher {voucherSnapshot.code}</span>
              <span className="mt-0.5 block text-xs text-[#51624b]">{voucherSnapshot.discountType || 'discount'} {voucherSnapshot.discountValue || ''}</span>
            </span>
            <span className="text-right text-[#263d27]">1</span>
            <span className="hidden text-right text-[#263d27] sm:block">Diskon</span>
            <span className="text-right font-bold text-[#263d27]">-{formatTotal(voucherSnapshot.discountAmount)}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_260px]">
        <div className="rounded-2xl bg-[#eef2e8] p-4 text-xs font-semibold leading-relaxed text-[#263d27]">
          Simpan invoice ini sebagai bukti order. Status payment dan pengiriman akan mengikuti update DOKU, admin, dan kurir.
          <div className="mt-3 flex flex-wrap gap-2">
            {order.paymentUrl && ['unpaid', 'pending'].includes(order.paymentStatus) ? (
              <Link to={`${isMobile ? '/mobile/payment' : '/payment'}?order=${encodeURIComponent(order.orderNumber)}&payment=doku`} className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#263d27] px-4 text-xs font-bold text-[#eef2e8]">
                <CreditCard className="h-4 w-4" />
                Lanjut bayar
              </Link>
            ) : null}
            {order.trackingUrl && order.trackingNumber ? (
              <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#263d27]/15 bg-white px-4 text-xs font-bold text-[#263d27]">
                <ExternalLink className="h-4 w-4" />
                Lacak resi
              </a>
            ) : null}
            {!order.trackingUrl && courierSearchUrl ? (
              <a href={courierSearchUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#263d27]/15 bg-white px-4 text-xs font-bold text-[#263d27]">
                <ExternalLink className="h-4 w-4" />
                Cari resi kurir
              </a>
            ) : null}
            <a href={buildPublicTrackingUrl(order.orderNumber)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#263d27]/15 bg-white px-4 text-xs font-bold text-[#263d27]">
              <ExternalLink className="h-4 w-4" />
              Tracking publik
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-[#263d27]/10 bg-white p-4">
          <div className="flex items-center justify-between text-sm font-semibold text-[#6b7280]">
            <span>Total item</span>
            <span>{order.quantity}</span>
          </div>
          {voucherSnapshot ? (
            <>
              <div className="mt-3 flex items-center justify-between border-t border-[#e5e7eb] pt-3 text-sm font-semibold text-[#6b7280]">
                <span>Subtotal produk</span>
                <span>{formatTotal(productsSubtotal)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm font-semibold text-[#263d27]">
                <span>Voucher {voucherSnapshot.code}</span>
                <span>-{formatTotal(voucherSnapshot.discountAmount)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm font-semibold text-[#6b7280]">
                <span>Subtotal setelah voucher</span>
                <span>{formatTotal(subtotalAfterVoucher)}</span>
              </div>
              {shouldShowShipping ? (
                <div className="mt-2 flex items-center justify-between text-sm font-semibold text-[#6b7280]">
                  <span>{shippingPromotionLabel ? 'Ongkir setelah promo' : 'Ongkir'}</span>
                  <span>{formatTotal(shippingFee)}</span>
                </div>
              ) : null}
              {shippingPromotionLabel ? <p className="mt-1 text-xs font-bold text-emerald-700">{shippingPromotionLabel}</p> : null}
            </>
          ) : null}
          {!voucherSnapshot && shouldShowShipping ? (
            <>
              <div className="mt-3 flex items-center justify-between border-t border-[#e5e7eb] pt-3 text-sm font-semibold text-[#6b7280]">
                <span>Subtotal produk</span>
                <span>{formatTotal(Math.max(Number(order.subtotal || 0) - shippingFee, 0))}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm font-semibold text-[#6b7280]">
                <span>{shippingPromotionLabel ? 'Ongkir setelah promo' : 'Ongkir'}</span>
                <span>{formatTotal(shippingFee)}</span>
              </div>
              {shippingPromotionLabel ? <p className="mt-1 text-xs font-bold text-emerald-700">{shippingPromotionLabel}</p> : null}
            </>
          ) : null}
          <div className="mt-3 flex items-center justify-between border-t border-[#e5e7eb] pt-3">
            <span className="text-sm font-bold uppercase text-[#263d27]">Total bayar</span>
            <span className="text-xl font-bold text-[#0b130c]">{formatTotal(order.subtotal)}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
  );
};

const CustomerInvoicePage = () => {
  const { orderNumber } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  const [customerCode, setCustomerCode] = useState(initialCode.toUpperCase());
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const isMobileRoute = location.pathname.startsWith('/mobile');

  const order = useMemo(() => (
    portal?.orders?.find((item) => item.orderNumber === orderNumber) || null
  ), [orderNumber, portal]);

  const dashboardPath = `${isMobileRoute ? '/mobile/customer' : '/customer'}${customerCode ? `?code=${encodeURIComponent(customerCode)}` : ''}`;

  const loadInvoice = async (code) => {
    if (!code.trim()) {
      toast.error('Kode customer wajib diisi');
      return;
    }

    setLoading(true);
    setSearched(true);
    const result = await getCustomerPortalByCode(code);
    setLoading(false);

    if (!result) {
      setPortal(null);
      toast.error('Kode customer tidak ditemukan');
      return;
    }

    setPortal(result);
    setCustomerCode(result.customer.customerCode);
    setSearchParams({ code: result.customer.customerCode });
  };

  useEffect(() => {
    if (initialCode) loadInvoice(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitLookup = (event) => {
    event.preventDefault();
    loadInvoice(customerCode);
  };

  const unlockInvoice = async (event) => {
    event.preventDefault();
    setSecurityLoading(true);
    const result = await verifyCustomerPortalSecurity(portal.customer.customerCode, securityAnswer);
    setSecurityLoading(false);

    if (!result) {
      toast.error('Security answer salah');
      return;
    }

    setPortal(result);
    setSecurityAnswer('');
    toast.success('Invoice terbuka');
  };

  const content = (
    <main className={isMobileRoute ? 'mobile-page space-y-4' : 'mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8'}>
      <div className={isMobileRoute ? 'flex items-center justify-between gap-3' : 'mb-5 flex items-center justify-between gap-4'}>
        <Link to={dashboardPath} className="inline-flex items-center gap-2 text-sm font-bold text-[#263d27]">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        {order ? (
          <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        ) : null}
      </div>

      {!portal ? (
        <section className={isMobileRoute ? 'mobile-card p-5' : 'rounded-[28px] border bg-white p-6 shadow-sm'}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#0b130c]">Invoice</h1>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Masukkan kode customer untuk membuka invoice {orderNumber}.</p>
            </div>
          </div>
          <form onSubmit={submitLookup} className="mt-5 grid grid-cols-[1fr_auto] gap-2">
            <input
              value={customerCode}
              onChange={(event) => setCustomerCode(event.target.value.toUpperCase())}
              placeholder="SOLI09232"
              className="h-12 rounded-2xl border px-4 text-sm font-bold uppercase tracking-[0.08em] outline-none focus:border-[#263d27]"
            />
            <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buka
            </Button>
          </form>
          {searched && !loading ? <p className="mt-3 text-xs font-semibold text-[#6b7280]">Invoice belum ditemukan untuk data tersebut.</p> : null}
        </section>
      ) : portal.requiresSecurity ? (
        <section className={isMobileRoute ? 'mobile-card p-5' : 'rounded-[28px] border bg-white p-6 shadow-sm'}>
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-bold uppercase text-[#263d27]">Cek keamanan</div>
              <h1 className="mt-1 text-xl font-bold text-[#0b130c]">Buka invoice</h1>
              <p className="mt-2 text-sm font-semibold text-[#6b7280]">{portal.customer.securityQuestion}</p>
            </div>
          </div>
          <form onSubmit={unlockInvoice} className="mt-5 grid gap-3">
            <input
              value={securityAnswer}
              onChange={(event) => setSecurityAnswer(event.target.value)}
              placeholder="Jawaban"
              className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]"
            />
            <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={securityLoading}>
              {securityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Buka
            </Button>
          </form>
        </section>
      ) : order ? (
        <InvoiceCard customer={portal.customer} order={order} isMobile={isMobileRoute} />
      ) : (
        <StateBlock
          className={isMobileRoute ? 'mobile-card' : 'rounded-[28px]'}
          icon={FileText}
          title="Invoice tidak ditemukan"
          description={`Order ${orderNumber} tidak ditemukan untuk kode customer ini.`}
        />
      )}
    </main>
  );

  if (isMobileRoute) {
    return (
      <MobileCommerceLayout>
        <Helmet><title>Invoice {orderNumber} - Solivagant</title></Helmet>
        {content}
      </MobileCommerceLayout>
    );
  }

  return (
    <>
      <Helmet><title>Invoice {orderNumber} - Solivagant</title></Helmet>
      <div className="min-h-screen bg-[#f7f8f2] text-[#0b130c]">
        {content}
      </div>
    </>
  );
};

export default CustomerInvoicePage;
