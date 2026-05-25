import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Clipboard, CreditCard, Download, ExternalLink, Eye, FileCheck2, Loader2, MessageCircle, PackageCheck, ScanLine, Search, Sparkles, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileFilterChips from '@/components/mobile-ui/MobileFilterChips.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import StatusChip, { getOrderStatusTone, getPaymentStatusTone } from '@/components/ui/status-chip.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useOrders } from '@/hooks/useOrders.js';
import { getProductLowStock } from '@/services/productCatalogService.js';
import {
  getBespokeItem,
  getBespokeProductionStatusLabels,
  getOrderStatusLabels,
  isBespokeOrder,
  updateOrderShipment,
} from '@/services/orderService.js';
import { buildNotificationMessage, getWhatsAppNotificationUrl } from '@/services/notificationTemplateService.js';
import { buildPublicTrackingUrl } from '@/services/publicTrackingService.js';
import { getMobileFromState } from '@/hooks/useMobileBackNavigation.js';
import { getOrderProductItems, getOrderVoucherSnapshot } from '@/utils/orderTotals.js';
import { getDiscountedVoucherCartLines } from '@/utils/cartVoucherPricing.js';
import { exportOrdersCsv } from '@/utils/orderBulkActions.js';
import {
  getBespokeOrderSummary,
  hasShippingLabelPrinted,
  isArchivedOrder,
  isFrontQueueOrder,
  isShippedOrder,
} from '@/utils/orderWorkflow.js';
import { MOBILE_PAGE_SIZE } from '@/pages/mobile/mobilePageUtils.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
const formatDate = (value) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const statusLabels = getOrderStatusLabels();
const bespokeProductionStatusLabels = getBespokeProductionStatusLabels();
const paymentStatusLabels = {
  unpaid: 'Belum dibayar',
  pending: 'Menunggu bayar',
  paid: 'Sudah dibayar',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
  refunded: 'Refund',
};

const bespokeDetailRows = (item) => [
  ['Aroma', item?.preferredNotes || item?.notes],
  ['Momen', item?.occasion],
  ['Ukuran', item?.size],
  ['Botol', item?.bottleType],
  ['Cap', item?.capDesign],
  ['Label', item?.labelDesign],
  ['Material', item?.exoticMaterial],
  ['Budget', item?.budget],
  ['Reference', item?.referenceProductName],
  ['Story', item?.story],
].filter(([, value]) => value);

const nextActionByStatus = {
  pending_payment: 'Tunggu pembayaran DOKU/manual sebelum produksi.',
  paid: 'Siap diproses: review brief, siapkan formula, lalu ubah ke Processing.',
  processing: 'Sedang dikerjakan. Update ke Shipped setelah resi/packing siap.',
  shipped: 'Dalam pengiriman. Ubah ke Completed saat selesai.',
  completed: 'Order selesai.',
  cancelled: 'Order dibatalkan.',
};

const getPaymentSummary = (orders) => ({
  pending: orders.filter((order) => ['unpaid', 'pending'].includes(order.paymentStatus)).length,
  paid: orders.filter((order) => order.paymentStatus === 'paid').length,
  attention: orders.filter((order) => ['failed', 'expired'].includes(order.paymentStatus)).length,
});

const orderFilterOptions = [
  { value: 'active', label: 'Aktif' },
  { value: 'proof_review', label: 'Bukti' },
  { value: 'paid', label: 'Sudah bayar' },
  { value: 'packing', label: 'Label/resi' },
  { value: 'shipped', label: 'Dikirim' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'bespoke', label: 'Bespoke' },
  { value: 'archive', label: 'Arsip' },
];

const paymentProofStatusLabels = {
  missing: 'Belum ada bukti',
  submitted: 'Bukti perlu dicek',
  approved: 'Bukti disetujui',
  rejected: 'Bukti ditolak',
};

const paymentProofToneByStatus = {
  missing: 'warning',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
};

const canExportShippingLabel = (order) => Boolean(
  order
    && order.paymentStatus === 'paid'
    && !['cancelled'].includes(order.status)
);

const getQuickAction = (order) => {
  if (order.paymentProofStatus === 'submitted') return 'Cek bukti transfer';
  if (order.paymentProofStatus === 'rejected') return 'Menunggu upload ulang bukti';
  if (['unpaid', 'pending'].includes(order.paymentStatus)) return 'Follow-up pembayaran';
  if (hasShippingLabelPrinted(order)) return 'Resi sudah dicetak';
  if (order.paymentStatus === 'paid' && isFrontQueueOrder(order)) return 'Siap cetak resi';
  if (isShippedOrder(order)) return 'Follow-up pengiriman';
  return 'Review';
};

const MobileOrdersPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orders, summary, loading, reload, updateStatus, updatePaymentStatus, deleteOne } = useOrders();
  const [orderFilter, setOrderFilter] = useState(() => {
    const filter = new URLSearchParams(location.search).get('filter');
    return orderFilterOptions.some((option) => option.value === filter) ? filter : 'active';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const products = useCatalogProducts({ editableOnly: true });
  const paymentSummary = getPaymentSummary(orders);
  const lowStockProducts = products.filter(getProductLowStock);
  const lowStockPreview = lowStockProducts.slice(0, 8);
  const filteredOrders = useMemo(() => orders.filter((order) => {
    if (orderFilter === 'proof_review') return order.paymentProofStatus === 'submitted' && isFrontQueueOrder(order);
    if (orderFilter === 'paid') return order.paymentStatus === 'paid' && isFrontQueueOrder(order);
    if (orderFilter === 'packing') return hasShippingLabelPrinted(order);
    if (orderFilter === 'shipped') return isShippedOrder(order) && !isArchivedOrder(order);
    if (orderFilter === 'follow_up') {
      return !isArchivedOrder(order) && (['unpaid', 'pending'].includes(order.paymentStatus) || isShippedOrder(order));
    }
    if (orderFilter === 'bespoke') return isBespokeOrder(order) && isFrontQueueOrder(order);
    if (orderFilter === 'archive') return isArchivedOrder(order);
    return isFrontQueueOrder(order);
  }).filter((order) => {
    const query = deferredSearchTerm.trim().toLowerCase();
    if (!query) return true;
    return [
      order.orderNumber,
      order.customerName,
      order.customerCode,
      order.contact,
      order.trackingNumber,
      order.courierName,
      ...getOrderProductItems(order).map((item) => item.name),
    ].some((value) => String(value || '').toLowerCase().includes(query));
  }), [deferredSearchTerm, orderFilter, orders]);
  const visibleOrders = filteredOrders.slice(0, visibleCount);
  const selectedOrderSet = useMemo(() => new Set(selectedOrders), [selectedOrders]);
  const selectedFilteredOrders = useMemo(() => filteredOrders.filter((order) => selectedOrderSet.has(order.id || order.orderNumber)), [filteredOrders, selectedOrderSet]);
  const selectedPrintableOrders = useMemo(() => selectedFilteredOrders.filter(canExportShippingLabel), [selectedFilteredOrders]);
  const allFilteredSelected = filteredOrders.length > 0 && filteredOrders.every((order) => selectedOrderSet.has(order.id || order.orderNumber));

  useEffect(() => {
    setVisibleCount(MOBILE_PAGE_SIZE);
  }, [deferredSearchTerm, orderFilter]);

  const submitScannerSearch = (event) => {
    event.preventDefault();
    const query = searchTerm.trim().toLowerCase();
    if (!query) return;
    const directMatch = orders.find((order) => [
      order.orderNumber,
      order.customerCode,
      order.trackingNumber,
      order.contact,
    ].some((value) => String(value || '').trim().toLowerCase() === query));
    const targetOrder = directMatch || (filteredOrders.length === 1 ? filteredOrders[0] : null);
    if (targetOrder) {
      navigate(`/mobile/studio/orders/${targetOrder.id || targetOrder.orderNumber}`, { state: getMobileFromState(location) });
      toast.success(`Buka ${targetOrder.orderNumber}`);
      return;
    }
    toast.info(`${filteredOrders.length} order cocok. Pilih dari list.`);
  };

  const copyOrder = async (order) => {
    await navigator.clipboard.writeText(order.checkoutDraft);
    toast.success(`${order.orderNumber} disalin`);
  };

  const copyPublicTrackingLink = async (order) => {
    try {
      await navigator.clipboard.writeText(buildPublicTrackingUrl(order.orderNumber));
      toast.success('Link tracking publik disalin');
    } catch (error) {
      toast.error(error.message || 'Gagal menyalin tracking');
    }
  };

  const toggleOrderSelection = (order, checked) => {
    const key = order.id || order.orderNumber;
    setSelectedOrders((current) => (
      checked ? Array.from(new Set([...current, key])) : current.filter((value) => value !== key)
    ));
  };

  const toggleFilteredSelection = (checked) => {
    const visibleKeys = filteredOrders.map((order) => order.id || order.orderNumber);
    setSelectedOrders((current) => {
      const visibleSet = new Set(visibleKeys);
      if (!checked) return current.filter((key) => !visibleSet.has(key));
      return Array.from(new Set([...current, ...visibleKeys]));
    });
  };

  const bulkMarkPaid = async () => {
    if (!selectedFilteredOrders.length) {
      toast.error('Pilih order dulu untuk mark paid');
      return;
    }
    setBulkSaving(true);
    try {
      await Promise.all(selectedFilteredOrders.map((order) => updatePaymentStatus(order.id || order.orderNumber, 'paid')));
      toast.success(`${selectedFilteredOrders.length} order ditandai paid`);
    } catch (error) {
      toast.error(error.message || 'Gagal mark paid massal');
    } finally {
      setBulkSaving(false);
    }
  };

  const bulkPrintResi = async () => {
    const { exportShippingLabelsPdf } = await import('@/utils/shippingLabelPdf.js');
    const printedCount = await exportShippingLabelsPdf(selectedFilteredOrders);
    if (!printedCount) {
      toast.error('Pilih order paid untuk print resi');
      return;
    }
    await Promise.all(selectedPrintableOrders.map((order) => (
      hasShippingLabelPrinted(order) || isShippedOrder(order) || isArchivedOrder(order)
        ? Promise.resolve()
        : updateOrderShipment(order.id || order.orderNumber, {
          shipmentStatus: 'packing',
          courierName: order.courierName,
          trackingNumber: order.trackingNumber,
          trackingUrl: order.trackingUrl,
          packingNotes: order.packingNotes || 'Resi PDF dicetak dari Mobile Orders.',
        })
    )));
    await reload();
    setOrderFilter('packing');
    toast.success(`${printedCount} resi PDF siap. Order dipindah ke Label/resi.`);
  };

  const exportShippingLabel = async (order) => {
    if (!canExportShippingLabel(order)) {
      toast.error('Resi PDF tersedia setelah payment paid');
      return;
    }
    const { exportShippingLabelPdf } = await import('@/utils/shippingLabelPdf.js');
    await exportShippingLabelPdf(order);
    if (!hasShippingLabelPrinted(order) && !isShippedOrder(order) && !isArchivedOrder(order)) {
      await updateOrderShipment(order.id || order.orderNumber, {
        shipmentStatus: 'packing',
        courierName: order.courierName,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
        packingNotes: order.packingNotes || 'Resi PDF dicetak dari Mobile Orders.',
      });
      await reload();
      setOrderFilter('packing');
    }
    toast.success(`${order.orderNumber} resi PDF siap`);
  };

  const bulkWhatsAppFollowUp = async () => {
    if (!selectedFilteredOrders.length) {
      toast.error('Pilih order dulu untuk follow-up WA');
      return;
    }
    const messages = selectedFilteredOrders.map((order) => {
      const eventKey = order.shipmentStatus === 'shipped'
        ? 'shipped'
        : order.paymentStatus === 'paid'
          ? 'paid'
          : 'order_created';
      return { order, message: buildNotificationMessage(order, eventKey) };
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
    if (!selectedFilteredOrders.length) {
      toast.error('Pilih order dulu untuk export CSV');
      return;
    }
    exportOrdersCsv(selectedFilteredOrders, 'mobile_orders_selected.csv');
    toast.success(`${selectedFilteredOrders.length} order diekspor CSV`);
  };

  const openQuickFollowUp = (order) => {
    const eventKey = order.shipmentStatus === 'shipped'
      ? 'shipped'
      : order.paymentStatus === 'paid'
        ? 'paid'
        : 'order_created';
    const message = buildNotificationMessage(order, eventKey);
    window.open(getWhatsAppNotificationUrl(order, message), '_blank', 'noopener,noreferrer');
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet>
        <title>Order - Solivagant</title>
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Order"
          subtitle={`${summary.active} aktif / ${summary.total} total`}
          eyebrow="Studio admin"
          action={<PackageCheck className="h-5 w-5 text-amber-700" />}
        />

        <section className="mobile-soft-card grid grid-cols-2 gap-3 p-4">
          <div>
            <div className="text-[10px] font-bold uppercase text-amber-700">Estimasi revenue</div>
            <div className="mt-1 text-lg font-bold text-[#1f2937]">{formatTotal(summary.revenue)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-amber-700">Selesai</div>
            <div className="mt-1 text-lg font-bold text-[#1f2937]">{summary.completed}</div>
          </div>
        </section>

        <section className="mobile-card p-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[10px] font-bold uppercase text-[#263d27]">Flow pembayaran DOKU</div>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                Checkout reserve stok sekali untuk mencegah oversell. Jika payment gagal, expired, refunded, atau order dibatalkan, stok dikembalikan otomatis.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-amber-50 px-3 py-2 text-center">
              <div className="text-sm font-bold text-amber-800">{paymentSummary.pending}</div>
              <div className="text-[9px] font-bold uppercase text-amber-700">Menunggu</div>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-center">
              <div className="text-sm font-bold text-emerald-700">{paymentSummary.paid}</div>
              <div className="text-[9px] font-bold uppercase text-emerald-700">Dibayar</div>
            </div>
            <div className="rounded-2xl bg-rose-50 px-3 py-2 text-center">
              <div className="text-sm font-bold text-rose-700">{paymentSummary.attention}</div>
              <div className="text-[9px] font-bold uppercase text-rose-700">Masalah</div>
            </div>
          </div>
          <MobileFilterChips
            value={orderFilter}
            onChange={setOrderFilter}
            options={orderFilterOptions}
            className="mt-3 flex-nowrap overflow-x-auto pb-0"
          />
          <form className="relative mt-3" onSubmit={submitScannerSearch}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b949e]" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Cari / scan order, customer, resi"
              className="h-12 w-full rounded-2xl border border-[#e5e7eb] bg-white pl-10 pr-10 text-sm font-bold outline-none focus:border-amber-300"
              autoCapitalize="characters"
              enterKeyHint="search"
            />
            <ScanLine className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-700" />
          </form>
          <p className="mt-2 text-[11px] font-semibold text-[#6b7280]">
            {filteredOrders.length} order tampil. Scanner hardware bisa kirim Enter untuk langsung buka hasil tunggal.
          </p>
          <div className="mt-3 rounded-2xl border border-[#263d27]/10 bg-[#eef2e8] p-3">
            <label className="flex items-center gap-2 text-xs font-bold text-[#263d27]">
              <Checkbox checked={allFilteredSelected} onCheckedChange={(checked) => toggleFilteredSelection(Boolean(checked))} />
              Pilih semua yang tampil
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" className="h-11 rounded-2xl gap-1 text-xs" onClick={bulkMarkPaid} disabled={bulkSaving || !selectedFilteredOrders.length}>
                {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Mark paid
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-1 text-xs" onClick={bulkPrintResi} disabled={!selectedPrintableOrders.length}>
                <Download className="h-4 w-4" />
                Print resi
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-1 text-xs" onClick={bulkWhatsAppFollowUp} disabled={!selectedFilteredOrders.length}>
                <MessageCircle className="h-4 w-4" />
                WA follow-up
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-1 text-xs" onClick={bulkExportCsv} disabled={!selectedFilteredOrders.length}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase text-[#6b7280]">{selectedFilteredOrders.length} dipilih / {selectedPrintableOrders.length} siap print</p>
          </div>
        </section>

        {lowStockProducts.length ? (
          <section className="mobile-card border border-rose-100 bg-rose-50/70 p-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-rose-700">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-rose-700">Peringatan stok menipis</div>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-rose-800">
                  {lowStockProducts.length} produk mendekati habis setelah checkout mengurangi stok.
                </p>
              </div>
            </div>
            <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
              {lowStockPreview.map((product) => (
                <button
                  key={product.id || product.slug}
                  type="button"
                  onClick={() => navigate('/mobile/studio/products')}
                  className="snap-start whitespace-nowrap rounded-2xl bg-white px-3 py-2 text-left text-[11px] font-bold text-[#1f2937] shadow-sm"
                >
                  {product.name}
                  <span className="ml-2 text-rose-700">{product.stock}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          {visibleOrders.map((order) => {
            const bespoke = isBespokeOrder(order);
            const bespokeItem = getBespokeItem(order);
            const bespokeSummary = getBespokeOrderSummary(order);
            const shippingLabelReady = canExportShippingLabel(order) && !hasShippingLabelPrinted(order) && !isShippedOrder(order) && !isArchivedOrder(order);
            const voucherSnapshot = getOrderVoucherSnapshot(order);
            const discountedItemLines = getDiscountedVoucherCartLines(getOrderProductItems(order), voucherSnapshot || {});

            return (
            <article key={order.id} className="mobile-card mobile-list-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-2">
                  <Checkbox checked={selectedOrderSet.has(order.id || order.orderNumber)} onCheckedChange={(checked) => toggleOrderSelection(order, Boolean(checked))} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-[#1f2937]">{order.orderNumber}</h2>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280]">{formatDate(order.createdAt)}</p>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280]">{order.customerName} / {order.contact}</p>
                  {order.customerCode ? <p className="mt-1 text-[10px] font-bold uppercase text-[#263d27]">{order.customerCode}</p> : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {bespoke ? <StatusChip size="sm" tone="primary">Bespoke</StatusChip> : null}
                  {bespoke ? (
                    <StatusChip size="sm" tone="primary">
                      {bespokeProductionStatusLabels[order.bespokeProductionStatus || 'review_brief']}
                    </StatusChip>
                  ) : null}
                  <StatusChip size="sm" tone={getOrderStatusTone(order.status)}>{statusLabels[order.status] || order.status}</StatusChip>
                  <StatusChip size="sm" tone={getPaymentStatusTone(order.paymentStatus)}>
                    {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
                  </StatusChip>
                  {order.paymentProofStatus && order.paymentProofStatus !== 'missing' ? (
                    <StatusChip size="sm" tone={paymentProofToneByStatus[order.paymentProofStatus] || 'warning'}>
                      {paymentProofStatusLabels[order.paymentProofStatus] || order.paymentProofStatus}
                    </StatusChip>
                  ) : null}
                  {order.inventoryDeducted ? <StatusChip size="sm" tone="success">Stok reserved</StatusChip> : null}
                </div>
              </div>
              {order.persistence === 'local' ? <div className="mt-2 w-fit rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase text-stone-600">Draft lokal</div> : null}
              <div className="mt-3 space-y-2">
                {discountedItemLines.map((line) => {
                  const item = line.item;
                  const hasDiscount = line.discount > 0;
                  return (
                  <div key={`${order.id}-${item.slug}`} className="flex items-center justify-between gap-2 rounded-2xl bg-[#f8f7f4] px-3 py-2 text-xs font-semibold text-[#1f2937]">
                    <span className="min-w-0">
                      <span className="block truncate">{item.name} x{item.quantity}</span>
                      {hasDiscount ? <span className="mt-0.5 block text-[10px] font-bold text-[#263d27]">Diskon -{formatTotal(line.discount)}</span> : null}
                    </span>
                    <span className="shrink-0 text-right text-amber-700">
                      {hasDiscount ? (
                        <>
                          <span className="block text-[10px] text-[#9ca3af] line-through">{formatTotal(line.originalTotal)}</span>
                          <span className="block">{formatTotal(line.discountedTotal)}</span>
                        </>
                      ) : item.price || formatTotal(line.originalTotal)}
                    </span>
                  </div>
                  );
                })}
                {voucherSnapshot ? (
                  <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#eef2e8] px-3 py-2 text-xs font-bold text-[#263d27]">
                    <span className="min-w-0 truncate">Voucher {voucherSnapshot.code}</span>
                    <span className="shrink-0">-{formatTotal(voucherSnapshot.discountAmount)}</span>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 rounded-2xl bg-[#f8f7f4] p-3">
                <div className="text-[10px] font-bold uppercase text-[#6b7280]">Aksi berikutnya</div>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-[#1f2937]">{getQuickAction(order)}. {nextActionByStatus[order.status] || 'Review order dan update status berikutnya.'}</p>
              </div>
              {order.paymentProofStatus === 'submitted' ? (
                <button
                  type="button"
                  onClick={() => navigate(`/mobile/studio/orders/${order.id || order.orderNumber}`, { state: getMobileFromState(location) })}
                  className="mobile-interactive mobile-pressable mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-left text-xs font-bold text-sky-700"
                >
                  <span className="inline-flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4" />
                    Bukti transfer perlu dicek
                  </span>
                  <Eye className="h-4 w-4" />
                </button>
              ) : null}
              <div className="mt-3 rounded-2xl border border-[#e5e7eb] bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-[#6b7280]">Admin pembayaran</div>
                    <p className="mt-1 text-xs font-semibold text-[#1f2937]">{order.paymentProvider || 'manual'}{order.paymentReference ? ` / ${order.paymentReference}` : ''}</p>
                  </div>
                  {order.paymentStatus !== 'paid' ? (
                    <Button type="button" size="sm" className="h-9 shrink-0 rounded-2xl px-3 text-xs" onClick={() => updatePaymentStatus(order.id || order.orderNumber, 'paid')}>
                      Tandai paid
                    </Button>
                  ) : null}
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                  <select
                    value={order.paymentStatus}
                    onChange={(event) => updatePaymentStatus(order.id || order.orderNumber, event.target.value)}
                    className="h-10 rounded-2xl border border-[#e5e7eb] bg-[#f8f7f4] px-3 text-xs font-bold outline-none focus:border-amber-300"
                  >
                    {Object.entries(paymentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <span className="grid h-10 place-items-center rounded-2xl bg-[#f8f7f4] px-3 text-[10px] font-bold uppercase text-[#263d27]">
                    {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
                  </span>
                </div>
              </div>
              {bespoke ? (
                <div className="mt-3 rounded-2xl border border-[#263d27]/10 bg-[#eef2e8] p-3">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Bespoke brief
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-white px-3 py-2">
                      <span className="block text-[10px] font-bold uppercase text-[#6b7280]">Botol</span>
                      <span className="mt-1 block truncate text-xs font-bold text-[#0b130c]">{bespokeSummary?.bottle}</span>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-2">
                      <span className="block text-[10px] font-bold uppercase text-[#6b7280]">Cap</span>
                      <span className="mt-1 block truncate text-xs font-bold text-[#0b130c]">{bespokeItem?.capDesign || '-'}</span>
                    </div>
                  </div>
                  {bespokeSummary?.aroma ? (
                    <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-[#1f2937]">{bespokeSummary.aroma}</p>
                  ) : null}
                  <details className="mt-2">
                    <summary className="cursor-pointer select-none text-xs font-bold text-[#263d27]">Buka detail brief</summary>
                    <div className="mt-3 grid gap-2 border-t border-[#263d27]/10 pt-3">
                      {bespokeDetailRows(bespokeItem).map(([label, value]) => (
                        <div key={label} className="grid grid-cols-[72px_1fr] gap-2 text-xs font-semibold leading-snug">
                          <span className="text-[#6b7280]">{label}</span>
                          <span className="min-w-0 text-[#1f2937]">{value}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#6b7280]">{order.quantity} item</div>
                  <div className="text-base font-bold text-[#1f2937]">{formatTotal(order.subtotal)}</div>
                  {voucherSnapshot ? <div className="text-[11px] font-bold text-[#263d27]">Hemat {formatTotal(voucherSnapshot.discountAmount)}</div> : null}
                </div>
                <select value={order.status} onChange={(event) => updateStatus(order.id || order.orderNumber, event.target.value)} className="h-10 rounded-2xl border border-[#e5e7eb] bg-white px-2 text-xs font-bold outline-none focus:border-amber-300">
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" className="mobile-interactive mobile-pressable h-12 rounded-2xl gap-2 text-xs font-bold" onClick={() => navigate(`/mobile/studio/orders/${order.id || order.orderNumber}`, { state: getMobileFromState(location) })}><Eye className="h-4 w-4" />Detail</Button>
                {shippingLabelReady ? (
                  <Button type="button" variant="outline" className="mobile-interactive mobile-pressable h-12 rounded-2xl gap-2 bg-white text-xs font-bold" onClick={() => exportShippingLabel(order)}><Truck className="h-4 w-4" />Resi PDF</Button>
                ) : (
                  <Button type="button" variant="outline" className="mobile-interactive mobile-pressable h-12 rounded-2xl gap-2 bg-white text-xs font-bold" onClick={() => openQuickFollowUp(order)}><MessageCircle className="h-4 w-4" />WA</Button>
                )}
                <Button type="button" variant="outline" className="mobile-interactive mobile-pressable h-12 rounded-2xl gap-2 bg-white text-xs font-bold" onClick={() => copyOrder(order)}><Clipboard className="h-4 w-4" />Salin</Button>
                <Button type="button" variant="outline" className="mobile-interactive mobile-pressable h-12 rounded-2xl gap-2 bg-white text-xs font-bold" onClick={() => copyPublicTrackingLink(order)}><ExternalLink className="h-4 w-4" />Tracking</Button>
                <Button type="button" variant="outline" className="mobile-interactive mobile-delete-action h-12 rounded-2xl border-rose-200 bg-rose-50 text-xs font-bold text-rose-700" onClick={() => deleteOne(order.id || order.orderNumber)}><Trash2 className="h-4 w-4" />Hapus</Button>
              </div>
            </article>
            );
          })}
          <PaginationOrLoadMore
            visibleCount={visibleOrders.length}
            totalCount={filteredOrders.length}
            loading={loading}
            onLoadMore={() => setVisibleCount((current) => current + MOBILE_PAGE_SIZE)}
          />
          {!filteredOrders.length && !loading ? (
            <MobileStatePanel
              icon={PackageCheck}
              title="Tidak ada order di tampilan ini"
              description="Ganti chip filter untuk melihat order lain."
            />
          ) : null}
          {loading && !filteredOrders.length ? (
            <MobileStatePanel
              tone="loading"
              title="Memuat order"
              description="Sebentar, order terbaru sedang disiapkan."
            />
          ) : null}
        </section>
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileOrdersPage;

