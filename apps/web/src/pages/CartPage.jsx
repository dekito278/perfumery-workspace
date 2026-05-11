import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CreditCard, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import { useCart } from '@/hooks/useCart.js';
import { checkoutCourierOptions, useCheckoutFlow } from '@/hooks/useCheckoutFlow.js';

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
  const { items, summary, updateQuantity, removeItem, clear } = useCart();
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
    shippingFee,
    totalDue,
    canSubmitCheckout,
    setCustomerName,
    setContact,
    setDeliveryAddress,
    setNotes,
    setSecurityAnswer,
    setSelectedShipping,
    chooseShippingCourier,
    updateCustomerCode,
    updateDestinationSearch,
    useCustomerLastAddress,
    useCustomerNewAddress,
    searchDestinations,
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
                    <div>
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
              {items.map((item) => (
                <article key={item.slug} className="rounded-2xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold">{item.name}</h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">{item.notes}</p>
                      <p className="mt-1 text-xs font-bold uppercase text-[#263d27]">{item.price} · {item.size}</p>
                    </div>
                    <Button type="button" size="icon" variant="outline" className="rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeItem(item.slug)} aria-label={`Hapus ${item.name}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Button type="button" size="icon" variant="outline" className="rounded-2xl bg-white" onClick={() => decreaseQuantity(item)}><Minus className="h-4 w-4" /></Button>
                    <span className="grid h-10 min-w-12 place-items-center rounded-2xl bg-[#f7f8f2] text-sm font-bold">{item.quantity}</span>
                    <Button type="button" size="icon" variant="outline" className="rounded-2xl bg-white" onClick={() => updateQuantity(item.slug, item.quantity + 1)} disabled={item.maxStock > 0 && item.quantity >= item.maxStock}><Plus className="h-4 w-4" /></Button>
                    {item.maxStock > 0 ? <span className="text-xs font-bold text-muted-foreground">stok {item.maxStock}</span> : null}
                  </div>
                </article>
              ))}
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
              <div className="mt-4 grid gap-4">
                <section className="rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] p-4">
                  <CheckoutSectionTitle step="1" title="Customer" description="Masuk sebagai repeat customer atau isi data baru." />
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                    <input value={customerCode} onChange={(event) => updateCustomerCode(event.target.value)} placeholder="Kode customer, contoh SOLI09232" className="h-12 rounded-2xl border px-4 text-sm font-semibold uppercase outline-none focus:border-[#263d27]" />
                    <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-sm font-bold" onClick={lookupCustomer} disabled={lookupLoading}>{lookupLoading ? '...' : 'Cek'}</Button>
                  </div>
                  <p className="mt-2 rounded-2xl bg-white px-4 py-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                    Customer baru bisa kosongkan kode. Setelah checkout, Solivagant akan membuat kode unik untuk order berikutnya.
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
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nama customer" className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="WhatsApp atau email" className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                <textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Alamat lengkap pengiriman" rows={3} className="rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-[#263d27]" />
                  </div>
                </section>
                <section className="rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] p-4">
                  <CheckoutSectionTitle step="3" title="Ongkir" description="Cari area, pilih ekspedisi, lalu pilih layanan ongkir." />
                  <div className="mt-3 grid gap-3">
                <div className="grid gap-2">
                  <div className="text-xs font-bold uppercase text-[#263d27]">Area ongkir</div>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input value={destinationSearch} onChange={(event) => updateDestinationSearch(event.target.value)} placeholder="Kecamatan / kota, contoh: Jakarta Selatan" className="h-12 rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" />
                    <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-sm font-bold" onClick={searchDestinations} disabled={shippingLoading || destinationSearch.trim().length < 3}>
                      Cari
                    </Button>
                  </div>
                  <p className="rounded-2xl bg-[#f7f8f2] px-4 py-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                    Alamat lengkap dipakai untuk kurir. Area ongkir dipakai khusus mencari tarif RajaOngkir.
                  </p>
                </div>
                <div className="grid gap-2">
                  <div className="text-xs font-bold uppercase text-[#263d27]">Pilih ekspedisi</div>
                  <select
                    value={selectedCourier}
                    onChange={(event) => chooseShippingCourier(event.target.value)}
                    className="h-12 rounded-2xl border bg-white px-4 text-sm font-bold text-[#0b130c] outline-none focus:border-[#263d27]"
                  >
                    <option value="">Pilih kurir</option>
                    {checkoutCourierOptions.map((courier) => (
                      <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
                    ))}
                  </select>
                </div>
                <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-sm font-bold" onClick={autoCalculateShipping} disabled={shippingLoading || destinationSearch.trim().length < 3 || !selectedCourier}>
                  {shippingLoading ? 'Menghitung ongkir...' : selectedDestination ? 'Tampilkan layanan ongkir' : 'Cari area ongkir'}
                </Button>
                {selectedDestination ? (
                  <p className="rounded-2xl bg-[#eef2e8] px-4 py-3 text-xs font-bold text-[#263d27]">
                    Area ongkir: {selectedDestination.label}
                  </p>
                ) : null}
                {destinationOptions.length ? (
                  <div className="grid gap-2">
                    <div className="text-xs font-bold uppercase text-[#263d27]">Pilih area tujuan</div>
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
                            <span className="text-sm font-bold text-[#263d27]">{formatTotal(rate.cost)}</span>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">{rate.etd ? `ETA ${rate.etd}` : rate.description || 'Estimasi mengikuti kurir'}</p>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {shippingError ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">{shippingError}</p> : null}
                  </div>
                </section>
                <section className="rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] p-4">
                  <CheckoutSectionTitle step="4" title="Catatan order" description="Catatan opsional sebelum order dibuat." />
                  <div className="mt-3">
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan pengiriman atau request" rows={3} className="rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-[#263d27]" />
                  </div>
                </section>
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
                <Button type="button" className="h-12 rounded-2xl gap-2 px-5" onClick={() => submitOrder()} disabled={!canSubmitCheckout}><CreditCard className="h-4 w-4" />{saving ? 'Memproses...' : 'Bayar sekarang'}</Button>
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

