import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CreditCard, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
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

const CartPage = () => {
  const navigate = useNavigate();
  const { items, summary, updateQuantity, removeItem, clear } = useCart();
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
      toast.error('Customer name, contact, and address are required');
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
        callbackPath: '/payment',
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
      setSubmittedOrder(order);
      toast.success(`Order ${order.orderNumber} saved. Customer code: ${order.customerCode || customerCode}`);
      navigate('/payment');
    } catch (error) {
      toast.error(error.message || 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Cart - Solivagant</title>
      </Helmet>
      <main className="min-h-screen bg-[#f7f8f2] text-[#0b130c]">
        <section className="border-b border-[#263d27]/15 bg-[#050705] text-[#eef2e8]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-bold text-[#eef2e8]"><ArrowLeft className="h-4 w-4" />Catalog</Link>
            <Link to="/home" className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-[#eef2e8]">Home</Link>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:px-8">
          <div>
            {submittedOrder ? (
              <section className="mb-6 rounded-2xl border border-[#263d27]/15 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-xs font-bold uppercase text-[#263d27]">Order received</div>
                      <h2 className="mt-1 text-2xl font-bold">{submittedOrder.orderNumber}</h2>
                      <p className="mt-2 max-w-xl text-sm font-semibold leading-relaxed text-muted-foreground">
                        Data customer sudah masuk ke Studio. Simpan kode ini untuk order berikutnya tanpa isi ulang data.
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={copyCustomerCode} className="rounded-2xl bg-[#263d27] px-5 py-4 text-center text-xl font-bold tracking-[0.16em] text-[#eef2e8]">
                    {submittedOrder.customerCode || '-'}
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link to="/catalog" className="inline-flex h-11 items-center rounded-2xl border bg-white px-5 text-sm font-bold">Shop again</Link>
                  <Link to={`/customer?code=${submittedOrder.customerCode}`} className="inline-flex h-11 items-center rounded-2xl bg-[#263d27] px-5 text-sm font-bold text-[#eef2e8]">Track order</Link>
                </div>
              </section>
            ) : null}

            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase text-[#263d27]">Checkout</div>
                <h1 className="mt-1 text-4xl font-bold">Cart</h1>
              </div>
              <div className="rounded-2xl border bg-white px-4 py-3 text-right">
                <div className="text-xs font-bold uppercase text-muted-foreground">Subtotal</div>
                <div className="text-xl font-bold">{formatTotal(totalDue)}</div>
                {shippingFee ? <div className="text-xs font-bold text-[#263d27]">Ongkir {formatTotal(shippingFee)}</div> : null}
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              {items.map((item) => (
                <article key={item.slug} className="rounded-2xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold">{item.name}</h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">{item.notes}</p>
                      <p className="mt-1 text-xs font-bold uppercase text-[#263d27]">{item.price} · {item.size}</p>
                    </div>
                    <Button type="button" size="icon" variant="outline" className="rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeItem(item.slug)} aria-label={`Remove ${item.name}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Button type="button" size="icon" variant="outline" className="rounded-2xl bg-white" onClick={() => decreaseQuantity(item)}><Minus className="h-4 w-4" /></Button>
                    <span className="grid h-10 min-w-12 place-items-center rounded-2xl bg-[#f7f8f2] text-sm font-bold">{item.quantity}</span>
                    <Button type="button" size="icon" variant="outline" className="rounded-2xl bg-white" onClick={() => updateQuantity(item.slug, item.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </article>
              ))}
              {!items.length ? (
                <div className="rounded-2xl border bg-white p-8 text-center">
                  <ShoppingBag className="mx-auto h-8 w-8 text-[#263d27]" />
                  <h2 className="mt-3 text-xl font-bold">Cart is empty</h2>
                  <Link to="/catalog" className="mt-4 inline-flex h-11 items-center rounded-2xl bg-[#263d27] px-5 text-sm font-bold text-[#eef2e8]">Open catalog</Link>
                </div>
              ) : null}
            </div>
          </div>

          {items.length ? (
            <aside className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold">Checkout</h2>
              <div className="mt-4 grid gap-3">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input value={customerCode} onChange={(event) => { setCustomerCode(event.target.value.toUpperCase()); setSecurityChallenge(null); setSecurityAnswer(''); }} placeholder="Customer code, e.g. SOLI09232" className="h-12 rounded-2xl border px-4 text-sm font-semibold uppercase outline-none focus:border-[#263d27]" />
                  <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-sm font-bold" onClick={lookupCustomer} disabled={lookupLoading}>{lookupLoading ? '...' : 'Load'}</Button>
                </div>
                <p className="rounded-2xl bg-[#f7f8f2] px-4 py-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                  Customer baru bisa kosongkan kode. Setelah checkout, Solivagant akan membuat kode unik untuk order berikutnya.
                </p>
                {securityChallenge ? (
                  <div className="rounded-2xl border border-[#263d27]/10 bg-[#eef2e8] p-4">
                    <div className="text-xs font-bold uppercase text-[#263d27]">Security question</div>
                    <p className="mt-1 text-sm font-bold">{securityChallenge.securityQuestion}</p>
                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                      <input value={securityAnswer} onChange={(event) => setSecurityAnswer(event.target.value)} placeholder="Answer" className="h-12 rounded-2xl border bg-white px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                      <Button type="button" className="h-12 rounded-2xl px-4 text-sm font-bold" onClick={verifyCustomerSecurity} disabled={lookupLoading}>{lookupLoading ? '...' : 'Verify'}</Button>
                    </div>
                  </div>
                ) : null}
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="WhatsApp or email" className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                <textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Delivery address" rows={3} className="rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-[#263d27]" />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input value={destinationSearch} onChange={(event) => { setDestinationSearch(event.target.value); setDeliveryArea(event.target.value); setSelectedShipping(null); setShippingOptions([]); }} placeholder="City / district" className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                  <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-sm font-bold" onClick={searchDestinations} disabled={shippingLoading}>{shippingLoading ? '...' : 'Cari'}</Button>
                </div>
                {destinationOptions.length ? (
                  <div className="grid gap-2">
                    {destinationOptions.map((destination) => (
                      <button key={destination.id} type="button" onClick={() => loadShippingRates(destination)} className="rounded-2xl border border-[#263d27]/10 bg-[#f7f8f2] px-4 py-3 text-left text-sm font-bold text-[#263d27]">
                        {destination.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {shippingOptions.length ? (
                  <div className="grid gap-2">
                    <div className="text-xs font-bold uppercase text-[#263d27]">Pilih ekspedisi</div>
                    {shippingOptions.map((rate) => {
                      const active = selectedShipping?.courierCode === rate.courierCode && selectedShipping?.service === rate.service;
                      return (
                        <button key={`${rate.courierCode}-${rate.service}-${rate.cost}`} type="button" onClick={() => setSelectedShipping(rate)} className={`rounded-2xl border px-4 py-3 text-left transition ${active ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-white'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-bold">{rate.courierName} {rate.service}</span>
                            <span className="text-sm font-bold text-[#263d27]">{formatTotal(rate.cost)}</span>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">{rate.etd ? `ETA ${rate.etd}` : rate.description || 'Estimasi mengikuti kurir'}</p>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {shippingError ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">{shippingError}</p> : null}
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery notes or request" rows={3} className="rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-[#263d27]" />
              </div>
              <div className="mt-4 rounded-2xl bg-[#f7f8f2] p-4">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Subtotal</span>
                  <span>{formatTotal(summary.subtotal)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm font-bold">
                  <span>Ongkir</span>
                  <span>{shippingFee ? formatTotal(shippingFee) : '-'}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#263d27]/10 pt-3 text-lg font-bold text-[#263d27]">
                  <span>Total bayar</span>
                  <span>{formatTotal(totalDue)}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" className="h-12 rounded-2xl gap-2 px-5" onClick={submitOrder} disabled={saving}><CreditCard className="h-4 w-4" />{saving ? 'Memproses...' : 'Bayar sekarang'}</Button>
                <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={clear}>Clear</Button>
              </div>
            </aside>
          ) : null}
        </section>
      </main>
    </>
  );
};

export default CartPage;

