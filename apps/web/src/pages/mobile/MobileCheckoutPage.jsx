import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { BadgePercent, ChevronDown, CreditCard, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCart } from '@/hooks/useCart.js';
import { checkoutCourierOptions, useCheckoutFlow } from '@/hooks/useCheckoutFlow.js';
import { checkoutPaymentMethods } from '@/services/cartService.js';
import { getDiscountedVoucherCartLineMap } from '@/utils/cartVoucherPricing.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
const courierLabels = { jnt: 'JnT', ide: 'IDEXPRES', pos: 'POS', anteraja: 'ANTERAJA', jne: 'JNE' };

const CheckoutProgress = ({ steps }) => {
  const firstIncompleteIndex = steps.findIndex((step) => !step.complete);
  const currentIndex = firstIncompleteIndex === -1 ? steps.length - 1 : Math.max(firstIncompleteIndex, 0);
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
  const [showManualShippingArea, setShowManualShippingArea] = useState(false);
  const { items, summary, updateQuantity, removeItem, clear } = useCart();
  const voucher = useAppliedVoucher(summary.subtotal, items);
  const discountedLineMap = getDiscountedVoucherCartLineMap(items, voucher.appliedVoucher || {}, voucher.discountAmount);
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
    selectedShipping, shippingLoading, shippingError, shippingNotice, shippingFee, discountAmount, discountedSubtotal, totalDue, selectedPaymentMethod, isManualPayment, validPhoneContact,
    canSubmitCheckout, setCustomerName, setContact, setDeliveryAddress, setNotes, setSecurityAnswer, setSelectedShipping,
    setSelectedPaymentMethod, chooseShippingCourier, updateCustomerCode, updateDestinationSearch, useCustomerLastAddress,
    useCustomerNewAddress, autoCalculateShipping, loadShippingRates, lookupCustomer, verifyCustomerSecurity, submitOrder,
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
    { label: 'Voucher', complete: shippingComplete },
    { label: 'Pembayaran', complete: paymentComplete },
    { label: 'Ringkasan', complete: Boolean(paymentComplete && items.length) },
  ];
  const missingRequirements = checkoutRequirements.filter((item) => !item.complete);
  const primaryActionLabel = saving ? 'Memproses...' : (isManualPayment ? 'Buat pesanan' : 'Bayar sekarang');
  const handleCourierChange = (courierCode) => {
    chooseShippingCourier(courierCode);
    if (!courierCode) return;
    const searchText = destinationSearch.trim() || deliveryAddress.trim();
    if (searchText.length >= 3) {
      setShowManualShippingArea(false);
      autoCalculateShipping({ courierCode, searchText, autoSelectBest: true });
    } else {
      setShowManualShippingArea(true);
    }
  };
  const showShippingAreaFallback = showManualShippingArea || Boolean(shippingError);
  const showShippingAlternatives = showManualShippingArea || Boolean(shippingError);
  const showShippingServiceChoices = Boolean(visibleShippingOptions.length && (!selectedShipping || showManualShippingArea));
  const recalculateShipping = () => {
    autoCalculateShipping({ searchText: destinationSearch.trim() || deliveryAddress.trim(), autoSelectBest: true });
  };
  const choosePaymentMethod = (method) => {
    if (method.id !== selectedPaymentMethod) {
      toast.success(`${method.label} dipilih`);
    }
    setSelectedPaymentMethod(method.id);
  };

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
          {discountAmount ? (
            <div className="mt-3 rounded-2xl border border-[#263d27]/12 bg-white/82 px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-xs font-bold text-[#263d27]">
                <span className="min-w-0 truncate">Voucher {voucher.appliedVoucher?.code}</span>
                <span className="shrink-0">Hemat {formatTotal(discountAmount)}</span>
              </div>
            </div>
          ) : null}
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
          description="Kode customer opsional untuk pembeli lama. Pembeli baru langsung isi nama dan nomor."
          complete={contactComplete}
        >
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={customerCode} onChange={(event) => updateCustomerCode(event.target.value)} placeholder="Opsional: kode customer" className="mobile-commerce-control h-12 px-3 text-sm font-semibold uppercase" />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={lookupCustomer} disabled={lookupLoading || !customerCode.trim()}>{lookupLoading ? '...' : 'Cek kode'}</Button>
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
          title="Pilih kurir"
          description="Ongkir dihitung otomatis setelah kurir dipilih."
          complete={shippingComplete}
        >
            <label className={`mobile-commerce-courier-select ${selectedCourier ? 'is-selected' : ''}`}>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase">
                  {selectedCourier ? 'Kurir dipilih' : 'Dropdown kurir'}
                </span>
                <span className="mt-0.5 block truncate text-sm font-bold">
                  {selectedCourier ? (courierLabels[selectedCourier] || selectedCourier.toUpperCase()) : 'Pilih kurir pengiriman'}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
              <select value={selectedCourier} onChange={(event) => handleCourierChange(event.target.value)} aria-label="Pilih kurir pengiriman">
                <option value="">Pilih kurir</option>{checkoutCourierOptions.map((courier) => <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>)}
              </select>
            </label>
            {shippingLoading ? (
              <p className="mobile-commerce-notice bg-[#f7f8f2] font-bold text-[#263d27]">
                Mencari ongkir dari alamat pengiriman...
              </p>
            ) : null}
            {!showShippingAreaFallback && !selectedShipping ? (
              <button type="button" onClick={() => setShowManualShippingArea(true)} className="w-fit text-left text-xs font-bold text-[#263d27] underline underline-offset-4">
                Edit ongkir manual
              </button>
            ) : null}
            {showShippingAreaFallback ? (
              <div className="mobile-commerce-panel bg-white p-3">
                <input value={destinationSearch} onChange={(event) => updateDestinationSearch(event.target.value)} placeholder="Contoh: Kebayoran Baru" className="mobile-commerce-control h-12 px-3 text-sm font-semibold" />
                <p className="mobile-commerce-notice mt-2">
                  Pakai ini hanya kalau alamat lengkap belum menemukan area ongkir yang tepat.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-11 rounded-2xl bg-white text-xs font-bold"
                  onClick={recalculateShipping}
                  disabled={shippingLoading || !selectedCourier || (!deliveryAddress.trim() && destinationSearch.trim().length < 3)}
                >
                  Hitung ulang
                </Button>
              </div>
            ) : null}
            {selectedDestination ? (
              <p className="mobile-commerce-notice bg-[#eef2e8] font-bold text-[#263d27]">
                Area ongkir: {selectedDestination.label}
              </p>
            ) : null}
            {shippingNotice ? <p className="mobile-commerce-notice bg-[#eef2e8] font-bold text-[#263d27]">{shippingNotice}</p> : null}
            {showShippingAlternatives && destinationOptions.length ? (
              <div className="grid gap-2">
                <div className="text-[10px] font-bold uppercase text-[#6f7d61]">Pilih area lain</div>
                {destinationOptions.map((destination) => <button key={destination.id} type="button" onClick={() => loadShippingRates(destination)} className="mobile-commerce-choice px-3 py-2 text-xs font-bold">{destination.label}</button>)}
              </div>
            ) : null}
            {showShippingServiceChoices ? visibleShippingOptions.map((rate) => {
              const active = selectedShipping?.courierCode === rate.courierCode && selectedShipping?.service === rate.service;
              return (
                <button
                  key={`${rate.courierCode}-${rate.service}`}
                  type="button"
                  onClick={() => setSelectedShipping(rate)}
                  className={`mobile-commerce-choice px-3 py-3 ${active ? 'is-active' : ''}`}
                >
                  <div className="flex justify-between gap-3 text-sm font-bold">
                    <span className="min-w-0">{courierLabels[rate.courierCode] || rate.courierName} {rate.serviceLabel || rate.service}</span>
                    <span className="shrink-0">{formatTotal(rate.cost)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-[#6b7280]">{rate.etd ? `ETA ${rate.etd}` : rate.description || 'Estimasi mengikuti kurir'}</p>
                    {active ? <span className="shrink-0 rounded-full bg-[#263d27] px-2 py-1 text-[9px] font-bold uppercase text-white">Dipilih</span> : null}
                  </div>
                </button>
              );
            }) : null}
            {selectedShipping ? (
              <div className="mobile-commerce-panel border-[#263d27]/24 bg-[#eef2e8] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-[#263d27]">Ongkir dipakai</div>
                    <p className="mt-1 text-xs font-bold text-[#1f2937]">
                      {courierLabels[selectedShipping.courierCode] || selectedShipping.courierName} {selectedShipping.serviceLabel || selectedShipping.service} - {formatTotal(selectedShipping.cost)}
                    </p>
                    {selectedDestination ? (
                      <p className="mt-1 text-[11px] font-semibold leading-snug text-[#51624b]">Area: {selectedDestination.label}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase text-[#263d27]">Auto</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white text-xs font-bold" onClick={() => setShowManualShippingArea(true)}>
                    Edit manual
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-2xl bg-white text-xs font-bold"
                    onClick={recalculateShipping}
                    disabled={shippingLoading || !selectedCourier || (!deliveryAddress.trim() && destinationSearch.trim().length < 3)}
                  >
                    Hitung ulang
                  </Button>
                </div>
              </div>
            ) : visibleShippingOptions.length ? (
              <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
                Pilih salah satu layanan ongkir. Setelah itu kamu akan lanjut ke pembayaran.
              </p>
            ) : null}
            {shippingError ? <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">{shippingError}</p> : null}
        </CheckoutSection>
        <CheckoutSection
          step="4"
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
        <div>
          <CheckoutSection
            step="5"
            title="Pembayaran"
            description={shippingComplete ? 'Ongkir sudah masuk total. Pilih metode pembayaran.' : 'Lengkapi ongkir dulu supaya total bayar final.'}
            complete={paymentComplete}
          >
            {checkoutPaymentMethods.map((method) => <button key={method.id} type="button" onClick={() => choosePaymentMethod(method)} className={`mobile-commerce-choice px-3 py-3 ${selectedPaymentMethod === method.id ? 'is-active' : ''}`}><div className="text-sm font-bold">{method.label}</div><p className="mt-1 text-[11px] font-semibold text-[#6b7280]">{method.description}</p></button>)}
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan pengiriman atau request" rows={2} className="mobile-commerce-control px-3 py-3 text-sm font-semibold" />
          </CheckoutSection>
        </div>
        <div>
          <CheckoutSection
            step="6"
            title="Ringkasan"
            description="Cek produk dan total sebelum pesanan dibuat."
            complete={Boolean(paymentComplete && items.length)}
            action={<span className="shrink-0 text-xs font-bold text-amber-700">{summary.quantity} item</span>}
          >
            {items.map((item) => {
              const discountedLine = discountedLineMap.get(item.slug);
              const hasLineDiscount = Boolean(discountedLine?.discount);

              return (
              <div key={item.slug} className="mobile-commerce-panel bg-[#f8f7f4] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold">{item.name}</h3>
                    <p className="mt-1 text-[10px] font-bold uppercase text-amber-700">{item.size} / {item.price}</p>
                    {hasLineDiscount ? (
                      <p className="mt-1 text-[11px] font-bold text-[#263d27]">
                        Setelah voucher: {formatTotal(discountedLine.discountedUnitPrice)} / item
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    {hasLineDiscount ? (
                      <div className="text-[11px] font-bold text-[#9ca3af] line-through">{formatTotal(discountedLine.originalTotal)}</div>
                    ) : null}
                    <p className="text-xs font-bold text-[#263d27]">{formatTotal(discountedLine?.discountedTotal ?? Number(item.priceNumber || 0) * Number(item.quantity || 0))}</p>
                    {hasLineDiscount ? (
                      <div className="mt-0.5 text-[10px] font-bold text-emerald-700">-{formatTotal(discountedLine.discount)}</div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 inline-flex items-center rounded-[14px] border border-[#263d27]/10 bg-white p-1">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => decreaseQuantity(item)}><Minus className="h-4 w-4" /></Button>
                  <span className="grid h-8 min-w-10 place-items-center text-sm font-bold">{item.quantity}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => updateQuantity(item.slug, item.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              );
            })}
            <div className="mobile-commerce-summary px-3 py-3 text-xs font-bold text-[#263d27]">
              <div className="flex justify-between gap-3"><span>Subtotal</span><span>{formatTotal(summary.subtotal)}</span></div>
              {discountAmount ? (
                <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div className="flex justify-between gap-3 text-emerald-800">
                    <span className="min-w-0 truncate">Diskon voucher {voucher.appliedVoucher?.code}</span>
                    <span className="shrink-0">-{formatTotal(discountAmount)}</span>
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase text-emerald-700">Dipakai sebelum ongkir</div>
                </div>
              ) : null}
              {discountAmount ? (
                <div className="mt-2 flex justify-between gap-3 text-[#6b7280]"><span>Subtotal setelah voucher</span><span>{formatTotal(discountedSubtotal)}</span></div>
              ) : null}
              <div className="mt-2 flex justify-between gap-3 text-[#6b7280]"><span>Ongkir</span><span>{shippingFee ? formatTotal(shippingFee) : '-'}</span></div>
              <div className="mt-3 border-t border-[#263d27]/10 pt-3 flex justify-between gap-3 text-sm text-[#0b130c]"><span>Total bayar</span><span>{formatTotal(totalDue)}</span></div>
            </div>
          </CheckoutSection>
        </div>
        <StickyBottomActionBar
          fixed
          reserveSpace
          aria-label="Aksi pembayaran"
          className="mobile-checkout-action-bar"
          contentClassName="rounded-2xl border-[#263d27]/10 bg-white/95"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-[#8b949e]">{canSubmitCheckout ? 'Total bayar' : 'Lengkapi dulu'}</p>
              <p className="truncate text-lg font-bold leading-tight text-[#263d27]">{formatTotal(totalDue)}</p>
              <p className={`truncate text-[10px] font-bold ${canSubmitCheckout ? 'text-emerald-700' : 'text-amber-700'}`}>
                {canSubmitCheckout ? (discountAmount ? `Voucher -${formatTotal(discountAmount)}` : 'Siap dibayar') : missingRequirements.map((item) => item.label).join(', ')}
              </p>
            </div>
            <Button type="button" className="h-12 rounded-2xl gap-2 px-4" onClick={() => submitOrder()} disabled={saving || !canSubmitCheckout}>
              <CreditCard className="h-4 w-4" />
              {primaryActionLabel}
            </Button>
          </div>
        </StickyBottomActionBar>
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileCheckoutPage;
