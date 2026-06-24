import React from 'react';
import { Helmet } from 'react-helmet';
import { Clipboard, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useCustomers } from '@/hooks/useCustomers.js';

const formatDate = (value) => (
  value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '-'
);

const CustomersPage = () => {
  const { customers, summary, loading } = useCustomers();

  const copyCode = async (customer) => {
    await navigator.clipboard.writeText(customer.customerCode);
    toast.success(`${customer.customerCode} disalin`);
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Customer - Solivagant</title>
        <meta name="description" content="Kelola customer Solivagant dan kode repeat order." />
      </Helmet>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <UsersRound className="h-4 w-4 text-primary" />
              Customer toko
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Kode customer</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Setiap customer checkout dibuatkan kode unik. Saat order berikutnya, customer cukup masukkan kode seperti SOLI09232 agar data mereka terisi otomatis.
            </p>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Customer</span><strong>{summary.total}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Repeat</span><strong>{summary.repeat}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Order terhubung</span><strong>{summary.orders}</strong></div>
          </div>
        </div>

        <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Customer</h2>
            <span className="text-sm font-bold text-amber-700">Format kode: SOLIxxxxx</span>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border">
            <div className="hidden grid-cols-[1fr_1fr_1fr_0.6fr_0.8fr_auto] gap-3 bg-[#fffaf0] px-4 py-3 text-xs font-bold uppercase text-muted-foreground lg:grid">
              <span>Customer</span>
              <span>Kontak</span>
              <span>Alamat</span>
              <span>Order</span>
              <span>Order terakhir</span>
              <span>Kode</span>
            </div>
            {customers.map((customer) => (
              <article key={customer.id || customer.customerCode} className="grid gap-3 border-t bg-white px-4 py-4 text-sm font-semibold lg:grid-cols-[1fr_1fr_1fr_0.6fr_0.8fr_auto] lg:items-center">
                <div>
                  <div className="font-bold text-[#1b1a16]">{customer.customerName}</div>
                  {customer.persistence === 'local' ? <div className="mt-1 text-xs font-bold uppercase text-stone-500">Fallback lokal</div> : null}
                </div>
                <div className="text-muted-foreground">{customer.contact}</div>
                <div className="text-muted-foreground">{customer.deliveryAddress || customer.deliveryArea || '-'}</div>
                <div>{customer.orderCount}</div>
                <div className="text-muted-foreground">{formatDate(customer.lastOrderAt)}</div>
                <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={() => copyCode(customer)}>
                  <Clipboard className="h-4 w-4" />
                  {customer.customerCode}
                </Button>
              </article>
            ))}
            {!customers.length && !loading ? (
              <div className="bg-white p-8 text-center">
                <UsersRound className="mx-auto h-8 w-8 text-amber-700" />
                <h3 className="mt-3 font-bold">Belum ada customer</h3>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Customer dari checkout dan bespoke request yang tersimpan akan muncul di sini.</p>
              </div>
            ) : null}
            {loading && !customers.length ? (
              <div className="bg-white p-8 text-center text-sm font-bold text-muted-foreground">Memuat customer...</div>
            ) : null}
          </div>
        </section>
      </div>
    </AuthenticatedLayout>
  );
};

export default CustomersPage;
