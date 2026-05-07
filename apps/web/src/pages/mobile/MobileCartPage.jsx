import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, CreditCard, Minus, PackageCheck, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.jsx';
import { useCart } from '@/hooks/useCart.js';
import {
  buildCheckoutDraft,
  buildOrderNotes,
} from '@/services/cartService.js';
import { createDokuCheckout } from '@/services/dokuCheckoutService.js';
import { lookupCheckoutCustomerByCode } from '@/services/customerService.js';
import { createOrder } from '@/services/orderService.js';
import {
  describeShippingRate,
  getCheckoutShippingWeight,
  getShippingRates,
  searchShippingDestinations,
} from '@/services/shippingService.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;

const formatCartSubtitle = (items, quantity) => {
  if (!items.length) return 'Cart is empty';
  const productNames = items.slice(0, 2).map((item) => item.name).join(', ');
  const remainingCount = Math.max(items.length - 2, 0);
  return remainingCount ? `${productNames} +${remainingCount} more` : `${quantity} item${quantity > 1 ? 's' : ''}: ${productNames}`;
};

const MobileCartPage = () => {
  const navigate = useNavigate();
  const { items, summary, updateQuantity, removeItem, clear } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(Boolean(items.length));
  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [contact, setContact] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryArea, setDeliveryArea] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [securityChallenge, setSecurityChallenge] = useState(null);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const paymentMethod = 'DOKU payment';
  const [destinationSearch, setDestinationSearch] = useState('');
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const shippingFee = Number(selectedShipping?.cost || 0);
  const totalDue = summary.subtotal + shippingFee;
  const shippingSummary = selectedShipping ? describeShippingRate(selectedShipping) : '';
  const shippingWeight = useMemo(() => getCheckoutShippingWeight(items), [items]);

  const checkoutDraft = useMemo(() => buildCheckoutDraft({
    customerCode,
    customerName,
    contact,
    deliveryAddress,
    deliveryArea,
    paymentMethod,
    shippingSummary,
    shippingFee,
    notes,
    items,
  }), [contact, customerCode, customerName, deliveryAddress, deliveryArea, items, notes, paymentMethod, shippingFee, shippingSummary]);

  const decreaseQuantity = (item) => {
    if (item.quantity <= 1) {
      removeItem(item.slug);
      return;
    }
    updateQuantity(item.slug, item.quantity - 1);
  };

  const applyCheckoutCustomer = (customer) => {
    setSecurityChallenge(null);
    setSecurityAnswer('');
    setCustomerCode(customer.customerCode);
    setCustomerName(customer.customerName);
    setContact(customer.contact);
    setDeliveryAddress(customer.deliveryAddress || '');
    setDeliveryArea(customer.deliveryArea || '');
    setDestinationSearch(customer.deliveryArea || '');
    toast.success(`${customer.customerCode} loaded`);
  };

  const searchDestinations = async () => {
    if (destinationSearch.trim().length < 3) {
      toast.error('Isi minimal 3 huruf area tujuan');
      return;
    }

    setShippingLoading(true);
    setShippingError('');
    setSelectedShipping(null);
    setShippingOptions([]);
    try {
      const destinations = await searchShippingDestinations(destinationSearch);
      setDestinationOptions(destinations);
      if (!destinations.length) {
        setShippingError('Area tujuan tidak ditemukan');
      }
    } catch (error) {
      setShippingError(error.message || 'Gagal mencari area tujuan');
    } finally {
      setShippingLoading(false);
    }
  };

  const loadShippingRates = async (destination) => {
    setDeliveryArea(destination.label);
    setDestinationSearch(destination.label);
    setShippingLoading(true);
    setShippingError('');
    setSelectedShipping(null);
    setShippingOptions([]);
    try {
      const rates = await getShippingRates({
        destinationId: destination.id,
        weight: shippingWeight,
      });
      setShippingOptions(rates);
      if (!rates.length) {
        setShippingError('Belum ada ongkir untuk area ini');
      }
    } catch (error) {
      setShippingError(error.message || 'Gagal menghitung ongkir');
    } finally {
      setShippingLoading(false);
    }
  };

  const lookupCustomer = async () => {
    if (!customerCode.trim()) {
      toast.error('Customer code is required');
      return;
    }

    setLookupLoading(true);
    const customer = await lookupCheckoutCustomerByCode(customerCode);
    setLookupLoading(false);
    if (!customer) {
      toast.error('Customer code not found');
      return;
    }

    if (customer.requiresSecurity) {
      setCustomerName('');
      setContact('');
      setDeliveryAddress('');
      setDeliveryArea('');
      setSecurityChallenge(customer);
      setSecurityAnswer('');
      setCustomerCode(customer.customerCode);
      toast.info('Security question is required');
      return;
    }

    applyCheckoutCustomer(customer);
  };

  const verifyCustomerSecurity = async () => {
    if (!securityChallenge?.customerCode || !securityAnswer.trim()) {
      toast.error('Security answer is required');
      return;
    }

    setLookupLoading(true);
    const customer = await lookupCheckoutCustomerByCode(securityChallenge.customerCode, securityAnswer);
    setLookupLoading(false);
    if (!customer || customer.requiresSecurity) {
      toast.error('Security answer is incorrect');
      return;
    }

    applyCheckoutCustomer(customer);
  };

  const copyCustomerCode = async () => {
    if (!submittedOrder?.customerCode) return;
    await navigator.clipboard.writeText(submittedOrder.customerCode);
    toast.success(`${submittedOrder.customerCode} copied`);
  };

  const submitOrder = async () => {
    if (!items.length) return;
    if (!customerName.trim() || !contact.trim() || !deliveryAddress.trim()) {
      toast.error('Name, contact, and address are required');
      return;
    }
    if (!selectedShipping) {
      toast.error('Pilih ekspedisi dulu');
      return;
    }

    setSaving(true);
    try {
      const order = await createOrder({
        customerName,
        customerCode,
        contact,
        deliveryAddress,
        deliveryArea,
        notes: buildOrderNotes({ deliveryAddress, deliveryArea, paymentMethod, shippingSummary, notes }),
        items,
        subtotal: totalDue,
        quantity: summary.quantity,
        checkoutDraft,
        paymentProvider: 'doku',
      });
      const checkout = await createDokuCheckout({
        order,
        amount: totalDue,
        customerName,
        contact,
        callbackPath: '/mobile/payment',
      });
      sessionStorage.setItem('solivagant:doku-payment', JSON.stringify({
        paymentUrl: checkout.paymentUrl,
        invoiceNumber: checkout.invoiceNumber || order.orderNumber,
        orderNumber: order.orderNumber,
        customerCode: order.customerCode || customerCode,
        amount: totalDue,
        customerName,
        createdAt: new Date().toISOString(),
      }));
      clear();
      setCheckoutOpen(false);
      setSubmittedOrder(order);
      toast.success(`Order ${order.orderNumber} saved. Customer code: ${order.customerCode || customerCode}`);
      navigate('/mobile/payment');
    } catch (error) {
      toast.error(error.message || 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileCommerceLayout>
      <Helmet>
        <title>Cart - Solivagant</title>
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Cart"
          subtitle={formatCartSubtitle(items, summary.quantity)}
          eyebrow="Checkout"
          onBack={() => navigate('/mobile/catalog')}
          action={<ShoppingBag className="h-5 w-5 text-amber-700" />}
        />

        {submittedOrder ? (
          <section className="mobile-soft-card border border-[#263d27]/15 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase text-amber-700">Order received</div>
                <h2 className="mt-1 text-lg font-bold text-[#1f2937]">{submittedOrder.orderNumber}</h2>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                  Data customer sudah masuk ke Studio. Simpan kode ini untuk order berikutnya tanpa isi ulang data.
                </p>
                <button type="button" onClick={copyCustomerCode} className="mt-3 w-full rounded-2xl bg-[#263d27] px-4 py-3 text-center text-lg font-bold tracking-[0.16em] text-[#eef2e8]">
                  {submittedOrder.customerCode || '-'}
                </button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/catalog')}>Shop again</Button>
                  <Button type="button" className="rounded-2xl" onClick={() => navigate(`/mobile/customer?code=${submittedOrder.customerCode}`)}>Track order</Button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mobile-soft-card p-4">
          <div className="text-[10px] font-bold uppercase text-amber-700">Subtotal</div>
          <div className="mt-1 text-3xl font-bold text-[#1f2937]">{formatTotal(totalDue)}</div>
          {shippingFee ? <p className="mt-1 text-xs font-bold text-[#263d27]">Termasuk ongkir {formatTotal(shippingFee)}</p> : null}
          {items.length ? (
            <div className="mt-3 grid gap-2">
              {items.slice(0, 3).map((item) => (
                <div key={item.slug} className="flex items-center justify-between gap-3 rounded-2xl border border-[#263d27]/10 bg-white/70 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#1f2937]">{item.name}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase text-[#8b949e]">{item.size} / x{item.quantity}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-[#263d27]">{formatTotal(Number(item.priceNumber || 0) * Number(item.quantity || 0))}</span>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-xs font-semibold text-[#6b7280]">Checkout tersimpan ke Studio, lalu pembayaran dibuka di halaman Solivagant.</p>
          {items.length ? (
            <Button type="button" className="mt-4 h-12 w-full rounded-2xl gap-2" onClick={() => setCheckoutOpen(true)}>
              <PackageCheck className="h-4 w-4" />
              Review checkout
            </Button>
          ) : null}
        </section>

        <section className="space-y-3">
          {items.map((item) => (
            <article key={item.slug} className="mobile-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-[#1f2937]">{item.name}</h2>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280]">{item.notes}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase text-amber-700">{item.price} · {item.size}</p>
                </div>
                <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeItem(item.slug)} aria-label={`Remove ${item.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl bg-white" onClick={() => decreaseQuantity(item)} aria-label={`Decrease ${item.name}`}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="grid h-10 min-w-12 place-items-center rounded-2xl bg-[#f8f7f4] text-sm font-bold text-[#1f2937]">{item.quantity}</span>
                <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl bg-white" onClick={() => updateQuantity(item.slug, item.quantity + 1)} aria-label={`Increase ${item.name}`}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
          {!items.length ? (
            <div className="mobile-card p-5 text-center">
              <ShoppingBag className="mx-auto h-8 w-8 text-amber-700" />
              <h2 className="mt-3 text-base font-bold text-[#1f2937]">Cart is empty</h2>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Add a perfume from the catalog first.</p>
              <Button className="mt-4 rounded-2xl" onClick={() => navigate('/mobile/catalog')}>Open catalog</Button>
            </div>
          ) : null}
        </section>

        <Link to="/mobile/catalog" className="mobile-card flex items-center justify-between p-3 text-sm font-bold text-[#1f2937]">
          Continue shopping
          <ShoppingBag className="h-4 w-4 text-amber-700" />
        </Link>

        <Sheet open={checkoutOpen && Boolean(items.length)} onOpenChange={setCheckoutOpen}>
          <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-[28px] border-0 bg-[#fbfaf7] p-4">
            <SheetHeader className="pr-8 text-left">
              <SheetTitle>Checkout</SheetTitle>
              <SheetDescription>{formatCartSubtitle(items, summary.quantity)} / {formatTotal(totalDue)}</SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-3">
              <section className="mobile-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-[#1f2937]">Products in cart</h2>
                  <span className="text-xs font-bold text-amber-700">{summary.quantity} item{summary.quantity > 1 ? 's' : ''}</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {items.map((item) => (
                    <div key={item.slug} className="rounded-2xl border border-[#263d27]/10 bg-[#f8f7f4] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-[#1f2937]">{item.name}</h3>
                          <p className="mt-1 text-xs font-semibold leading-snug text-[#6b7280]">{item.notes}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase text-amber-700">{item.size} / {item.price}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="mt-2 text-xs font-bold text-[#1f2937]">{formatTotal(Number(item.priceNumber || 0) * Number(item.quantity || 0))}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-2xl border border-[#263d27]/10 bg-white p-1">
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-[#263d27]" onClick={() => decreaseQuantity(item)} aria-label={`Decrease ${item.name}`}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="grid h-8 min-w-10 place-items-center text-sm font-bold text-[#1f2937]">{item.quantity}</span>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-[#263d27]" onClick={() => updateQuantity(item.slug, item.quantity + 1)} aria-label={`Increase ${item.name}`}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button type="button" size="sm" variant="ghost" className="h-9 rounded-2xl px-3 text-xs font-bold text-rose-700" onClick={() => removeItem(item.slug)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mobile-card p-3">
                <h2 className="text-sm font-bold text-[#1f2937]">Customer</h2>
                <div className="mt-3 grid gap-2">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input value={customerCode} onChange={(event) => { setCustomerCode(event.target.value.toUpperCase()); setSecurityChallenge(null); setSecurityAnswer(''); }} placeholder="Customer code, e.g. SOLI09232" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold uppercase outline-none focus:border-amber-300" />
                    <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={lookupCustomer} disabled={lookupLoading}>{lookupLoading ? '...' : 'Load'}</Button>
                  </div>
                  <p className="rounded-2xl bg-[#f8f7f4] px-3 py-2 text-[11px] font-semibold leading-relaxed text-[#6b7280]">
                    Customer baru bisa kosongkan kode. Setelah checkout, Solivagant akan membuat kode unik untuk order berikutnya.
                  </p>
                  {securityChallenge ? (
                    <div className="rounded-2xl border border-[#263d27]/10 bg-[#eef2e8] p-3">
                      <div className="text-[10px] font-bold uppercase text-[#263d27]">Security question</div>
                      <p className="mt-1 text-sm font-bold text-[#1f2937]">{securityChallenge.securityQuestion}</p>
                      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                        <input value={securityAnswer} onChange={(event) => setSecurityAnswer(event.target.value)} placeholder="Answer" className="h-11 rounded-2xl border border-[#d7dfd0] bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                        <Button type="button" className="h-11 rounded-2xl px-4 text-xs font-bold" onClick={verifyCustomerSecurity} disabled={lookupLoading}>{lookupLoading ? '...' : 'Verify'}</Button>
                      </div>
                    </div>
                  ) : null}
                  <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="WhatsApp or email" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  <textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Delivery address" rows={3} className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input value={destinationSearch} onChange={(event) => { setDestinationSearch(event.target.value); setDeliveryArea(event.target.value); setSelectedShipping(null); setShippingOptions([]); }} placeholder="City / district" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                    <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={searchDestinations} disabled={shippingLoading}>{shippingLoading ? '...' : 'Cari'}</Button>
                  </div>
                  {destinationOptions.length ? (
                    <div className="grid gap-2">
                      {destinationOptions.map((destination) => (
                        <button key={destination.id} type="button" onClick={() => loadShippingRates(destination)} className="rounded-2xl border border-[#263d27]/10 bg-[#f8f7f4] px-3 py-2 text-left text-xs font-bold text-[#263d27]">
                          {destination.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {shippingOptions.length ? (
                    <div className="grid gap-2">
                      <div className="text-[10px] font-bold uppercase text-amber-700">Pilih ekspedisi</div>
                      {shippingOptions.map((rate) => {
                        const active = selectedShipping?.courierCode === rate.courierCode && selectedShipping?.service === rate.service;
                        return (
                          <button key={`${rate.courierCode}-${rate.service}-${rate.cost}`} type="button" onClick={() => setSelectedShipping(rate)} className={`rounded-2xl border px-3 py-3 text-left transition ${active ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-white'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-bold text-[#1f2937]">{rate.courierName} {rate.service}</span>
                              <span className="text-sm font-bold text-[#263d27]">{formatTotal(rate.cost)}</span>
                            </div>
                            <p className="mt-1 text-[11px] font-semibold text-[#6b7280]">{rate.etd ? `ETA ${rate.etd}` : rate.description || 'Estimasi mengikuti kurir'}</p>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {shippingError ? <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">{shippingError}</p> : null}
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery notes or request" rows={2} className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
                </div>
              </section>

              <section className="mobile-card p-3">
                <div className="flex items-center justify-between text-sm font-bold text-[#1f2937]">
                  <span>Subtotal</span>
                  <span>{formatTotal(summary.subtotal)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm font-bold text-[#1f2937]">
                  <span>Ongkir</span>
                  <span>{shippingFee ? formatTotal(shippingFee) : '-'}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#263d27]/10 pt-3 text-base font-bold text-[#263d27]">
                  <span>Total bayar</span>
                  <span>{formatTotal(totalDue)}</span>
                </div>
              </section>

              <div className="grid gap-2">
                <Button type="button" className="h-12 w-full rounded-2xl gap-2" onClick={submitOrder} disabled={saving}>
                  <CreditCard className="h-4 w-4" />
                  {saving ? 'Memproses...' : 'Bayar sekarang'}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileCartPage;
