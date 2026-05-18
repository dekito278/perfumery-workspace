import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { BadgePercent, CreditCard, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
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
    <section className="mobile-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase text-amber-700">Langkah {Math.min(currentIndex + 1, steps.length)}/{steps.length}</div>
          <div className="mt-0.5 text-sm font-bold leading-snug text-[#1f2937]">{currentStep.label}</div>
        </div>
        <span className="mobile-commerce-chip shrink-0 px-3 py-1 text-[10px] uppercase">{completedCount}/{steps.length} beres</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef2e8]"><div className="h-full rounded-full bg-[#263d27]" style={{ width: `${progressPercent}%` }} /></div>
    </section>
  );
};

const CheckoutSection = ({ action, children, complete = false, description = '', step, title }) => (
  <section className="mobile-card p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 gap-3">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-2xl text-xs font-bold ${complete ? 'bg-[#263d27] text-white' : 'bg-amber-50 text-amber-800'}`}>
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[#0b130c]">{title}</h2>
          {description ? <p className="mt-1 text-[11px] font-semibold leading-relaxed text-[#6b7280]">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
    <div className="mt-3 grid gap-2">
      {children}
    </div>
  </section>
);

const MobileCheckoutPage = () => {
  const navigate = useNavigate();
  const { items, summary, updateQuantity, removeItem, clear } = useCart();
  const voucher = useAppliedVoucher(summary.subtotal);
  const checkout = useCheckoutFlow({
    items,
    summary,
    clearCart: clear,
    paymentPath: '/mobile/payment',
    voucherCode: voucher.appliedVoucher?.code || '',
    voucherDiscount: voucher.discountAmount,
    voucherDetails: voucher.appliedVoucher,
    clearVoucher: voucher.removeVoucher,
  });
  const {
    customerCode, customerName, contact, deliveryAddress, notes, saving, securityChallenge, securityAnswer, lookupLoading,
    repeatCustomer, repeatAddressMode, destinationSearch, destinationOptions, selectedDestination, shippingOptions, selectedCourier,
    selectedShipping, shippingLoading, shippingError, shippingFee, discountAmount, discountedSubtotal, totalDue, selectedPaymentMethod, isManualPayment, validPhoneContact,
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
  const contactComplete = Boolean(customerName.trim() && validPhoneContact);
  const addressComplete = Boolean(contactComplete && deliveryAddress.trim());
  const shippingComplete = Boolean(addressComplete && selectedDestination && selectedCourier && selectedShipping);
  const paymentComplete = Boolean(shippingComplete && selectedPaymentMethod);
  const checkoutSteps = [
    { label: 'Kontak', complete: contactComplete },
    { label: 'Alamat', complete: addressComplete },
    { label: 'Ongkir', complete: shippingComplete },
    { label: 'Pembayaran', complete: paymentComplete },
    { label: 'Ringkasan', complete: Boolean(paymentComplete && items.length) },
  ];
  const missingRequirements = checkoutRequirements.filter((item) => !item.complete);
  const primaryActionLabel = saving ? 'Memproses...' : (isManualPayment ? 'Buat pesanan & upload bukti' : 'Bayar sekarang');

  if (!items.length) return (
    <MobileCommerceLayout>
        <main className="mobile-page">
        <section className="mobile-soft-card p-4">
          <div className="text-[10px] font-bold uppercase text-amber-700">Checkout</div>
          <h1 className="mt-1 text-xl font-bold leading-tight text-[#1f2937]">Belum ada item untuk dibayar.</h1>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">Tambahkan parfum ready stock ke keranjang, atau mulai dari request custom.</p>
          <Button type="button" className="mt-4 h-11 w-full rounded-2xl gap-2" onClick={() => navigate('/mobile/catalog')}>
            <ShoppingBag className="h-4 w-4" />
            Buka katalog
          </Button>
        </section>
        <StateBlock className="mobile-card" icon={ShoppingBag} title="Keranjang kosong" description="Pilih parfum dari katalog untuk mulai belanja." action="Buka katalog" onAction={() => navigate('/mobile/catalog')} />
      </main>
    </MobileCommerceLayout>
  );

  return (
    <MobileCommerceLayout>
      <Helmet><title>Pembayaran - Solivagant</title></Helmet>
      <main className="mobile-page mobile-checkout-page">
        <section className="mobile-soft-card p-3">
          <div className="text-[10px] font-bold uppercase text-amber-700">Pembayaran</div>
          <h1 className="mt-1 text-xl font-bold leading-tight text-[#1f2937]">Lengkapi pengiriman dan pembayaran.</h1>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div><div className="text-[10px] font-bold uppercase text-[#8b949e]">Total bayar</div><div className="mt-1 text-2xl font-bold text-[#263d27]">{formatTotal(totalDue)}</div></div>
            <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/cart')}>Edit keranjang</Button>
          </div>
        </section>
        <CheckoutProgress steps={checkoutSteps} />
        <section className="mobile-commerce-panel px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-[11px] font-bold leading-snug text-[#6b7280]">
              {canSubmitCheckout ? 'Semua data siap.' : `Lengkapi: ${missingRequirements.map((item) => item.label).join(', ')}`}
            </p>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase ${canSubmitCheckout ? 'bg-[#eef2e8] text-[#263d27]' : 'bg-amber-50 text-amber-800'}`}>
              {canSubmitCheckout ? 'Siap' : `${missingRequirements.length} kurang`}
            </span>
          </div>
        </section>
        <CheckoutSection
          step="1"
          title="Kontak"
          description="Data penerima dan kode customer kalau sudah pernah order."
          complete={contactComplete}
        >
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={customerCode} onChange={(event) => updateCustomerCode(event.target.value)} placeholder="Kode customer" className="mobile-commerce-control h-12 px-3 text-sm font-semibold uppercase" />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={lookupCustomer} disabled={lookupLoading}>{lookupLoading ? '...' : 'Cek'}</Button>
            </div>
            {securityChallenge ? <div className="grid grid-cols-[1fr_auto] gap-2"><input value={securityAnswer} onChange={(event) => setSecurityAnswer(event.target.value)} placeholder="Jawaban keamanan" className="mobile-commerce-control h-11 px-3 text-sm font-semibold" /><Button onClick={verifyCustomerSecurity}>Verifikasi</Button></div> : null}
            <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nama pembeli" className="mobile-commerce-control h-12 px-3 text-sm font-semibold" />
            <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Contoh: 081234567890" inputMode="tel" autoComplete="tel" className="mobile-commerce-control h-12 px-3 text-sm font-semibold" />
        </CheckoutSection>
        <CheckoutSection
          step="2"
          title="Alamat"
          description="Alamat pengiriman lengkap untuk kurir dan invoice."
          complete={addressComplete}
        >
            {repeatCustomer?.customerCode && (repeatCustomer.deliveryAddress || repeatCustomer.deliveryArea) ? (
              <div className="grid gap-2">
                <button type="button" onClick={useCustomerLastAddress} className={`mobile-commerce-choice px-3 py-2 text-xs font-bold ${repeatAddressMode === 'last' ? 'is-active' : ''}`}>Pakai alamat terakhir</button>
                <button type="button" onClick={useCustomerNewAddress} className={`mobile-commerce-choice px-3 py-2 text-xs font-bold ${repeatAddressMode === 'new' ? 'is-active' : ''}`}>Kirim ke alamat baru</button>
              </div>
            ) : null}
            <textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Alamat lengkap pengiriman" rows={3} className="mobile-commerce-control px-3 py-3 text-sm font-semibold" />
        </CheckoutSection>
        <CheckoutSection
          step="3"
          title="Ongkir"
          description="Cari area tujuan, pilih kurir, lalu pilih layanan ongkir."
          complete={shippingComplete}
        >
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={destinationSearch} onChange={(event) => updateDestinationSearch(event.target.value)} placeholder="Kecamatan / kota tujuan" className="mobile-commerce-control h-12 px-3 text-sm font-semibold" />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-3 text-xs font-bold" onClick={searchDestinations}>Cari</Button>
            </div>
            <select value={selectedCourier} onChange={(event) => chooseShippingCourier(event.target.value)} className="mobile-commerce-control h-12 px-3 text-sm font-bold">
              <option value="">Pilih kurir</option>{checkoutCourierOptions.map((courier) => <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>)}
            </select>
            <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white" onClick={autoCalculateShipping} disabled={shippingLoading || !selectedCourier}>Cari layanan ongkir</Button>
            {destinationOptions.map((destination) => <button key={destination.id} type="button" onClick={() => loadShippingRates(destination)} className="mobile-commerce-choice px-3 py-2 text-xs font-bold">{destination.label}</button>)}
            {visibleShippingOptions.map((rate) => <button key={`${rate.courierCode}-${rate.service}`} type="button" onClick={() => setSelectedShipping(rate)} className="mobile-commerce-choice px-3 py-3"><div className="flex justify-between text-sm font-bold"><span>{courierLabels[rate.courierCode] || rate.courierName} {rate.serviceLabel || rate.service}</span><span>{formatTotal(rate.cost)}</span></div></button>)}
            {shippingError ? <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">{shippingError}</p> : null}
        </CheckoutSection>
        <CheckoutSection
          step="4"
          title="Pembayaran"
          description="Pilih metode pembayaran dan tambahkan catatan bila perlu."
          complete={paymentComplete}
        >
            {checkoutPaymentMethods.map((method) => <button key={method.id} type="button" onClick={() => setSelectedPaymentMethod(method.id)} className={`mobile-commerce-choice px-3 py-3 ${selectedPaymentMethod === method.id ? 'is-active' : ''}`}><div className="text-sm font-bold">{method.label}</div><p className="mt-1 text-[11px] font-semibold text-[#6b7280]">{method.description}</p></button>)}
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan pengiriman atau request" rows={2} className="mobile-commerce-control px-3 py-3 text-sm font-semibold" />
        </CheckoutSection>
        <CheckoutSection
          step="V"
          title="Voucher"
          description="Kode promo akan memotong subtotal produk sebelum ongkir."
          complete={Boolean(voucher.appliedVoucher)}
          action={voucher.discountAmount ? <span className="shrink-0 text-xs font-bold text-[#263d27]">-{formatTotal(voucher.discountAmount)}</span> : null}
        >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                value={voucher.inputCode}
                onChange={(event) => voucher.setInputCode(event.target.value.toUpperCase())}
                placeholder="Kode voucher"
                className="mobile-commerce-control h-12 px-3 text-sm font-semibold uppercase"
              />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold gap-1.5" onClick={voucher.applyVoucher}>
                <BadgePercent className="h-4 w-4" />
                Pakai
              </Button>
            </div>
            {voucher.appliedVoucher ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#263d27]/14 bg-[#eef2e8] px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-[#263d27]">{voucher.appliedVoucher.code} diterapkan</div>
                  <div className="mt-0.5 text-[11px] font-semibold text-[#51624b]">Hemat {formatTotal(voucher.discountAmount)}</div>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-xl text-[#263d27]" onClick={voucher.removeVoucher} aria-label="Hapus voucher">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : voucher.message ? (
              <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">{voucher.message}</p>
            ) : null}
        </CheckoutSection>
        <CheckoutSection
          step="5"
          title="Ringkasan"
          description="Cek produk dan total sebelum pesanan dibuat."
          complete={Boolean(paymentComplete && items.length)}
          action={<span className="shrink-0 text-xs font-bold text-amber-700">{summary.quantity} item</span>}
        >
            {items.map((item) => (
              <div key={item.slug} className="mobile-commerce-panel bg-[#f8f7f4] p-3">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-bold">{item.name}</h3><p className="mt-1 text-[10px] font-bold uppercase text-amber-700">{item.size} / {item.price}</p></div><p className="text-xs font-bold">{formatTotal(Number(item.priceNumber || 0) * Number(item.quantity || 0))}</p></div>
                <div className="mt-3 inline-flex items-center rounded-[14px] border border-[#263d27]/10 bg-white p-1">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => decreaseQuantity(item)}><Minus className="h-4 w-4" /></Button>
                  <span className="grid h-8 min-w-10 place-items-center text-sm font-bold">{item.quantity}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => updateQuantity(item.slug, item.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            <div className="mobile-commerce-summary px-3 py-3 text-xs font-bold text-[#263d27]">
              <div className="flex justify-between gap-3"><span>Subtotal</span><span>{formatTotal(summary.subtotal)}</span></div>
              {discountAmount ? (
                <div className="mt-2 flex justify-between gap-3 text-[#263d27]"><span>Voucher {voucher.appliedVoucher?.code}</span><span>-{formatTotal(discountAmount)}</span></div>
              ) : null}
              {discountAmount ? (
                <div className="mt-2 flex justify-between gap-3 text-[#6b7280]"><span>Subtotal setelah voucher</span><span>{formatTotal(discountedSubtotal)}</span></div>
              ) : null}
              <div className="mt-2 flex justify-between gap-3 text-[#6b7280]"><span>Ongkir</span><span>{shippingFee ? formatTotal(shippingFee) : '-'}</span></div>
              <div className="mt-3 border-t border-[#263d27]/10 pt-3 flex justify-between gap-3 text-sm text-[#0b130c]"><span>Total bayar</span><span>{formatTotal(totalDue)}</span></div>
            </div>
        </CheckoutSection>
        {canSubmitCheckout ? (
          <StickyBottomActionBar
            fixed
            reserveSpace
            aria-label="Aksi pembayaran"
            className="mobile-checkout-action-bar"
            contentClassName="rounded-[24px] border-[#263d27]/10 bg-white/95"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase text-[#8b949e]">Total bayar</p>
                <p className="truncate text-lg font-bold leading-tight text-[#263d27]">{formatTotal(totalDue)}</p>
              </div>
              <Button type="button" className="h-12 rounded-2xl gap-2 px-4" onClick={() => submitOrder()} disabled={saving}>
                <CreditCard className="h-4 w-4" />
                {primaryActionLabel}
              </Button>
            </div>
          </StickyBottomActionBar>
        ) : null}
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileCheckoutPage;
