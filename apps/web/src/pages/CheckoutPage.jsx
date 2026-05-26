import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ChevronDown, CreditCard, Search, ShoppingBag } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCart } from '@/hooks/useCart.js';
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

        <section className="editorial-page-hero">
          <p className="editorial-eyebrow">SECURE CHECKOUT</p>
          <h1>Checkout</h1>
          <p>Lengkapi kontak, alamat, ongkir, dan metode pembayaran. Setelah order dibuat, kamu akan diarahkan ke instruksi pembayaran yang sesuai.</p>
        </section>

        <section className="editorial-section editorial-checkout-page editorial-section--compact">
          <form className="editorial-form" onSubmit={submitCheckout}>
            <p className="editorial-eyebrow">CUSTOMER INFORMATION</p>
            {!items.length ? (
              <div className="editorial-empty-state editorial-empty-state--inline">
                <ShoppingBag className="h-8 w-8" />
                <p>Keranjang masih kosong. Tambahkan produk ready stock sebelum checkout.</p>
                <Link to="/catalog" className="editorial-button editorial-button--primary">Explore Collection</Link>
              </div>
            ) : null}
            <label>
              Customer code
              <div className="editorial-inline-field">
                <input type="text" value={customerCode} onChange={(event) => updateCustomerCode(event.target.value)} placeholder="Opsional untuk pembeli lama" />
                <button type="button" className="editorial-button" onClick={lookupCustomer} disabled={lookupLoading || !customerCode.trim()}>
                  {lookupLoading ? 'Checking' : 'Load'}
                </button>
              </div>
            </label>
            <label>
              Full name
              <input type="text" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nama pembeli" autoComplete="name" />
            </label>
            <label>
              WhatsApp
              <input type="tel" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="081234567890" autoComplete="tel" />
            </label>
            <label>
              Shipping address
              <textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} rows="4" placeholder="Alamat lengkap pengiriman" />
            </label>
            <label>
              Courier
              <span className={`editorial-select-shell ${selectedCourier ? 'is-selected' : ''}`}>
                <span>{selectedCourier ? courierLabels[selectedCourier] || selectedCourier.toUpperCase() : 'Pilih kurir'}</span>
                <ChevronDown className="h-4 w-4" />
                <select value={selectedCourier} onChange={(event) => handleCourierChange(event.target.value)} aria-label="Pilih kurir">
                  <option value="">Pilih kurir</option>
                  {checkoutCourierOptions.map((courier) => (
                    <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
                  ))}
                </select>
              </span>
            </label>
            {showAreaSearch || shippingError || destinationOptions.length ? (
              <label>
                Area ongkir
                <div className="editorial-inline-field">
                  <input type="text" value={destinationSearch} onChange={(event) => updateDestinationSearch(event.target.value)} placeholder="Contoh: Kebayoran Baru" />
                  <button
                    type="button"
                    className="editorial-button"
                    disabled={shippingLoading || !selectedCourier}
                    onClick={() => autoCalculateShipping({ searchText: destinationSearch || deliveryAddress, autoSelectBest: true })}
                  >
                    <Search className="h-4 w-4" />
                    Cari
                  </button>
                </div>
              </label>
            ) : null}
            {shippingLoading ? <p className="editorial-notice">Mencari ongkir...</p> : null}
            {shippingNotice ? <p className="editorial-notice editorial-notice--success">{shippingNotice}</p> : null}
            {shippingError ? <p className="editorial-form-error">{shippingError}</p> : null}
            {destinationOptions.length ? (
              <div className="editorial-option-grid">
                {destinationOptions.slice(0, 4).map((destination) => (
                  <button key={destination.id || destination.label} type="button" onClick={() => loadShippingRates(destination, { autoSelectCheapest: true })}>
                    {destination.label}
                  </button>
                ))}
              </div>
            ) : null}
            {visibleShippingOptions.length ? (
              <div className="editorial-option-grid">
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
            {selectedDestination ? <p className="editorial-notice editorial-notice--success">Area: {selectedDestination.label}</p> : null}
            <label>
              Payment
              <select value={selectedPaymentMethod} onChange={(event) => setSelectedPaymentMethod(event.target.value)}>
                {checkoutPaymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>{method.label}</option>
                ))}
              </select>
            </label>
            <label>
              Delivery notes
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="3" placeholder="Catatan pengiriman opsional" />
            </label>
            <div className="editorial-checkout-fields">
              <span>Subtotal: {formatTotal(summary.subtotal)}</span>
              <span>Ongkir: {selectedShipping ? formatTotal(shippingFee) : 'Belum dipilih'}</span>
              <span>Diskon: {discountAmount ? `-${formatTotal(discountAmount)}` : '-'}</span>
              <span>Total: {formatTotal(totalDue)}</span>
            </div>
            {!canSubmitCheckout && items.length ? <p className="editorial-form-error">Lengkapi: {missingFields || 'data checkout'}.</p> : null}
            <button type="submit" className="editorial-button editorial-button--primary" disabled={!items.length || saving}>
              {saving ? 'Saving order...' : 'Place Order'}
              <CreditCard className="h-4 w-4" />
            </button>
          </form>

          <aside className="editorial-cart-preview">
            <p className="editorial-eyebrow">ORDER SUMMARY</p>
            <h2>{items.length ? 'Selected works.' : 'No item selected.'}</h2>
            {items.map((item) => (
              <div key={item.slug} className="editorial-cart-line">
                <ProductVisual product={item} className="editorial-cart-line__image" imageFit="cover" />
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.size} / Qty {item.quantity}</span>
                </div>
                <strong>{formatTotal(Number(item.priceNumber || 0) * Number(item.quantity || 0))}</strong>
              </div>
            ))}
            <div className="editorial-subtotal"><span>Total</span><strong>{formatTotal(totalDue)}</strong></div>
            <Link to="/cart" className="editorial-button">Return to Cart</Link>
          </aside>
        </section>

        <footer className="editorial-footer">
          <span>SOLIVAGANT by Dekito</span>
          <Link to="/track-order">Track Order</Link>
        </footer>
      </main>
    </>
  );
};

export default CheckoutPage;
