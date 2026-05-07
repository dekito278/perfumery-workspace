import React from 'react';
import { Helmet } from 'react-helmet';
import { Clipboard, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useCustomers } from '@/hooks/useCustomers.js';

const formatDate = (value) => (
  value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '-'
);

const MobileCustomersPage = () => {
  const { customers, summary, loading } = useCustomers();

  const copyCode = async (customer) => {
    await navigator.clipboard.writeText(customer.customerCode);
    toast.success(`${customer.customerCode} copied`);
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet>
        <title>Customers - Solivagant Studio</title>
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Customers"
          subtitle={`${summary.total} records / ${summary.repeat} repeat`}
          eyebrow="E-commerce"
          action={<UsersRound className="h-5 w-5 text-amber-700" />}
        />

        <section className="mobile-soft-card grid grid-cols-2 gap-3 p-4">
          <div>
            <div className="text-[10px] font-bold uppercase text-amber-700">Customer code</div>
            <div className="mt-1 text-sm font-bold text-[#1f2937]">SOLIxxxxx</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-amber-700">Linked orders</div>
            <div className="mt-1 text-lg font-bold text-[#1f2937]">{summary.orders}</div>
          </div>
        </section>

        <section className="space-y-3">
          {customers.map((customer) => (
            <article key={customer.id || customer.customerCode} className="mobile-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-[#1f2937]">{customer.customerName}</h2>
                    {customer.persistence === 'local' ? <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase text-stone-600">Local</span> : null}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280]">{customer.contact}</p>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280]">{customer.deliveryArea || customer.deliveryAddress || 'No address saved'}</p>
                </div>
                <button type="button" onClick={() => copyCode(customer)} className="shrink-0 rounded-2xl bg-[#263d27] px-3 py-2 text-xs font-bold text-[#eef2e8]">
                  {customer.customerCode}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-[#f8f7f4] p-3 text-xs font-semibold text-[#6b7280]">
                <p><strong className="block text-[10px] uppercase text-[#263d27]">Orders</strong>{customer.orderCount}</p>
                <p><strong className="block text-[10px] uppercase text-[#263d27]">Last order</strong>{formatDate(customer.lastOrderAt)}</p>
              </div>
              <Button type="button" variant="outline" className="mt-3 w-full rounded-2xl gap-2 bg-white" onClick={() => copyCode(customer)}>
                <Clipboard className="h-4 w-4" />
                Copy customer code
              </Button>
            </article>
          ))}
          {!customers.length && !loading ? (
            <div className="mobile-card p-5 text-center">
              <UsersRound className="mx-auto h-8 w-8 text-amber-700" />
              <h2 className="mt-3 text-base font-bold text-[#1f2937]">No customers yet</h2>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Customer dari checkout dan bespoke request akan muncul di sini.</p>
            </div>
          ) : null}
          {loading && !customers.length ? (
            <div className="mobile-card p-5 text-center text-xs font-bold text-[#6b7280]">Loading customers...</div>
          ) : null}
        </section>
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileCustomersPage;
