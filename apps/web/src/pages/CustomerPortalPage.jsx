import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, PackageCheck, Search, ShoppingBag, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { getCustomerPortalByCode } from '@/services/customerService.js';
import { getOrderStatusLabels } from '@/services/orderService.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-');

const statusLabels = getOrderStatusLabels();

const statusSteps = ['pending_payment', 'paid', 'processing', 'shipped', 'completed'];

const getActiveStep = (status) => {
  if (status === 'cancelled') return -1;
  const index = statusSteps.indexOf(status);
  return index >= 0 ? index : 0;
};

const CustomerPortalPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  const [customerCode, setCustomerCode] = useState(initialCode.toUpperCase());
  const [portal, setPortal] = useState(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const latestOrder = portal?.orders?.[0];
  const activeOrders = useMemo(() => (
    portal?.orders?.filter((order) => !['completed', 'cancelled'].includes(order.status)) || []
  ), [portal]);

  const loadPortalForCode = async (code) => {
    if (!code.trim()) {
      toast.error('Customer code is required');
      return;
    }

    setLoading(true);
    setSearched(true);
    const result = await getCustomerPortalByCode(code);
    setLoading(false);

    if (!result) {
      setPortal(null);
      toast.error('Customer code not found');
      return;
    }

    setPortal(result);
    setCustomerCode(result.customer.customerCode);
    setSearchParams({ code: result.customer.customerCode });
    toast.success(`${result.customer.customerCode} loaded`);
  };

  useEffect(() => {
    if (initialCode) {
      loadPortalForCode(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPortal = async (event) => {
    event?.preventDefault();
    await loadPortalForCode(customerCode);
  };

  const copyCode = async () => {
    if (!portal?.customer?.customerCode) return;
    await navigator.clipboard.writeText(portal.customer.customerCode);
    toast.success(`${portal.customer.customerCode} copied`);
  };

  return (
    <>
      <Helmet>
        <title>Customer Dashboard - Solivagant</title>
        <meta name="description" content="Check Solivagant order progress with a customer code." />
      </Helmet>
      <main className="min-h-screen bg-[#f7f8f2] text-[#0b130c]">
        <section className="border-b border-[#263d27]/15 bg-[#050705] text-[#eef2e8]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/home" className="inline-flex items-center gap-2 text-sm font-bold text-[#eef2e8]"><ArrowLeft className="h-4 w-4" />Home</Link>
            <Link to="/catalog" className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-[#eef2e8]">Shop</Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div className="space-y-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#263d27]/15 bg-white px-3 py-1 text-xs font-bold uppercase text-[#263d27]">
                <UserRound className="h-4 w-4" />
                Customer portal
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">Cek order dengan kode unik.</h1>
              <p className="mt-4 text-base font-medium leading-relaxed text-muted-foreground">
                Masukkan kode seperti SOLI09232 untuk melihat data customer, status order, dan proses pesanan tanpa username atau password.
              </p>
            </div>

            <form onSubmit={loadPortal} className="rounded-2xl border bg-white p-4 shadow-sm">
              <label className="text-xs font-bold uppercase text-muted-foreground">Customer code</label>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={customerCode}
                  onChange={(event) => setCustomerCode(event.target.value.toUpperCase())}
                  placeholder="SOLI09232"
                  className="h-12 rounded-2xl border px-4 text-sm font-bold uppercase tracking-[0.08em] outline-none focus:border-[#263d27]"
                />
                <Button type="submit" className="h-12 rounded-2xl gap-2" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Check
                </Button>
              </div>
              <p className="mt-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                Kode ini diberikan setelah checkout pertama. Simpan untuk order berikutnya.
              </p>
            </form>
          </div>

          <div className="space-y-4">
            {portal ? (
              <>
                <section className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase text-[#263d27]">Welcome back</div>
                      <h2 className="mt-1 text-2xl font-bold">{portal.customer.customerName}</h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">{portal.customer.contact}</p>
                    </div>
                    <button type="button" onClick={copyCode} className="rounded-2xl bg-[#263d27] px-5 py-4 text-center text-xl font-bold tracking-[0.16em] text-[#eef2e8]">
                      {portal.customer.customerCode}
                    </button>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-[#f7f8f2] p-4">
                      <div className="text-xs font-bold uppercase text-muted-foreground">Orders</div>
                      <div className="mt-1 text-2xl font-bold">{portal.orders.length}</div>
                    </div>
                    <div className="rounded-2xl bg-[#f7f8f2] p-4">
                      <div className="text-xs font-bold uppercase text-muted-foreground">Active</div>
                      <div className="mt-1 text-2xl font-bold">{activeOrders.length}</div>
                    </div>
                    <div className="rounded-2xl bg-[#f7f8f2] p-4">
                      <div className="text-xs font-bold uppercase text-muted-foreground">Latest</div>
                      <div className="mt-1 text-sm font-bold">{latestOrder ? statusLabels[latestOrder.status] || latestOrder.status : '-'}</div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-bold">Order progress</h2>
                  <div className="mt-4 grid gap-4">
                    {portal.orders.map((order) => {
                      const activeStep = getActiveStep(order.status);
                      return (
                        <article key={order.orderNumber} className="rounded-2xl border bg-[#fbfaf7] p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-bold">{order.orderNumber}</h3>
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase text-amber-800">{statusLabels[order.status] || order.status}</span>
                              </div>
                              <p className="mt-1 text-sm font-semibold text-muted-foreground">{formatDate(order.createdAt)}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold uppercase text-muted-foreground">{order.quantity} items</div>
                              <div className="text-lg font-bold">{formatTotal(order.subtotal)}</div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2">
                            {order.items.map((item) => (
                              <div key={`${order.orderNumber}-${item.slug || item.name}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold">
                                <span className="min-w-0 truncate">{item.name} x{item.quantity}</span>
                                <span className="shrink-0 text-amber-700">{item.price || '-'}</span>
                              </div>
                            ))}
                          </div>

                          <div className="mt-5 grid grid-cols-5 gap-2">
                            {statusSteps.map((step, index) => {
                              const done = activeStep >= index;
                              return (
                                <div key={step} className="min-w-0">
                                  <div className={`h-2 rounded-full ${done ? 'bg-[#263d27]' : 'bg-stone-200'}`} />
                                  <div className={`mt-2 truncate text-[10px] font-bold uppercase ${done ? 'text-[#263d27]' : 'text-muted-foreground'}`}>
                                    {statusLabels[step] || step}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
                    {!portal.orders.length ? (
                      <div className="rounded-2xl border border-dashed bg-[#fbfaf7] p-8 text-center">
                        <PackageCheck className="mx-auto h-8 w-8 text-amber-700" />
                        <h3 className="mt-3 font-bold">No orders yet</h3>
                        <p className="mt-1 text-sm font-medium text-muted-foreground">Order baru akan muncul setelah checkout.</p>
                      </div>
                    ) : null}
                  </div>
                </section>
              </>
            ) : (
              <section className="rounded-2xl border border-dashed bg-white p-8 text-center">
                {searched ? <Search className="mx-auto h-8 w-8 text-amber-700" /> : <ShoppingBag className="mx-auto h-8 w-8 text-amber-700" />}
                <h2 className="mt-3 text-xl font-bold">{searched ? 'Customer code not found' : 'Your dashboard appears here'}</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {searched ? 'Cek lagi kode SOLI yang kamu masukkan.' : 'Masukkan customer code untuk melihat progres order.'}
                </p>
              </section>
            )}
          </div>
        </section>
      </main>
    </>
  );
};

export default CustomerPortalPage;
