import { useTranslate } from '@/hooks/useTranslate.js';
import { FREE_VIAL_PRICE_LABEL, isFreeVialLine } from '@/utils/freeVial.js';
import CartPriceChange from '@/components/storefront/CartPriceChange.jsx';
import { asCustomerCode } from '@/utils/customerCode.js';
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { BadgePercent, CreditCard, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useSignOut } from '@/hooks/useSignOut.js';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCart } from '@/hooks/useCart.js';
import { useMemberPrices } from '@/hooks/useStorefrontProducts.js';
import { memberSavingForCart } from '@/utils/memberPriceNudge.js';
import { checkoutCourierOptions, useCheckoutFlow } from '@/hooks/useCheckoutFlow.js';
import { checkoutPaymentMethods } from '@/services/cartService.js';
import { publicErrorMessage } from '@/utils/publicErrorMessage.js';
import { splitScriptName } from '@/utils/scriptName.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const courierLabels = checkoutCourierOptions.reduce((labels, courier) => ({
  ...labels,
  [courier.courierCode]: courier.label,
}), {});

const CheckoutPage = () => {
  const { t } = useTranslate();
  const { items, summary, clear } = useCart();
  const { currentUser, loginWithGoogle } = useAuth();
  // Stays on the page: a buyer signing out mid-checkout keeps their place, and a refused sign-out says so.
  const { signOut } = useSignOut(null);
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
    repeatCustomer, repeatAddressMode, useCustomerLastAddress, useCustomerNewAddress,
    securityChallenge, securityAnswer, setSecurityAnswer, verifyCustomerSecurity,
    destinationSearch, destinationOptions, selectedDestination, selectedCourier, selectedShipping, shippingOptions,
    shippingLoading, shippingError, shippingNotice, shippingFee, discountAmount, totalDue, selectedPaymentMethod,
    canSubmitCheckout, blockedItems, validPhoneContact, updateCustomerCode, setCustomerName, setContact, setDeliveryAddress, setNotes,
    updateDestinationSearch, chooseShippingCourier, autoCalculateShipping, loadShippingRates, setSelectedShipping,
    setSelectedPaymentMethod, lookupCustomer, submitOrder,
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
    !selectedDestination ? t('checkout.fieldDestination') : '',
    !selectedCourier ? t('checkout.fieldCourier') : '',
    !selectedShipping ? t('checkout.fieldRate') : '',
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
  // The area search on request, as the phone offered it: for when the full address did not find the right
  // shipping area on its own.
  const [manualArea, setManualArea] = useState(false);
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
          <section className="ng-section !pt-14 md:!pt-20">
            <div className="ng-container flex flex-col items-start gap-6">
              <p className="ng-eyebrow ng-mono m-0">{t('checkout.eyebrow')}</p>
              <h1 className="ng-display ng-h1">{t('checkout.title')}</h1>
              <p className="ng-lead">{t('checkout.emptyTitle')}</p>
              {/* The heading already says the cart is empty; what is left is the instruction and the way out. */}
              <p className="m-0 flex items-center gap-3 text-ng-dust"><ShoppingBag className="h-5 w-5" aria-hidden="true" /> {t('checkout.emptyBody')}</p>
              <Link to="/catalog" className="ng-btn">{t('home.seeCollection')}</Link>
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

        <section className="ng-section !border-b-0 !pt-14 md:!pt-20">
          <div className="ng-container flex flex-col gap-12">
            <div className="flex flex-col gap-5">
              <p className="ng-eyebrow ng-mono m-0">{t('checkout.ngStep')}</p>
              <h1 className="ng-display ng-h1">{t('checkout.title')}</h1>
              <p className="ng-lead">{t('checkout.lead')}</p>
            </div>

            <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-[72px]">
              <form id="checkout-form" className="flex flex-col gap-14" onSubmit={handleSubmitAttempt} noValidate>
                {/* Customer info */}
                <fieldset className="ng-fieldset">
                  <legend className="ng-legend"><span className="ng-mono text-ng-ember">I</span>{t('checkout.buyerInfo')}</legend>
                  {currentUser ? (
                    <div className="flex items-center justify-between gap-3 border border-ng-bone/20 px-4 py-3 text-sm">
                      <span className="min-w-0 truncate text-ng-sand">{t('checkout.signedInAuto', { email: currentUser.email })}</span>
                      <button type="button" onClick={signOut} className="ng-link ng-mono min-h-[44px] shrink-0 border-0 bg-transparent p-0 underline underline-offset-4">{t('checkout.signOut')}</button>
                    </div>
                  ) : (
                    <button type="button" onClick={handleGoogleLogin} className="ng-btn ng-btn--ghost ng-btn--block !min-h-[56px] !justify-start !normal-case !tracking-normal !font-ng-body !text-[15px]">
                      <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {memberSaving > 0
                        ? t('checkout.signInSaving', { amount: formatTotal(memberSaving) })
                        : t('checkout.signInPlain')}
                    </button>
                  )}
                  <label className="ng-label">
                    <span className="ng-mono text-ng-dust">{t('checkout.customerCode')}</span>
                    <div className="flex gap-2">
                      <input type="text" className="ng-field uppercase placeholder:normal-case" value={customerCode} onChange={(event) => updateCustomerCode(event.target.value)} placeholder={t('checkout.customerCodePlaceholder')} aria-label={t('checkout.customerCode')} autoComplete="off" />
                      <button type="button" className="ng-btn ng-btn--ghost shrink-0" onClick={lookupCustomer} disabled={lookupLoading || !customerCode.trim()}>
                        {lookupLoading ? t('checkout.checking') : t('checkout.load')}
                      </button>
                    </div>
                    {customerCode.trim() && !asCustomerCode(customerCode) ? (
                      <p className="m-0 text-sm text-ng-dust" role="status">{t('checkout.codeUnknown')}</p>
                    ) : null}
                  </label>
                  {securityChallenge ? (
                    <label className="ng-label">
                      <span className="ng-mono text-ng-dust">{securityChallenge.securityQuestion || t('checkout.securityQuestion')}</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="ng-field"
                          value={securityAnswer}
                          onChange={(event) => setSecurityAnswer(event.target.value)}
                          placeholder={t('checkout.securityAnswer')} aria-label={t('checkout.securityAnswer')}
                          autoComplete="off"
                        />
                        <button type="button" className="ng-btn ng-btn--ghost shrink-0" onClick={verifyCustomerSecurity} disabled={lookupLoading || !securityAnswer.trim()}>
                          {lookupLoading ? t('checkout.checking') : t('checkout.verify')}
                        </button>
                      </div>
                    </label>
                  ) : null}
                  <div className="grid gap-5 md:grid-cols-2">
                    <label className="ng-label">
                      <span className="ng-mono text-ng-dust">{t('checkout.fullName')}</span>
                      <input type="text" className="ng-field" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder={t('checkout.namePlaceholder')} aria-label={t('checkout.namePlaceholder')} autoComplete="name" aria-invalid={triedSubmit && fieldErrors.customerName ? 'true' : undefined} />
                      {triedSubmit && fieldErrors.customerName ? <span className="ng-error text-sm" role="alert">{fieldErrors.customerName}</span> : null}
                    </label>
                    <label className="ng-label">
                      <span className="ng-mono text-ng-dust">{t('checkout.whatsapp')}</span>
                      <input type="tel" className="ng-field" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="081234567890" aria-label={t('checkout.whatsappAria')} autoComplete="tel" aria-invalid={triedSubmit && fieldErrors.contact ? 'true' : undefined} />
                      {triedSubmit && fieldErrors.contact ? <span className="ng-error text-sm" role="alert">{fieldErrors.contact}</span> : null}
                    </label>
                  </div>
                  <div className="ng-label">
                    <label className="ng-mono text-ng-dust" htmlFor="checkout-address">{t('checkout.address')}</label>
                    {/* A returning buyer picks between the address on file and a new one — the choice the
                        phone checkout always offered and the desktop one never did. */}
                    {repeatCustomer?.customerCode && (repeatCustomer.deliveryAddress || repeatCustomer.deliveryArea) ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" aria-pressed={repeatAddressMode === 'last'} onClick={useCustomerLastAddress} className="ng-chip ng-chip--plain">{t('mcheckout.useLastAddress')}</button>
                        <button type="button" aria-pressed={repeatAddressMode === 'new'} onClick={useCustomerNewAddress} className="ng-chip ng-chip--plain">{t('mcheckout.useNewAddress')}</button>
                      </div>
                    ) : null}
                    <textarea id="checkout-address" className="ng-field" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} rows="3" placeholder={t('checkout.addressPlaceholder')} aria-label={t('checkout.address')} autoComplete="street-address" aria-invalid={triedSubmit && fieldErrors.deliveryAddress ? 'true' : undefined} />
                    {triedSubmit && fieldErrors.deliveryAddress ? <span className="ng-error text-sm" role="alert">{fieldErrors.deliveryAddress}</span> : null}
                  </div>
                </fieldset>

                {/* Shipping */}
                <fieldset className="ng-fieldset">
                  <legend className="ng-legend"><span className="ng-mono text-ng-ember">II</span>{t('checkout.deliveryLegend')}</legend>
                  <label className="ng-label">
                    <span className="ng-mono text-ng-dust">{t('checkout.courier')}</span>
                    <select className="ng-field" value={selectedCourier} onChange={(event) => handleCourierChange(event.target.value)} aria-label={t('checkout.pickCourier')}>
                      <option value="">{t('checkout.pickCourier')}</option>
                      {checkoutCourierOptions.map((courier) => (
                        <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
                      ))}
                    </select>
                  </label>
                  {showAreaSearch || manualArea ? (
                    <label className="ng-label">
                      <span className="ng-mono text-ng-dust">{t('checkout.destination')}</span>
                      <div className="flex gap-2">
                        <input type="text" className="ng-field" value={destinationSearch} onChange={(event) => updateDestinationSearch(event.target.value)} placeholder={t('checkout.destinationPlaceholder')} aria-label={t('checkout.destinationAria')} autoComplete="off" />
                        <button
                          type="button"
                          className="ng-btn ng-btn--ghost shrink-0"
                          disabled={shippingLoading || !selectedCourier}
                          onClick={() => autoCalculateShipping({ searchText: destinationSearch || deliveryAddress, autoSelectBest: true })}
                        >
                          <Search className="h-4 w-4" aria-hidden="true" /> {t('checkout.search')}
                        </button>
                      </div>
                      {manualArea ? <span className="text-sm text-ng-dust">{t('mcheckout.manualAreaHint')}</span> : null}
                    </label>
                  ) : selectedCourier ? (
                    <button type="button" onClick={() => setManualArea(true)} className="ng-link ng-mono inline-flex min-h-[44px] items-center self-start border-0 bg-transparent p-0 underline underline-offset-4">
                      {t('mcheckout.editManualShipping')}
                    </button>
                  ) : null}
                  {shippingLoading ? <p role="status" className="ng-notice">{t('checkout.searchingRates')}</p> : null}
                  {shippingNotice ? <p role="status" className="ng-notice">{shippingNotice}</p> : null}
                  {shippingError ? <p role="status" className="ng-notice ng-notice--error">{shippingError}</p> : null}
                  {destinationOptions.length ? (
                    <div className="flex flex-col gap-2">
                      <span className="ng-mono text-ng-ash">{t('mcheckout.pickOtherArea')}</span>
                      <div className="flex flex-wrap gap-2">
                        {destinationOptions.slice(0, 4).map((destination) => (
                          <button key={destination.id || destination.label} type="button" className="ng-chip ng-chip--plain" aria-pressed={selectedDestination?.label === destination.label} onClick={() => loadShippingRates(destination, { autoSelectCheapest: true })}>
                            {destination.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {visibleShippingOptions.length ? (
                    <div className="flex flex-col gap-2">
                      {visibleShippingOptions.map((rate) => (
                        <button
                          key={`${rate.courierCode}-${rate.service}-${rate.cost}`}
                          type="button"
                          aria-pressed={selectedShipping?.service === rate.service && selectedShipping?.cost === rate.cost}
                          className="ng-choice"
                          onClick={() => setSelectedShipping(rate)}
                        >
                          <span>{courierLabels[rate.courierCode] || rate.courierCode} · {rate.service}</span>
                          <span className="flex items-baseline gap-2">
                            {/* The promotion was applied to rate.cost before it got here, and the desktop
                                showed only the result: a lower number with nothing to explain it. The phone
                                has always struck through the original and named the promo. A buyer who
                                cannot see that free shipping happened has been given a discount and no
                                reason to remember it. */}
                            {rate.promotionApplied && Number(rate.originalCost || 0) > Number(rate.cost || 0) ? (
                              <s className="text-sm text-ng-ash">{formatTotal(rate.originalCost)}</s>
                            ) : null}
                            {formatTotal(rate.cost)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {selectedShipping?.promotionApplied && selectedShipping.promotionLabel ? (
                    <p role="status" className="ng-notice">{selectedShipping.promotionLabel}</p>
                  ) : null}
                  {selectedDestination ? <p role="status" className="ng-notice">{t('ship.area', { area: selectedDestination.label })}</p> : null}
                </fieldset>

                {/* Voucher */}
                <fieldset className="ng-fieldset">
                  <legend className="ng-legend"><span className="ng-mono text-ng-ember">III</span>{t('cart.voucher')}</legend>
                  <div className="flex flex-col gap-2.5">
                    <label className="text-sm text-ng-dust" htmlFor="checkout-voucher">
                      {voucher.appliedVoucher ? t('cart.voucherApplied', { code: voucher.appliedVoucher.code }) : t('checkout.voucherEnter')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="checkout-voucher"
                        type="text"
                        className="ng-field uppercase placeholder:normal-case"
                        value={voucher.inputCode}
                        onChange={(event) => voucher.setInputCode(event.target.value)}
                        placeholder={t('checkout.voucherPlaceholder')} aria-label={t('checkout.voucherPlaceholder')}
                        autoComplete="off"
                        disabled={!items.length || voucher.loading}
                      />
                      <button type="button" className="ng-btn ng-btn--ghost shrink-0" onClick={voucher.applyVoucher} disabled={!items.length || voucher.loading}>
                        <BadgePercent className="h-4 w-4" aria-hidden="true" />
                        {voucher.loading ? t('checkout.checking') : t('checkout.voucherApply')}
                      </button>
                    </div>
                    {voucher.message ? <p role="status" className={`m-0 text-sm ${voucher.appliedVoucher ? 'text-ng-sand' : 'ng-error'}`}>{voucher.message}</p> : null}
                    {voucher.appliedVoucher ? (
                      <button type="button" className="ng-link ng-mono inline-flex min-h-[44px] items-center gap-2 self-start border-0 bg-transparent p-0" onClick={voucher.removeVoucher}>
                        <X className="h-3.5 w-3.5" aria-hidden="true" /> {t('cart.voucherRemove')}
                      </button>
                    ) : null}
                  </div>
                </fieldset>

                {/* Payment */}
                <fieldset className="ng-fieldset">
                  <legend className="ng-legend"><span className="ng-mono text-ng-ember">IV</span>{t('checkout.paymentLegend')}</legend>
                  {/* Choices you can read, as the phone checkout drew them, instead of a closed dropdown. */}
                  <div className="flex flex-col gap-2" role="group" aria-label={t('checkout.paymentMethod')}>
                    {checkoutPaymentMethods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        aria-pressed={selectedPaymentMethod === method.id}
                        className="ng-choice"
                        onClick={() => setSelectedPaymentMethod(method.id)}
                      >
                        <span className="flex flex-col gap-1 text-left">
                          <span>{t(method.labelKey)}</span>
                          {method.descriptionKey ? <span className="text-[13px] text-ng-dust">{t(method.descriptionKey)}</span> : null}
                        </span>
                        <span className="ng-choice__dot" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                  <label className="ng-label">
                    <span className="ng-mono text-ng-dust">{t('checkout.deliveryNote')}</span>
                    <textarea className="ng-field" value={notes} onChange={(event) => setNotes(event.target.value)} rows="2" placeholder={t('checkout.optional')} aria-label={t('checkout.deliveryNote')} autoComplete="off" />
                  </label>
                </fieldset>

                {/* Said on the cart page, and again here: this is the screen where the number becomes a
                    transfer instruction, and a total that moved without explanation is a total nobody trusts. */}
                {items.some((item) => item.priceChanged) ? (
                  <p className="ng-notice" role="status">{t('checkout.pricesUpdated')}</p>
                ) : null}
                {!canSubmitCheckout && items.length ? <p role="status" className="ng-notice ng-notice--error">{t('checkout.missingFields', { fields: missingFields || t('checkout.missingFieldsFallback') })}</p> : null}
                <button type="submit" className="ng-btn ng-btn--lg ng-btn--block" disabled={!items.length || saving}>
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  {saving ? t('checkout.processing') : t('checkout.placeOrder')}
                </button>
              </form>

              <aside className="ng-panel ng-sticky flex flex-col gap-5" aria-labelledby="checkout-summary-title">
                <p className="ng-mono m-0 text-ng-ash">{t('checkout.summary')}</p>
                <h2 id="checkout-summary-title" className="sr-only">{items.length ? t('checkout.chosenProducts') : t('checkout.noProducts')}</h2>

                <div className="flex flex-col gap-4 border-b border-ng-bone/15 pb-5">
                  {items.map((item) => (
                    <div key={item.slug} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3.5">
                      <div className="h-[60px] w-12">
                        <ProductVisual product={item} className="h-full w-full" imageFit="cover" label={false} sizes="48px" />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <strong className="truncate font-ng-display text-xl font-normal leading-none">{splitScriptName(item.name).name}</strong>
                        <span className="text-xs text-ng-ash">{t('checkout.sizeQty', { size: item.size, qty: item.quantity })}</span>
                        <CartPriceChange item={item} />
                      </div>
                      <strong className="text-sm font-normal">{isFreeVialLine(item) ? FREE_VIAL_PRICE_LABEL : formatTotal(Number(item.priceNumber || 0) * Number(item.quantity || 0))}</strong>
                    </div>
                  ))}
                </div>

                <dl className="m-0 flex flex-col gap-3 text-[15px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ng-dust">{t('checkout.subtotal')}</dt>
                    <dd className="m-0">{formatTotal(summary.subtotal)}</dd>
                  </div>
                  {shippingFee ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ng-dust">{t('checkout.shipping')}</dt>
                      <dd className="m-0">{formatTotal(shippingFee)}</dd>
                    </div>
                  ) : null}
                  {voucher.discountAmount ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ng-dust">Voucher {voucher.appliedVoucher?.code}</dt>
                      <dd className="m-0 text-ng-sand">-{formatTotal(voucher.discountAmount)}</dd>
                    </div>
                  ) : null}
                  <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-ng-bone/30 pt-4">
                    <dt className="ng-mono text-ng-dust">{t('checkout.total')}</dt>
                    <dd className="m-0 font-ng-display text-[34px] leading-none">{formatTotal(totalDue)}</dd>
                  </div>
                </dl>

                <Link to="/cart" className="ng-link ng-mono inline-flex min-h-[44px] items-center justify-center">{t('checkout.backToCart')}</Link>
              </aside>
            </div>
          </div>
        </section>

        <StorefrontFooter />
      </main>

      {/* The phone's pay bar: the total and the order button, always in reach while the form scrolls. */}
      <div className="ng-buybar is-visible lg:hidden">
        <div className="ng-buybar__inner">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="ng-mono text-ng-ash">{t('cust.itemCount', { count: summary.boughtQuantity })}</span>
            <span className="text-lg">{formatTotal(totalDue)}</span>
          </div>
          <button type="submit" form="checkout-form" className="ng-btn shrink-0" onClick={() => setTriedSubmit(true)} disabled={!items.length || saving}>
            {saving ? t('checkout.processing') : t('checkout.placeOrder')}
          </button>
        </div>
      </div>
    </>
  );
};

export default CheckoutPage;
