import { useTranslate } from '@/hooks/useTranslate.js';
import InternationalCheckoutNotice from '@/components/storefront/InternationalCheckoutNotice.jsx';
import InternationalDeliveryFields from '@/components/storefront/InternationalDeliveryFields.jsx';
import CartPriceChange from '@/components/storefront/CartPriceChange.jsx';
import { asCustomerCode } from '@/utils/customerCode.js';
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { BadgePercent, ChevronDown, CreditCard, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCart } from '@/hooks/useCart.js';
import { useMemberPrices } from '@/hooks/useStorefrontProducts.js';
import { memberSavingForCart } from '@/utils/memberPriceNudge.js';
import { checkoutCourierOptions, useCheckoutFlow } from '@/hooks/useCheckoutFlow.js';
import { checkoutPaymentMethods } from '@/services/cartService.js';
import { publicErrorMessage } from '@/utils/publicErrorMessage.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const courierLabels = checkoutCourierOptions.reduce((labels, courier) => ({
  ...labels,
  [courier.courierCode]: courier.label,
}), {});

const CheckoutPage = () => {
  const { t } = useTranslate();
  const { items, summary, clear } = useCart();
  const { currentUser, loginWithGoogle, logout } = useAuth();
  // What this cart would save at member prices. 0 whenever there is nothing to say — no member prices
  // filled in, or the visitor already pays them — and 0 keeps the ordinary "data terisi otomatis" copy.
  const { index: memberIndex } = useMemberPrices();
  const memberSaving = memberSavingForCart(items, memberIndex);
  const voucher = useAppliedVoucher(summary.subtotal, items);
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
    securityChallenge, securityAnswer, setSecurityAnswer, verifyCustomerSecurity,
    destinationSearch, destinationOptions, selectedDestination, selectedCourier, selectedShipping, shippingOptions,
    shippingLoading, shippingError, shippingNotice, shippingFee, discountAmount, totalDue, selectedPaymentMethod,
    canSubmitCheckout, blockedItems, validPhoneContact, updateCustomerCode, setCustomerName, setContact, setDeliveryAddress, setNotes,
    updateDestinationSearch, chooseShippingCourier, autoCalculateShipping, loadShippingRates, setSelectedShipping,
    setSelectedPaymentMethod, lookupCustomer, submitOrder,
    deliveryCountry, setDeliveryCountry, destination, isInternational,
  } = checkout;
  const visibleShippingOptions = useMemo(() => (
    selectedCourier ? shippingOptions.filter((rate) => rate.courierCode === selectedCourier) : shippingOptions
  ), [selectedCourier, shippingOptions]);
  // Keep in sync with canSubmitCheckout in useCheckoutFlow so the notice names every
  // actually-missing field (previously omitted valid phone, destination, courier, payment).
  const missingFields = [
    !customerName.trim() ? t('checkout.fieldName') : '',
    !contact.trim() ? t('checkout.fieldContact') : (!validPhoneContact ? t('checkout.fieldValidPhone') : ''),
    !deliveryAddress.trim() ? t('checkout.fieldAddress') : '',
    // The two shops ask for different things, and a notice listing "courier" to a buyer in Berlin names
    // a field that is not on their screen.
    ...(isInternational
      ? [!destination ? t('checkout.fieldCountry') : '']
      : [
        !selectedDestination ? t('checkout.fieldDestination') : '',
        !selectedCourier ? t('checkout.fieldCourier') : '',
        !selectedShipping ? t('checkout.fieldRate') : '',
      ]),
    !selectedPaymentMethod ? t('checkout.fieldPayment') : '',
    // canSubmitCheckout also refuses lines whose product is gone or sold out; name them, otherwise the
    // notice names nothing to act on (audit round 9).
    blockedItems.length ? t('checkout.fieldBlocked', { names: blockedItems.map((item) => item.name).join(', ') }) : '',
  ].filter(Boolean).join(', ');

  const handleGoogleLogin = async () => {
    try {
      // Return to a CLEAN checkout URL (no hash/query) so Supabase appends a single #access_token it can
      // parse — window.location.href can carry a stale hash and produce ##access_token, which fails to
      // parse (session then only appears after a manual refresh). useCheckoutFlow prefills once logged in.
      await loginWithGoogle(`${window.location.origin}${window.location.pathname}`);
    } catch (error) {
      toast.error(publicErrorMessage(error, t('checkout.googleFail')));
    }
  };

  const [triedSubmit, setTriedSubmit] = useState(false);
  const fieldErrors = {
    customerName: !customerName.trim() ? t('checkout.errName') : '',
    contact: !contact.trim() ? t('checkout.errPhone') : (!validPhoneContact ? t('checkout.errPhoneInvalid') : ''),
    deliveryAddress: !deliveryAddress.trim() ? t('checkout.errAddress') : '',
  };
  const handleSubmitAttempt = (event) => {
    setTriedSubmit(true);
    submitCheckout(event);
  };

  // Derived, never latched. A returning buyer arrives with selectedCourier already restored from the
  // saved draft, so handleCourierChange never runs — the old useState stayed false and the page asked for
  // a destination while showing no field to type one into. The only way out was changing the courier and
  // changing it back, which nobody would guess. Anyone who has a courier but no shipping service yet needs
  // this field, however the courier got there.
  const showAreaSearch = Boolean(selectedCourier && !selectedShipping) || Boolean(shippingError) || destinationOptions.length > 0;

  const handleCourierChange = (courierCode) => {
    chooseShippingCourier(courierCode);
    if (!courierCode) return;
    const searchText = destinationSearch.trim() || deliveryAddress.trim();
    if (searchText.length >= 3) {
      autoCalculateShipping({ courierCode, searchText, autoSelectBest: true });
    }
  };

  const submitCheckout = (event) => {
    event.preventDefault();
    submitOrder();
  };

  if (!items.length) {
    return (
      <>
        <Helmet>
          <title>{t('checkout.tab')}</title>
        </Helmet>
        <main className="solivagant-editorial-home">
          <PublicHeader />
          <section className="cart-hero">
            <p className="editorial-eyebrow">CHECKOUT</p>
            <h1>Checkout</h1>
            <p>{t('checkout.emptyTitle')}</p>
          </section>
          <section className="checkout-layout">
            <div className="cart-empty">
              <ShoppingBag className="h-8 w-8" />
              <h2>{t('checkout.emptyEyebrow')}</h2>
              <p>{t('checkout.emptyBody')}</p>
              <Link to="/catalog" className="cart-empty__cta">{t('home.seeCollection')}</Link>
            </div>
          </section>
          <StorefrontFooter />
        </main>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t('checkout.tab')}</title>
      </Helmet>

      <main className="solivagant-editorial-home">
        <PublicHeader />

        <section className="cart-hero">
          <p className="editorial-eyebrow">CHECKOUT</p>
          <h1>Checkout</h1>
          <p>{t('checkout.lead')}</p>
        </section>

        <section className="checkout-layout">
          {/* Checkout form */}
          <InternationalCheckoutNotice className="mb-4" />
          <form className="checkout-form" onSubmit={handleSubmitAttempt} noValidate>
            {/* Customer info */}
            <fieldset className="checkout-fieldset">
              <legend className="editorial-eyebrow">{t('checkout.buyerInfo')}</legend>
              {currentUser ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 14px', borderRadius: '14px', background: '#f3f1ec', fontSize: '0.8rem', fontWeight: 600, marginBottom: '12px' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('checkout.signedInAuto', { email: currentUser.email })}</span>
                  <button type="button" onClick={logout} style={{ flexShrink: 0, fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>{t('checkout.signOut')}</button>
                </div>
              ) : (
                <button type="button" onClick={handleGoogleLogin} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', borderRadius: '14px', border: '1px solid #d8d2c4', background: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', marginBottom: '12px' }}>
                  <UserRound size={16} />
                  {memberSaving > 0
                    ? t('checkout.signInSaving', { amount: formatTotal(memberSaving) })
                    : t('checkout.signInPlain')}
                </button>
              )}
              <label className="checkout-field">
                <span>{t('checkout.customerCode')}</span>
                <div className="checkout-field__inline">
                  <input type="text" value={customerCode} onChange={(event) => updateCustomerCode(event.target.value)} placeholder={t('checkout.customerCodePlaceholder')} aria-label={t('checkout.customerCode')} autoComplete="off" />
                  <button type="button" onClick={lookupCustomer} disabled={lookupLoading || !customerCode.trim()}>
                    {lookupLoading ? t('checkout.checking') : t('checkout.load')}
                  </button>
                </div>
                {/* Outside .checkout-field__inline, which is a flex row: inside it, the hint became a
                    third column and squeezed the field and the button. */}
                {customerCode.trim() && !asCustomerCode(customerCode) ? (
                  <p className="checkout-helper-text" role="status">{t('checkout.codeUnknown')}</p>
                ) : null}
              </label>
              {securityChallenge ? (
                <label className="checkout-field">
                  <span>{securityChallenge.securityQuestion || t('checkout.securityQuestion')}</span>
                  <div className="checkout-field__inline">
                    <input
                      type="text"
                      value={securityAnswer}
                      onChange={(event) => setSecurityAnswer(event.target.value)}
                      placeholder={t('checkout.securityAnswer')} aria-label={t('checkout.securityAnswer')}
                      autoComplete="off"
                    />
                    <button type="button" onClick={verifyCustomerSecurity} disabled={lookupLoading || !securityAnswer.trim()}>
                      {lookupLoading ? t('checkout.checking') : t('checkout.verify')}
                    </button>
                  </div>
                </label>
              ) : null}
              <label className="checkout-field">
                <span>{t('checkout.fullName')}</span>
                <input type="text" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder={t('checkout.namePlaceholder')} aria-label={t('checkout.namePlaceholder')} autoComplete="name" aria-invalid={triedSubmit && fieldErrors.customerName ? 'true' : undefined} />
                {triedSubmit && fieldErrors.customerName ? <span className="checkout-field__error" role="alert">{fieldErrors.customerName}</span> : null}
              </label>
              <label className="checkout-field">
                <span>{t('checkout.whatsapp')}</span>
                <input type="tel" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="081234567890" aria-label={t('checkout.whatsappAria')} autoComplete="tel" aria-invalid={triedSubmit && fieldErrors.contact ? 'true' : undefined} />
                {triedSubmit && fieldErrors.contact ? <span className="checkout-field__error" role="alert">{fieldErrors.contact}</span> : null}
              </label>
              <label className="checkout-field">
                <span>{t('checkout.address')}</span>
                <textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} rows="3" placeholder={t('checkout.addressPlaceholder')} aria-label={t('checkout.address')} autoComplete="street-address" aria-invalid={triedSubmit && fieldErrors.deliveryAddress ? 'true' : undefined} />
                {triedSubmit && fieldErrors.deliveryAddress ? <span className="checkout-field__error" role="alert">{fieldErrors.deliveryAddress}</span> : null}
              </label>
            </fieldset>

            {/* Shipping. The international half asks where the parcel goes and stops there: there is no
                courier list to show, because RajaOngkir only knows Indonesian addresses. */}
            <fieldset className="checkout-fieldset">
              <legend className="editorial-eyebrow">{t('checkout.deliveryLegend')}</legend>
              {isInternational ? (
                <InternationalDeliveryFields
                  value={deliveryCountry}
                  onChange={setDeliveryCountry}
                  destination={destination}
                  invalid={triedSubmit && !destination}
                />
              ) : (
              <>
              <label className="checkout-field">
                <span>{t('checkout.courier')}</span>
                <div className="checkout-select-wrap">
                  <select value={selectedCourier} onChange={(event) => handleCourierChange(event.target.value)} aria-label={t('checkout.pickCourier')}>
                    <option value="">{t('checkout.pickCourier')}</option>
                    {checkoutCourierOptions.map((courier) => (
                      <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4" />
                </div>
              </label>
              {showAreaSearch ? (
                <label className="checkout-field">
                  <span>{t('checkout.destination')}</span>
                  <div className="checkout-field__inline">
                    <input type="text" value={destinationSearch} onChange={(event) => updateDestinationSearch(event.target.value)} placeholder={t('checkout.destinationPlaceholder')} aria-label={t('checkout.destinationAria')} autoComplete="off" />
                    <button
                      type="button"
                      disabled={shippingLoading || !selectedCourier}
                      onClick={() => autoCalculateShipping({ searchText: destinationSearch || deliveryAddress, autoSelectBest: true })}
                    >
                      <Search className="h-4 w-4" /> {t('checkout.search')}
                    </button>
                  </div>
                </label>
              ) : null}
              {shippingLoading ? <p className="checkout-notice">{t('checkout.searchingRates')}</p> : null}
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
              {selectedDestination ? <p className="checkout-notice is-success">{t('ship.area', { area: selectedDestination.label })}</p> : null}
              </>
              )}
            </fieldset>

            {/* Voucher */}
            <fieldset className="checkout-fieldset">
              <legend className="editorial-eyebrow">VOUCHER</legend>
              <div className="cart-voucher" style={{ marginTop: 0, paddingTop: 0, border: 'none' }}>
                <label className="cart-voucher__label">
                  {voucher.appliedVoucher ? t('cart.voucherApplied', { code: voucher.appliedVoucher.code }) : t('checkout.voucherEnter')}
                </label>
                <div className="cart-voucher__input">
                  <input
                    type="text"
                    value={voucher.inputCode}
                    onChange={(event) => voucher.setInputCode(event.target.value)}
                    placeholder={t('checkout.voucherPlaceholder')} aria-label={t('checkout.voucherPlaceholder')}
                    autoComplete="off"
                    disabled={!items.length || voucher.loading}
                  />
                  <button type="button" onClick={voucher.applyVoucher} disabled={!items.length || voucher.loading}>
                    <BadgePercent className="h-4 w-4" />
                    {voucher.loading ? t('checkout.checking') : t('checkout.voucherApply')}
                  </button>
                </div>
                {voucher.message ? <p className={`cart-voucher__msg${voucher.appliedVoucher ? ' is-success' : ''}`}>{voucher.message}</p> : null}
                {voucher.appliedVoucher ? (
                  <button type="button" className="cart-voucher__remove" onClick={voucher.removeVoucher}>
                    <X className="h-3.5 w-3.5" /> {t('cart.voucherRemove')}
                  </button>
                ) : null}
              </div>
            </fieldset>

            {/* Payment */}
            <fieldset className="checkout-fieldset">
              <legend className="editorial-eyebrow">{t('checkout.paymentLegend')}</legend>
              <label className="checkout-field">
                <span>{t('checkout.paymentMethod')}</span>
                <div className="checkout-select-wrap">
                  <select value={selectedPaymentMethod} onChange={(event) => setSelectedPaymentMethod(event.target.value)}>
                    {checkoutPaymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>{t(method.labelKey)}</option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4" />
                </div>
              </label>
              <label className="checkout-field">
                <span>{t('checkout.deliveryNote')}</span>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="2" placeholder={t('checkout.optional')} aria-label={t('checkout.deliveryNote')} autoComplete="off" />
              </label>
            </fieldset>

            {/* Submit */}
            {/* Said on the cart page, and again here: this is the screen where the number becomes a
                transfer instruction, and a total that moved without explanation is a total nobody trusts. */}
            {items.some((item) => item.priceChanged) ? (
              <p className="checkout-notice" role="status">{t('checkout.pricesUpdated')}</p>
            ) : null}
            {!canSubmitCheckout && items.length ? <p className="checkout-notice is-error">{t('checkout.missingFields', { fields: missingFields || t('checkout.missingFieldsFallback') })}</p> : null}
            <button type="submit" className="checkout-submit" disabled={!items.length || saving}>
              <CreditCard className="h-4 w-4" />
              {saving ? t('checkout.processing') : t('checkout.placeOrder')}
            </button>
          </form>

          {/* Order summary sidebar */}
          <aside className="cart-summary">
            <p className="editorial-eyebrow">{t('checkout.summary')}</p>
            <h2>{items.length ? t('checkout.chosenProducts') : t('checkout.noProducts')}</h2>

            {items.map((item) => (
              <div key={item.slug} className="checkout-summary-line">
                <div className="checkout-summary-line__image">
                  <ProductVisual product={item} imageFit="cover" />
                </div>
                <div className="checkout-summary-line__info">
                  <strong>{item.name}</strong>
                  <span>{t('checkout.sizeQty', { size: item.size, qty: item.quantity })}</span>
                  <CartPriceChange item={item} />
                </div>
                <strong className="checkout-summary-line__price">{formatTotal(Number(item.priceNumber || 0) * Number(item.quantity || 0))}</strong>
              </div>
            ))}

            <div className="cart-totals" style={{ marginTop: items.length ? '20px' : '0' }}>
              <div className="cart-totals__row">
                <span>{t('checkout.subtotal')}</span>
                <strong>{formatTotal(summary.subtotal)}</strong>
              </div>
              {shippingFee ? (
                <div className="cart-totals__row">
                  <span>{t('checkout.shipping')}</span>
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
                <span style={{ fontWeight: 700, color: 'var(--editorial-charcoal)' }}>{t('checkout.total')}</span>
                <strong style={{ fontSize: '1.05rem' }}>{formatTotal(totalDue)}</strong>
              </div>
            </div>

            <Link to="/cart" className="cart-actions__secondary" style={{ marginTop: '20px' }}>{t('checkout.backToCart')}</Link>
          </aside>
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default CheckoutPage;
