import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Check, CreditCard, Minus, Plus, ShoppingBag } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import { useCart } from '@/hooks/useCart.js';
import { checkoutCourierOptions, useCheckoutFlow } from '@/hooks/useCheckoutFlow.js';
import { checkoutPaymentMethods } from '@/services/cartService.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
const courierLabels = { jnt: 'JnT', ide: 'IDEXPRES', pos: 'POS', anteraja: 'ANTERAJA', jne: 'JNE' };

const CheckoutProgress = ({ steps }) => {
  const currentIndex = Math.max(steps.findIndex((step) => !step.complete), 0);
  const currentStep = steps[currentIndex] || steps[steps.length - 1];
  const completedCount = steps.filter((step) => step.complete).length;
  const progressPercent = Math.min(Math.max((completedCount / steps.length) * 100, 8), 100);
  return (
    <section className="rounded-2xl border border-[#263d27]/10 bg-white/95 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase text-amber-700">Step {Math.min(currentIndex + 1, steps.length)}/{steps.length}</div>
          <div className="mt-0.5 truncate text-sm font-bold text-[#1f2937]">{currentStep.label}</div>
        </div>
        <span className="shrink-0 rounded-full bg-[#eef2e8] px-3 py-1 text-[10px] font-bold uppercase text-[#263d27]">{completedCount}/{steps.length} beres</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef2e8]"><div className="h-full rounded-full bg-[#263d27]" style={{ width: `${progressPercent}%` }} /></div>
    </section>
  );
};

const CheckoutRequirementChecklist = ({ items }) => (
  <div className="grid grid-cols-2 gap-1.5">
    {items.map((item) => (
      <span key={item.label} className={`inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-bold ${item.complete ? 'bg-[#eef2e8] text-[#263d27]' : 'bg-amber-50 text-amber-800'}`}>
        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${item.complete ? 'bg-[#263d27] text-white' : 'bg-amber-200 text-amber-800'}`}>{item.complete ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>
        <span className="truncate">{item.label}</span>
      </span>
    ))}
  </div>
);

const MobileCheckoutPage = () => {
  const navigate = useNavigate();
  const { items, summary, updateQuantity, removeItem, clear } = useCart();
  const checkout = useCheckoutFlow({ items, summary, clearCart: clear, paymentPath: '/mobile/payment' });
  const {
    customerCode, customerName, contact, deliveryAddress, notes, saving, securityChallenge, securityAnswer, lookupLoading,
    repeatCustomer, repeatAddressMode, destinationSearch, destinationOptions, selectedDestination, shippingOptions, selectedCourier,
    selectedShipping, shippingLoading, shippingError, shippingFee, totalDue, selectedPaymentMethod, isManualPayment, validPhoneContact,
    canSubmitCheckout, setCustomerName, setContact, setDeliveryAddress, setNotes, setSecurityAnswer, setSelectedShipping,
    setSelectedPaymentMethod, chooseShippingCourier, updateCustomerCode, updateDestinationSearch, useCustomerLastAddress,
    useCustomerNewAddress, searchDestinations, autoCalculateShipping, loadShippingRates, lookupCustomer, verifyCustomerSecurity, submitOrder,
  } = checkout;
  const decreaseQuantity = (item) => item.quantity <= 1 ? removeItem(item.slug) : updateQuantity(item.slug, item.quantity - 1);
  const visibleShippingOptions = selectedCourier ? shippingOptions.filter((rate) => rate.courierCode === selectedCourier) : [];
  const checkoutRequirements = [
    { label: 'Nama', complete: Boolean(customerName.trim()) },
    { label: 'Nomor WA', complete: validPhoneContact },
    { label: 'Alamat', complete: Boolean(deliveryAddress.trim()) },
    { label: 'Area', complete: Boolean(selectedDestination) },
    { label: 'Kurir', complete: Boolean(selectedCourier && selectedShipping) },
  ];
  const checkoutSteps = [
    { label: 'Keranjang', complete: Boolean(items.length) },
    { label: 'Customer', complete: Boolean(customerName.trim() && validPhoneContact) },
    { label: 'Alamat', complete: Boolean(deliveryAddress.trim() && selectedDestination) },
    { label: 'Ongkir', complete: Boolean(selectedCourier && selectedShipping) },
    { label: 'Bayar', complete: Boolean(selectedPaymentMethod) },
  ];

  if (!items.length) return (
    <MobileCommerceLayout>
      <main className="mobile-page space-y-4">
        <StateBlock className="mobile-card" icon={ShoppingBag} title="Keranjang kosong" description="Pilih parfum dari katalog untuk mulai checkout." action="Buka katalog" onAction={() => navigate('/mobile/catalog')} />
      </main>
    </MobileCommerceLayout>
  );

  return (
    <MobileCommerceLayout>
      <Helmet><title>Checkout - Solivagant</title></Helmet>
      <main className="mobile-page mobile-checkout-page space-y-4">
        <section className="mobile-soft-card p-4">
          <div className="text-[10px] font-bold uppercase text-amber-700">Checkout</div>
          <h1 className="mt-1 text-2xl font-bold text-[#1f2937]">Lengkapi pengiriman dan pembayaran.</h1>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div><div className="text-[10px] font-bold uppercase text-[#8b949e]">Total bayar</div><div className="mt-1 text-2xl font-bold text-[#263d27]">{formatTotal(totalDue)}</div></div>
            <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/cart')}>Edit cart</Button>
          </div>
        </section>
        <CheckoutProgress steps={checkoutSteps} />
        <section className="mobile-card p-3">
          <div className="text-[10px] font-bold uppercase text-amber-700">Kontak penerima</div>
          <div className="mt-3 grid gap-2">
            <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nama customer" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Contoh: 081234567890" inputMode="tel" autoComplete="tel" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
          </div>
        </section>
        <section className="mobile-card p-3">
          <div className="flex items-center justify-between"><h2 className="text-sm font-bold">Produk di keranjang</h2><span className="text-xs font-bold text-amber-700">{summary.quantity} item</span></div>
          <div className="mt-3 grid gap-2">
            {items.map((item) => (
              <div key={item.slug} className="rounded-2xl border border-[#263d27]/10 bg-[#f8f7f4] p-3">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-bold">{item.name}</h3><p className="mt-1 text-[10px] font-bold uppercase text-amber-700">{item.size} / {item.price}</p></div><p className="text-xs font-bold">{formatTotal(Number(item.priceNumber || 0) * Number(item.quantity || 0))}</p></div>
                <div className="mt-3 inline-flex items-center rounded-2xl border border-[#263d27]/10 bg-white p-1">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => decreaseQuantity(item)}><Minus className="h-4 w-4" /></Button>
                  <span className="grid h-8 min-w-10 place-items-center text-sm font-bold">{item.quantity}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => updateQuantity(item.slug, item.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="mobile-card p-3">
          <h2 className="text-sm font-bold">Alamat & pembayaran</h2>
          <div className="mt-3 grid gap-2">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={customerCode} onChange={(event) => updateCustomerCode(event.target.value)} placeholder="Kode customer" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold uppercase outline-none focus:border-amber-300" />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={lookupCustomer} disabled={lookupLoading}>{lookupLoading ? '...' : 'Cek'}</Button>
            </div>
            {securityChallenge ? <div className="grid grid-cols-[1fr_auto] gap-2"><input value={securityAnswer} onChange={(event) => setSecurityAnswer(event.target.value)} placeholder="Jawaban keamanan" className="h-11 rounded-2xl border border-[#d7dfd0] bg-white px-3 text-sm font-semibold outline-none" /><Button onClick={verifyCustomerSecurity}>Verifikasi</Button></div> : null}
            {repeatCustomer?.customerCode && (repeatCustomer.deliveryAddress || repeatCustomer.deliveryArea) ? (
              <div className="grid gap-2">
                <button type="button" onClick={useCustomerLastAddress} className={`rounded-2xl border px-3 py-2 text-left text-xs font-bold ${repeatAddressMode === 'last' ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-white'}`}>Pakai alamat terakhir</button>
                <button type="button" onClick={useCustomerNewAddress} className={`rounded-2xl border px-3 py-2 text-left text-xs font-bold ${repeatAddressMode === 'new' ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-white'}`}>Kirim ke alamat baru</button>
              </div>
            ) : null}
            <textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Alamat lengkap pengiriman" rows={3} className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none" />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={destinationSearch} onChange={(event) => updateDestinationSearch(event.target.value)} placeholder="Kecamatan / kota tujuan" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none" />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-3 text-xs font-bold" onClick={searchDestinations}>Cari</Button>
            </div>
            <select value={selectedCourier} onChange={(event) => chooseShippingCourier(event.target.value)} className="h-12 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-bold">
              <option value="">Pilih kurir</option>{checkoutCourierOptions.map((courier) => <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>)}
            </select>
            <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white" onClick={autoCalculateShipping} disabled={shippingLoading || !selectedCourier}>Cari layanan ongkir</Button>
            {destinationOptions.map((destination) => <button key={destination.id} type="button" onClick={() => loadShippingRates(destination)} className="rounded-2xl border px-3 py-2 text-left text-xs font-bold">{destination.label}</button>)}
            {visibleShippingOptions.map((rate) => <button key={`${rate.courierCode}-${rate.service}`} type="button" onClick={() => setSelectedShipping(rate)} className="rounded-2xl border px-3 py-3 text-left"><div className="flex justify-between text-sm font-bold"><span>{courierLabels[rate.courierCode] || rate.courierName} {rate.serviceLabel || rate.service}</span><span>{formatTotal(rate.cost)}</span></div></button>)}
            {shippingError ? <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">{shippingError}</p> : null}
            {checkoutPaymentMethods.map((method) => <button key={method.id} type="button" onClick={() => setSelectedPaymentMethod(method.id)} className={`rounded-2xl border px-3 py-3 text-left ${selectedPaymentMethod === method.id ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-white'}`}><div className="text-sm font-bold">{method.label}</div><p className="mt-1 text-[11px] font-semibold text-[#6b7280]">{method.description}</p></button>)}
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan pengiriman atau request" rows={2} className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none" />
          </div>
        </section>
        <StickyBottomActionBar
          fixed
          reserveSpace
          aria-label="Checkout actions"
          className="mobile-checkout-action-bar"
          contentClassName="rounded-[24px] border-[#263d27]/10 bg-white/95"
        >
          <div className="grid gap-2">{!canSubmitCheckout ? <CheckoutRequirementChecklist items={checkoutRequirements} /> : null}<Button type="button" className="h-12 w-full rounded-2xl gap-2" onClick={() => submitOrder()} disabled={!canSubmitCheckout}><CreditCard className="h-4 w-4" />{saving ? 'Memproses...' : (isManualPayment ? 'Buat order & upload bukti' : 'Bayar sekarang')}</Button></div>
        </StickyBottomActionBar>
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileCheckoutPage;
