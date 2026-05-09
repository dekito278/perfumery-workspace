import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Clipboard, CreditCard, ExternalLink, Loader2, PackageCheck, ReceiptText, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useOrders } from '@/hooks/useOrders.js';
import { refreshDokuPaymentStatus } from '@/services/dokuCheckoutService.js';
import {
  getBespokeItem,
  getBespokeProductionStatusLabels,
  getOrderStatusLabels,
  isBespokeOrder,
} from '@/services/orderService.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
const formatDate = (value) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const statusLabels = getOrderStatusLabels();
const bespokeProductionStatusLabels = getBespokeProductionStatusLabels();
const paymentStatusLabels = {
  unpaid: 'Unpaid',
  pending: 'Pending payment',
  paid: 'Paid',
  failed: 'Failed',
  expired: 'Expired',
  refunded: 'Refunded',
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
  const { orders, summary, loading, reload, updateStatus, deleteOne } = useOrders();
  const [syncingOrder, setSyncingOrder] = useState('');

  const copyOrder = async (order) => {
    await navigator.clipboard.writeText(order.checkoutDraft);
    toast.success(`${order.orderNumber} copied`);
  };

  const syncDokuStatus = async (order) => {
    if (!order?.orderNumber) return;

    setSyncingOrder(order.orderNumber);
    try {
      const result = await refreshDokuPaymentStatus(order.orderNumber);
      await reload();
      const statusLabel = paymentStatusLabels[result.paymentStatus] || result.paymentStatus || 'checked';
      if (result.syncApplied) {
        toast.success(`${order.orderNumber} DOKU synced: ${statusLabel}`);
      } else {
        toast.warning(result.syncWarning || `${order.orderNumber} DOKU checked, but order was not updated`);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to sync DOKU status');
    } finally {
      setSyncingOrder('');
    }
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
              Storefront orders
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Order queue</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Pesanan dari cart dan request bespoke masuk ke sini agar bisa dicek, dikonfirmasi, disiapkan, lalu ditandai selesai.
            </p>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Total orders</span><strong>{summary.total}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Active</span><strong>{summary.active}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Revenue draft</span><strong>{formatTotal(summary.revenue)}</strong></div>
          </div>
        </div>

        <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Orders</h2>
            <span className="text-sm font-bold text-amber-700">{summary.completed} completed</span>
          </div>
          <div className="mt-5 grid gap-4">
            {orders.map((order) => {
              const bespoke = isBespokeOrder(order);
              const bespokeItem = getBespokeItem(order);

              return (
              <article key={order.id} className="rounded-2xl border bg-[#fbfaf7] p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">{order.orderNumber}</h3>
                      {bespoke ? <span className="rounded-full bg-[#eef2e8] px-3 py-1 text-xs font-bold uppercase text-[#263d27]">Bespoke</span> : null}
                      {bespoke ? <span className="rounded-full bg-[#f7f8f2] px-3 py-1 text-xs font-bold uppercase text-[#263d27]">{bespokeProductionStatusLabels[order.bespokeProductionStatus || 'review_brief']}</span> : null}
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase text-amber-800">{statusLabels[order.status] || order.status}</span>
                      {order.persistence === 'local' ? <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold uppercase text-stone-600">Local draft</span> : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">{formatDate(order.createdAt)} / {order.customerName} / {order.contact}{order.customerCode ? ` / ${order.customerCode}` : ''}</p>
                    <div className="mt-3 grid gap-2">
                      {order.items.map((item) => (
                        <div key={`${order.id}-${item.slug}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold">
                          <span>{item.name} x{item.quantity}</span>
                          <span className="text-amber-700">{item.price}</span>
                        </div>
                      ))}
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
                        <CreditCard className="h-3.5 w-3.5" />
                        {order.paymentProvider || 'manual'} / {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
                      </span>
                      {order.paymentReference ? <span className="rounded-full bg-white px-3 py-1 text-muted-foreground">Ref {order.paymentReference}</span> : null}
                      {order.paymentUrl && ['unpaid', 'pending'].includes(order.paymentStatus) ? (
                        <>
                          <a href={`/payment?order=${encodeURIComponent(order.orderNumber)}&payment=doku`} className="inline-flex items-center gap-1 rounded-full bg-[#263d27] px-3 py-1 text-[#eef2e8]">
                            <CreditCard className="h-3.5 w-3.5" />
                            Continue payment
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
                          Checkout response saved
                        </span>
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
                    </div>
                    <select value={order.status} onChange={(event) => updateStatus(order.id, event.target.value)} className="h-11 rounded-2xl border bg-white px-3 text-sm font-bold outline-none focus:border-amber-300">
                      {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={() => copyOrder(order)}><Clipboard className="h-4 w-4" />Copy</Button>
                      <Button type="button" variant="outline" className="rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => deleteOne(order.id)}><Trash2 className="h-4 w-4" />Delete</Button>
                    </div>
                  </div>
                </div>
              </article>
              );
            })}
            {!orders.length && !loading ? (
              <div className="rounded-2xl border border-dashed bg-[#fbfaf7] p-8 text-center">
                <PackageCheck className="mx-auto h-8 w-8 text-amber-700" />
                <h3 className="mt-3 font-bold">No orders yet</h3>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Pesanan cart dan request bespoke yang tersimpan akan muncul di sini.</p>
              </div>
            ) : null}
            {loading && !orders.length ? (
              <div className="rounded-2xl border border-dashed bg-[#fbfaf7] p-8 text-center text-sm font-bold text-muted-foreground">
                Loading orders...
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AuthenticatedLayout>
  );
};

export default OrdersPage;

