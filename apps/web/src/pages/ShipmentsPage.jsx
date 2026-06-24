import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, CreditCard, Download, ExternalLink, Eye, Loader2, MessageCircle, PackageCheck, Save, Search, Truck } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import StatusChip, { getPaymentStatusTone, getShipmentStatusTone } from '@/components/ui/status-chip.jsx';
import { useOrders } from '@/hooks/useOrders.js';
import { getShipmentStatusLabels, updateOrderShipment } from '@/services/orderService.js';
import { buildNotificationMessage, getWhatsAppNotificationUrl } from '@/services/notificationTemplateService.js';
import { buildPublicTrackingUrl } from '@/services/publicTrackingService.js';
import { exportOrdersCsv } from '@/utils/orderBulkActions.js';
import {
  hasShippingLabelPrinted,
  isArchivedOrder,
  isFrontQueueOrder,
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
const fulfillmentFilterLabels = {
  ready_to_ship: 'Siap proses',
  label_resi: 'Label/resi',
  shipped: 'Dikirim',
  unpaid: 'Belum paid',
  archive: 'Arsip',
};

const buildShipmentDraft = (order = {}) => ({
  shipmentStatus: order.shipmentStatus || 'not_ready',
  courierName: order.courierName || '',
  trackingNumber: order.trackingNumber || '',
  trackingUrl: order.trackingUrl || '',
  packingNotes: order.packingNotes || '',
});

const ShipmentsPage = () => {
  const navigate = useNavigate();
  const { orders, summary, loading, reload, updatePaymentStatus } = useOrders();
  const [drafts, setDrafts] = useState({});
  const [savingOrder, setSavingOrder] = useState('');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('ready_to_ship');
  const [bulkDraft, setBulkDraft] = useState({
    shipmentStatus: 'packing',
    courierName: '',
  });
  const [bulkSaving, setBulkSaving] = useState(false);

  const shipmentOrders = useMemo(() => orders, [orders]);

  const filteredShipmentOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return shipmentOrders.filter((order) => {
      const paid = order.paymentStatus === 'paid';
      const matchesFilter = (fulfillmentFilter === 'ready_to_ship' && paid && isFrontQueueOrder(order))
        || (fulfillmentFilter === 'label_resi' && hasShippingLabelPrinted(order))
        || (fulfillmentFilter === 'shipped' && isShippedOrder(order) && !isArchivedOrder(order))
        || (fulfillmentFilter === 'unpaid' && !paid && isFrontQueueOrder(order))
        || (fulfillmentFilter === 'archive' && isArchivedOrder(order));

      if (!matchesFilter) return false;
      if (!query) return true;

      return [
        order.orderNumber,
        order.customerName,
        order.customerCode,
        order.contact,
        order.trackingNumber,
        order.courierName,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [fulfillmentFilter, searchTerm, shipmentOrders]);

  const selectedOrderSet = useMemo(() => new Set(selectedOrders), [selectedOrders]);
  const selectedShipmentOrders = useMemo(() => (
    shipmentOrders.filter((order) => selectedOrderSet.has(order.id || order.orderNumber))
  ), [selectedOrderSet, shipmentOrders]);
  const selectedPrintableOrders = selectedShipmentOrders.filter(canExportShippingLabel);
  const visibleOrderKeys = filteredShipmentOrders.map((order) => order.id || order.orderNumber);
  const allVisibleSelected = visibleOrderKeys.length > 0 && visibleOrderKeys.every((key) => selectedOrderSet.has(key));
  const readyToShipCount = shipmentOrders.filter((order) => order.paymentStatus === 'paid' && isFrontQueueOrder(order)).length;
  const labelResiCount = shipmentOrders.filter(hasShippingLabelPrinted).length;
  const missingResiCount = shipmentOrders.filter((order) => order.paymentStatus === 'paid' && hasShippingLabelPrinted(order) && !order.trackingNumber).length;
  const shippedCount = shipmentOrders.filter((order) => isShippedOrder(order) && !isArchivedOrder(order)).length;
  const filterCounts = {
    ready_to_ship: readyToShipCount,
    label_resi: labelResiCount,
    shipped: shippedCount,
    unpaid: shipmentOrders.filter((order) => order.paymentStatus !== 'paid' && isFrontQueueOrder(order)).length,
    archive: shipmentOrders.filter(isArchivedOrder).length,
  };

  useEffect(() => {
    setDrafts((current) => {
      const nextDrafts = { ...current };
      shipmentOrders.forEach((order) => {
        const key = order.id || order.orderNumber;
        if (!nextDrafts[key]) {
          nextDrafts[key] = buildShipmentDraft(order);
        }
      });
      return nextDrafts;
    });
  }, [shipmentOrders]);

  useEffect(() => {
    setSelectedOrders((current) => current.filter((key) => shipmentOrders.some((order) => (order.id || order.orderNumber) === key)));
  }, [shipmentOrders]);

  const updateDraft = (order, field, value) => {
    const key = order.id || order.orderNumber;
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...buildShipmentDraft(order),
        ...current[key],
        [field]: value,
      },
    }));
  };

  const prepareShipmentNotification = async (order) => {
    const message = buildNotificationMessage(order, 'shipped');
    if (!message) return;

    try {
      await navigator.clipboard.writeText(message);
      toast.success(`${order.orderNumber} pesan resi disalin`, {
        action: {
          label: 'Buka WA',
          onClick: () => window.open(getWhatsAppNotificationUrl(order, message), '_blank', 'noopener,noreferrer'),
        },
      });
    } catch (error) {
      toast.success(`${order.orderNumber} pesan resi siap`);
    }
  };

  const saveShipment = async (order) => {
    const key = order.id || order.orderNumber;
    const draft = drafts[key] || buildShipmentDraft(order);
    setSavingOrder(key);
    try {
      const nextOrder = await updateOrderShipment(key, draft);
      await reload();
      if (draft.shipmentStatus === 'shipped' || draft.trackingNumber) {
        await prepareShipmentNotification(nextOrder || { ...order, ...draft, status: draft.shipmentStatus === 'shipped' ? 'shipped' : order.status });
      }
      toast.success(`${order.orderNumber} pengiriman tersimpan`);
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan pengiriman');
    } finally {
      setSavingOrder('');
    }
  };

  const toggleOrderSelection = (order, checked) => {
    const key = order.id || order.orderNumber;
    setSelectedOrders((current) => (
      checked
        ? Array.from(new Set([...current, key]))
        : current.filter((value) => value !== key)
    ));
  };

  const toggleVisibleSelection = (checked) => {
    setSelectedOrders((current) => {
      const visibleSet = new Set(visibleOrderKeys);
      if (!checked) return current.filter((key) => !visibleSet.has(key));
      return Array.from(new Set([...current, ...visibleOrderKeys]));
    });
  };

  const bulkUpdateShipments = async () => {
    if (!selectedShipmentOrders.length) {
      toast.error('Pilih order dulu untuk bulk update');
      return;
    }

    const patch = {
      shipmentStatus: bulkDraft.shipmentStatus,
      ...(bulkDraft.courierName.trim() ? { courierName: bulkDraft.courierName } : {}),
    };
    setBulkSaving(true);
    try {
      await Promise.all(selectedShipmentOrders.map((order) => {
        const key = order.id || order.orderNumber;
        const currentDraft = drafts[key] || buildShipmentDraft(order);
        return updateOrderShipment(key, {
          ...currentDraft,
          ...patch,
          trackingNumber: currentDraft.trackingNumber,
          trackingUrl: currentDraft.trackingUrl,
          packingNotes: currentDraft.packingNotes,
        });
      }));
      await reload();
      toast.success(`${selectedShipmentOrders.length} pengiriman diperbarui`);
    } catch (error) {
      toast.error(error.message || 'Update massal pengiriman gagal');
    } finally {
      setBulkSaving(false);
    }
  };

  const exportShippingLabel = async (order) => {
    if (!canExportShippingLabel(order)) {
      toast.error('Resi PDF tersedia setelah payment paid');
      return;
    }
    const { exportShippingLabelPdf } = await import('@/utils/shippingLabelPdf.js');
    await exportShippingLabelPdf(order);
    if (!hasShippingLabelPrinted(order) && !isShippedOrder(order) && !isArchivedOrder(order)) {
      const key = order.id || order.orderNumber;
      const currentDraft = drafts[key] || buildShipmentDraft(order);
      await updateOrderShipment(key, {
        ...currentDraft,
        shipmentStatus: 'packing',
        packingNotes: currentDraft.packingNotes || 'Resi PDF dicetak dari Desktop Fulfillment.',
      });
      await reload();
      setFulfillmentFilter('label_resi');
      toast.success(`${order.orderNumber} resi PDF siap. Order masuk Label/resi.`);
      return;
    }
    toast.success(`${order.orderNumber} resi PDF siap`);
  };

  const copyPublicTrackingLink = async (order) => {
    try {
      await navigator.clipboard.writeText(buildPublicTrackingUrl(order.orderNumber));
      toast.success(`${order.orderNumber} link tracking publik disalin`);
    } catch (error) {
      toast.error(error.message || 'Gagal menyalin link tracking publik');
    }
  };

  const openPublicTrackingLink = (order) => {
    window.open(buildPublicTrackingUrl(order.orderNumber), '_blank', 'noopener,noreferrer');
  };

  const exportSelectedShippingLabels = async () => {
    const { exportShippingLabelsPdf } = await import('@/utils/shippingLabelPdf.js');
    const printedCount = await exportShippingLabelsPdf(selectedShipmentOrders);
    if (!printedCount) {
      toast.error('Pilih order paid untuk cetak bulk resi');
      return;
    }
    await Promise.all(selectedPrintableOrders.map((order) => {
      if (hasShippingLabelPrinted(order) || isShippedOrder(order) || isArchivedOrder(order)) return Promise.resolve();
      const key = order.id || order.orderNumber;
      const currentDraft = drafts[key] || buildShipmentDraft(order);
      return updateOrderShipment(key, {
        ...currentDraft,
        shipmentStatus: 'packing',
        packingNotes: currentDraft.packingNotes || 'Resi PDF dicetak dari Desktop Fulfillment.',
      });
    }));
    await reload();
    setFulfillmentFilter('label_resi');
    toast.success(`${printedCount} resi PDF siap. Order dipindah ke Label/resi.`);
  };

  const bulkMarkPaid = async () => {
    if (!selectedShipmentOrders.length) {
      toast.error('Pilih order dulu untuk mark paid');
      return;
    }
    setBulkSaving(true);
    try {
      await Promise.all(selectedShipmentOrders.map((order) => updatePaymentStatus(order.id || order.orderNumber, 'paid')));
      toast.success(`${selectedShipmentOrders.length} order ditandai paid`);
    } catch (error) {
      toast.error(error.message || 'Gagal mark paid massal');
    } finally {
      setBulkSaving(false);
    }
  };

  const bulkWhatsAppFollowUp = async () => {
    if (!selectedShipmentOrders.length) {
      toast.error('Pilih order dulu untuk follow-up WA');
      return;
    }
    const messages = selectedShipmentOrders.map((order) => {
      const message = buildNotificationMessage(order, order.shipmentStatus === 'shipped' || order.trackingNumber ? 'shipped' : 'processing');
      return { order, message };
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
    if (!selectedShipmentOrders.length) {
      toast.error('Pilih order dulu untuk export CSV');
      return;
    }
    exportOrdersCsv(selectedShipmentOrders, 'fulfillment_selected.csv');
    toast.success(`${selectedShipmentOrders.length} order diekspor CSV`);
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Pengiriman - Solivagant</title>
        <meta name="description" content="Kelola fulfillment pengiriman order Solivagant." />
      </Helmet>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Button variant="ghost" className="h-9 gap-2 rounded-2xl" onClick={() => navigate('/studio')}>
            <ArrowLeft className="h-4 w-4" />
            Kembali ke dashboard
          </Button>
        </div>

        <div className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <Truck className="h-4 w-4 text-primary" />
              Fulfillment e-commerce
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Pengiriman</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Cetak resi, lengkapi kurir, pindahkan ke dikirim, lalu tutup order setelah delivered.
            </p>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Order aktif</span><strong>{summary.active}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Total order</span><strong>{summary.total}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Siap proses</span><strong>{readyToShipCount}</strong></div>
          </div>
        </div>

        <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Antrean fulfillment</h2>
            <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => navigate('/studio/orders')}>
              <PackageCheck className="h-4 w-4" />
              Order
            </Button>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border bg-[#fbfaf7] p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Cari customer, order, kontak, kurir, atau nomor resi"
                  className="h-11 w-full rounded-2xl border bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-amber-300"
                />
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(fulfillmentFilterLabels).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant="outline"
                    className={`h-11 rounded-2xl text-xs font-bold ${fulfillmentFilter === value ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-white'}`}
                    onClick={() => setFulfillmentFilter(value)}
                  >
                    {label} <span className="ml-1 opacity-70">{filterCounts[value]}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 border-t pt-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs font-bold uppercase text-muted-foreground">Siap proses</div>
                <div className="mt-1 text-2xl font-bold text-[#1b1a16]">{readyToShipCount}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs font-bold uppercase text-muted-foreground">Label/resi</div>
                <div className="mt-1 text-2xl font-bold text-amber-700">{labelResiCount}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs font-bold uppercase text-muted-foreground">Butuh resi</div>
                <div className="mt-1 text-2xl font-bold text-[#1b1a16]">{missingResiCount}</div>
              </div>
            </div>

            <div className="grid gap-3 border-t pt-3 lg:grid-cols-[auto_1fr_auto]">
              <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-bold">
                <Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => toggleVisibleSelection(Boolean(checked))} />
                Pilih tampilan
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={bulkDraft.courierName}
                  onChange={(event) => setBulkDraft((current) => ({ ...current, courierName: event.target.value }))}
                  placeholder="Kurir massal, contoh: JNE / J&T"
                  className="h-11 rounded-2xl border bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300"
                />
                <select
                  value={bulkDraft.shipmentStatus}
                  onChange={(event) => setBulkDraft((current) => ({ ...current, shipmentStatus: event.target.value }))}
                  className="h-11 rounded-2xl border bg-white px-3 text-sm font-bold outline-none focus:border-amber-300"
                >
                  {Object.entries(shipmentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={bulkMarkPaid} disabled={bulkSaving || !selectedShipmentOrders.length}>
                  <CreditCard className="h-4 w-4" />
                  Mark paid
                </Button>
                <Button type="button" className="h-11 rounded-2xl gap-2" onClick={bulkUpdateShipments} disabled={bulkSaving || !selectedShipmentOrders.length}>
                  {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Update massal
                </Button>
                <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={exportSelectedShippingLabels} disabled={!selectedPrintableOrders.length}>
                  <Download className="h-4 w-4" />
                  Resi PDF
                </Button>
                <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={bulkWhatsAppFollowUp} disabled={!selectedShipmentOrders.length}>
                  <MessageCircle className="h-4 w-4" />
                  WA follow-up
                </Button>
                <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={bulkExportCsv} disabled={!selectedShipmentOrders.length}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>
            <p className="text-xs font-bold text-muted-foreground">
              {filteredShipmentOrders.length} tampil / {shipmentOrders.length} pengiriman, {selectedShipmentOrders.length} dipilih, {selectedPrintableOrders.length} siap cetak.
            </p>
          </div>

          <div className="mt-5 grid gap-4">
            {filteredShipmentOrders.map((order) => {
              const key = order.id || order.orderNumber;
              const draft = drafts[key] || buildShipmentDraft(order);
              const paid = order.paymentStatus === 'paid';
              const selected = selectedOrderSet.has(key);

              return (
                <article key={key} className="rounded-2xl border bg-[#fbfaf7] p-4">
                  <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Checkbox checked={selected} onCheckedChange={(checked) => toggleOrderSelection(order, Boolean(checked))} />
                        <h3 className="text-lg font-bold">{order.orderNumber}</h3>
                        <StatusChip icon={PackageCheck} tone={getPaymentStatusTone(order.paymentStatus)}>
                          {paid ? 'Sudah dibayar' : 'Menunggu bayar'}
                        </StatusChip>
                        <StatusChip icon={Truck} tone={getShipmentStatusTone(order.shipmentStatus)}>
                          {shipmentStatusLabels[order.shipmentStatus] || order.shipmentStatus}
                        </StatusChip>
                        {paid && !draft.trackingNumber ? (
                          <StatusChip tone="warning">Butuh resi</StatusChip>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">
                        {formatDate(order.createdAt)} / {order.customerName} / {order.contact}
                      </p>
                      <div className="mt-3 grid gap-2">
                        {(order.items || []).map((item) => (
                          <div key={`${key}-${item.slug || item.name}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold">
                            <span className="min-w-0 truncate">{item.name} x{item.quantity}{item.size ? ` / ${item.size}` : ''}</span>
                            <span className="shrink-0 text-amber-700">{item.price || '-'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-bold sm:grid-cols-2">
                        <span>Total {formatTotal(order.subtotal)}</span>
                        <span className="text-muted-foreground">{order.courierName || draft.courierName || 'Kurir belum diisi'}{order.trackingNumber || draft.trackingNumber ? ` / ${order.trackingNumber || draft.trackingNumber}` : ''}</span>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <select
                        value={draft.shipmentStatus}
                        onChange={(event) => updateDraft(order, 'shipmentStatus', event.target.value)}
                        className="h-11 rounded-2xl border bg-white px-3 text-sm font-bold outline-none focus:border-amber-300"
                      >
                        {Object.entries(shipmentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <input
                        value={draft.courierName}
                        onChange={(event) => updateDraft(order, 'courierName', event.target.value)}
                        placeholder="Kurir, contoh: JNE / J&T"
                        className="h-11 rounded-2xl border bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300"
                      />
                      <input
                        value={draft.trackingNumber}
                        onChange={(event) => updateDraft(order, 'trackingNumber', event.target.value)}
                        placeholder="Nomor resi kurir"
                        className="h-11 rounded-2xl border bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300"
                      />
                      <input
                        value={draft.trackingUrl}
                        onChange={(event) => updateDraft(order, 'trackingUrl', event.target.value)}
                        placeholder="URL tracking kurir opsional"
                        className="h-11 rounded-2xl border bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300"
                      />
                      <textarea
                        value={draft.packingNotes}
                        onChange={(event) => updateDraft(order, 'packingNotes', event.target.value)}
                        rows={2}
                        placeholder="Catatan packing..."
                        className="rounded-2xl border bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300"
                      />
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Button type="button" className="h-11 rounded-2xl gap-2" onClick={() => saveShipment(order)} disabled={savingOrder === key}>
                          {savingOrder === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Simpan pengiriman
                        </Button>
                        <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => navigate(`/studio/orders/${key}`)}>
                          <Eye className="h-4 w-4" />
                          Detail
                        </Button>
                        <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => exportShippingLabel(order)} disabled={!canExportShippingLabel(order)}>
                          <Download className="h-4 w-4" />
                          Resi PDF
                        </Button>
                        <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => copyPublicTrackingLink(order)}>
                          <Copy className="h-4 w-4" />
                          Salin tracking
                        </Button>
                        <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => openPublicTrackingLink(order)}>
                          <ExternalLink className="h-4 w-4" />
                          Buka tracking
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {!filteredShipmentOrders.length && !loading ? (
              <StateBlock
                className="bg-[#fbfaf7]"
                icon={Truck}
                title="Pengiriman tidak ditemukan"
                description="Ubah pencarian atau filter untuk melihat pengiriman lain."
              />
            ) : null}
            {loading && !shipmentOrders.length ? (
              <StateBlock
                className="bg-[#fbfaf7]"
                tone="loading"
                title="Memuat pengiriman"
                description="Sebentar, data pengiriman sedang disiapkan."
              />
            ) : null}
          </div>
        </section>
      </div>
    </AuthenticatedLayout>
  );
};

export default ShipmentsPage;
