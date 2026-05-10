import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Eye, Loader2, PackageCheck, Save, Search, Truck } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { useOrders } from '@/hooks/useOrders.js';
import { getShipmentStatusLabels, updateOrderShipment } from '@/services/orderService.js';
import { buildNotificationMessage, getWhatsAppNotificationUrl } from '@/services/notificationTemplateService.js';
import { canExportShippingLabel, exportShippingLabelPdf, exportShippingLabelsPdf } from '@/utils/shippingLabelPdf.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-');

const shipmentStatusLabels = getShipmentStatusLabels();
const fulfillmentFilterLabels = {
  ready_to_ship: 'Paid belum dikirim',
  all: 'Semua aktif',
  shipped: 'Sudah dikirim',
  unpaid: 'Belum paid',
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
  const { orders, summary, loading, reload } = useOrders();
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

  const shipmentOrders = useMemo(() => (
    orders.filter((order) => order.status !== 'cancelled')
  ), [orders]);

  const filteredShipmentOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return shipmentOrders.filter((order) => {
      const paid = order.paymentStatus === 'paid';
      const shipped = ['shipped', 'delivered'].includes(order.shipmentStatus);
      const matchesFilter = fulfillmentFilter === 'all'
        || (fulfillmentFilter === 'ready_to_ship' && paid && !shipped)
        || (fulfillmentFilter === 'shipped' && shipped)
        || (fulfillmentFilter === 'unpaid' && !paid);

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
      toast.success(`${order.orderNumber} tracking message copied`, {
        action: {
          label: 'Open WA',
          onClick: () => window.open(getWhatsAppNotificationUrl(order, message), '_blank', 'noopener,noreferrer'),
        },
      });
    } catch (error) {
      toast.success(`${order.orderNumber} tracking message ready`);
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
      toast.success(`${order.orderNumber} shipment saved`);
    } catch (error) {
      toast.error(error.message || 'Failed to save shipment');
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
      toast.success(`${selectedShipmentOrders.length} shipment updated`);
    } catch (error) {
      toast.error(error.message || 'Bulk update shipment gagal');
    } finally {
      setBulkSaving(false);
    }
  };

  const exportShippingLabel = (order) => {
    if (!canExportShippingLabel(order)) {
      toast.error('Resi PDF tersedia setelah payment paid');
      return;
    }
    exportShippingLabelPdf(order);
    toast.success(`${order.orderNumber} resi PDF prepared`);
  };

  const exportSelectedShippingLabels = () => {
    const printedCount = exportShippingLabelsPdf(selectedShipmentOrders);
    if (!printedCount) {
      toast.error('Pilih order paid untuk cetak bulk resi');
      return;
    }
    toast.success(`${printedCount} resi PDF prepared`);
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Shipments - Solivagant</title>
        <meta name="description" content="Manage shipment fulfillment for Solivagant orders." />
      </Helmet>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Button variant="ghost" className="h-9 gap-2 rounded-2xl" onClick={() => navigate('/studio')}>
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
        </div>

        <div className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <Truck className="h-4 w-4 text-primary" />
              E-commerce fulfillment
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Shipments</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Simpan kurir, nomor resi, status pengiriman, dan cetak label setelah order paid.
            </p>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Active orders</span><strong>{summary.active}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Total orders</span><strong>{summary.total}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Ready ship</span><strong>{shipmentOrders.filter((order) => order.paymentStatus === 'paid' && !['shipped', 'delivered'].includes(order.shipmentStatus)).length}</strong></div>
          </div>
        </div>

        <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Fulfillment queue</h2>
            <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => navigate('/studio/orders')}>
              <PackageCheck className="h-4 w-4" />
              Orders
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
                    {label}
                  </Button>
                ))}
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
                  placeholder="Bulk kurir, contoh: JNE / J&T"
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
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" className="h-11 rounded-2xl gap-2" onClick={bulkUpdateShipments} disabled={bulkSaving || !selectedShipmentOrders.length}>
                  {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Bulk update
                </Button>
                <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={exportSelectedShippingLabels} disabled={!selectedPrintableOrders.length}>
                  <Download className="h-4 w-4" />
                  Bulk resi
                </Button>
              </div>
            </div>
            <p className="text-xs font-bold text-muted-foreground">
              {filteredShipmentOrders.length} tampil / {shipmentOrders.length} shipment, {selectedShipmentOrders.length} dipilih, {selectedPrintableOrders.length} siap cetak.
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
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                          {paid ? 'Paid' : 'Waiting payment'}
                        </span>
                        <span className="rounded-full bg-[#eef2e8] px-3 py-1 text-xs font-bold uppercase text-[#263d27]">
                          {shipmentStatusLabels[order.shipmentStatus] || order.shipmentStatus}
                        </span>
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
                      <div className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm font-bold">
                        Total {formatTotal(order.subtotal)}
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
                        placeholder="Nomor resi"
                        className="h-11 rounded-2xl border bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300"
                      />
                      <input
                        value={draft.trackingUrl}
                        onChange={(event) => updateDraft(order, 'trackingUrl', event.target.value)}
                        placeholder="Tracking URL opsional"
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
                          Save shipment
                        </Button>
                        <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => navigate(`/studio/orders/${key}`)}>
                          <Eye className="h-4 w-4" />
                          Detail
                        </Button>
                        <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => exportShippingLabel(order)} disabled={!canExportShippingLabel(order)}>
                          <Download className="h-4 w-4" />
                          Resi PDF
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {!filteredShipmentOrders.length && !loading ? (
              <div className="rounded-2xl border border-dashed bg-[#fbfaf7] p-8 text-center">
                <Truck className="mx-auto h-8 w-8 text-amber-700" />
                <h3 className="mt-3 font-bold">No shipment rows match</h3>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Ubah pencarian atau filter untuk melihat shipment lain.</p>
              </div>
            ) : null}
            {loading && !shipmentOrders.length ? (
              <div className="rounded-2xl border border-dashed bg-[#fbfaf7] p-8 text-center text-sm font-bold text-muted-foreground">
                Loading shipments...
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AuthenticatedLayout>
  );
};

export default ShipmentsPage;
