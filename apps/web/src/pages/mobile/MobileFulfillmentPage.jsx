import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Clipboard, Copy, CreditCard, Download, ExternalLink, Loader2, MessageCircle, PackageCheck, PackageOpen, ScanLine, Search, Send, Truck } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileFilterChips from '@/components/mobile-ui/MobileFilterChips.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import StatusChip, { getPaymentStatusTone, getShipmentStatusTone } from '@/components/ui/status-chip.jsx';
import { useOrders } from '@/hooks/useOrders.js';
import {
  getBespokeProductionStatusLabels,
  getShipmentStatusLabels,
  isBespokeOrder,
  updateOrderShipment,
} from '@/services/orderService.js';
import { buildNotificationMessage, getWhatsAppNotificationUrl } from '@/services/notificationTemplateService.js';
import { buildPublicTrackingUrl } from '@/services/publicTrackingService.js';
import { getMobileFromState } from '@/hooks/useMobileBackNavigation.js';
import { getOrderProductItems, getOrderVoucherSnapshot } from '@/utils/orderTotals.js';
import { exportOrdersCsv } from '@/utils/orderBulkActions.js';
import {
  hasShippingLabelPrinted,
  isArchivedOrder,
  isShippedOrder,
} from '@/utils/orderWorkflow.js';

const canExportShippingLabel = (order) => Boolean(
  order
    && order.paymentStatus === 'paid'
    && !['cancelled'].includes(order.status)
);

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-');

const shipmentStatusLabels = getShipmentStatusLabels();
const bespokeProductionStatusLabels = getBespokeProductionStatusLabels();

const isPaid = (order) => order.paymentStatus === 'paid';
const isOpenShipment = (order) => !['shipped', 'delivered'].includes(order.shipmentStatus) && !['shipped', 'completed', 'cancelled'].includes(order.status);
const isBespokeReady = (order) => !isBespokeOrder(order) || order.bespokeProductionStatus === 'ready';
const isFulfillmentReady = (order) => isPaid(order) && isOpenShipment(order) && isBespokeReady(order);
const isNeedsResi = (order) => isFulfillmentReady(order) && !order.trackingNumber;

const queueFilterOptions = [
  { value: 'paid', label: 'Paid' },
  { value: 'packing', label: 'Label/resi' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'need_resi', label: 'Butuh resi' },
  { value: 'blocked', label: 'Tertahan' },
];

const createDrafts = (orders) => Object.fromEntries(orders.map((order) => [
  order.id || order.orderNumber,
  {
    shipmentStatus: order.shipmentStatus || 'not_ready',
    courierName: order.courierName || '',
    trackingNumber: order.trackingNumber || '',
    trackingUrl: order.trackingUrl || '',
    packingNotes: order.packingNotes || '',
  },
]));

const FulfillmentMetric = ({ label, value, tone = 'amber' }) => {
  const tones = {
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    rose: 'bg-rose-50 text-rose-800 border-rose-100',
    stone: 'bg-stone-50 text-stone-700 border-stone-100',
  };

  return (
    <div className={`rounded-2xl border px-3 py-2 ${tones[tone] || tones.amber}`}>
      <div className="text-xl font-bold leading-none">{value}</div>
      <div className="mt-1 truncate text-[10px] font-bold uppercase">{label}</div>
    </div>
  );
};

const MobileFulfillmentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orders, loading, reload, updatePaymentStatus } = useOrders();
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState('');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [queueFilter, setQueueFilter] = useState('paid');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setDrafts(createDrafts(orders));
  }, [orders]);

  const paidOrders = useMemo(() => orders.filter(isPaid), [orders]);
  const readyOrders = useMemo(() => paidOrders.filter(isFulfillmentReady), [paidOrders]);
  const packingOrders = useMemo(() => readyOrders.filter((order) => order.shipmentStatus === 'packing'), [readyOrders]);
  const shippedOrders = useMemo(() => orders.filter((order) => order.shipmentStatus === 'shipped' && !['completed', 'cancelled'].includes(order.status)), [orders]);
  const followUpOrders = useMemo(() => orders.filter((order) => (
    ['unpaid', 'pending'].includes(order.paymentStatus)
    || (order.shipmentStatus === 'shipped' && !['completed', 'cancelled'].includes(order.status))
  )), [orders]);
  const blockedPaidOrders = useMemo(() => paidOrders.filter((order) => isOpenShipment(order) && !isBespokeReady(order)), [paidOrders]);
  const displayedOrders = useMemo(() => {
    if (queueFilter === 'packing') return readyOrders.filter((order) => order.shipmentStatus === 'packing');
    if (queueFilter === 'shipped') return shippedOrders;
    if (queueFilter === 'follow_up') return followUpOrders;
    if (queueFilter === 'need_resi') return readyOrders.filter(isNeedsResi);
    if (queueFilter === 'blocked') return blockedPaidOrders;
    return paidOrders.filter((order) => !['completed', 'cancelled'].includes(order.status));
  }, [blockedPaidOrders, followUpOrders, paidOrders, queueFilter, readyOrders, shippedOrders]);
  const searchedOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return displayedOrders;
    return displayedOrders.filter((order) => [
      order.orderNumber,
      order.customerName,
      order.customerCode,
      order.contact,
      order.trackingNumber,
      order.courierName,
      ...getOrderProductItems(order).map((item) => item.name),
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [displayedOrders, searchTerm]);
  const shippedToday = useMemo(() => {
    const today = new Date().toDateString();
    return orders.filter((order) => order.shipmentStatus === 'shipped' && order.shippedAt && new Date(order.shippedAt).toDateString() === today);
  }, [orders]);
  const selectedOrderSet = useMemo(() => new Set(selectedOrders), [selectedOrders]);
  const selectedSearchedOrders = useMemo(() => searchedOrders.filter((order) => selectedOrderSet.has(order.id || order.orderNumber)), [searchedOrders, selectedOrderSet]);
  const selectedPrintableOrders = useMemo(() => selectedSearchedOrders.filter(canExportShippingLabel), [selectedSearchedOrders]);
  const allSearchedSelected = searchedOrders.length > 0 && searchedOrders.every((order) => selectedOrderSet.has(order.id || order.orderNumber));

  const findScannedOrder = (query) => {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return null;
    return orders.find((order) => [
      order.orderNumber,
      order.customerCode,
      order.trackingNumber,
      order.contact,
    ].some((value) => String(value || '').trim().toLowerCase() === normalizedQuery));
  };

  const submitScannerSearch = (event) => {
    event?.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;
    const directMatch = findScannedOrder(query);
    const singleVisibleMatch = searchedOrders.length === 1 ? searchedOrders[0] : null;
    const targetOrder = directMatch || singleVisibleMatch;
    if (targetOrder) {
      navigate(`/mobile/studio/orders/${targetOrder.id || targetOrder.orderNumber}`, { state: getMobileFromState(location) });
      toast.success(`Buka ${targetOrder.orderNumber}`);
      return;
    }
    toast.info(`${searchedOrders.length} order cocok. Pilih salah satu dari antrean.`);
  };

  const updateDraft = (orderKey, field, value) => {
    setDrafts((current) => ({
      ...current,
      [orderKey]: {
        ...(current[orderKey] || {}),
        [field]: value,
      },
    }));
  };

  const toggleOrderSelection = (order, checked) => {
    const key = order.id || order.orderNumber;
    setSelectedOrders((current) => (
      checked ? Array.from(new Set([...current, key])) : current.filter((value) => value !== key)
    ));
  };

  const toggleSearchedSelection = (checked) => {
    const visibleKeys = searchedOrders.map((order) => order.id || order.orderNumber);
    setSelectedOrders((current) => {
      const visibleSet = new Set(visibleKeys);
      if (!checked) return current.filter((key) => !visibleSet.has(key));
      return Array.from(new Set([...current, ...visibleKeys]));
    });
  };

  const bulkMarkPaid = async () => {
    if (!selectedSearchedOrders.length) {
      toast.error('Pilih order dulu untuk mark paid');
      return;
    }
    setBulkSaving(true);
    try {
      await Promise.all(selectedSearchedOrders.map((order) => updatePaymentStatus(order.id || order.orderNumber, 'paid')));
      toast.success(`${selectedSearchedOrders.length} order ditandai paid`);
    } catch (error) {
      toast.error(error.message || 'Gagal mark paid massal');
    } finally {
      setBulkSaving(false);
    }
  };

  const saveShipment = async (order, shipmentStatus, overrides = {}) => {
    const orderKey = order.id || order.orderNumber;
    const draft = { ...(drafts[orderKey] || {}), ...overrides };
    setSavingId(orderKey);
    try {
      await updateOrderShipment(orderKey, {
        ...draft,
        shipmentStatus,
        shippedAt: shipmentStatus === 'shipped' ? new Date().toISOString() : order.shippedAt,
      });
      await reload();
      toast.success(shipmentStatus === 'shipped' ? 'Order ditandai dikirim' : 'Order ditandai packed');
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan pengiriman');
    } finally {
      setSavingId('');
    }
  };

  const copyPackingList = async (order, draft = {}) => {
    const lines = [
      `Order: ${order.orderNumber}`,
      `Customer: ${order.customerName}`,
      `Contact: ${order.contact}`,
      `Kurir: ${draft.courierName || order.courierName || '-'}`,
      `Resi: ${draft.trackingNumber || order.trackingNumber || '-'}`,
      '',
      'Packing list:',
      ...getOrderProductItems(order).map((item) => `- ${item.name} x${item.quantity}${item.size ? ` / ${item.size}` : ''}`),
      draft.packingNotes || order.packingNotes ? `\nCatatan: ${draft.packingNotes || order.packingNotes}` : '',
    ].filter(Boolean);
    await navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Packing list disalin');
  };

  const openWhatsAppFollowUp = (order, draft = {}) => {
    const notificationOrder = {
      ...order,
      courierName: draft.courierName || order.courierName,
      trackingNumber: draft.trackingNumber || order.trackingNumber,
      trackingUrl: draft.trackingUrl || order.trackingUrl,
      packingNotes: draft.packingNotes || order.packingNotes,
      shipmentStatus: draft.shipmentStatus || order.shipmentStatus,
    };
    const eventKey = notificationOrder.trackingNumber || notificationOrder.shipmentStatus === 'shipped' ? 'shipped' : 'processing';
    const message = buildNotificationMessage(notificationOrder, eventKey);
    window.open(getWhatsAppNotificationUrl(notificationOrder, message), '_blank', 'noopener,noreferrer');
  };

  const copyPublicTrackingLink = async (order) => {
    try {
      await navigator.clipboard.writeText(buildPublicTrackingUrl(order.orderNumber));
      toast.success('Link tracking publik disalin');
    } catch (error) {
      toast.error(error.message || 'Gagal menyalin link tracking');
    }
  };

  const exportResi = async (order) => {
    if (!canExportShippingLabel(order)) {
      toast.error('Resi PDF tersedia setelah payment paid');
      return;
    }
    const { exportShippingLabelPdf } = await import('@/utils/shippingLabelPdf.js');
    await exportShippingLabelPdf(order);
    if (!hasShippingLabelPrinted(order) && !isShippedOrder(order) && !isArchivedOrder(order)) {
      const draft = drafts[order.id || order.orderNumber] || {};
      await updateOrderShipment(order.id || order.orderNumber, {
        ...draft,
        shipmentStatus: 'packing',
        packingNotes: draft.packingNotes || order.packingNotes || 'Resi PDF dicetak dari Mobile Fulfillment.',
      });
      await reload();
      setQueueFilter('packing');
      toast.success('Resi PDF siap. Order masuk Label/resi.');
      return;
    }
    toast.success('Resi PDF siap');
  };

  const bulkPrintResi = async () => {
    const { exportShippingLabelsPdf } = await import('@/utils/shippingLabelPdf.js');
    const printedCount = await exportShippingLabelsPdf(selectedSearchedOrders);
    if (!printedCount) {
      toast.error('Pilih order paid untuk print resi');
      return;
    }
    await Promise.all(selectedPrintableOrders.map((order) => (
      hasShippingLabelPrinted(order) || isShippedOrder(order) || isArchivedOrder(order)
        ? Promise.resolve()
        : updateOrderShipment(order.id || order.orderNumber, {
          ...(drafts[order.id || order.orderNumber] || {}),
          shipmentStatus: 'packing',
          packingNotes: drafts[order.id || order.orderNumber]?.packingNotes || order.packingNotes || 'Resi PDF dicetak dari Mobile Fulfillment.',
        })
    )));
    await reload();
    setQueueFilter('packing');
    toast.success(`${printedCount} resi PDF siap. Order dipindah ke Label/resi.`);
  };

  const bulkWhatsAppFollowUp = async () => {
    if (!selectedSearchedOrders.length) {
      toast.error('Pilih order dulu untuk follow-up WA');
      return;
    }
    const messages = selectedSearchedOrders.map((order) => {
      const draft = drafts[order.id || order.orderNumber] || {};
      const notificationOrder = {
        ...order,
        courierName: draft.courierName || order.courierName,
        trackingNumber: draft.trackingNumber || order.trackingNumber,
        trackingUrl: draft.trackingUrl || order.trackingUrl,
        packingNotes: draft.packingNotes || order.packingNotes,
        shipmentStatus: draft.shipmentStatus || order.shipmentStatus,
      };
      const eventKey = notificationOrder.trackingNumber || notificationOrder.shipmentStatus === 'shipped' ? 'shipped' : 'processing';
      return { order: notificationOrder, message: buildNotificationMessage(notificationOrder, eventKey) };
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
    if (!selectedSearchedOrders.length) {
      toast.error('Pilih order dulu untuk export CSV');
      return;
    }
    exportOrdersCsv(selectedSearchedOrders, 'mobile_fulfillment_selected.csv');
    toast.success(`${selectedSearchedOrders.length} order diekspor CSV`);
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>Fulfillment - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Fulfillment"
          subtitle={`${readyOrders.length} paid siap kirim`}
          eyebrow="Studio mobile"
          action={<PackageOpen className="h-5 w-5 text-amber-700" />}
        />

        <section className="mobile-studio-hero p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase text-amber-700">Dashboard label/resi</div>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-[#142116]">
                {loading ? 'Sinkron order' : readyOrders.length ? 'Siap label/resi' : 'Antrean kosong'}
              </h1>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#68736a]">
                Paid storefront order masuk sini setelah siap dikirim. Bespoke muncul setelah production status Ready.
              </p>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-amber-700 shadow-sm">
              <Truck className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <FulfillmentMetric label="Siap" value={loading ? '-' : readyOrders.length} tone="emerald" />
            <FulfillmentMetric label="Label/resi" value={loading ? '-' : packingOrders.length} tone="amber" />
            <FulfillmentMetric label="Paid tertahan" value={loading ? '-' : blockedPaidOrders.length} tone={blockedPaidOrders.length ? 'rose' : 'stone'} />
            <FulfillmentMetric label="Dikirim hari ini" value={loading ? '-' : shippedToday.length} tone="stone" />
          </div>
          <MobileFilterChips
            value={queueFilter}
            onChange={setQueueFilter}
            options={queueFilterOptions}
            className="mt-3 flex-nowrap overflow-x-auto pb-0"
          />
          <form className="relative mt-3 block" onSubmit={submitScannerSearch}>
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
            {searchedOrders.length} order tampil. Scan barcode/resi atau ketik nama customer untuk lompat cepat.
          </p>
          <div className="mt-3 rounded-2xl border border-[#1b1a16]/10 bg-white/78 p-3">
            <label className="flex items-center gap-2 text-xs font-bold text-[#1b1a16]">
              <Checkbox checked={allSearchedSelected} onCheckedChange={(checked) => toggleSearchedSelection(Boolean(checked))} />
              Pilih semua yang tampil
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" className="h-11 rounded-2xl gap-1 text-xs" onClick={bulkMarkPaid} disabled={bulkSaving || !selectedSearchedOrders.length}>
                {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Mark paid
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-1 text-xs" onClick={bulkPrintResi} disabled={!selectedPrintableOrders.length}>
                <Download className="h-4 w-4" />
                Resi PDF
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-1 text-xs" onClick={bulkWhatsAppFollowUp} disabled={!selectedSearchedOrders.length}>
                <MessageCircle className="h-4 w-4" />
                WA follow-up
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-1 text-xs" onClick={bulkExportCsv} disabled={!selectedSearchedOrders.length}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase text-[#6b7280]">{selectedSearchedOrders.length} dipilih / {selectedPrintableOrders.length} siap print</p>
          </div>
        </section>

        {blockedPaidOrders.length ? (
          <section className="mobile-card border border-amber-100 bg-amber-50/70 p-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-amber-700">
                <PackageCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-amber-800">Paid tapi belum siap</div>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-900">
                  {blockedPaidOrders.length} bespoke order masih menunggu workflow produksi sebelum masuk packing.
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {blockedPaidOrders.slice(0, 3).map((order) => (
                <button
                  key={order.id || order.orderNumber}
                  type="button"
                  onClick={() => navigate(`/mobile/studio/orders/${order.id || order.orderNumber}`, { state: getMobileFromState(location) })}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-left"
                >
                  <span className="min-w-0 truncate text-xs font-bold text-[#1f2937]">{order.orderNumber}</span>
                  <span className="shrink-0 text-[10px] font-bold uppercase text-amber-800">
                    {bespokeProductionStatusLabels[order.bespokeProductionStatus || 'review_brief']}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#1b1a16]">Antrean siap</h2>
            <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => navigate('/mobile/studio/orders')}>Semua order</Button>
          </div>

          {searchedOrders.map((order) => {
            const orderKey = order.id || order.orderNumber;
            const draft = drafts[orderKey] || {};
            const saving = savingId === orderKey;
            const blocked = !isFulfillmentReady(order);

            return (
              <article key={orderKey} className="mobile-card mobile-list-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-2">
                    <Checkbox checked={selectedOrderSet.has(orderKey)} onCheckedChange={(checked) => toggleOrderSelection(order, Boolean(checked))} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[#1b1a16]">{order.orderNumber}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">{order.customerName} / {order.contact}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase text-[#9ca3af]">{formatDate(order.createdAt)}</p>
                    </div>
                  </div>
                  <StatusChip size="xs" tone={blocked ? 'warning' : getShipmentStatusTone(order.shipmentStatus)}>
                    {blocked ? bespokeProductionStatusLabels[order.bespokeProductionStatus || 'review_brief'] : shipmentStatusLabels[order.shipmentStatus] || 'Ready'}
                  </StatusChip>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <StatusChip size="xs" tone={getPaymentStatusTone(order.paymentStatus)}>Sudah dibayar</StatusChip>
                  <StatusChip size="xs" tone={draft.trackingNumber || order.trackingNumber ? 'success' : 'warning'}>
                    {draft.trackingNumber || order.trackingNumber ? 'Resi siap' : 'Butuh resi'}
                  </StatusChip>
                  {isBespokeOrder(order) ? <StatusChip size="xs" tone="primary">Bespoke</StatusChip> : null}
                </div>

                <div className="mt-3 grid gap-2">
                  {getOrderProductItems(order).map((item) => (
                    <div key={`${orderKey}-${item.slug || item.name}`} className="flex items-center justify-between gap-2 rounded-2xl bg-[#f8f7f4] px-3 py-2">
                      <span className="min-w-0 truncate text-xs font-bold text-[#1f2937]">{item.name} x{item.quantity}</span>
                      <span className="shrink-0 text-[10px] font-bold text-amber-700">{item.size || item.price}</span>
                    </div>
                  ))}
                  {getOrderVoucherSnapshot(order) ? (
                    <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#f7f1e5] px-3 py-2">
                      <span className="min-w-0 truncate text-xs font-bold text-[#1b1a16]">Voucher {getOrderVoucherSnapshot(order).code}</span>
                      <span className="shrink-0 text-[10px] font-bold text-[#1b1a16]">-{formatTotal(getOrderVoucherSnapshot(order).discountAmount)}</span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2">
                  <input
                    value={draft.trackingNumber || ''}
                    onChange={(event) => updateDraft(orderKey, 'trackingNumber', event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      const nextTrackingNumber = String(event.currentTarget.value || '').trim();
                      if (!nextTrackingNumber) return;
                      updateDraft(orderKey, 'trackingNumber', nextTrackingNumber);
                      saveShipment(order, draft.shipmentStatus === 'shipped' ? 'shipped' : 'packing', { trackingNumber: nextTrackingNumber });
                    }}
                    placeholder="Scan / paste resi kurir"
                    className="h-14 min-w-0 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-base font-bold tracking-[0.04em] text-[#1f2937] outline-none focus:border-amber-400"
                    disabled={blocked}
                    autoCapitalize="characters"
                    enterKeyHint="done"
                  />
                  <div className="grid grid-cols-2 gap-2">
                  <input
                    value={draft.courierName || ''}
                    onChange={(event) => updateDraft(orderKey, 'courierName', event.target.value)}
                    placeholder="Kurir"
                    className="h-11 min-w-0 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300"
                    disabled={blocked}
                  />
                  <input
                    value={draft.trackingUrl || ''}
                    onChange={(event) => updateDraft(orderKey, 'trackingUrl', event.target.value)}
                    placeholder="URL tracking kurir"
                    className="h-11 min-w-0 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300"
                    disabled={blocked}
                  />
                  </div>
                </div>
                <textarea
                  value={draft.packingNotes || ''}
                  onChange={(event) => updateDraft(orderKey, 'packingNotes', event.target.value)}
                  rows={2}
                  placeholder="Catatan packing"
                  className="mt-2 w-full rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300"
                  disabled={blocked}
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#6b7280]">{order.quantity} items</div>
                    <div className="text-base font-bold text-[#1f2937]">{formatTotal(order.subtotal)}</div>
                    {getOrderVoucherSnapshot(order) ? <div className="text-[11px] font-bold text-[#1b1a16]">Hemat {formatTotal(getOrderVoucherSnapshot(order).discountAmount)}</div> : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="mobile-interactive mobile-pressable h-9 px-2 text-xs"
                    onClick={() => navigate(`/mobile/studio/orders/${orderKey}`, { state: getMobileFromState(location) })}
                  >
                    Detail
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="mobile-interactive mobile-pressable col-span-2 h-16 rounded-2xl gap-2 text-base font-bold shadow-lg shadow-amber-100"
                    onClick={() => saveShipment(order, 'shipped')}
                    disabled={saving || blocked}
                  >
                    <Send className="h-5 w-5" />
                    Tandai dikirim
                  </Button>
                  <Button
                    type="button"
                    className="mobile-interactive mobile-pressable h-14 rounded-2xl gap-1 text-xs font-bold"
                    onClick={() => saveShipment(order, 'packing')}
                    disabled={saving || blocked}
                  >
                    <PackageOpen className="h-4 w-4" />
                    Label/resi
                  </Button>
                  <Button type="button" variant="outline" className="mobile-interactive mobile-pressable h-14 rounded-2xl bg-white gap-1 text-xs font-bold" onClick={() => openWhatsAppFollowUp(order, draft)}>
                    <MessageCircle className="h-4 w-4" />
                    WA customer
                  </Button>
                  <Button type="button" variant="outline" className="mobile-interactive mobile-pressable h-12 rounded-2xl bg-white gap-1 text-xs font-bold" onClick={() => copyPublicTrackingLink(order)}>
                    <Copy className="h-4 w-4" />
                    Salin tracking
                  </Button>
                  <Button type="button" variant="outline" className="mobile-interactive mobile-pressable h-12 rounded-2xl bg-white gap-1 text-xs font-bold" onClick={() => window.open(buildPublicTrackingUrl(order.orderNumber), '_blank', 'noopener,noreferrer')}>
                    <ExternalLink className="h-4 w-4" />
                    Buka tracking
                  </Button>
                  <Button type="button" variant="outline" className="mobile-interactive mobile-pressable h-12 rounded-2xl bg-white gap-1 text-xs font-bold" onClick={() => copyPackingList(order, draft)}>
                    <Clipboard className="h-4 w-4" />
                    Salin list
                  </Button>
                  <Button type="button" variant="outline" className="mobile-interactive mobile-pressable h-12 rounded-2xl bg-white gap-1 text-xs font-bold" onClick={() => exportResi(order)} disabled={!canExportShippingLabel(order)}>
                    <Download className="h-4 w-4" />
                    Resi
                  </Button>
                </div>
              </article>
            );
          })}

          {!searchedOrders.length && !loading ? (
            <MobileStatePanel
              icon={PackageOpen}
              title="Tidak ada order di tampilan ini"
              description="Ganti chip filter atau bersihkan pencarian untuk melihat antrean packing lain."
            />
          ) : null}
          {loading && !searchedOrders.length ? (
            <MobileStatePanel
              tone="loading"
              title="Memuat antrean fulfillment"
              description="Sebentar, order paid sedang disiapkan."
            />
          ) : null}
        </section>
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileFulfillmentPage;
