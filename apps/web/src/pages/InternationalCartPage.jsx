import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';
import { useCart } from '@/hooks/useCart.js';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import { useCartInternationalQuote } from '@/hooks/useInternationalQuote.js';
import { buildInternationalCartDraft } from '@/utils/overseasEnquiry.js';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import InternationalShippingQuote from '@/components/storefront/InternationalShippingQuote.jsx';
import FreeVialPicker from '@/components/storefront/FreeVialPicker.jsx';
import StaleCatalogNotice from '@/components/storefront/StaleCatalogNotice.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import TextReveal from '@/components/storefront/TextReveal.jsx';
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

        <section className="cart-hero">
          <p className="editorial-eyebrow hero-animate-text hero-animate-text--d1">{t('cart.eyebrow')}</p>
          <TextReveal as="h1" text={t('cart.title')} />
          <p className="hero-animate-text hero-animate-text--d3">{t('cart.intl.lead')}</p>
        </section>

        <section className="cart-layout">
          <div className="cart-items">
            {unfulfillable.length ? (
              <p className="checkout-notice is-error" role="alert">
                {t('cart.intl.unavailable', { names: unfulfillable.map((line) => line.name).join(', ') })}
              </p>
            ) : null}
            {unpriced.length ? (
              <p className="checkout-notice is-error" role="alert">
                {t('cart.intl.unpriced', { names: unpriced.map((line) => line.name).join(', ') })}
              </p>
            ) : null}
            {!lines.length ? (
              <div className="cart-empty">
                <ShoppingBag className="h-10 w-10" />
                <h2>{t('cart.empty')}</h2>
                <p>{t('cart.emptyBody')}</p>
                <Link to="/catalog" className="cart-empty__cta">
                  {t('home.seeCollection')} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              lines.map((line) => (
                <div key={line.slug} className="cart-line">
                  <Link to={`/catalog/${line.productSlug}`} className="cart-line__image">
                    <ProductVisual product={line} imageFit="cover" />
                  </Link>
                  <div className="cart-line__info">
                    <Link to={`/catalog/${line.productSlug}`} className="cart-line__name">{line.name}</Link>
                    <span className="cart-line__meta">{[line.notes, line.size].filter(Boolean).join(' · ')}</span>
                    {/* The dollar alone, per bottle and for the line — see the note at the top of
                        InternationalPrice.jsx for why the rupiah is not beside it. */}
                    <span className="cart-line__price">
                      {line.unitUsd ? `US$${line.unitUsd}` : t('intlQuote.onRequest.destination')}
                      {line.unitUsd && line.quantity > 1 ? ` · US$${line.lineUsd}` : ''}
                    </span>
                  </div>
                  <div className="cart-line__qty">
                    <button type="button" onClick={() => updateQuantity(line.slug, Math.max(1, line.quantity - 1))} aria-label={t('cart.decreaseOf', { name: line.name })}>
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span>{line.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(line.slug, line.quantity + 1)} aria-label={t('cart.increaseOf', { name: line.name })}>
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button type="button" className="cart-line__remove" onClick={() => removeItem(line.slug)} aria-label={t('cart.removeOf', { name: line.name })}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
            {/* The gift, in both shops since 2026-10-06. Every word of it comes from the message file, so
                it reads in English here; the line it writes into the cart carries Dekito's own Indonesian
                'Gratis' for the packing slip, which the buyer never sees. */}
            <FreeVialPicker items={items} products={catalog} onPick={setGift} />
          </div>

          <aside className="cart-summary">
            <p className="editorial-eyebrow">{t('cart.summaryEyebrow')}</p>
            <h2>{t('cart.summary')}</h2>
            {lines.length ? <InternationalShippingQuote quote={quote} className="mt-4" /> : null}
            <p className="cart-totals__note mt-3"><span>{t('cart.intl.howItWorks')}</span></p>
            <div className="cart-actions">
              {lines.length ? (
                <a
                  href={canOrder ? buildWhatsAppCheckoutUrl(message, phone) : '#'}
                  onClick={needsDestination ? focusDestinationPicker : undefined}
                  target={canOrder ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="cart-actions__primary magnetic-hover"
                  aria-disabled={!canOrder && !needsDestination}
                >
                  <Globe className="h-4 w-4" /> {t(needsDestination ? 'intlQuote.pickFirst' : 'cart.intl.order')}
                </a>
              ) : (
                <Link to="/catalog" className="cart-actions__primary magnetic-hover">{t('cart.addProductsFirst')}</Link>
              )}
              <Link to="/catalog" className="cart-actions__secondary">{t('cart.keepShopping')}</Link>
            </div>
          </aside>
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default InternationalCartPage;
