import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clipboard, CreditCard, Download, ExternalLink, Eye, FileCheck2, Loader2, MessageCircle, PackageCheck, ReceiptText, RefreshCw, Search, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import StatusChip, { getOrderStatusTone, getPaymentStatusTone, getShipmentStatusTone } from '@/components/ui/status-chip.jsx';
import { useOrders } from '@/hooks/useOrders.js';
import { refreshDokuPaymentStatus } from '@/services/dokuCheckoutService.js';
import {
  getBespokeItem,
  getBespokeProductionStatusLabels,
  getOrderReservationExpiresAt,
  getOrderStatusLabels,
  getShipmentStatusLabels,
  isBespokeOrder,
} from '@/services/orderService.js';
import { buildNotificationMessage, getWhatsAppNotificationUrl } from '@/services/notificationTemplateService.js';
import {
  getOrderProductItems,
  getOrderProductsSubtotal,
  getOrderShippingFee,
  getOrderSubtotalAfterVoucher,
  getOrderVoucherSnapshot,
} from '@/utils/orderTotals.js';
import { getDiscountedVoucherCartLines } from '@/utils/cartVoucherPricing.js';
import { exportOrdersCsv } from '@/utils/orderBulkActions.js';

const canExportShippingLabel = (order) => Boolean(
  order
    && order.paymentStatus === 'paid'
    && !['cancelled'].includes(order.status)
);

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
const formatDate = (value) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const statusLabels = getOrderStatusLabels();
const shipmentStatusLabels = getShipmentStatusLabels();
const bespokeProductionStatusLabels = getBespokeProductionStatusLabels();
const paymentStatusLabels = {
  unpaid: 'Belum dibayar',
  pending: 'Menunggu bayar',
  paid: 'Sudah dibayar',
  failed: 'Gagal',
  expired: 'Expired',
  refunded: 'Refund',
};

const orderFilterLabels = {
  all: 'Semua',
  proof_review: 'Review bukti',
  payment: 'Perlu dibayar',
  packing: 'Siap packing',
  shipped: 'Dikirim',
  bespoke: 'Bespoke',
};

const paymentProofStatusLabels = {
  missing: 'Belum ada bukti',
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

const OrderVoucherSummary = ({ order }) => {
  const voucherSnapshot = getOrderVoucherSnapshot(order);
  if (!voucherSnapshot) return null;
  const shippingFee = getOrderShippingFee(order);

  return (
    <div className="mt-2 rounded-2xl border border-[#263d27]/10 bg-[#eef2e8] px-3 py-2 text-xs font-bold text-[#263d27]">
      <div className="flex justify-between gap-3"><span>Subtotal produk</span><span>{formatTotal(getOrderProductsSubtotal(order))}</span></div>
      <div className="mt-1 flex justify-between gap-3"><span>Voucher {voucherSnapshot.code}</span><span>-{formatTotal(voucherSnapshot.discountAmount)}</span></div>
      <div className="mt-1 flex justify-between gap-3 text-muted-foreground"><span>Subtotal setelah voucher</span><span>{formatTotal(getOrderSubtotalAfterVoucher(order))}</span></div>
      {shippingFee ? <div className="mt-1 flex justify-between gap-3 text-muted-foreground"><span>Ongkir</span><span>{formatTotal(shippingFee)}</span></div> : null}
    </div>
  );
};

const bespokeDetailRows = (item) => [
  ['Mood', item?.mood],
  ['Occasion', item?.occasion],
  ['Budget', item?.budget],
  ['Size', item?.size],
  ['Preferred aroma', item?.preferredNotes || item?.notes],
  ['Avoided notes', item?.avoidedNotes],
  ['Story', item?.story],
  ['Cap design', item?.capDesign],
  ['Exotic material', item?.exoticMaterial],
  ['Reference scent', item?.referenceProductName],
].filter(([, value]) => value);

const OrdersPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orders, summary, loading, reload, updateStatus, updatePaymentStatus, deleteOne } = useOrders();
  const [syncingOrder, setSyncingOrder] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [orderFilter, setOrderFilter] = useState(() => {
    const filter = new URLSearchParams(location.search).get('filter');
    return orderFilterLabels[filter] ? filter : 'all';
  });

  const visibleOrders = orders.filter((order) => {
    const query = searchTerm.trim().toLowerCase();
    const shipped = ['shipped', 'delivered'].includes(order.shipmentStatus);
    const matchesFilter = orderFilter === 'all'
      || (orderFilter === 'proof_review' && order.paymentProofStatus === 'submitted')
      || (orderFilter === 'payment' && ['unpaid', 'pending'].includes(order.paymentStatus))
      || (orderFilter === 'packing' && order.paymentStatus === 'paid' && !shipped)
      || (orderFilter === 'shipped' && shipped)
      || (orderFilter === 'bespoke' && isBespokeOrder(order));
    if (!matchesFilter) return false;
    if (!query) return true;
    return [
      order.orderNumber,
      order.customerName,
      order.customerCode,
      order.contact,
      order.paymentReference,
      order.trackingNumber,
      order.courierName,
    ].some((value) => String(value || '').toLowerCase().includes(query));
  });

  const filterCounts = {
    all: orders.length,
    proof_review: orders.filter((order) => order.paymentProofStatus === 'submitted').length,
    payment: orders.filter((order) => ['unpaid', 'pending'].includes(order.paymentStatus)).length,
    packing: orders.filter((order) => order.paymentStatus === 'paid' && !['shipped', 'delivered'].includes(order.shipmentStatus)).length,
    shipped: orders.filter((order) => ['shipped', 'delivered'].includes(order.shipmentStatus)).length,
    bespoke: orders.filter(isBespokeOrder).length,
  };
  const selectedOrderSet = useMemo(() => new Set(selectedOrders), [selectedOrders]);
  const selectedVisibleOrders = visibleOrders.filter((order) => selectedOrderSet.has(order.id || order.orderNumber));
  const selectedPrintableOrders = selectedVisibleOrders.filter(canExportShippingLabel);
  const visibleOrderKeys = visibleOrders.map((order) => order.id || order.orderNumber);
  const allVisibleSelected = visibleOrderKeys.length > 0 && visibleOrderKeys.every((key) => selectedOrderSet.has(key));

  useEffect(() => {
    setSelectedOrders((current) => current.filter((key) => orders.some((order) => (order.id || order.orderNumber) === key)));
  }, [orders]);

  const copyOrder = async (order) => {
    await navigator.clipboard.writeText(order.checkoutDraft);
    toast.success(`${order.orderNumber} disalin`);
  };

  const prepareCustomerNotification = async (order, eventKey) => {
    const message = buildNotificationMessage(order, eventKey);
    if (!message) return;

    try {
      await navigator.clipboard.writeText(message);
      toast.success(`Pesan customer ${order.orderNumber} disalin`, {
        action: {
          label: 'Open WA',
          onClick: () => window.open(getWhatsAppNotificationUrl(order, message), '_blank', 'noopener,noreferrer'),
        },
      });
    } catch (error) {
      toast.success(`Pesan customer ${order.orderNumber} siap`);
    }
  };

  const updatePaymentAndNotify = async (order, paymentStatus) => {
    await updatePaymentStatus(order.id || order.orderNumber, paymentStatus);
    if (paymentStatus === 'paid') {
      await prepareCustomerNotification({ ...order, paymentStatus: 'paid', status: 'paid' }, 'paid');
    }
  };

  const updateStatusAndNotify = async (order, status) => {
    await updateStatus(order.id || order.orderNumber, status);
    if (['processing', 'shipped', 'completed'].includes(status)) {
      await prepareCustomerNotification({ ...order, status }, status);
    }
  };

  const toggleOrderSelection = (order, checked) => {
    const key = order.id || order.orderNumber;
    setSelectedOrders((current) => (
      checked ? Array.from(new Set([...current, key])) : current.filter((value) => value !== key)
    ));
  };

  const toggleVisibleSelection = (checked) => {
    setSelectedOrders((current) => {
      const visibleSet = new Set(visibleOrderKeys);
      if (!checked) return current.filter((key) => !visibleSet.has(key));
      return Array.from(new Set([...current, ...visibleOrderKeys]));
    });
  };

  const bulkMarkPaid = async () => {
    if (!selectedVisibleOrders.length) {
      toast.error('Pilih order dulu untuk mark paid');
      return;
    }
    setBulkSaving(true);
    try {
      await Promise.all(selectedVisibleOrders.map((order) => updatePaymentStatus(order.id || order.orderNumber, 'paid')));
      toast.success(`${selectedVisibleOrders.length} order ditandai paid`);
    } catch (error) {
      toast.error(error.message || 'Gagal mark paid massal');
    } finally {
      setBulkSaving(false);
    }
  };

  const bulkPrintResi = async () => {
    const { exportShippingLabelsPdf } = await import('@/utils/shippingLabelPdf.js');
    const printedCount = exportShippingLabelsPdf(selectedVisibleOrders);
    if (!printedCount) {
      toast.error('Pilih order paid untuk cetak resi');
      return;
    }
    toast.success(`${printedCount} resi PDF siap`);
  };

  const bulkWhatsAppFollowUp = async () => {
    if (!selectedVisibleOrders.length) {
      toast.error('Pilih order dulu untuk follow-up WA');
      return;
    }
    const messages = selectedVisibleOrders.map((order) => {
      const eventKey = order.shipmentStatus === 'shipped'
        ? 'shipped'
        : order.paymentStatus === 'paid'
          ? 'paid'
          : 'order_created';
      return {
        order,
        message: buildNotificationMessage(order, eventKey),
      };
    }).filter((entry) => entry.message);
    if (!messages.length) {
      toast.error('Tidak ada template WA untuk order terpilih');
      return;
    }
    await navigator.clipboard.writeText(messages.map(({ order, message }) => `${order.orderNumber}\n${message}`).join('\n\n---\n\n'));
    window.open(getWhatsAppNotificationUrl(messages[0].order, messages[0].message), '_blank', 'noopener,noreferrer');
    toast.success(`${messages.length} pesan WA disalin, WA pertama dibuka`);
  };

  const bulkExportCsv = () => {
    if (!selectedVisibleOrders.length) {
      toast.error('Pilih order dulu untuk export CSV');
      return;
    }
    exportOrdersCsv(selectedVisibleOrders, 'orders_selected.csv');
    toast.success(`${selectedVisibleOrders.length} order diekspor CSV`);
  };

  const syncDokuStatus = async (order) => {
    if (!order?.orderNumber) return;

    setSyncingOrder(order.orderNumber);
    try {
      const result = await refreshDokuPaymentStatus(order.orderNumber);
      await reload();
      const statusLabel = paymentStatusLabels[result.paymentStatus] || result.paymentStatus || 'checked';
      if (result.syncApplied) {
        toast.success(`${order.orderNumber} DOKU tersinkron: ${statusLabel}`);
      } else {
        toast.warning(result.syncWarning || `${order.orderNumber} DOKU checked, but order was not updated`);
      }
    } catch (error) {
      toast.error(error.message || 'Gagal sinkron status DOKU');
    } finally {
      setSyncingOrder('');
    }
  };

  const exportShippingLabel = async (order) => {
    if (!canExportShippingLabel(order)) {
      toast.error('Resi PDF tersedia setelah payment paid');
      return;
    }
    const { exportShippingLabelPdf } = await import('@/utils/shippingLabelPdf.js');
    exportShippingLabelPdf(order);
    toast.success(`${order.orderNumber} resi PDF prepared`);
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Orders - Solivagant</title>
        <meta name="description" content="Manage storefront orders for Solivagant." />
      </Helmet>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <PackageCheck className="h-4 w-4 text-primary" />
              Order toko
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Antrean order</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Pesanan dari cart dan request bespoke masuk ke sini agar bisa dicek, dikonfirmasi, disiapkan, lalu ditandai selesai.
            </p>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Total order</span><strong>{summary.total}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Aktif</span><strong>{summary.active}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Estimasi revenue</span><strong>{formatTotal(summary.revenue)}</strong></div>
          </div>
        </div>

        <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Orders</h2>
            <span className="text-sm font-bold text-amber-700">{summary.completed} selesai</span>
          </div>
          <div className="mt-4 grid gap-3 rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] p-4 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari order, customer, kode, kontak, payment ref, kurir, atau resi"
                className="h-11 w-full rounded-2xl border bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-amber-300"
              />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {Object.entries(orderFilterLabels).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  className={`h-11 rounded-2xl text-xs font-bold ${orderFilter === value ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-white'}`}
                  onClick={() => setOrderFilter(value)}
                >
                  {label} <span className="ml-1 opacity-70">{filterCounts[value]}</span>
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 rounded-2xl border border-[#263d27]/10 bg-[#eef2e8] p-4 lg:grid-cols-[auto_1fr] lg:items-center">
            <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-bold">
              <Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => toggleVisibleSelection(Boolean(checked))} />
              Pilih tampilan
            </label>
            <div className="grid gap-2 sm:grid-cols-4">
              <Button type="button" className="h-11 rounded-2xl gap-2" onClick={bulkMarkPaid} disabled={bulkSaving || !selectedVisibleOrders.length}>
                {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Mark paid
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={bulkPrintResi} disabled={!selectedPrintableOrders.length}>
                <Download className="h-4 w-4" />
                Print resi
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={bulkWhatsAppFollowUp} disabled={!selectedVisibleOrders.length}>
                <MessageCircle className="h-4 w-4" />
                WA follow-up
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={bulkExportCsv} disabled={!selectedVisibleOrders.length}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
            <p className="text-xs font-bold text-muted-foreground lg:col-span-2">
              {selectedVisibleOrders.length} order dipilih, {selectedPrintableOrders.length} siap print resi.
            </p>
          </div>
          <div className="mt-5 grid gap-4">
            {visibleOrders.map((order) => {
              const bespoke = isBespokeOrder(order);
              const bespokeItem = getBespokeItem(order);
              const reservationExpiresAt = getOrderReservationExpiresAt(order);
              const voucherSnapshot = getOrderVoucherSnapshot(order);
              const discountedItemLines = getDiscountedVoucherCartLines(getOrderProductItems(order), voucherSnapshot || {});

              return (
              <article key={order.id} className="rounded-2xl border bg-[#fbfaf7] p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">{order.orderNumber}</h3>
                      <Checkbox checked={selectedOrderSet.has(order.id || order.orderNumber)} onCheckedChange={(checked) => toggleOrderSelection(order, Boolean(checked))} />
                      {bespoke ? <StatusChip className="border-[#263d27]/20 bg-[#eef2e8] text-[#263d27]">Bespoke</StatusChip> : null}
                      {bespoke ? <StatusChip className="border-[#263d27]/10 bg-[#f7f8f2] text-[#263d27]">{bespokeProductionStatusLabels[order.bespokeProductionStatus || 'review_brief']}</StatusChip> : null}
                      <StatusChip tone={getOrderStatusTone(order.status)}>{statusLabels[order.status] || order.status}</StatusChip>
                      <StatusChip icon={CreditCard} tone={getPaymentStatusTone(order.paymentStatus)}>{paymentStatusLabels[order.paymentStatus] || order.paymentStatus}</StatusChip>
                      <StatusChip icon={Truck} tone={getShipmentStatusTone(order.shipmentStatus)}>{shipmentStatusLabels[order.shipmentStatus] || order.shipmentStatus}</StatusChip>
                      {order.paymentProofStatus && order.paymentProofStatus !== 'missing' ? (
                        <StatusChip icon={FileCheck2} tone={paymentProofToneByStatus[order.paymentProofStatus] || 'warning'}>
                          {paymentProofStatusLabels[order.paymentProofStatus] || order.paymentProofStatus}
                        </StatusChip>
                      ) : null}
                      {order.persistence === 'local' ? <StatusChip>Local draft</StatusChip> : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">{formatDate(order.createdAt)} / {order.customerName} / {order.contact}{order.customerCode ? ` / ${order.customerCode}` : ''}</p>
                    <div className="mt-3 grid gap-2">
                      {discountedItemLines.map((line) => {
                        const item = line.item;
                        const hasDiscount = line.discount > 0;
                        return (
                        <div key={`${order.id}-${item.slug}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold">
                          <span className="min-w-0">
                            <span className="block truncate">{item.name} x{item.quantity}</span>
                            {hasDiscount ? <span className="mt-0.5 block text-[11px] font-bold text-[#263d27]">Diskon voucher -{formatTotal(line.discount)}</span> : null}
                          </span>
                          <span className="shrink-0 text-right text-amber-700">
                            {hasDiscount ? (
                              <>
                                <span className="block text-[11px] text-[#9ca3af] line-through">{formatTotal(line.originalTotal)}</span>
                                <span className="block">{formatTotal(line.discountedTotal)}</span>
                              </>
                            ) : item.price || formatTotal(line.originalTotal)}
                          </span>
                        </div>
                        );
                      })}
                      <OrderVoucherSummary order={order} />
                    </div>
                    {bespoke ? (
                      <div className="mt-3 grid gap-2 rounded-2xl border border-[#263d27]/10 bg-white p-3 sm:grid-cols-2">
                        {bespokeDetailRows(bespokeItem).map(([label, value]) => (
                          <p key={label} className="text-xs font-semibold text-muted-foreground">
                            <span className="block text-[10px] font-bold uppercase text-[#263d27]">{label}</span>
                            {value}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {order.notes ? <p className="mt-3 text-sm font-semibold text-muted-foreground">Notes: {order.notes}</p> : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[#263d27]">
                        {order.paymentProvider || 'manual'} / {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
                      </span>
                      {order.paymentReference ? <span className="rounded-full bg-white px-3 py-1 text-muted-foreground">Ref {order.paymentReference}</span> : null}
                      {order.paymentUrl && ['unpaid', 'pending'].includes(order.paymentStatus) ? (
                        <>
                          <a href={`/payment?order=${encodeURIComponent(order.orderNumber)}&payment=doku`} className="inline-flex items-center gap-1 rounded-full bg-[#263d27] px-3 py-1 text-[#eef2e8]">
                            <CreditCard className="h-3.5 w-3.5" />
                            Lanjut bayar
                          </a>
                          <a href={order.paymentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[#263d27]">
                            <ExternalLink className="h-3.5 w-3.5" />
                            DOKU URL
                          </a>
                        </>
                      ) : null}
                      {order.paymentResponse && Object.keys(order.paymentResponse).length ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-muted-foreground">
                          <ReceiptText className="h-3.5 w-3.5" />
                          Respons checkout tersimpan
                        </span>
                      ) : null}
                      {order.paymentProofStatus === 'submitted' ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/studio/orders/${order.id || order.orderNumber}`)}
                          className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-sky-700"
                        >
                          <FileCheck2 className="h-3.5 w-3.5" />
                          Bukti perlu dicek
                        </button>
                      ) : null}
                      {order.paymentProofStatus === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                          <FileCheck2 className="h-3.5 w-3.5" />
                          Bukti ditolak
                        </span>
                      ) : null}
                      {order.inventoryDeducted ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                          Stok reserved{reservationExpiresAt ? ` sampai ${formatDate(reservationExpiresAt)}` : ''}
                        </span>
                      ) : ['expired', 'failed', 'refunded'].includes(order.paymentStatus) || order.status === 'cancelled' ? (
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">Stok dilepas</span>
                      ) : null}
                      {order.paymentProvider === 'doku' && ['unpaid', 'pending'].includes(order.paymentStatus) ? (
                        <button
                          type="button"
                          onClick={() => syncDokuStatus(order)}
                          disabled={syncingOrder === order.orderNumber}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[#263d27] disabled:opacity-60"
                        >
                          {syncingOrder === order.orderNumber ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Sync DOKU
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex min-w-56 flex-col gap-3">
                    <div className="rounded-2xl border bg-white p-3 text-right">
                      <div className="text-xs font-bold uppercase text-muted-foreground">{order.quantity} items</div>
                      <div className="text-xl font-bold">{formatTotal(order.subtotal)}</div>
                      {voucherSnapshot ? <div className="mt-1 text-[11px] font-bold text-[#263d27]">Hemat {formatTotal(voucherSnapshot.discountAmount)}</div> : null}
                    </div>
                    <div className="rounded-2xl border bg-white p-3">
                      <div className="text-xs font-bold uppercase text-muted-foreground">Admin pembayaran</div>
                      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                        <select value={order.paymentStatus} onChange={(event) => updatePaymentAndNotify(order, event.target.value)} className="h-10 rounded-2xl border bg-[#fbfaf7] px-3 text-xs font-bold outline-none focus:border-amber-300">
                          {Object.entries(paymentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        {order.paymentStatus !== 'paid' ? (
                          <Button type="button" size="sm" className="h-10 rounded-2xl px-3 text-xs" onClick={() => updatePaymentAndNotify(order, 'paid')}>
                            Tandai paid
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <select value={order.status} onChange={(event) => updateStatusAndNotify(order, event.target.value)} className="h-11 rounded-2xl border bg-white px-3 text-sm font-bold outline-none focus:border-amber-300">
                      {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={() => navigate(`/studio/orders/${order.id || order.orderNumber}`)}><Eye className="h-4 w-4" />Detail</Button>
                      <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={() => copyOrder(order)}><Clipboard className="h-4 w-4" />Salin</Button>
                      <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={() => exportShippingLabel(order)} disabled={!canExportShippingLabel(order)}><Download className="h-4 w-4" />Resi PDF</Button>
                      <Button type="button" variant="outline" className="rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => deleteOne(order.id || order.orderNumber)}><Trash2 className="h-4 w-4" />Hapus</Button>
                    </div>
                  </div>
                </div>
              </article>
              );
            })}
            {!visibleOrders.length && !loading ? (
              <StateBlock title="Order tidak ditemukan" description="Ubah pencarian atau filter untuk melihat order lain." icon={PackageCheck} />
            ) : null}
            {loading && !orders.length ? (
              <StateBlock title="Memuat order" description="Mengambil order terbaru dari storefront." tone="loading" />
            ) : null}
          </div>
        </section>
      </div>
    </AuthenticatedLayout>
  );
};

export default OrdersPage;

