import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';
import { atStockCap, nextQuantityUp } from '@/utils/cartQuantity.js';
import { useCart } from '@/hooks/useCart.js';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import { useCartInternationalQuote } from '@/hooks/useInternationalQuote.js';
import { buildInternationalCartDraft } from '@/utils/overseasEnquiry.js';
import { shortNoteList } from '@/utils/shortNoteList.js';
import { splitScriptName } from '@/utils/scriptName.js';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import InternationalShippingQuote from '@/components/storefront/InternationalShippingQuote.jsx';
import FreeVialPicker from '@/components/storefront/FreeVialPicker.jsx';
import StaleCatalogNotice from '@/components/storefront/StaleCatalogNotice.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';

/**
 * The English shop's cart: the same basket as the Indonesian one, priced in dollars, with the parcel's
 * destination, shipping and arrival next to it, and WhatsApp as the till.
 *
 * Dekito's decision, 2026-10-06, reversing his own of 18 Sep: "saya maunya orang luar itu masukin ke
 * keranjang sama kayak di Indonesia — dari situ baru pilih negara dan kelihatan ongkir, baru order ke
 * WA." Between those dates the English shop had no cart at all and sold one bottle at a time by enquiry,
 * because the only cart was the domestic one — rupiah, a voucher box and an Indonesian courier list.
 *
 * So this is a SEPARATE page rather than a branch inside CartPage. A page that renders half of itself
 * is how the first attempt leaked a domestic price under an international one, and a page that cannot
 * reach rupiah, the voucher or /checkout cannot leak them. What it shares with the domestic cart is the
 * storage, the line controls and the classes; what it must never share is the till.
 */
const InternationalCartPage = () => {
  const { t } = useTranslate();
  const { items, updateQuantity, removeItem, setGift } = useCart();
  const catalog = useStorefrontProducts();
  const quote = useCartInternationalQuote(items);
  const phone = getStorefrontWhatsAppNumber();
  const { lines, unpriced, needsDestination, focusDestinationPicker, draft } = quote;
  const message = buildInternationalCartDraft({ t, quote: draft });
  // THE BUTTON IS NEVER DEAD. Until a destination is picked it points at the picker; once one is picked it
  // opens WhatsApp, whether or not the rule could price the parcel. It used to require a SETTLED total, so
  // a buyer who chose "another country" — the one option that describes a destination the carrier sheet
  // does not list, and therefore the buyer who most needs to reach Dekito — pressed a button that did
  // nothing at all. Same for seven bottles, and for a line with no export price.
  const canOrder = Boolean(message) && Boolean(phone);
  // Lines the catalogue can no longer fulfil. The domestic cart has said this since audit round 9; this
  // one said nothing, and three bottles are out of stock in the shop as this is written.
  const unfulfillable = lines.filter((line) => line.unavailable || line.outOfStock);

  return (
    <>
      <Helmet><title>{t('cart.tab')}</title></Helmet>
      <main className="solivagant-editorial-home">
        <StaleCatalogNotice stale={catalog.stale} className="mx-auto mt-4 w-[min(1180px,92vw)]" />
        <ScrollProgress />
        <PublicHeader />

        <section className="ng-section !border-b-0 !pt-14 md:!pt-20">
          <div className="ng-container flex flex-col gap-12">
            <div className="flex flex-col gap-5">
              <p className="ng-eyebrow ng-mono m-0">{t('cart.eyebrow')}</p>
              <h1 className="ng-display ng-h1">{t('cart.title')}</h1>
              <p className="ng-lead">{t('cart.intl.lead')}</p>
            </div>

            <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-[72px]">
              <div className="flex flex-col gap-14">
                <div className="flex flex-col border-t border-ng-bone/30">
                  {unfulfillable.length ? (
                    <p className="ng-error m-0 border-b border-ng-bone/15 py-4 text-sm" role="alert">
                      {t('cart.intl.unavailable', { names: unfulfillable.map((line) => line.name).join(', ') })}
                    </p>
                  ) : null}
                  {unpriced.length ? (
                    <p className="ng-error m-0 border-b border-ng-bone/15 py-4 text-sm" role="alert">
                      {t('cart.intl.unpriced', { names: unpriced.map((line) => line.name).join(', ') })}
                    </p>
                  ) : null}
                  {!lines.length ? (
                    <div className="flex flex-col items-start gap-5 border-b border-ng-bone/15 py-14">
                      <ShoppingBag className="h-8 w-8 text-ng-ash" aria-hidden="true" />
                      <h2 className="ng-display text-[36px] font-normal">{t('cart.empty')}</h2>
                      <p className="m-0 text-ng-dust">{t('cart.emptyBody')}</p>
                      <Link to="/catalog" className="ng-btn">
                        {t('home.seeCollection')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  ) : (
                    lines.map((line) => (
                      <div key={line.slug} className="ng-cart-line">
                        <Link to={`/catalog/${line.productSlug}`} className="ng-cart-line__image" tabIndex={-1} aria-hidden="true">
                          <ProductVisual product={line} className="h-full w-full" imageFit="cover" label={false} sizes="96px" />
                        </Link>
                        <div className="flex min-w-0 flex-col gap-2">
                          <Link to={`/catalog/${line.productSlug}`} className="font-ng-display text-[28px] leading-none text-ng-bone no-underline [overflow-wrap:anywhere] md:text-[34px]">{splitScriptName(line.name).name}</Link>
                          <span className="ng-mono text-ng-ash">{[shortNoteList(line.notes), line.size].filter(Boolean).join(' · ')}</span>
                          <button type="button" className="ng-link ng-mono mt-1 inline-flex min-h-[44px] items-center self-start border-0 bg-transparent p-0 underline underline-offset-4" onClick={() => removeItem(line.slug)} aria-label={t('cart.removeOf', { name: line.name })}>
                            {t('cart.removeItem')}
                          </button>
                        </div>
                        <div className="ng-cart-line__qty">
                          <div className="ng-stepper">
                            <button type="button" onClick={() => updateQuantity(line.slug, Math.max(1, line.quantity - 1))} aria-label={t('cart.decreaseOf', { name: line.name })}>
                              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <span aria-live="polite">{line.quantity}</span>
                            <button type="button" onClick={() => updateQuantity(line.slug, nextQuantityUp(line))} disabled={atStockCap(line)} aria-label={t('cart.increaseOf', { name: line.name })}>
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        {/* The dollar alone, per bottle and for the line — see the note at the top of
                            InternationalPrice.jsx for why the rupiah is not beside it. */}
                        <div className="ng-cart-line__sum flex flex-col items-end gap-1 text-right">
                          <span className="text-base">{line.unitUsd ? `US$${line.unitUsd}` : t('intlQuote.onRequest.destination')}</span>
                          {line.unitUsd && line.quantity > 1 ? <span className="text-xs text-ng-dust">{`US$${line.lineUsd}`}</span> : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {/* The gift, in both shops since 2026-10-06. Every word of it comes from the message file, so
                    it reads in English here; the line it writes into the cart carries Dekito's own Indonesian
                    'Gratis' for the packing slip, which the buyer never sees. */}
                <FreeVialPicker items={items} products={catalog} onPick={setGift} />
              </div>

              <aside className="ng-panel ng-sticky flex flex-col gap-6" aria-labelledby="intl-cart-summary">
                <p className="ng-mono m-0 text-ng-ash">{t('cart.summaryEyebrow')}</p>
                <h2 id="intl-cart-summary" className="sr-only">{t('cart.summary')}</h2>
                {lines.length ? <InternationalShippingQuote quote={quote} /> : null}
                <p className="m-0 text-sm leading-relaxed text-ng-dust">{t('cart.intl.howItWorks')}</p>
                {lines.length ? (
                  <a
                    href={canOrder ? buildWhatsAppCheckoutUrl(message, phone) : '#'}
                    onClick={needsDestination ? focusDestinationPicker : undefined}
                    target={canOrder ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="ng-btn ng-btn--lg ng-btn--block"
                    aria-disabled={!canOrder && !needsDestination}
                  >
                    <Globe className="h-4 w-4" aria-hidden="true" /> {t(needsDestination ? 'intlQuote.pickFirst' : 'cart.intl.order')}
                  </a>
                ) : (
                  <Link to="/catalog" className="ng-btn ng-btn--lg ng-btn--block">{t('cart.addProductsFirst')}</Link>
                )}
                <Link to="/catalog" className="ng-link ng-mono inline-flex min-h-[44px] items-center justify-center">{t('cart.keepShopping')}</Link>
              </aside>
            </div>
          </div>
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default InternationalCartPage;
