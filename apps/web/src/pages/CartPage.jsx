import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clipboard, CreditCard, MessageCircle, Minus, PackageCheck, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { useCart } from '@/hooks/useCart.js';
import {
  buildCheckoutDraft,
  buildOrderNotes,
  buildWhatsAppCheckoutUrl,
  checkoutPaymentOptions,
} from '@/services/cartService.js';
import { createDokuCheckout } from '@/services/dokuCheckoutService.js';
import { createOrder } from '@/services/orderService.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;

const CartPage = () => {
  const navigate = useNavigate();
  const { items, summary, updateQuantity, removeItem, clear } = useCart();
  const [customerName, setCustomerName] = useState('');
  const [contact, setContact] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryArea, setDeliveryArea] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Manual confirmation');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const checkoutDraft = useMemo(() => buildCheckoutDraft({
    customerName,
    contact,
    deliveryAddress,
    deliveryArea,
    paymentMethod,
    notes,
    items,
  }), [contact, customerName, deliveryAddress, deliveryArea, items, notes, paymentMethod]);

  const copyDraft = async () => {
    await navigator.clipboard.writeText(checkoutDraft);
    toast.success('Checkout draft copied');
  };

  const submitOrder = async ({ openWhatsApp = false, openDoku = false } = {}) => {
    if (!items.length) return;
    if (!customerName.trim() || !contact.trim() || !deliveryAddress.trim()) {
      toast.error('Customer name, contact, and address are required');
      return;
    }

    setSaving(true);
    const whatsappWindow = openWhatsApp ? window.open('about:blank', '_blank') : null;
    const dokuWindow = openDoku ? window.open('about:blank', '_blank') : null;
    try {
      const order = await createOrder({
        customerName,
        contact,
        notes: buildOrderNotes({ deliveryAddress, deliveryArea, paymentMethod, notes }),
        items,
        subtotal: summary.subtotal,
        quantity: summary.quantity,
        checkoutDraft,
        paymentProvider: openDoku ? 'doku' : openWhatsApp ? 'whatsapp' : 'manual',
      });
      if (openDoku) {
        const checkout = await createDokuCheckout({
          order,
          amount: summary.subtotal,
          customerName,
          contact,
        });
        clear();
        toast.success(`Order ${order.orderNumber} saved. Opening DOKU Checkout`);
        if (dokuWindow) {
          dokuWindow.location.href = checkout.paymentUrl;
        } else {
          window.location.href = checkout.paymentUrl;
          return;
        }
        navigate('/home');
        return;
      }
      clear();
      toast.success(`Order ${order.orderNumber} saved to Studio`);
      if (openWhatsApp) {
        const whatsappUrl = buildWhatsAppCheckoutUrl(`${checkoutDraft}\n\nStudio order: ${order.orderNumber}`);
        if (whatsappWindow) {
          whatsappWindow.location.href = whatsappUrl;
        } else {
          window.location.href = whatsappUrl;
          return;
        }
      }
      navigate('/home');
    } catch (error) {
      if (whatsappWindow) {
        whatsappWindow.close();
      }
      if (dokuWindow) {
        dokuWindow.close();
      }
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
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase text-[#263d27]">Checkout</div>
                <h1 className="mt-1 text-4xl font-bold">Cart</h1>
              </div>
              <div className="rounded-2xl border bg-white px-4 py-3 text-right">
                <div className="text-xs font-bold uppercase text-muted-foreground">Subtotal</div>
                <div className="text-xl font-bold">{formatTotal(summary.subtotal)}</div>
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
                    <Button type="button" size="icon" variant="outline" className="rounded-2xl bg-white" onClick={() => updateQuantity(item.slug, item.quantity - 1)}><Minus className="h-4 w-4" /></Button>
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
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="WhatsApp or email" className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                <textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Delivery address" rows={3} className="rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-[#263d27]" />
                <input value={deliveryArea} onChange={(event) => setDeliveryArea(event.target.value)} placeholder="City / area" className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="h-12 rounded-2xl border bg-white px-4 text-sm font-semibold outline-none focus:border-[#263d27]">
                  {checkoutPaymentOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery notes or request" rows={3} className="rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-[#263d27]" />
              </div>
              <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-[#f7f8f2] p-4 text-xs font-semibold leading-relaxed">{checkoutDraft}</pre>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" className="rounded-2xl gap-2" onClick={() => submitOrder({ openDoku: true })} disabled={saving}><CreditCard className="h-4 w-4" />{saving ? 'Saving...' : 'Pay with DOKU'}</Button>
                <Button type="button" className="rounded-2xl gap-2" onClick={() => submitOrder({ openWhatsApp: true })} disabled={saving}><MessageCircle className="h-4 w-4" />{saving ? 'Saving...' : 'Save & WhatsApp'}</Button>
                <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={() => submitOrder()} disabled={saving}><PackageCheck className="h-4 w-4" />Save manual</Button>
                <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={copyDraft}><Clipboard className="h-4 w-4" />Copy draft</Button>
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

