import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { BadgePercent, ChevronDown, CreditCard, Search, ShoppingBag, X } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCart } from '@/hooks/useCart.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { checkoutCourierOptions, useCheckoutFlow } from '@/hooks/useCheckoutFlow.js';
import { checkoutPaymentMethods } from '@/services/cartService.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const courierLabels = checkoutCourierOptions.reduce((labels, courier) => ({
  ...labels,
  [courier.courierCode]: courier.label,
}), {});

const CheckoutPage = () => {
  const { items, summary, clear } = useCart();
  const voucher = useAppliedVoucher(summary.subtotal, items);
  const [showAreaSearch, setShowAreaSearch] = useState(false);
  const checkout = useCheckoutFlow({
    items,
    summary,
    clearCart: clear,
    paymentPath: '/payment',
    voucherCode: voucher.appliedVoucher?.code || '',
    voucherDiscount: voucher.discountAmount,
    voucherDetails: voucher.appliedVoucher,
    clearVoucher: voucher.removeVoucher,
  });
  const {
    customerCode, customerName, contact, deliveryAddress, notes, saving, lookupLoading,
    destinationSearch, destinationOptions, selectedDestination, selectedCourier, selectedShipping, shippingOptions,
    shippingLoading, shippingError, shippingNotice, shippingFee, discountAmount, totalDue, selectedPaymentMethod,
    canSubmitCheckout, updateCustomerCode, setCustomerName, setContact, setDeliveryAddress, setNotes,
    updateDestinationSearch, chooseShippingCourier, autoCalculateShipping, loadShippingRates, setSelectedShipping,
    setSelectedPaymentMethod, lookupCustomer, submitOrder,
  } = checkout;
  const visibleShippingOptions = useMemo(() => (
    selectedCourier ? shippingOptions.filter((rate) => rate.courierCode === selectedCourier) : shippingOptions
  ), [selectedCourier, shippingOptions]);
  const missingFields = [
    !customerName.trim() ? 'nama' : '',
    !contact.trim() ? 'kontak' : '',
    !deliveryAddress.trim() ? 'alamat' : '',
    !selectedShipping ? 'ongkir' : '',
  ].filter(Boolean).join(', ');

  const handleCourierChange = (courierCode) => {
    chooseShippingCourier(courierCode);
    if (!courierCode) return;
    const searchText = destinationSearch.trim() || deliveryAddress.trim();
    if (searchText.length >= 3) {
      autoCalculateShipping({ courierCode, searchText, autoSelectBest: true });
    } else {
      setShowAreaSearch(true);
    }
  };

  const submitCheckout = (event) => {
    event.preventDefault();
    submitOrder();
  };

  return (
    <>
      <Helmet>
        <title>Checkout - SOLIVAGANT</title>
      </Helmet>

      <main className="solivagant-editorial-home">
        <PublicHeader />

        <section className="cart-hero">
          <p className="editorial-eyebrow">CHECKOUT</p>
          <h1>Checkout</h1>
          <p>Lengkapi data pengiriman dan pembayaran untuk menyelesaikan pesanan.</p>
        </section>

        <section className="checkout-layout">
          {/* Checkout form */}
          <form className="checkout-form" onSubmit={submitCheckout}>
            {!items.length ? (
              <div className="cart-empty">
                <ShoppingBag className="h-8 w-8" />
                <h2>Keranjang kosong</h2>
                <p>Tambahkan produk sebelum checkout.</p>
                <Link to="/catalog" className="cart-empty__cta">Explore Collection</Link>
              </div>
            ) : null}

            {/* Customer info */}
            <fieldset className="checkout-fieldset">
              <legend className="editorial-eyebrow">INFORMASI PEMBELI</legend>
              <label className="checkout-field">
                <span>Customer code</span>
                <div className="checkout-field__inline">
                  <input type="text" value={customerCode} onChange={(event) => updateCustomerCode(event.target.value)} placeholder="Opsional untuk pembeli lama" />
                  <button type="button" onClick={lookupCustomer} disabled={lookupLoading || !customerCode.trim()}>
                    {lookupLoading ? 'Cek...' : 'Load'}
                  </button>
                </div>
              </label>
              <label className="checkout-field">
                <span>Nama lengkap</span>
                <input type="text" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nama pembeli" autoComplete="name" />
              </label>
              <label className="checkout-field">
                <span>WhatsApp</span>
                <input type="tel" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="081234567890" autoComplete="tel" />
              </label>
              <label className="checkout-field">
                <span>Alamat pengiriman</span>
                <textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} rows="3" placeholder="Alamat lengkap pengiriman" />
              </label>
            </fieldset>

            {/* Shipping */}
            <fieldset className="checkout-fieldset">
              <legend className="editorial-eyebrow">PENGIRIMAN</legend>
              <label className="checkout-field">
                <span>Kurir</span>
                <div className="checkout-select-wrap">
                  <select value={selectedCourier} onChange={(event) => handleCourierChange(event.target.value)} aria-label="Pilih kurir">
                    <option value="">Pilih kurir</option>
                    {checkoutCourierOptions.map((courier) => (
                      <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4" />
                </div>
              </label>
              {showAreaSearch || shippingError || destinationOptions.length ? (
                <label className="checkout-field">
                  <span>Area tujuan</span>
                  <div className="checkout-field__inline">
                    <input type="text" value={destinationSearch} onChange={(event) => updateDestinationSearch(event.target.value)} placeholder="Contoh: Kebayoran Baru" />
                    <button
                      type="button"
                      disabled={shippingLoading || !selectedCourier}
                      onClick={() => autoCalculateShipping({ searchText: destinationSearch || deliveryAddress, autoSelectBest: true })}
                    >
                      <Search className="h-4 w-4" /> Cari
                    </button>
                  </div>
                </label>
              ) : null}
              {shippingLoading ? <p className="checkout-notice">Mencari ongkir...</p> : null}
              {shippingNotice ? <p className="checkout-notice is-success">{shippingNotice}</p> : null}
              {shippingError ? <p className="checkout-notice is-error">{shippingError}</p> : null}
              {destinationOptions.length ? (
                <div className="checkout-options">
                  {destinationOptions.slice(0, 4).map((destination) => (
                    <button key={destination.id || destination.label} type="button" onClick={() => loadShippingRates(destination, { autoSelectCheapest: true })}>
                      {destination.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {visibleShippingOptions.length ? (
                <div className="checkout-options">
                  {visibleShippingOptions.map((rate) => (
                    <button
                      key={`${rate.courierCode}-${rate.service}-${rate.cost}`}
                      type="button"
                      className={selectedShipping?.service === rate.service && selectedShipping?.cost === rate.cost ? 'is-active' : ''}
                      onClick={() => setSelectedShipping(rate)}
                    >
                      {rate.service} / {formatTotal(rate.cost)}
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedDestination ? <p className="checkout-notice is-success">Area: {selectedDestination.label}</p> : null}
            </fieldset>

            {/* Voucher */}
            <fieldset className="checkout-fieldset">
              <legend className="editorial-eyebrow">VOUCHER</legend>
              <div className="cart-voucher" style={{ marginTop: 0, paddingTop: 0, border: 'none' }}>
                <label className="cart-voucher__label">
                  {voucher.appliedVoucher ? `${voucher.appliedVoucher.code} diterapkan` : 'Masukkan kode voucher'}
                </label>
                <div className="cart-voucher__input">
                  <input
                    type="text"
                    value={voucher.inputCode}
                    onChange={(event) => voucher.setInputCode(event.target.value)}
                    placeholder="Kode voucher"
                    disabled={!items.length || voucher.loading}
                  />
                  <button type="button" onClick={voucher.applyVoucher} disabled={!items.length || voucher.loading}>
                    <BadgePercent className="h-4 w-4" />
                    {voucher.loading ? 'Cek...' : 'Pakai'}
                  </button>
                </div>
                {voucher.message ? <p className={`cart-voucher__msg${voucher.appliedVoucher ? ' is-success' : ''}`}>{voucher.message}</p> : null}
                {voucher.appliedVoucher ? (
                  <button type="button" className="cart-voucher__remove" onClick={voucher.removeVoucher}>
                    <X className="h-3.5 w-3.5" /> Hapus voucher
                  </button>
                ) : null}
              </div>
            </fieldset>

            {/* Payment */}
            <fieldset className="checkout-fieldset">
              <legend className="editorial-eyebrow">PEMBAYARAN</legend>
              <label className="checkout-field">
                <span>Metode pembayaran</span>
                <div className="checkout-select-wrap">
                  <select value={selectedPaymentMethod} onChange={(event) => setSelectedPaymentMethod(event.target.value)}>
                    {checkoutPaymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>{method.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4" />
                </div>
              </label>
              <label className="checkout-field">
                <span>Catatan pengiriman</span>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="2" placeholder="Opsional" />
              </label>
            </fieldset>

            {/* Submit */}
            {!canSubmitCheckout && items.length ? <p className="checkout-notice is-error">Lengkapi: {missingFields || 'data checkout'}.</p> : null}
            <button type="submit" className="checkout-submit" disabled={!items.length || saving}>
              <CreditCard className="h-4 w-4" />
              {saving ? 'Memproses...' : 'Buat Pesanan'}
            </button>
          </form>

          {/* Order summary sidebar */}
          <aside className="cart-summary">
            <p className="editorial-eyebrow">RINGKASAN PESANAN</p>
            <h2>{items.length ? 'Produk yang dipilih' : 'Belum ada produk'}</h2>

            {items.map((item) => (
              <div key={item.slug} className="checkout-summary-line">
                <div className="checkout-summary-line__image">
                  <ProductVisual product={item} imageFit="cover" />
                </div>
                <div className="checkout-summary-line__info">
                  <strong>{item.name}</strong>
                  <span>{item.size} · Qty {item.quantity}</span>
                </div>
                <strong className="checkout-summary-line__price">{formatTotal(Number(item.priceNumber || 0) * Number(item.quantity || 0))}</strong>
              </div>
            ))}

            <div className="cart-totals" style={{ marginTop: items.length ? '20px' : '0' }}>
              <div className="cart-totals__row">
                <span>Subtotal</span>
                <strong>{formatTotal(summary.subtotal)}</strong>
              </div>
              {shippingFee ? (
                <div className="cart-totals__row">
                  <span>Ongkir</span>
                  <strong>{formatTotal(shippingFee)}</strong>
                </div>
              ) : null}
              {voucher.discountAmount ? (
                <div className="cart-totals__row cart-totals__row--discount">
                  <span>Voucher {voucher.appliedVoucher?.code}</span>
                  <strong>-{formatTotal(voucher.discountAmount)}</strong>
                </div>
              ) : null}
              <div className="cart-totals__row" style={{ paddingTop: '12px', borderTop: `1px solid var(--editorial-border)`, marginTop: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--editorial-charcoal)' }}>Total</span>
                <strong style={{ fontSize: '1.05rem' }}>{formatTotal(totalDue)}</strong>
              </div>
            </div>

            <Link to="/cart" className="cart-actions__secondary" style={{ marginTop: '20px' }}>Kembali ke Cart</Link>
          </aside>
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default CheckoutPage;
