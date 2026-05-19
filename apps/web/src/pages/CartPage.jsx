import React, { useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgePercent, CheckCircle2, CreditCard, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCart } from '@/hooks/useCart.js';
import { checkoutCourierOptions, useCheckoutFlow } from '@/hooks/useCheckoutFlow.js';
import { checkoutPaymentMethods } from '@/services/cartService.js';
import { getDiscountedVoucherCartLineMap } from '@/utils/cartVoucherPricing.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;

const courierLabels = {
  jnt: 'JnT',
  ide: 'IDEXPRES',
  pos: 'POS',
  anteraja: 'ANTERAJA',
  jne: 'JNE',
};

const CheckoutSectionTitle = ({ step, title, description }) => (
  <div className="flex items-start gap-3">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-sm font-bold text-[#263d27]">{step}</span>
    <div>
      <h3 className="text-sm font-bold text-[#0b130c]">{title}</h3>
      {description ? <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">{description}</p> : null}
    </div>
  </div>
);

const CartPage = () => {
  const navigate = useNavigate();
  const paymentSectionRef = useRef(null);
  const [showManualShippingArea, setShowManualShippingArea] = useState(false);
  const { items, summary, updateQuantity, removeItem, clear } = useCart();
  const voucher = useAppliedVoucher(summary.subtotal, items);
  const discountedLineMap = getDiscountedVoucherCartLineMap(items, voucher.appliedVoucher || {}, voucher.discountAmount);
  const {
    customerCode,
    customerName,
    contact,
    deliveryAddress,
    notes,
    saving,
    submittedOrder,
    securityChallenge,
    securityAnswer,
    lookupLoading,
    repeatCustomer,
    repeatAddressMode,
    destinationSearch,
    destinationOptions,
    selectedDestination,
    shippingOptions,
    selectedCourier,
    selectedShipping,
    shippingLoading,
    shippingError,
    shippingNotice,
    shippingFee,
    discountAmount,
    discountedSubtotal,
    totalDue,
    selectedPaymentMethod,
    isManualPayment,
    validPhoneContact,
    canSubmitCheckout,
    setCustomerName,
    setContact,
    setDeliveryAddress,
    setNotes,
    setSecurityAnswer,
    setSelectedShipping,
    setSelectedPaymentMethod,
    chooseShippingCourier,
    updateCustomerCode,
    updateDestinationSearch,
    useCustomerLastAddress,
    useCustomerNewAddress,
    autoCalculateShipping,
    loadShippingRates,
    lookupCustomer,
    verifyCustomerSecurity,
    copyCustomerCode,
    submitOrder,
  } = useCheckoutFlow({
    items,
    summary,
    clearCart: clear,
    paymentPath: '/payment',
    voucherCode: voucher.appliedVoucher?.code || '',
    voucherDiscount: voucher.discountAmount,
    voucherDetails: voucher.appliedVoucher,
    clearVoucher: voucher.removeVoucher,
  });

  const decreaseQuantity = (item) => {
    if (item.quantity <= 1) {
      removeItem(item.slug);
      return;
    }
    updateQuantity(item.slug, item.quantity - 1);
  };

  const visibleShippingOptions = selectedCourier
    ? shippingOptions.filter((rate) => rate.courierCode === selectedCourier)
    : [];
  const contactComplete = Boolean(customerName.trim() && validPhoneContact);
  const addressComplete = Boolean(contactComplete && deliveryAddress.trim());
  const shippingComplete = Boolean(addressComplete && selectedDestination && selectedCourier && selectedShipping);
  const missingCheckoutItems = [
    !customerName.trim() ? 'nama penerima' : '',
    !validPhoneContact ? 'nomor WhatsApp' : '',
    !deliveryAddress.trim() ? 'alamat lengkap' : '',
    !selectedDestination ? 'pilihan kurir' : '',
    !selectedShipping ? 'ongkir' : '',
    !selectedPaymentMethod ? 'metode bayar' : '',
  ].filter(Boolean);
  const scrollToPayment = () => {
    paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const handleCourierChange = (courierCode) => {
    chooseShippingCourier(courierCode);
    if (!courierCode) return;
    const searchText = destinationSearch.trim() || deliveryAddress.trim();
    if (searchText.length >= 3) {
      autoCalculateShipping({ courierCode, searchText, autoSelectBest: true });
    } else {
      setShowManualShippingArea(true);
    }
  };
  const showShippingAreaFallback = showManualShippingArea || Boolean(shippingError) || Boolean(destinationSearch.trim()) || destinationOptions.length > 0;

  return (
    <>
      <Helmet>
        <title>Cart - Solivagant</title>
      </Helmet>
      <main className="min-h-screen bg-[#f7f8f2] text-[#0b130c]">
        <section className="border-b border-[#263d27]/15 bg-[#050705] text-[#eef2e8]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-bold text-[#eef2e8]"><ArrowLeft className="h-4 w-4" />Katalog</Link>
            <Link to="/home" className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-[#eef2e8]">Beranda</Link>
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
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase text-[#263d27]">Order diterima</div>
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
                  <Link to="/catalog" className="inline-flex h-11 items-center rounded-2xl border bg-white px-5 text-sm font-bold">Belanja lagi</Link>
                  <Link to={`/customer?code=${submittedOrder.customerCode}`} className="inline-flex h-11 items-center rounded-2xl bg-[#263d27] px-5 text-sm font-bold text-[#eef2e8]">Lacak order</Link>
                </div>
              </section>
            ) : null}

            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase text-[#263d27]">Checkout</div>
                <h1 className="mt-1 text-4xl font-bold">Keranjang</h1>
              </div>
              <div className="rounded-2xl border bg-white px-4 py-3 text-right">
                <div className="text-xs font-bold uppercase text-muted-foreground">Subtotal</div>
                <div className="text-xl font-bold">{formatTotal(totalDue)}</div>
                {shippingFee ? <div className="text-xs font-bold text-[#263d27]">Ongkir {formatTotal(shippingFee)}</div> : null}
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              {items.map((item) => {
                const discountedLine = discountedLineMap.get(item.slug);
                const hasLineDiscount = Boolean(discountedLine?.discount);
                const lineTotal = Number(item.priceNumber || 0) * Number(item.quantity || 0);

                return (
                <article key={item.slug} className="rounded-2xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold">{item.name}</h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">{item.notes}</p>
                      {hasLineDiscount ? (
                        <p className="mt-1 text-xs font-bold text-[#263d27]">
                          Setelah voucher: {formatTotal(discountedLine.discountedUnitPrice)} / item
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs font-bold uppercase text-[#263d27]">{item.price} · {item.size}</p>
                    </div>
                    <div className="flex shrink-0 items-start gap-3">
                      <div className="text-right">
                        {hasLineDiscount ? (
                          <div className="text-xs font-bold text-[#9ca3af] line-through">{formatTotal(discountedLine.originalTotal)}</div>
                        ) : null}
                        <div className="text-base font-bold text-[#263d27]">{formatTotal(discountedLine?.discountedTotal ?? lineTotal)}</div>
                        {hasLineDiscount ? (
                          <div className="mt-0.5 text-xs font-bold text-emerald-700">-{formatTotal(discountedLine.discount)}</div>
                        ) : null}
                      </div>
                      <Button type="button" size="icon" variant="outline" className="rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeItem(item.slug)} aria-label={`Hapus ${item.name}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Button type="button" size="icon" variant="outline" className="rounded-2xl bg-white" onClick={() => decreaseQuantity(item)}><Minus className="h-4 w-4" /></Button>
                    <span className="grid h-10 min-w-12 place-items-center rounded-2xl bg-[#f7f8f2] text-sm font-bold">{item.quantity}</span>
                    <Button type="button" size="icon" variant="outline" className="rounded-2xl bg-white" onClick={() => updateQuantity(item.slug, item.quantity + 1)} disabled={item.maxStock > 0 && item.quantity >= item.maxStock}><Plus className="h-4 w-4" /></Button>
                    {item.maxStock > 0 ? <span className="text-xs font-bold text-muted-foreground">stok {item.maxStock}</span> : null}
                  </div>
                </article>
                );
              })}
              {!items.length ? (
                <StateBlock
                  icon={ShoppingBag}
                  title="Keranjang kosong"
                  description="Pilih parfum dari katalog untuk mulai checkout."
                  action="Buka katalog"
                  onAction={() => navigate('/catalog')}
                />
              ) : null}
            </div>
          </div>

          {items.length ? (
            <aside className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold">Checkout</h2>
              <div className={`mt-4 rounded-2xl border px-4 py-3 ${canSubmitCheckout ? 'border-[#263d27]/20 bg-[#eef2e8]' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-xs font-bold uppercase ${canSubmitCheckout ? 'text-[#263d27]' : 'text-amber-800'}`}>
                      {canSubmitCheckout ? 'Siap dibuat' : 'Belum selesai'}
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-[#0b130c]">
                      {canSubmitCheckout
                        ? 'Semua data checkout sudah lengkap. Cek ringkasan lalu buat order.'
                        : `Lengkapi ${missingCheckoutItems.join(', ')}.`}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase ${canSubmitCheckout ? 'bg-[#263d27] text-white' : 'bg-white text-amber-800'}`}>
                    {canSubmitCheckout ? 'Ready' : `${missingCheckoutItems.length} kurang`}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-4">
                <section className="rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] p-4">
                  <CheckoutSectionTitle step="1" title="Customer" description="Kode customer hanya untuk pembeli lama. Pembeli baru bisa langsung isi kontak." />
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                    <input value={customerCode} onChange={(event) => updateCustomerCode(event.target.value)} placeholder="Opsional: kode customer lama" className="h-12 rounded-2xl border px-4 text-sm font-semibold uppercase outline-none focus:border-[#263d27]" />
                    <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-sm font-bold" onClick={lookupCustomer} disabled={lookupLoading || !customerCode.trim()}>{lookupLoading ? '...' : 'Cek kode'}</Button>
                  </div>
                  <p className="mt-2 rounded-2xl bg-white px-4 py-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                    Belum punya kode? Lewati kolom ini. Setelah checkout selesai, Solivagant akan membuat kode customer untuk order berikutnya.
                  </p>
                </section>
                {securityChallenge ? (
                  <div className="rounded-2xl border border-[#263d27]/10 bg-[#eef2e8] p-4">
                    <div className="text-xs font-bold uppercase text-[#263d27]">Pertanyaan keamanan</div>
                    <p className="mt-1 text-sm font-bold">{securityChallenge.securityQuestion}</p>
                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                      <input value={securityAnswer} onChange={(event) => setSecurityAnswer(event.target.value)} placeholder="Jawaban" className="h-12 rounded-2xl border bg-white px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                      <Button type="button" className="h-12 rounded-2xl px-4 text-sm font-bold" onClick={verifyCustomerSecurity} disabled={lookupLoading}>{lookupLoading ? '...' : 'Verifikasi'}</Button>
                    </div>
                  </div>
                ) : null}
                <section className="rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] p-4">
                  <CheckoutSectionTitle step="2" title="Pengiriman" description="Nama, kontak, dan alamat lengkap untuk kurir." />
                  <div className="mt-3 grid gap-3">
                {repeatCustomer?.customerCode && (repeatCustomer.deliveryAddress || repeatCustomer.deliveryArea) ? (
                  <div className="rounded-2xl border border-[#263d27]/10 bg-[#f7f8f2] p-4">
                    <div className="text-xs font-bold uppercase text-[#263d27]">Repeat customer</div>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-muted-foreground">
                      Pakai alamat checkout terakhir atau kirim ke alamat baru.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button type="button" onClick={useCustomerLastAddress} className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold ${repeatAddressMode === 'last' ? 'border-[#263d27] bg-[#eef2e8] text-[#263d27]' : 'border-[#263d27]/10 bg-white text-[#1f2937]'}`}>
                        Pakai alamat terakhir
                        <span className="mt-1 block text-xs font-semibold text-muted-foreground">{repeatCustomer.deliveryArea || 'Area belum tersimpan'}</span>
                      </button>
                      <button type="button" onClick={useCustomerNewAddress} className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold ${repeatAddressMode === 'new' ? 'border-[#263d27] bg-[#eef2e8] text-[#263d27]' : 'border-[#263d27]/10 bg-white text-[#1f2937]'}`}>
                        Kirim ke alamat baru
                        <span className="mt-1 block text-xs font-semibold text-muted-foreground">Kosongkan alamat dan cari area ongkir baru.</span>
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-1.5">
                  <label className="text-xs font-bold uppercase text-[#263d27]">Nama penerima</label>
                  <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nama customer" className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-bold uppercase text-[#263d27]">Nomor WhatsApp / telepon</label>
                  <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Contoh: 081234567890" inputMode="tel" autoComplete="tel" className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                </div>
                {contact.trim() && !validPhoneContact ? (
                  <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
                    Isi nomor WhatsApp/telepon aktif untuk kurir. Email boleh ditulis di catatan, tapi tidak menggantikan nomor telepon.
                  </p>
                ) : (
                  <p className="rounded-2xl bg-[#f7f8f2] px-4 py-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                    Email tidak wajib. Nomor WhatsApp/telepon wajib supaya kurir bisa menghubungi penerima.
                  </p>
                )}
                <div className="grid gap-1.5">
                  <label className="text-xs font-bold uppercase text-[#263d27]">Alamat lengkap pengiriman</label>
                  <textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Nama jalan, nomor rumah, patokan, RT/RW jika ada" rows={3} className="rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-[#263d27]" />
                </div>
                  </div>
                </section>
                <section className="rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] p-4">
                  <CheckoutSectionTitle step="3" title="Pilih kurir" description="Setelah kurir dipilih, ongkir dihitung otomatis dari alamat lengkap." />
                  <div className="mt-3 grid gap-3">
                <div className="grid gap-2">
                  <div className="text-xs font-bold uppercase text-[#263d27]">Pilih ekspedisi</div>
                  <select
                    value={selectedCourier}
                    onChange={(event) => handleCourierChange(event.target.value)}
                    className="h-12 rounded-2xl border bg-white px-4 text-sm font-bold text-[#0b130c] outline-none focus:border-[#263d27]"
                  >
                    <option value="">Pilih kurir</option>
                    {checkoutCourierOptions.map((courier) => (
                      <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
                    ))}
                  </select>
                </div>
                {shippingLoading ? (
                  <p className="rounded-2xl bg-[#f7f8f2] px-4 py-3 text-xs font-bold text-[#263d27]">
                    Mencari ongkir dari alamat pengiriman...
                  </p>
                ) : null}
                {!showShippingAreaFallback ? (
                  <button type="button" onClick={() => setShowManualShippingArea(true)} className="w-fit text-left text-xs font-bold text-[#263d27] underline underline-offset-4">
                    Pilih area manual
                  </button>
                ) : (
                  <div className="grid gap-2 rounded-2xl border border-[#263d27]/10 bg-white p-3">
                    <div className="text-xs font-bold uppercase text-[#263d27]">Area manual kalau alamat belum ketemu</div>
                    <input value={destinationSearch} onChange={(event) => updateDestinationSearch(event.target.value)} placeholder="Contoh: Kebayoran Baru" className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-2xl bg-white px-4 text-xs font-bold"
                      onClick={() => autoCalculateShipping({ searchText: destinationSearch.trim() || deliveryAddress.trim(), autoSelectBest: true })}
                      disabled={shippingLoading || (!deliveryAddress.trim() && destinationSearch.trim().length < 3) || !selectedCourier}
                    >
                      Hitung ulang
                    </Button>
                  </div>
                )}
                {selectedDestination ? (
                  <p className="rounded-2xl bg-[#eef2e8] px-4 py-3 text-xs font-bold text-[#263d27]">
                    Area ongkir: {selectedDestination.label}
                  </p>
                ) : null}
                {shippingNotice ? <p className="rounded-2xl bg-[#eef2e8] px-4 py-3 text-xs font-bold text-[#263d27]">{shippingNotice}</p> : null}
                {destinationOptions.length ? (
                  <div className="grid gap-2">
                    <div className="text-xs font-bold uppercase text-[#263d27]">Bukan area ini? Pilih koreksi</div>
                    {destinationOptions.map((destination) => (
                      <button key={destination.id} type="button" onClick={() => loadShippingRates(destination)} className="rounded-2xl border border-[#263d27]/10 bg-[#f7f8f2] px-4 py-3 text-left text-sm font-bold text-[#263d27]">
                        {destination.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {visibleShippingOptions.length ? (
                  <div className="grid gap-2">
                    <div className="text-xs font-bold uppercase text-[#263d27]">Harga {courierLabels[selectedCourier] || 'ekspedisi'}</div>
                    {visibleShippingOptions.map((rate) => {
                      const active = selectedShipping?.courierCode === rate.courierCode && selectedShipping?.service === rate.service;
                      return (
                        <button key={`${rate.courierCode}-${rate.service}-${rate.cost}`} type="button" onClick={() => setSelectedShipping(rate)} className={`rounded-2xl border px-4 py-3 text-left transition ${active ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-white'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-bold">{courierLabels[rate.courierCode] || rate.courierName} {rate.serviceLabel || rate.service}</span>
                            <span className="shrink-0 text-sm font-bold text-[#263d27]">{formatTotal(rate.cost)}</span>
                          </div>
                          {active ? <div className="mt-2 inline-flex rounded-full bg-[#263d27] px-2.5 py-1 text-[10px] font-bold uppercase text-white">Dipilih</div> : null}
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">{rate.etd ? `ETA ${rate.etd}` : rate.description || 'Estimasi mengikuti kurir'}</p>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {selectedShipping ? (
                  <div className="rounded-2xl border border-[#263d27]/15 bg-[#eef2e8] p-4">
                    <div className="text-xs font-bold uppercase text-[#263d27]">Ongkir paling hemat dipilih</div>
                    <p className="mt-1 text-sm font-bold text-[#0b130c]">
                      {courierLabels[selectedShipping.courierCode] || selectedShipping.courierName} {selectedShipping.serviceLabel || selectedShipping.service} · {formatTotal(selectedShipping.cost)}
                    </p>
                    <Button type="button" className="mt-3 h-11 w-full rounded-2xl" onClick={scrollToPayment}>
                      Lanjut pilih pembayaran
                    </Button>
                  </div>
                ) : visibleShippingOptions.length ? (
                  <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
                    Pilih salah satu layanan ongkir dulu. Setelah dipilih, total bayar dan tombol lanjut akan aktif.
                  </p>
                ) : null}
                {shippingError ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">{shippingError}</p> : null}
                  </div>
                </section>
                <section className="rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] p-4">
                  <CheckoutSectionTitle step="V" title="Voucher" description="Kode promo akan memotong subtotal produk sebelum ongkir." />
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                    <input
                      value={voucher.inputCode}
                      onChange={(event) => voucher.setInputCode(event.target.value.toUpperCase())}
                      placeholder="Kode voucher"
                      className="h-12 rounded-2xl border px-4 text-sm font-semibold uppercase outline-none focus:border-[#263d27]"
                    />
                    <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-sm font-bold gap-2" onClick={voucher.applyVoucher}>
                      <BadgePercent className="h-4 w-4" />
                      Pakai
                    </Button>
                  </div>
                  {voucher.appliedVoucher ? (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#263d27]/14 bg-[#eef2e8] px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[#263d27]">{voucher.appliedVoucher.code} diterapkan</div>
                        <div className="mt-0.5 text-xs font-semibold text-[#51624b]">Hemat {formatTotal(voucher.discountAmount)}</div>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-xl text-[#263d27]" onClick={voucher.removeVoucher} aria-label="Hapus voucher">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : voucher.message ? (
                    <p className="mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">{voucher.message}</p>
                  ) : null}
                </section>
                <section ref={paymentSectionRef} className={`rounded-2xl border p-4 ${shippingComplete ? 'border-[#263d27]/20 bg-[#eef2e8]' : 'border-[#263d27]/10 bg-[#fbfaf7]'}`}>
                  <CheckoutSectionTitle step="4" title="Pembayaran & catatan" description="Pilih metode bayar, lalu tambahkan catatan jika perlu." />
                  {!shippingComplete ? (
                    <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-amber-800">
                      Pembayaran bisa dipilih sekarang, tapi order baru bisa dibuat setelah alamat dan ongkir lengkap.
                    </p>
                  ) : (
                    <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-[#263d27]">
                      Ongkir sudah masuk ke total. Pilih metode bayar, lalu buat order.
                    </p>
                  )}
                  <div className="mt-3 grid gap-3">
                    <div className="grid gap-2">
                      {checkoutPaymentMethods.map((method) => {
                        const active = selectedPaymentMethod === method.id;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setSelectedPaymentMethod(method.id)}
                            className={`rounded-2xl border px-4 py-3 text-left transition ${active ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-white'}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-bold text-[#0b130c]">{method.label}</span>
                              {active ? <span className="rounded-full bg-[#263d27] px-2 py-1 text-[10px] font-bold uppercase text-white">Dipilih</span> : null}
                            </div>
                            <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">{method.description}</p>
                            {method.accountNumber ? (
                              <p className="mt-2 text-xs font-bold text-[#263d27]">{method.bankName} {method.accountNumber} / A/N {method.accountName}</p>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan pengiriman atau request" rows={3} className="rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-[#263d27]" />
                  </div>
                </section>
              </div>
              <div className="mt-4 rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-[#0b130c]">Ringkasan produk</h3>
                  <span className="text-xs font-bold text-amber-700">{summary.quantity} item</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {items.map((item) => {
                    const discountedLine = discountedLineMap.get(item.slug);
                    const hasLineDiscount = Boolean(discountedLine?.discount);
                    const lineTotal = Number(item.priceNumber || 0) * Number(item.quantity || 0);

                    return (
                      <div key={`${item.slug}-checkout`} className="rounded-2xl border border-[#263d27]/10 bg-white px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-[#0b130c]">{item.name}</div>
                            <div className="mt-0.5 text-[11px] font-bold uppercase text-amber-700">{item.size} / x{item.quantity}</div>
                            {hasLineDiscount ? (
                              <div className="mt-1 text-[11px] font-bold text-[#263d27]">Setelah voucher: {formatTotal(discountedLine.discountedUnitPrice)} / item</div>
                            ) : null}
                          </div>
                          <div className="shrink-0 text-right">
                            {hasLineDiscount ? (
                              <div className="text-[11px] font-bold text-[#9ca3af] line-through">{formatTotal(discountedLine.originalTotal)}</div>
                            ) : null}
                            <div className="text-sm font-bold text-[#263d27]">{formatTotal(discountedLine?.discountedTotal ?? lineTotal)}</div>
                            {hasLineDiscount ? (
                              <div className="mt-0.5 text-[10px] font-bold text-emerald-700">-{formatTotal(discountedLine.discount)}</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-[#f7f8f2] p-4">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Subtotal</span>
                  <span>{formatTotal(summary.subtotal)}</span>
                </div>
                {discountAmount ? (
                  <div className="mt-2 flex items-center justify-between text-sm font-bold text-[#263d27]">
                    <span>Voucher {voucher.appliedVoucher?.code}</span>
                    <span>-{formatTotal(discountAmount)}</span>
                  </div>
                ) : null}
                {discountAmount ? (
                  <div className="mt-2 flex items-center justify-between text-sm font-bold text-muted-foreground">
                    <span>Subtotal setelah voucher</span>
                    <span>{formatTotal(discountedSubtotal)}</span>
                  </div>
                ) : null}
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
                <Button type="button" className="h-12 rounded-2xl gap-2 px-5" onClick={() => submitOrder()} disabled={!canSubmitCheckout}><CreditCard className="h-4 w-4" />{saving ? 'Memproses...' : (isManualPayment ? 'Buat order & upload bukti' : 'Bayar sekarang')}</Button>
                <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={clear}>Kosongkan</Button>
              </div>
            </aside>
          ) : null}
        </section>
      </main>
    </>
  );
};

export default CartPage;

