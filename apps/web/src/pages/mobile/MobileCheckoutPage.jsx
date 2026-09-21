import { useTranslate } from '@/hooks/useTranslate.js';
import InternationalCheckoutNotice from '@/components/storefront/InternationalCheckoutNotice.jsx';
import CartPriceChange from '@/components/storefront/CartPriceChange.jsx';
import { asCustomerCode } from '@/utils/customerCode.js';
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { BadgePercent, ChevronDown, CreditCard, Minus, Plus, ShoppingBag, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCart } from '@/hooks/useCart.js';
import { useMemberPrices } from '@/hooks/useStorefrontProducts.js';
import { memberSavingForCart } from '@/utils/memberPriceNudge.js';
import { checkoutCourierOptions, useCheckoutFlow } from '@/hooks/useCheckoutFlow.js';
import { checkoutPaymentMethods } from '@/services/cartService.js';
import { getDiscountedVoucherCartLineMap } from '@/utils/cartVoucherPricing.js';
import { publicErrorMessage } from '@/utils/publicErrorMessage.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
const courierLabels = { jnt: 'JnT', ide: 'IDEXPRES', pos: 'POS', anteraja: 'ANTERAJA', jne: 'JNE' };

// One progress panel, not two. This used to sit above a second strip that repeated the same idea in
// different numbers: "Langkah 3/6", "2/6 beres", "Lengkapi: Area, Kurir" and "2 kurang" all at once.
// What a buyer needs is where they are and what is still missing (UX backlog U-7).
const CheckoutProgress = ({ steps, missing = [], ready = false }) => {
  const { t } = useTranslate();
  const firstIncompleteIndex = steps.findIndex((step) => !step.complete);
  const currentIndex = firstIncompleteIndex === -1 ? steps.length - 1 : Math.max(firstIncompleteIndex, 0);
  const currentStep = steps[currentIndex] || steps[steps.length - 1];
  const completedCount = steps.filter((step) => step.complete).length;
  const progressPercent = Math.min(Math.max((completedCount / steps.length) * 100, 8), 100);
  return (
    <section className="mobile-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase text-amber-700">{t('mcheckout.step', { current: Math.min(currentIndex + 1, steps.length), total: steps.length })}</div>
          <div className="mt-0.5 text-sm font-bold leading-snug text-[#1f2937]">{currentStep.label}</div>
        </div>
        {ready ? <span className="mobile-commerce-chip shrink-0 px-3 py-1 text-[10px] uppercase">{t('mcheckout.ready')}</span> : null}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-editorial-ivory"><div className="h-full rounded-full bg-[#b08b4f]" style={{ width: `${progressPercent}%` }} /></div>
      {ready ? null : (
        <p className="mt-2 text-[11px] font-bold leading-snug text-[#6b7280]">
          {t('mcheckout.stillNeeded', { fields: missing.map((item) => item.label).join(', ') })}
        </p>
      )}
    </section>
  );
};

const CheckoutSection = ({ action, children, complete = false, description = '', step, title }) => (
  <section className="mobile-card p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 gap-3">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-2xl text-xs font-bold ${complete ? 'bg-editorial-charcoal text-white' : 'bg-amber-50 text-amber-800'}`}>
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-editorial-charcoal">{title}</h2>
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
  const { t } = useTranslate();
  const navigate = useNavigate();
  const [showManualShippingArea, setShowManualShippingArea] = useState(false);
  const { currentUser, loginWithGoogle, logout } = useAuth();
  const { items, summary, updateQuantity, removeItem, clear } = useCart();
  const { index: memberIndex } = useMemberPrices();
  const memberSaving = memberSavingForCart(items, memberIndex);
  const handleGoogleLogin = async () => {
    try {
      // Clean redirect (no hash/query) so Supabase appends a single, parseable #access_token — a stale
      // hash on window.location.href produces ##access_token, which only resolves after a manual refresh.
      await loginWithGoogle(`${window.location.origin}${window.location.pathname}`);
    } catch (error) {
      toast.error(publicErrorMessage(error, t('checkout.googleFail')));
    }
  };
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
    canSubmitCheckout, blockedItems, setCustomerName, setContact, setDeliveryAddress, setNotes, setSecurityAnswer, setSelectedShipping,
    setSelectedPaymentMethod, chooseShippingCourier, updateCustomerCode, updateDestinationSearch, useCustomerLastAddress,
    useCustomerNewAddress, autoCalculateShipping, loadShippingRates, lookupCustomer, verifyCustomerSecurity, submitOrder,
  } = checkout;
  const decreaseQuantity = (item) => item.quantity <= 1 ? removeItem(item.slug) : updateQuantity(item.slug, item.quantity - 1);
  const visibleShippingOptions = selectedCourier ? shippingOptions.filter((rate) => rate.courierCode === selectedCourier) : [];
  const checkoutRequirements = [
    { label: t('mcheckout.stepName'), complete: Boolean(customerName.trim()) },
    { label: t('mcheckout.stepPhone'), complete: validPhoneContact },
    { label: t('mcheckout.stepAddress'), complete: Boolean(deliveryAddress.trim()) },
    { label: t('mcheckout.stepArea'), complete: Boolean(selectedDestination) },
    // Two requirements, not one. Folding them together told a buyer who had already chosen JNE that they
    // still needed to choose a courier, which reads as the app ignoring them.
    { label: t('mcheckout.stepCourier'), complete: Boolean(selectedCourier) },
    { label: t('checkout.shipping'), complete: Boolean(selectedShipping) },
    // Mirrors canSubmitCheckout: lines whose product is gone or sold out block the order (audit round 9).
    { label: t('mcheckout.removeUnavailable'), complete: !blockedItems.length },
  ];
  const contactComplete = Boolean(customerName.trim() && validPhoneContact);
  const addressComplete = Boolean(contactComplete && deliveryAddress.trim());
  const shippingComplete = Boolean(addressComplete && selectedDestination && selectedCourier && selectedShipping);
  const paymentComplete = Boolean(shippingComplete && selectedPaymentMethod);
  const checkoutSteps = [
    { label: t('mcheckout.contact'), complete: contactComplete },
    { label: t('mcheckout.stepAddress'), complete: addressComplete },
    { label: t('checkout.shipping'), complete: shippingComplete },
    { label: t('cart.voucher'), complete: shippingComplete },
    { label: t('mcheckout.title'), complete: paymentComplete },
    { label: t('mcheckout.summary'), complete: Boolean(paymentComplete && items.length) },
  ];
  const missingRequirements = checkoutRequirements.filter((item) => !item.complete);
  const primaryActionLabel = saving ? t('checkout.processing') : t(isManualPayment ? 'mcheckout.placeOrder' : 'mcheckout.payNow');
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
  // A returning buyer arrives with selectedCourier restored from the saved draft, so the automatic lookup
  // that normally runs on courier change never fires. Without this they saw "Masih perlu: Area" and no area
  // field, and had to find "Edit ongkir manual" to get one. Gated on !shippingLoading so it does not flash
  // during a lookup that is about to succeed.
  const showShippingAreaFallback = showManualShippingArea || Boolean(shippingError)
    || Boolean(selectedCourier && !selectedShipping && !shippingLoading);
  const showShippingAlternatives = showManualShippingArea || Boolean(shippingError);
  const showShippingServiceChoices = Boolean(visibleShippingOptions.length && (!selectedShipping || showManualShippingArea));
  const recalculateShipping = () => {
    autoCalculateShipping({ searchText: destinationSearch.trim() || deliveryAddress.trim(), autoSelectBest: true });
  };
  const choosePaymentMethod = (method) => {
    if (method.id !== selectedPaymentMethod) {
      toast.success(t('mcheckout.methodChosen', { method: t(method.labelKey) }));
    }
    setSelectedPaymentMethod(method.id);
  };

  if (!items.length) return (
    <MobileCommerceLayout>
        <main className="mobile-page">
        <section className="mobile-soft-card p-4">
          <div className="text-[10px] font-bold uppercase text-amber-700">Checkout</div>
          <h1 className="mt-1 text-xl font-bold leading-tight text-[#1f2937]">{t('mcheckout.emptyLead')}</h1>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">{t('mcheckout.emptyBody')}</p>
          <Button type="button" className="mt-4 h-11 w-full rounded-2xl gap-2" onClick={() => navigate('/mobile/catalog')}>
            <ShoppingBag className="h-4 w-4" />
            {t('mcheckout.openCatalog')}
          </Button>
        </section>
        <StateBlock className="mobile-card" icon={ShoppingBag} title={t('mcheckout.emptyTitle')} description={t('mcheckout.emptyPick')} action={t('mcheckout.openCatalog')} onAction={() => navigate('/mobile/catalog')} />
      </main>
    </MobileCommerceLayout>
  );

  return (
    <MobileCommerceLayout>
      <Helmet><title>{t('mcheckout.tab')}</title></Helmet>
      <main className="mobile-page mobile-checkout-page">
        <section className="mobile-soft-card p-3">
          <div className="text-[10px] font-bold uppercase text-amber-700">{t('mcheckout.title')}</div>
          <h1 className="mt-1 text-xl font-bold leading-tight text-[#1f2937]">{t('mcheckout.lead')}</h1>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div><div className="text-[10px] font-bold uppercase text-[#8b949e]">{t('mcheckout.totalDue')}</div><div className="mt-1 text-2xl font-bold text-editorial-charcoal">{formatTotal(totalDue)}</div></div>
            <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/cart')}>{t('mcheckout.editCart')}</Button>
          </div>
          {/* Sits under TOTAL BAYAR on purpose: this is the number the buyer is about to transfer, and a
              total that moved since they filled the cart needs a reason next to it. */}
          {items.some((item) => item.priceChanged) ? (
            <p role="status" className="mt-2 text-[11px] font-bold leading-snug text-[#6b7280]">
              {t('checkout.pricesUpdated')}
            </p>
          ) : null}
          {discountAmount ? (
            <div className="mt-3 rounded-2xl border border-editorial-stone/12 bg-white/82 px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-xs font-bold text-editorial-charcoal">
                <span className="min-w-0 truncate">Voucher {voucher.appliedVoucher?.code}</span>
                <span className="shrink-0">{t('cart.saved', { amount: formatTotal(discountAmount) })}</span>
              </div>
            </div>
          ) : null}
        </section>
        <CheckoutProgress steps={checkoutSteps} missing={missingRequirements} ready={canSubmitCheckout} />
        <InternationalCheckoutNotice className="mb-3" />
        <CheckoutSection
          step="1"
          title={t('mcheckout.contact')}
          description={t('mcheckout.stepCodeBody')}
          complete={contactComplete}
        >
            {currentUser ? (
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#f3f1ec] px-3 py-2 text-xs font-semibold text-editorial-charcoal">
                <span className="min-w-0 truncate">{t('checkout.signedInAuto', { email: currentUser.email })}</span>
                <button type="button" onClick={logout} className="shrink-0 font-bold underline underline-offset-4">{t('checkout.signOut')}</button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="h-12 w-full rounded-2xl bg-white gap-2 text-xs font-bold" onClick={handleGoogleLogin}>
                <UserRound className="h-4 w-4" />
                {memberSaving > 0
                  ? t('checkout.signInSaving', { amount: formatTotal(memberSaving) })
                  : t('mcheckout.signInPlain')}
              </Button>
            )}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={customerCode} onChange={(event) => updateCustomerCode(event.target.value)} placeholder={t('mcheckout.codeOptional')} aria-label={t('checkout.customerCode')} autoComplete="off" className="mobile-commerce-control h-12 px-3 text-sm font-semibold uppercase" />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={lookupCustomer} disabled={lookupLoading || !customerCode.trim()}>{lookupLoading ? '...' : t('mcheckout.checkCode')}</Button>
            </div>
            {/* Outside the two-column grid: inside it, the hint took the second cell, squeezed the field
                down to one character and pushed "Cek kode" onto its own row. */}
            {customerCode.trim() && !asCustomerCode(customerCode) ? (
              <p className="text-[11px] font-semibold leading-snug text-editorial-muted" role="status">{t('checkout.codeUnknown')}</p>
            ) : null}
            {securityChallenge ? <div className="grid grid-cols-[1fr_auto] gap-2"><input value={securityAnswer} onChange={(event) => setSecurityAnswer(event.target.value)} placeholder={t('checkout.securityAnswer')} aria-label={t('checkout.securityAnswer')} autoComplete="off" className="mobile-commerce-control h-11 px-3 text-sm font-semibold" /><Button onClick={verifyCustomerSecurity}>{t('checkout.verify')}</Button></div> : null}
            <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder={t('checkout.namePlaceholder')} aria-label={t('checkout.namePlaceholder')} autoComplete="name" className="mobile-commerce-control h-12 px-3 text-sm font-semibold" />
            <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="081234567890" aria-label={t('checkout.whatsappAria')} inputMode="tel" autoComplete="tel" className="mobile-commerce-control h-12 px-3 text-sm font-semibold" />
        </CheckoutSection>
        <CheckoutSection
          step="2"
          title={t('mcheckout.stepAddress')}
          description={t('mcheckout.stepAddressBody')}
          complete={addressComplete}
        >
            {repeatCustomer?.customerCode && (repeatCustomer.deliveryAddress || repeatCustomer.deliveryArea) ? (
              <div className="grid gap-2">
                <button type="button" onClick={useCustomerLastAddress} className={`mobile-commerce-choice px-3 py-2 text-xs font-bold ${repeatAddressMode === 'last' ? 'is-active' : ''}`}>{t('mcheckout.useLastAddress')}</button>
                <button type="button" onClick={useCustomerNewAddress} className={`mobile-commerce-choice px-3 py-2 text-xs font-bold ${repeatAddressMode === 'new' ? 'is-active' : ''}`}>{t('mcheckout.useNewAddress')}</button>
              </div>
            ) : null}
            <textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder={t('checkout.addressPlaceholder')} aria-label={t('checkout.address')} rows={3} autoComplete="street-address" className="mobile-commerce-control px-3 py-3 text-sm font-semibold" />
        </CheckoutSection>
        <CheckoutSection
          step="3"
          title={t('checkout.pickCourier')}
          description={t('mcheckout.stepShippingBody')}
          complete={shippingComplete}
        >
            <label className={`mobile-commerce-courier-select ${selectedCourier ? 'is-selected' : ''}`}>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase">
                  {t(selectedCourier ? 'mcheckout.courierChosen' : 'mcheckout.courierDropdown')}
                </span>
                <span className="mt-0.5 block truncate text-sm font-bold">
                  {selectedCourier ? (courierLabels[selectedCourier] || selectedCourier.toUpperCase()) : t('mcheckout.pickShippingCourier')}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
              <select value={selectedCourier} onChange={(event) => handleCourierChange(event.target.value)} aria-label={t('mcheckout.pickShippingCourier')}>
                <option value="">{t('checkout.pickCourier')}</option>{checkoutCourierOptions.map((courier) => <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>)}
              </select>
            </label>
            {shippingLoading ? (
              <p className="mobile-commerce-notice bg-editorial-ivory font-bold text-editorial-charcoal">
                {t('mcheckout.searchingRates')}
              </p>
            ) : null}
            {!showShippingAreaFallback && !selectedShipping ? (
              <button type="button" onClick={() => setShowManualShippingArea(true)} className="w-fit text-left text-xs font-bold text-editorial-charcoal underline underline-offset-4">
                {t('mcheckout.editManualShipping')}
              </button>
            ) : null}
            {showShippingAreaFallback ? (
              <div className="mobile-commerce-panel bg-white p-3">
                <input value={destinationSearch} onChange={(event) => updateDestinationSearch(event.target.value)} placeholder={t('checkout.destinationPlaceholder')} aria-label={t('checkout.destinationAria')} autoComplete="off" className="mobile-commerce-control h-12 px-3 text-sm font-semibold" />
                <p className="mobile-commerce-notice mt-2">
                  {t('mcheckout.manualAreaHint')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-11 rounded-2xl bg-white text-xs font-bold"
                  onClick={recalculateShipping}
                  disabled={shippingLoading || !selectedCourier || (!deliveryAddress.trim() && destinationSearch.trim().length < 3)}
                >
                  {t('mcheckout.recalculate')}
                </Button>
              </div>
            ) : null}
            {selectedDestination ? (
              <p className="mobile-commerce-notice bg-editorial-ivory font-bold text-editorial-charcoal">
                {t('ship.areaFee', { area: selectedDestination.label })}
              </p>
            ) : null}
            {shippingNotice ? <p className="mobile-commerce-notice bg-editorial-ivory font-bold text-editorial-charcoal">{shippingNotice}</p> : null}
            {showShippingAlternatives && destinationOptions.length ? (
              <div className="grid gap-2">
                <div className="text-[10px] font-bold uppercase text-editorial-muted">{t('mcheckout.pickOtherArea')}</div>
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
                    <span className="shrink-0 text-right">
                      {rate.promotionApplied && Number(rate.originalCost || 0) > Number(rate.cost || 0) ? (
                        <span className="block text-[10px] text-[#8a9280] line-through">{formatTotal(rate.originalCost)}</span>
                      ) : null}
                      {formatTotal(rate.cost)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-[#6b7280]">{rate.etd ? `ETA ${rate.etd}` : rate.description || t('mcheckout.estimateFollowsCourier')}</p>
                    {active ? <span className="shrink-0 rounded-full bg-editorial-charcoal px-2 py-1 text-[9px] font-bold uppercase text-white">{t('mcheckout.chosen')}</span> : null}
                  </div>
                  {rate.promotionApplied ? <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase text-emerald-700">{rate.promotionLabel}</div> : null}
                </button>
              );
            }) : null}
            {selectedShipping ? (
              <div className="mobile-commerce-panel border-editorial-stone/24 bg-editorial-ivory p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-editorial-charcoal">{t('mcheckout.rateUsed')}</div>
                    <p className="mt-1 text-xs font-bold text-[#1f2937]">
                      {courierLabels[selectedShipping.courierCode] || selectedShipping.courierName} {selectedShipping.serviceLabel || selectedShipping.service} - {formatTotal(selectedShipping.cost)}
                    </p>
                    {selectedShipping.promotionApplied ? <p className="mt-1 text-[11px] font-bold text-emerald-700">{selectedShipping.promotionLabel}</p> : null}
                    {selectedDestination ? (
                      <p className="mt-1 text-[11px] font-semibold leading-snug text-editorial-muted">{t('ship.area', { area: selectedDestination.label })}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase text-editorial-charcoal">{t('mcheckout.auto')}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white text-xs font-bold" onClick={() => setShowManualShippingArea(true)}>
                    {t('mcheckout.editManual')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-2xl bg-white text-xs font-bold"
                    onClick={recalculateShipping}
                    disabled={shippingLoading || !selectedCourier || (!deliveryAddress.trim() && destinationSearch.trim().length < 3)}
                  >
                    {t('mcheckout.recalculate')}
                  </Button>
                </div>
              </div>
            ) : visibleShippingOptions.length ? (
              <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
                {t('mcheckout.pickRate')}
              </p>
            ) : null}
            {shippingError ? <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">{shippingError}</p> : null}
        </CheckoutSection>
        <CheckoutSection
          step="4"
          title={t('cart.voucher')}
          description={t('mcheckout.stepVoucherBody')}
          complete={Boolean(voucher.appliedVoucher)}
          action={voucher.discountAmount ? <span className="shrink-0 text-xs font-bold text-editorial-charcoal">-{formatTotal(voucher.discountAmount)}</span> : null}
        >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                value={voucher.inputCode}
                onChange={(event) => voucher.setInputCode(event.target.value.toUpperCase())}
                placeholder={t('checkout.voucherPlaceholder')} aria-label={t('checkout.voucherPlaceholder')}
                autoComplete="off"
                className="mobile-commerce-control h-12 px-3 text-sm font-semibold uppercase"
              />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold gap-1.5" onClick={voucher.applyVoucher}>
                <BadgePercent className="h-4 w-4" />
                {t('mcheckout.apply')}
              </Button>
            </div>
            {voucher.appliedVoucher ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-editorial-stone/14 bg-editorial-ivory px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-editorial-charcoal">{t('cart.voucherApplied', { code: voucher.appliedVoucher.code })}</div>
                  <div className="mt-0.5 text-[11px] font-semibold text-editorial-muted">{t('cart.saved', { amount: formatTotal(voucher.discountAmount) })}</div>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-xl text-editorial-charcoal tap-44" onClick={voucher.removeVoucher} aria-label={t('cart.voucherRemove')}>
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
            title={t('checkout.paymentMethod')}
            description={t(shippingComplete ? 'mcheckout.shippingInTotal' : 'mcheckout.shippingFirst')}
            complete={paymentComplete}
          >
            {/* A radiogroup, not two info cards: the old buttons carried no radio and only a faint tint
                when chosen, so nothing said a choice was being asked for (UX backlog U-6). */}
            <div role="radiogroup" aria-label={t('checkout.paymentMethod')} className="grid gap-2">
              {checkoutPaymentMethods.map((method) => {
                const active = selectedPaymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => choosePaymentMethod(method)}
                    className={`mobile-commerce-choice flex items-start gap-3 px-3 py-3 ${active ? 'is-active' : ''}`}
                  >
                    <span className={`mobile-choice-radio${active ? ' is-on' : ''}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{t(method.labelKey)}</span>
                      <span className="mt-1 block text-[11px] font-semibold text-[#6b7280]">{t(method.descriptionKey)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('mcheckout.notePlaceholder')} aria-label={t('checkout.deliveryNote')} rows={2} autoComplete="off" className="mobile-commerce-control px-3 py-3 text-sm font-semibold" />
          </CheckoutSection>
        </div>
        <div>
          <CheckoutSection
            step="6"
            title={t('mcheckout.summary')}
            description={t('mcheckout.stepReviewBody')}
            complete={Boolean(paymentComplete && items.length)}
            action={<span className="shrink-0 text-xs font-bold text-amber-700">{summary.quantity} item</span>}
          >
            {items.map((item) => {
              const discountedLine = discountedLineMap.get(item.slug);
              const hasLineDiscount = Boolean(discountedLine?.discount);

              return (
              <div key={item.slug} className="mobile-commerce-panel bg-editorial-ivory p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold">{item.name}</h3>
                    <p className="mt-1 text-[10px] font-bold uppercase text-amber-700">{item.size} / {item.price}</p>
                    <CartPriceChange item={item} />
                    {hasLineDiscount ? (
                      <p className="mt-1 text-[11px] font-bold text-editorial-charcoal">
                        {t('cart.afterVoucherLine', { price: formatTotal(discountedLine.discountedUnitPrice) })}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    {hasLineDiscount ? (
                      <div className="text-[11px] font-bold text-[#6b7280] line-through">{formatTotal(discountedLine.originalTotal)}</div>
                    ) : null}
                    <p className="text-xs font-bold text-editorial-charcoal">{formatTotal(discountedLine?.discountedTotal ?? Number(item.priceNumber || 0) * Number(item.quantity || 0))}</p>
                    {hasLineDiscount ? (
                      <div className="mt-0.5 text-[10px] font-bold text-emerald-700">-{formatTotal(discountedLine.discount)}</div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 inline-flex items-center rounded-[14px] border border-editorial-stone/10 bg-white p-1">
                  <Button type="button" size="icon" variant="ghost" aria-label={t('cart.decrease')} className="h-8 w-8 rounded-xl tap-44" onClick={() => decreaseQuantity(item)}><Minus className="h-4 w-4" /></Button>
                  <span className="grid h-8 min-w-10 place-items-center text-sm font-bold">{item.quantity}</span>
                  <Button type="button" size="icon" variant="ghost" aria-label={t('cart.increase')} className="h-8 w-8 rounded-xl tap-44" onClick={() => updateQuantity(item.slug, item.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              );
            })}
            <div className="mobile-commerce-summary px-3 py-3 text-xs font-bold text-editorial-charcoal">
              <div className="flex justify-between gap-3"><span>{t('checkout.subtotal')}</span><span>{formatTotal(summary.subtotal)}</span></div>
              {discountAmount ? (
                <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div className="flex justify-between gap-3 text-emerald-800">
                    <span className="min-w-0 truncate">{t('mcheckout.voucherDiscount', { code: voucher.appliedVoucher?.code })}</span>
                    <span className="shrink-0">-{formatTotal(discountAmount)}</span>
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase text-emerald-700">{t('mcheckout.beforeShipping')}</div>
                </div>
              ) : null}
              {discountAmount ? (
                <div className="mt-2 flex justify-between gap-3 text-[#6b7280]"><span>{t('mcheckout.subtotalAfterVoucher')}</span><span>{formatTotal(discountedSubtotal)}</span></div>
              ) : null}
              <div className="mt-2 flex justify-between gap-3 text-[#6b7280]"><span>{t('checkout.shipping')}</span><span>{shippingFee ? formatTotal(shippingFee) : '-'}</span></div>
              <div className="mt-3 border-t border-editorial-stone/10 pt-3 flex justify-between gap-3 text-sm text-editorial-charcoal"><span>{t('mcheckout.totalDue')}</span><span>{formatTotal(totalDue)}</span></div>
            </div>
          </CheckoutSection>
        </div>
        <StickyBottomActionBar
          fixed
          reserveSpace
          aria-label={t('mcheckout.paymentActions')}
          className="mobile-checkout-action-bar"
          contentClassName="rounded-2xl border-editorial-stone/10 bg-white/95"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-[#8b949e]">{t(canSubmitCheckout ? 'mcheckout.totalDue' : 'mcheckout.completeFirst')}</p>
              <p className="truncate text-lg font-bold leading-tight text-editorial-charcoal">{formatTotal(totalDue)}</p>
              <p className={`truncate text-[10px] font-bold ${canSubmitCheckout ? 'text-emerald-700' : 'text-amber-700'}`}>
                {canSubmitCheckout ? (discountAmount ? `${t('cart.voucher')} -${formatTotal(discountAmount)}` : t('mcheckout.readyToPay')) : missingRequirements.map((item) => item.label).join(', ')}
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
