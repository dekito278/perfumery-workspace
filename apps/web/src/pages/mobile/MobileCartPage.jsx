import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Clipboard, CreditCard, MessageCircle, Minus, PackageCheck, Plus, ShoppingBag, Trash2 } from 'lucide-react';
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
  buildWhatsAppCheckoutUrl,
  checkoutPaymentOptions,
} from '@/services/cartService.js';
import { createDokuCheckout } from '@/services/dokuCheckoutService.js';
import { createOrder } from '@/services/orderService.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;

const MobileCartPage = () => {
  const navigate = useNavigate();
  const { items, summary, updateQuantity, removeItem, clear } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(Boolean(items.length));
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
      toast.error('Name, contact, and address are required');
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
        setCheckoutOpen(false);
        toast.success(`Order ${order.orderNumber} saved. Opening DOKU Checkout`);
        if (dokuWindow) {
          dokuWindow.location.href = checkout.paymentUrl;
        } else {
          window.location.href = checkout.paymentUrl;
          return;
        }
        navigate('/mobile/dashboard');
        return;
      }
      clear();
      setCheckoutOpen(false);
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
      navigate('/mobile/dashboard');
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
    <MobileCommerceLayout>
      <Helmet>
        <title>Cart - Solivagant</title>
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Cart"
          subtitle={`${summary.quantity} items`}
          eyebrow="Checkout"
          onBack={() => navigate('/mobile/catalog')}
          action={<ShoppingBag className="h-5 w-5 text-amber-700" />}
        />

        <section className="mobile-soft-card p-4">
          <div className="text-[10px] font-bold uppercase text-amber-700">Subtotal</div>
          <div className="mt-1 text-3xl font-bold text-[#1f2937]">{formatTotal(summary.subtotal)}</div>
          <p className="mt-2 text-xs font-semibold text-[#6b7280]">Checkout tersimpan ke order queue studio. Pembayaran diproses sebagai manual confirmation sampai payment link aktif.</p>
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
                <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl bg-white" onClick={() => updateQuantity(item.slug, item.quantity - 1)} aria-label={`Decrease ${item.name}`}>
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
              <SheetDescription>{summary.quantity} items / {formatTotal(summary.subtotal)}</SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-3">
              <section className="mobile-card p-3">
                <h2 className="text-sm font-bold text-[#1f2937]">Customer</h2>
                <div className="mt-3 grid gap-2">
                  <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="WhatsApp or email" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  <textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Delivery address" rows={3} className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  <input value={deliveryArea} onChange={(event) => setDeliveryArea(event.target.value)} placeholder="City / area" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                  <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="h-12 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300">
                    {checkoutPaymentOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery notes or request" rows={2} className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
                </div>
              </section>

              <section className="mobile-card p-3">
                <h2 className="text-sm font-bold text-[#1f2937]">Draft</h2>
                <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl bg-[#f8f7f4] p-3 text-xs font-semibold leading-relaxed text-[#1f2937]">{checkoutDraft}</pre>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="rounded-2xl gap-2 bg-white" onClick={copyDraft}><Clipboard className="h-4 w-4" />Copy</Button>
                  <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={() => { clear(); setCheckoutOpen(false); }}>Clear</Button>
                </div>
              </section>

              <div className="grid gap-2">
                <Button type="button" className="h-12 w-full rounded-2xl gap-2" onClick={() => submitOrder({ openDoku: true })} disabled={saving}>
                  <CreditCard className="h-4 w-4" />
                  {saving ? 'Saving order...' : 'Pay with DOKU'}
                </Button>
                <Button type="button" className="h-12 w-full rounded-2xl gap-2" onClick={() => submitOrder({ openWhatsApp: true })} disabled={saving}>
                  <MessageCircle className="h-4 w-4" />
                  {saving ? 'Saving order...' : 'Save & WhatsApp'}
                </Button>
                <Button type="button" variant="outline" className="h-12 w-full rounded-2xl gap-2 bg-white" onClick={() => submitOrder()} disabled={saving}>
                  <PackageCheck className="h-4 w-4" />
                  Save manual order
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

