import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, CreditCard, Minus, PackageCheck, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
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
    destinationOptions,
    selectedDestination,
    shippingOptions,
    selectedCourier,
    selectedShipping,
    shippingLoading,
    shippingError,
    shippingFee,
    totalDue,
    setCustomerName,
    setContact,
    setDeliveryAddress,
    setNotes,
    setSecurityAnswer,
    setSelectedShipping,
    chooseShippingCourier,
    updateCustomerCode,
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
    paymentPath: '/mobile/payment',
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
    <MobileCommerceLayout>
      <Helmet>
        <title>Cart - Solivagant</title>
      </Helmet>
      <main className="mobile-page space-y-4">
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
                <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl bg-white" onClick={() => updateQuantity(item.slug, item.quantity + 1)} disabled={item.maxStock > 0 && item.quantity >= item.maxStock} aria-label={`Increase ${item.name}`}>
                  <Plus className="h-4 w-4" />
                </Button>
                {item.maxStock > 0 ? <span className="text-[10px] font-bold text-[#8b949e]">stok {item.maxStock}</span> : null}
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
        <MobileBottomSheet
          open={checkoutOpen && Boolean(items.length)}
          onOpenChange={setCheckoutOpen}
          title="Checkout"
          description={`${formatCartSubtitle(items, summary.quantity)} / ${formatTotal(totalDue)}`}
        >
          <div className="space-y-3">
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
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-[#263d27]" onClick={() => updateQuantity(item.slug, item.quantity + 1)} disabled={item.maxStock > 0 && item.quantity >= item.maxStock} aria-label={`Increase ${item.name}`}>
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
                    <input value={customerCode} onChange={(event) => updateCustomerCode(event.target.value)} placeholder="Customer code, e.g. SOLI09232" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold uppercase outline-none focus:border-amber-300" />
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
                  <div className="grid gap-2">
                    <div className="text-[10px] font-bold uppercase text-amber-700">Pilih ekspedisi</div>
                    <select
                      value={selectedCourier}
                      onChange={(event) => chooseShippingCourier(event.target.value)}
                      className="h-12 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-bold text-[#1f2937] outline-none focus:border-amber-300"
                    >
                      <option value="">Pilih kurir</option>
                      {checkoutCourierOptions.map((courier) => (
                        <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
                      ))}
                    </select>
                  </div>
                  <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={autoCalculateShipping} disabled={shippingLoading || deliveryAddress.trim().length < 8}>
                    {shippingLoading ? 'Menghitung ongkir...' : 'Hitung ongkir otomatis'}
                  </Button>
                  {selectedDestination ? (
                    <p className="rounded-2xl bg-[#eef2e8] px-3 py-2 text-[11px] font-bold text-[#263d27]">
                      Area ongkir: {selectedDestination.label}
                    </p>
                  ) : null}
                  {destinationOptions.length ? (
                    <div className="grid gap-2">
                      <div className="text-[10px] font-bold uppercase text-amber-700">Pilih area jika hasil otomatis belum tepat</div>
                      {destinationOptions.map((destination) => (
                        <button key={destination.id} type="button" onClick={() => loadShippingRates(destination)} className="rounded-2xl border border-[#263d27]/10 bg-[#f8f7f4] px-3 py-2 text-left text-xs font-bold text-[#263d27]">
                          {destination.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {visibleShippingOptions.length ? (
                    <div className="grid gap-2">
                      <div className="text-[10px] font-bold uppercase text-amber-700">Harga {courierLabels[selectedCourier] || 'ekspedisi'}</div>
                      {visibleShippingOptions.map((rate) => {
                        const active = selectedShipping?.courierCode === rate.courierCode && selectedShipping?.service === rate.service;
                        return (
                          <button key={`${rate.courierCode}-${rate.service}-${rate.cost}`} type="button" onClick={() => setSelectedShipping(rate)} className={`rounded-2xl border px-3 py-3 text-left transition ${active ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-white'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-bold text-[#1f2937]">{courierLabels[rate.courierCode] || rate.courierName} {rate.serviceLabel || rate.service}</span>
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
                <Button type="button" className="h-12 w-full rounded-2xl gap-2" onClick={() => submitOrder({ onSuccess: () => setCheckoutOpen(false) })} disabled={saving}>
                  <CreditCard className="h-4 w-4" />
                  {saving ? 'Memproses...' : 'Bayar sekarang'}
                </Button>
              </div>
          </div>
        </MobileBottomSheet>
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileCartPage;
