import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clipboard, PackageCheck, PackageOpen, Send, Truck } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useOrders } from '@/hooks/useOrders.js';
import {
  getBespokeProductionStatusLabels,
  getShipmentStatusLabels,
  isBespokeOrder,
  updateOrderShipment,
} from '@/services/orderService.js';

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
  const { orders, loading } = useOrders();
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState('');

  useEffect(() => {
    setDrafts(createDrafts(orders));
  }, [orders]);

  const paidOrders = useMemo(() => orders.filter(isPaid), [orders]);
  const readyOrders = useMemo(() => paidOrders.filter(isFulfillmentReady), [paidOrders]);
  const packingOrders = useMemo(() => readyOrders.filter((order) => order.shipmentStatus === 'packing'), [readyOrders]);
  const blockedPaidOrders = useMemo(() => paidOrders.filter((order) => isOpenShipment(order) && !isBespokeReady(order)), [paidOrders]);
  const shippedToday = useMemo(() => {
    const today = new Date().toDateString();
    return orders.filter((order) => order.shipmentStatus === 'shipped' && order.shippedAt && new Date(order.shippedAt).toDateString() === today);
  }, [orders]);

  const updateDraft = (orderKey, field, value) => {
    setDrafts((current) => ({
      ...current,
      [orderKey]: {
        ...(current[orderKey] || {}),
        [field]: value,
      },
    }));
  };

  const saveShipment = async (order, shipmentStatus) => {
    const orderKey = order.id || order.orderNumber;
    const draft = drafts[orderKey] || {};
    setSavingId(orderKey);
    try {
      await updateOrderShipment(orderKey, {
        ...draft,
        shipmentStatus,
        shippedAt: shipmentStatus === 'shipped' ? new Date().toISOString() : order.shippedAt,
      });
      toast.success(shipmentStatus === 'shipped' ? 'Order marked shipped' : 'Order moved to packing');
    } catch (error) {
      toast.error(error.message || 'Failed to save shipment');
    } finally {
      setSavingId('');
    }
  };

  const copyPackingList = async (order) => {
    const lines = [
      order.orderNumber,
      order.customerName,
      order.contact,
      ...order.items.map((item) => `${item.name} x${item.quantity}${item.size ? ` / ${item.size}` : ''}`),
      order.packingNotes ? `Packing: ${order.packingNotes}` : '',
    ].filter(Boolean);
    await navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Packing list copied');
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>Fulfillment - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Fulfillment"
          subtitle={`${readyOrders.length} paid ready to ship`}
          eyebrow="Studio mobile"
          action={<PackageOpen className="h-5 w-5 text-amber-700" />}
        />

        <section className="mobile-studio-hero p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase text-amber-700">Packing dashboard</div>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-[#142116]">
                {loading ? 'Syncing orders' : readyOrders.length ? 'Ready to pack' : 'Queue clear'}
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
            <FulfillmentMetric label="Ready" value={loading ? '-' : readyOrders.length} tone="emerald" />
            <FulfillmentMetric label="Packing" value={loading ? '-' : packingOrders.length} tone="amber" />
            <FulfillmentMetric label="Paid blocked" value={loading ? '-' : blockedPaidOrders.length} tone={blockedPaidOrders.length ? 'rose' : 'stone'} />
            <FulfillmentMetric label="Shipped today" value={loading ? '-' : shippedToday.length} tone="stone" />
          </div>
        </section>

        {blockedPaidOrders.length ? (
          <section className="mobile-card border border-amber-100 bg-amber-50/70 p-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-amber-700">
                <PackageCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-amber-800">Paid but not ready</div>
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
                  onClick={() => navigate(`/mobile/studio/orders/${order.id || order.orderNumber}`)}
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
            <h2 className="text-base font-bold text-[#0b130c]">Ready queue</h2>
            <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => navigate('/mobile/studio/orders')}>All orders</Button>
          </div>

          {readyOrders.map((order) => {
            const orderKey = order.id || order.orderNumber;
            const draft = drafts[orderKey] || {};
            const saving = savingId === orderKey;

            return (
              <article key={orderKey} className="mobile-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[#0b130c]">{order.orderNumber}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">{order.customerName} / {order.contact}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase text-[#9ca3af]">{formatDate(order.createdAt)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
                    {shipmentStatusLabels[order.shipmentStatus] || 'Ready'}
                  </span>
                </div>

                <div className="mt-3 grid gap-2">
                  {order.items.map((item) => (
                    <div key={`${orderKey}-${item.slug || item.name}`} className="flex items-center justify-between gap-2 rounded-2xl bg-[#f8f7f4] px-3 py-2">
                      <span className="min-w-0 truncate text-xs font-bold text-[#1f2937]">{item.name} x{item.quantity}</span>
                      <span className="shrink-0 text-[10px] font-bold text-amber-700">{item.size || item.price}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input
                    value={draft.courierName || ''}
                    onChange={(event) => updateDraft(orderKey, 'courierName', event.target.value)}
                    placeholder="Kurir"
                    className="h-11 min-w-0 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300"
                  />
                  <input
                    value={draft.trackingNumber || ''}
                    onChange={(event) => updateDraft(orderKey, 'trackingNumber', event.target.value)}
                    placeholder="Resi"
                    className="h-11 min-w-0 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300"
                  />
                </div>
                <textarea
                  value={draft.packingNotes || ''}
                  onChange={(event) => updateDraft(orderKey, 'packingNotes', event.target.value)}
                  rows={2}
                  placeholder="Catatan packing"
                  className="mt-2 w-full rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300"
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#6b7280]">{order.quantity} items</div>
                    <div className="text-base font-bold text-[#1f2937]">{formatTotal(order.subtotal)}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 px-2 text-xs"
                    onClick={() => navigate(`/mobile/studio/orders/${orderKey}`)}
                  >
                    Detail
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-1 text-xs" onClick={() => copyPackingList(order)}>
                    <Clipboard className="h-4 w-4" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-2xl bg-white gap-1 text-xs"
                    onClick={() => saveShipment(order, 'packing')}
                    disabled={saving}
                  >
                    <PackageOpen className="h-4 w-4" />
                    Pack
                  </Button>
                  <Button
                    type="button"
                    className="h-11 rounded-2xl gap-1 text-xs"
                    onClick={() => saveShipment(order, 'shipped')}
                    disabled={saving}
                  >
                    <Send className="h-4 w-4" />
                    Ship
                  </Button>
                </div>
              </article>
            );
          })}

          {!readyOrders.length && !loading ? (
            <div className="mobile-card p-5 text-center">
              <PackageOpen className="mx-auto h-8 w-8 text-amber-700" />
              <h2 className="mt-3 text-base font-bold text-[#1f2937]">No paid orders ready</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                Order paid akan muncul setelah payment masuk dan belum dikirim.
              </p>
            </div>
          ) : null}
          {loading && !readyOrders.length ? (
            <div className="mobile-card p-5 text-center text-xs font-bold text-[#6b7280]">Loading fulfillment queue...</div>
          ) : null}
        </section>
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileFulfillmentPage;
