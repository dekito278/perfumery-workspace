import React from 'react';
import { Helmet } from 'react-helmet';
import { Clipboard, PackageCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useOrders } from '@/hooks/useOrders.js';
import { getOrderStatusLabels } from '@/services/orderService.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
const formatDate = (value) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const statusLabels = getOrderStatusLabels();

const MobileOrdersPage = () => {
  const { orders, summary, loading, updateStatus, deleteOne } = useOrders();

  const copyOrder = async (order) => {
    await navigator.clipboard.writeText(order.checkoutDraft);
    toast.success(`${order.orderNumber} copied`);
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet>
        <title>Orders - Solivagant Studio</title>
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

        <section className="space-y-3">
          {orders.map((order) => (
            <article key={order.id} className="mobile-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-[#1f2937]">{order.orderNumber}</h2>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280]">{formatDate(order.createdAt)}</p>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280]">{order.customerName} / {order.contact}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase text-amber-800">{statusLabels[order.status] || order.status}</span>
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
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#6b7280]">{order.quantity} items</div>
                  <div className="text-base font-bold text-[#1f2937]">{formatTotal(order.subtotal)}</div>
                </div>
                <select value={order.status} onChange={(event) => updateStatus(order.id, event.target.value)} className="h-10 rounded-2xl border border-[#e5e7eb] bg-white px-2 text-xs font-bold outline-none focus:border-amber-300">
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={() => copyOrder(order)}><Clipboard className="h-4 w-4" />Copy</Button>
                <Button type="button" variant="outline" className="rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => deleteOne(order.id)}><Trash2 className="h-4 w-4" />Delete</Button>
              </div>
            </article>
          ))}
          {!orders.length && !loading ? (
            <div className="mobile-card p-5 text-center">
              <PackageCheck className="mx-auto h-8 w-8 text-amber-700" />
              <h2 className="mt-3 text-base font-bold text-[#1f2937]">No orders yet</h2>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Save checkout dari cart untuk membuat order pertama.</p>
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

