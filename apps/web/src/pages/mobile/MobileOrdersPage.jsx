import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clipboard, CreditCard, Eye, PackageCheck, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useOrders } from '@/hooks/useOrders.js';
import { getProductLowStock } from '@/services/productCatalogService.js';
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
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  expired: 'Expired',
  refunded: 'Refunded',
};

const getPaymentStatusClassName = (status) => {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700';
  if (['failed', 'expired'].includes(status)) return 'bg-rose-50 text-rose-700';
  if (status === 'pending') return 'bg-amber-50 text-amber-700';
  return 'bg-stone-100 text-stone-600';
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

const MobileOrdersPage = () => {
  const navigate = useNavigate();
  const { orders, summary, loading, updateStatus, updatePaymentStatus, deleteOne } = useOrders();
  const products = useCatalogProducts({ editableOnly: true });
  const paymentSummary = getPaymentSummary(orders);
  const lowStockProducts = products.filter(getProductLowStock);

  const copyOrder = async (order) => {
    await navigator.clipboard.writeText(order.checkoutDraft);
    toast.success(`${order.orderNumber} copied`);
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet>
        <title>Orders - Solivagant</title>
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Orders"
          subtitle={`${summary.active} active / ${summary.total} total`}
          eyebrow="Studio admin"
          action={<PackageCheck className="h-5 w-5 text-amber-700" />}
        />

        <section className="mobile-soft-card grid grid-cols-2 gap-3 p-4">
          <div>
            <div className="text-[10px] font-bold uppercase text-amber-700">Revenue draft</div>
            <div className="mt-1 text-lg font-bold text-[#1f2937]">{formatTotal(summary.revenue)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-amber-700">Completed</div>
            <div className="mt-1 text-lg font-bold text-[#1f2937]">{summary.completed}</div>
          </div>
        </section>

        <section className="mobile-card p-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[10px] font-bold uppercase text-[#263d27]">DOKU payment flow</div>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                Checkout mengunci stok sekali, lalu payment callback mengubah status menjadi Paid otomatis. Setelah itu Studio tinggal lanjut Processing, Shipped, lalu Completed.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-amber-50 px-3 py-2 text-center">
              <div className="text-sm font-bold text-amber-800">{paymentSummary.pending}</div>
              <div className="text-[9px] font-bold uppercase text-amber-700">Pending</div>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-center">
              <div className="text-sm font-bold text-emerald-700">{paymentSummary.paid}</div>
              <div className="text-[9px] font-bold uppercase text-emerald-700">Paid</div>
            </div>
            <div className="rounded-2xl bg-rose-50 px-3 py-2 text-center">
              <div className="text-sm font-bold text-rose-700">{paymentSummary.attention}</div>
              <div className="text-[9px] font-bold uppercase text-rose-700">Issue</div>
            </div>
          </div>
        </section>

        {lowStockProducts.length ? (
          <section className="mobile-card border border-rose-100 bg-rose-50/70 p-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-rose-700">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-rose-700">Low stock warning</div>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-rose-800">
                  {lowStockProducts.length} produk mendekati habis setelah checkout mengurangi stok.
                </p>
              </div>
            </div>
            <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
              {lowStockProducts.map((product) => (
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
          {orders.map((order) => {
            const bespoke = isBespokeOrder(order);
            const bespokeItem = getBespokeItem(order);

            return (
            <article key={order.id} className="mobile-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-[#1f2937]">{order.orderNumber}</h2>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280]">{formatDate(order.createdAt)}</p>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280]">{order.customerName} / {order.contact}</p>
                  {order.customerCode ? <p className="mt-1 text-[10px] font-bold uppercase text-[#263d27]">{order.customerCode}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {bespoke ? <span className="rounded-full bg-[#eef2e8] px-2 py-1 text-[10px] font-bold uppercase text-[#263d27]">Bespoke</span> : null}
                  {bespoke ? (
                    <span className="rounded-full bg-[#f7f8f2] px-2 py-1 text-[10px] font-bold uppercase text-[#263d27]">
                      {bespokeProductionStatusLabels[order.bespokeProductionStatus || 'review_brief']}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase text-amber-800">{statusLabels[order.status] || order.status}</span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${getPaymentStatusClassName(order.paymentStatus)}`}>
                    {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
                  </span>
                  {order.inventoryDeducted ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">Stock cut</span> : null}
                </div>
              </div>
              {order.persistence === 'local' ? <div className="mt-2 w-fit rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase text-stone-600">Local draft</div> : null}
              <div className="mt-3 space-y-2">
                {order.items.map((item) => (
                  <div key={`${order.id}-${item.slug}`} className="flex items-center justify-between gap-2 rounded-2xl bg-[#f8f7f4] px-3 py-2 text-xs font-semibold text-[#1f2937]">
                    <span className="min-w-0 truncate">{item.name} x{item.quantity}</span>
                    <span className="shrink-0 text-amber-700">{item.price}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-2xl bg-[#f8f7f4] p-3">
                <div className="text-[10px] font-bold uppercase text-[#6b7280]">Next action</div>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-[#1f2937]">{nextActionByStatus[order.status] || 'Review order dan update status berikutnya.'}</p>
              </div>
              <div className="mt-3 rounded-2xl border border-[#e5e7eb] bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-[#6b7280]">Payment admin</div>
                    <p className="mt-1 text-xs font-semibold text-[#1f2937]">{order.paymentProvider || 'manual'}{order.paymentReference ? ` / ${order.paymentReference}` : ''}</p>
                  </div>
                  {order.paymentStatus !== 'paid' ? (
                    <Button type="button" size="sm" className="h-9 shrink-0 rounded-2xl px-3 text-xs" onClick={() => updatePaymentStatus(order.id || order.orderNumber, 'paid')}>
                      Mark paid
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
                  <span className={`grid h-10 place-items-center rounded-2xl px-3 text-[10px] font-bold uppercase ${getPaymentStatusClassName(order.paymentStatus)}`}>
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
                  <div className="grid gap-2">
                    {bespokeDetailRows(bespokeItem).map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[72px_1fr] gap-2 text-xs font-semibold leading-snug">
                        <span className="text-[#6b7280]">{label}</span>
                        <span className="min-w-0 text-[#1f2937]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#6b7280]">{order.quantity} items</div>
                  <div className="text-base font-bold text-[#1f2937]">{formatTotal(order.subtotal)}</div>
                </div>
                <select value={order.status} onChange={(event) => updateStatus(order.id || order.orderNumber, event.target.value)} className="h-10 rounded-2xl border border-[#e5e7eb] bg-white px-2 text-xs font-bold outline-none focus:border-amber-300">
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={() => navigate(`/mobile/studio/orders/${order.id || order.orderNumber}`)}><Eye className="h-4 w-4" />Detail</Button>
                <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={() => copyOrder(order)}><Clipboard className="h-4 w-4" />Copy</Button>
                <Button type="button" variant="outline" className="rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => deleteOne(order.id || order.orderNumber)}><Trash2 className="h-4 w-4" />Delete</Button>
              </div>
            </article>
            );
          })}
          {!orders.length && !loading ? (
            <div className="mobile-card p-5 text-center">
              <PackageCheck className="mx-auto h-8 w-8 text-amber-700" />
              <h2 className="mt-3 text-base font-bold text-[#1f2937]">No orders yet</h2>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Checkout cart dan request bespoke yang tersimpan akan muncul di sini.</p>
            </div>
          ) : null}
          {loading && !orders.length ? (
            <div className="mobile-card p-5 text-center text-xs font-bold text-[#6b7280]">Loading orders...</div>
          ) : null}
        </section>
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileOrdersPage;

