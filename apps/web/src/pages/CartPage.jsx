import { useTranslate } from '@/hooks/useTranslate.js';
import { atStockCap, nextQuantityUp } from '@/utils/cartQuantity.js';
import StaleCatalogNotice from '@/components/storefront/StaleCatalogNotice.jsx';
import CartPriceChange from '@/components/storefront/CartPriceChange.jsx';
import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgePercent, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCart } from '@/hooks/useCart.js';
import { useMemberPrices, useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import { memberSavingForCart, shouldPromptSignInForMemberPrice } from '@/utils/memberPriceNudge.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import FreeVialPicker from '@/components/storefront/FreeVialPicker.jsx';
import { splitFreeVialLines } from '@/utils/freeVial.js';
import { shortNoteList } from '@/utils/shortNoteList.js';
import { getDiscountedVoucherCartLineMap } from '@/utils/cartVoucherPricing.js';
import { splitScriptName } from '@/utils/scriptName.js';


const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const CartPage = () => {
  const { items, summary, updateQuantity, removeItem, setGift } = useCart();
  const { index: memberIndex } = useMemberPrices();
  const { currentUser } = useAuth();
  const memberSaving = memberSavingForCart(items, memberIndex);
  const offerMemberSignIn = shouldPromptSignInForMemberPrice({ saving: memberSaving, signedIn: Boolean(currentUser) });
  const { t } = useTranslate();
  const voucher = useAppliedVoucher(summary.subtotal, items);
  const subtotal = summary.subtotal;
  const totalAfterVoucher = Math.max(subtotal - voucher.discountAmount, 0);
  // Per line, as the phone cart showed it: what each bottle costs once the voucher is spread over it.
  const discountedLineMap = getDiscountedVoucherCartLineMap(items, voucher.appliedVoucher || {}, voucher.discountAmount);
  const revealRef = useScrollReveal();
  const catalogProducts = useStorefrontProducts();
  // Lines whose product left the catalog or ran out of stock — checkout refuses them, so say so here
  // rather than at the end of the form (audit round 9).
  const unavailableItems = items.filter((item) => item.unavailable || item.outOfStock);
  // The gift is not a purchase: it has no price to show, no quantity to change and no line of its own in
  // the list. The picker below owns it.
  const { lines: boughtLines } = splitFreeVialLines(items);

  const recommendations = useMemo(() => {
    const inCart = new Set(items.map((item) => item.productSlug || item.slug));
    const visible = catalogProducts.filter(isProductVisibleInStorefront);
    return getPublicFragranceCatalog(visible)
      // Addable, not merely published. getPublicFragranceCatalog is the mapper that produces
      // publicStatus, so this page can read it; the phone carts reach the catalogue through a
      // different mapper that has no such field and count stock instead. Same rule, two shapes.
      .filter((product) => !inCart.has(product.slug) && product.publicStatus === 'Available')
      .slice(0, 4);
  }, [catalogProducts, items]);

  return (
    <>
      <Helmet>
        <title>{t('cart.tab')}</title>
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <StaleCatalogNotice stale={catalogProducts.stale} className="mx-auto mt-4 w-[min(1180px,92vw)]" />
        <ScrollProgress />
        <PublicHeader />

        <section className="ng-section !border-b-0 !pt-14 md:!pt-20">
          <div className="ng-container flex flex-col gap-12">
            <div className="flex flex-col gap-5">
              <p className="ng-eyebrow ng-mono m-0">{t('cart.ngStep')}</p>
              <h1 className="ng-display ng-h1">{t('cart.title')}</h1>
              <p className="ng-lead">{t('cart.lead')}</p>
            </div>

            <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-[72px]">
              <div className="flex flex-col gap-14">
                <div className="flex flex-col border-t border-ng-bone/30">
                  {items.some((item) => item.priceChanged) ? (
                    <p className="m-0 border-b border-ng-bone/15 py-4 text-sm text-ng-sand" role="status">
                      {t('checkout.pricesUpdated')}
                    </p>
                  ) : null}
                  {unavailableItems.length ? (
                    <p className="ng-error m-0 border-b border-ng-bone/15 py-4 text-sm" role="alert">
                      {t('cart.unavailable', { names: unavailableItems.map((item) => item.name).join(', ') })}
                    </p>
                  ) : null}
                  {!boughtLines.length ? (
                    <div className="flex flex-col items-start gap-5 border-b border-ng-bone/15 py-14">
                      <ShoppingBag className="h-8 w-8 text-ng-ash" aria-hidden="true" />
                      <h2 className="ng-display text-[36px] font-normal">{t('cart.empty')}</h2>
                      {/* Both doors, as the phone cart always offered: a bottle from the shelf, or one
                          made to order. The desktop cart only ever pointed at the catalogue. */}
                      <p className="m-0 max-w-[480px] text-ng-dust">{t('cart.emptyMobileBody')}</p>
                      <div className="flex flex-wrap gap-3.5">
                        <Link to="/catalog" className="ng-btn">
                          {t('home.seeCollection')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        <Link to="/bespoke" className="ng-btn ng-btn--ghost">{t('cart.bespoke')}</Link>
                      </div>
                    </div>
                  ) : (
                    boughtLines.map((item) => {
                      const discountedLine = discountedLineMap.get(item.slug);
                      const hasLineDiscount = Boolean(discountedLine?.discount);
                      const lineTotal = discountedLine?.discountedTotal ?? Number(item.priceNumber || 0) * Number(item.quantity || 0);
                      return (
                        <div key={item.slug} className="ng-cart-line">
                          <Link to={`/catalog/${item.productSlug || item.slug}`} className="ng-cart-line__image" tabIndex={-1} aria-hidden="true">
                            <ProductVisual product={item} className="h-full w-full" imageFit="cover" label={false} sizes="96px" />
                          </Link>
                          <div className="flex min-w-0 flex-col gap-2">
                            <Link to={`/catalog/${item.productSlug || item.slug}`} className="font-ng-display text-[28px] leading-none text-ng-bone no-underline [overflow-wrap:anywhere] md:text-[34px]">{splitScriptName(item.name).name}</Link>
                            <span className="ng-mono text-ng-ash">{[shortNoteList(item.notes), item.size].filter(Boolean).join(' · ')}</span>
                            <span className="text-sm text-ng-dust">{item.price}</span>
                            <CartPriceChange item={item} className="mt-1" />
                            {hasLineDiscount ? (
                              <span className="text-sm text-ng-sand">{t('cart.afterVoucherLine', { price: formatTotal(discountedLine.discountedUnitPrice) })}</span>
                            ) : null}
                            <button type="button" className="ng-link ng-mono mt-1 inline-flex min-h-[44px] items-center self-start border-0 bg-transparent p-0 underline underline-offset-4" onClick={() => removeItem(item.slug)} aria-label={t('cart.removeOf', { name: item.name })}>
                              {t('cart.removeItem')}
                            </button>
                          </div>
                          <div className="ng-cart-line__qty">
                            <div className="ng-stepper">
                              <button type="button" onClick={() => updateQuantity(item.slug, Math.max(1, item.quantity - 1))} aria-label={t('cart.decreaseOf', { name: item.name })}>
                                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              <span aria-live="polite">{item.quantity}</span>
                              <button type="button" onClick={() => updateQuantity(item.slug, nextQuantityUp(item))} disabled={atStockCap(item)} aria-label={t('cart.increaseOf', { name: item.name })}>
                                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                          <div className="ng-cart-line__sum flex flex-col items-end gap-1 text-right">
                            {hasLineDiscount ? <span className="text-xs text-ng-ash line-through">{formatTotal(discountedLine.originalTotal)}</span> : null}
                            <span className="text-base">{formatTotal(lineTotal)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <FreeVialPicker items={items} products={catalogProducts} onPick={setGift} />
              </div>

              <aside className="ng-panel ng-sticky flex flex-col gap-6" aria-labelledby="cart-summary-title">
                <p className="ng-mono m-0 text-ng-ash">{t('cart.summaryEyebrow')}</p>
                <h2 id="cart-summary-title" className="sr-only">{t('cart.summary')}</h2>

                <div className="flex flex-col gap-2.5">
                  <label className="text-sm text-ng-dust" htmlFor="cart-voucher">
                    {voucher.appliedVoucher ? t('cart.voucherApplied', { code: voucher.appliedVoucher.code }) : t('cart.voucherPrompt')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="cart-voucher"
                      type="text"
                      aria-label={t('cart.voucherPlaceholder')}
                      className="ng-field !min-h-[48px] uppercase placeholder:normal-case"
                      value={voucher.inputCode}
                      onChange={(event) => voucher.setInputCode(event.target.value)}
                      placeholder={t('cart.voucherPlaceholder')}
                      disabled={!items.length || voucher.loading}
                    />
                    <button type="button" className="ng-btn ng-btn--ghost shrink-0" onClick={voucher.applyVoucher} disabled={!items.length || voucher.loading}>
                      <BadgePercent className="h-4 w-4" aria-hidden="true" />
                      {voucher.loading ? t('cart.voucherChecking') : t('cart.voucherApply')}
                    </button>
                  </div>
                  {voucher.message ? <p role="status" className={`m-0 text-sm ${voucher.appliedVoucher ? 'text-ng-sand' : 'ng-error'}`}>{voucher.message}</p> : null}
                  {voucher.appliedVoucher ? (
                    <button type="button" className="ng-link ng-mono inline-flex min-h-[44px] items-center gap-2 self-start border-0 bg-transparent p-0" onClick={voucher.removeVoucher}>
                      <X className="h-3.5 w-3.5" aria-hidden="true" /> {t('cart.voucherRemove')}
                    </button>
                  ) : null}
                </div>

                <dl className="m-0 flex flex-col gap-3 text-[15px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ng-dust">{t('cart.subtotal')}</dt>
                    <dd className="m-0">{formatTotal(subtotal)}</dd>
                  </div>
                  {voucher.discountAmount ? (
                    <>
                      <div className="flex justify-between gap-4">
                        <dt className="text-ng-dust">Voucher {voucher.appliedVoucher?.code}</dt>
                        <dd className="m-0 text-ng-sand">-{formatTotal(voucher.discountAmount)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-ng-dust">{t('cart.afterVoucher')}</dt>
                        <dd className="m-0">{formatTotal(totalAfterVoucher)}</dd>
                      </div>
                    </>
                  ) : null}
                  <div className="flex justify-between gap-4">
                    <dt className="text-ng-dust">{t('cart.giftTitle')}</dt>
                    <dd className="m-0 text-ng-sand">{t('cart.giftFree')}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ng-dust">{t('checkout.shipping')}</dt>
                    <dd className="m-0 text-right text-ng-ash">{t('cart.shippingAtCheckout')}</dd>
                  </div>
                </dl>

                {/* The saving the buyer is weighing the total against, at the moment they weigh it.
                    Every other storefront page names the member price — home, catalog, product, the
                    account page — and the checkout one step later names this exact amount. Built from the
                    message keys those pages already use, so there is no second wording to keep in step. */}
                {offerMemberSignIn ? (
                  <div className="flex flex-col gap-1.5 border border-ng-bone/20 p-4 text-sm">
                    <span>{t('price.memberTier')} · {t('price.saveShort', { amount: formatTotal(memberSaving) })}</span>
                    <Link to="/customer" className="ng-link ng-mono inline-flex min-h-[44px] items-center underline underline-offset-4">{t('why.member.cta')}</Link>
                  </div>
                ) : null}

                {items.length ? (
                  <Link to="/checkout" className="ng-btn ng-btn--lg ng-btn--block">{t('cart.toCheckout')}</Link>
                ) : (
                  <Link to="/catalog" className="ng-btn ng-btn--lg ng-btn--block">{t('cart.addProductsFirst')}</Link>
                )}
                <Link to="/catalog" className="ng-link ng-mono inline-flex min-h-[44px] items-center justify-center">{t('cart.keepShopping')}</Link>
              </aside>
            </div>
          </div>
        </section>

        {/* Cross-sell — complete the ritual */}
        {items.length && recommendations.length ? (
          <section className="ng-section" aria-labelledby="cart-recommend-title" data-reveal>
            <div className="ng-container flex flex-col gap-10">
              <div className="flex flex-col gap-3.5">
                <p className="ng-mono m-0 text-ng-ash">{t('cart.completeEyebrow')}</p>
                <h2 id="cart-recommend-title" className="ng-display text-[44px] md:text-[56px]">{t('cart.complete')}</h2>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-6">
                {recommendations.map((item) => (
                  <Link key={item.slug} to={`/catalog/${item.slug}`} className="ng-card">
                    <ProductVisual product={item} className="aspect-[4/5] w-full" imageFit="cover" label={false} sizes="(max-width: 767px) 50vw, 320px" />
                    <span className="ng-mono text-ng-ash">{item.category}</span>
                    <span className="font-ng-display text-[26px] leading-none">{splitScriptName(item.name).name}</span>
                    <span className="text-[15px]">{item.price}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <StorefrontFooter />
      </main>

      {/* The phone's pay bar, as the phone cart had: the total and the next step, always in reach. */}
      {items.length ? (
        <div className="ng-buybar is-visible lg:hidden">
          <div className="ng-buybar__inner">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="ng-mono text-ng-ash">{t('cust.itemCount', { count: summary.boughtQuantity })}</span>
              <span className="text-lg">{formatTotal(voucher.subtotalAfterDiscount)}</span>
              {voucher.discountAmount ? <span className="text-xs text-ng-sand">{t('cart.saved', { amount: formatTotal(voucher.discountAmount) })}</span> : null}
            </div>
            <Link to="/checkout" className="ng-btn shrink-0">{t('cart.payNext')}</Link>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default CartPage;
