import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Globe, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import StaleCatalogNotice from '@/components/storefront/StaleCatalogNotice.jsx';
import InternationalShippingQuote from '@/components/storefront/InternationalShippingQuote.jsx';
import FreeVialPicker from '@/components/storefront/FreeVialPicker.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import { useCart } from '@/hooks/useCart.js';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import { isProductVisibleInStorefront, getProductStockTotal } from '@/services/productCatalogService.js';
import CardPrice from '@/components/storefront/CardPrice.jsx';
import { useCartInternationalQuote } from '@/hooks/useInternationalQuote.js';
import { buildInternationalCartDraft } from '@/utils/overseasEnquiry.js';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';

/**
 * The phone's English cart. Same rule as the desktop one (InternationalCartPage.jsx): the basket in
 * dollars, the destination and shipping beside it, WhatsApp as the till, and nothing on the page that
 * can reach rupiah, the voucher or /mobile/checkout.
 */
const MobileInternationalCartPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslate();
  const { items, updateQuantity, removeItem, setGift } = useCart();
  const products = useStorefrontProducts();
  // In stock, counted. The two carts reach the catalogue through DIFFERENT mappers — the Studio one
  // here, the public one on CatalogPage — and only the public one carries `publicStatus`, so the
  // obvious-looking predicate silently matched nothing and emptied the whole list. getProductStockTotal
  // is what publicStatus is itself derived from, and it works on either shape.
  //
  // Both carts were offering La Tulipe, which has been at zero for days: the first thing an empty cart
  // suggests should not be the one bottle the catalogue greys out.
  const recommended = !items.length
    ? products.filter((entry) => isProductVisibleInStorefront(entry) && getProductStockTotal(entry.variants || []) > 0).slice(0, 4)
    : [];
  const quote = useCartInternationalQuote(items);
  const phone = getStorefrontWhatsAppNumber();
  const { lines, unpriced, needsDestination, focusDestinationPicker, draft, totalUsd, bottles } = quote;
  const message = buildInternationalCartDraft({ t, quote: draft });
  // Same two rules as the desktop cart: the button is never dead, and a line the catalogue cannot fulfil
  // is said out loud. See the notes in InternationalCartPage.jsx.
  const canOrder = Boolean(message) && Boolean(phone);
  const unfulfillable = lines.filter((line) => line.unavailable || line.outOfStock);
  const decrease = (line) => (line.quantity <= 1 ? removeItem(line.slug) : updateQuantity(line.slug, line.quantity - 1));
  const visualFor = (line) => {
    const product = products.find((entry) => entry.slug === line.productSlug || entry.id === line.productId);
    return { ...(product || {}), ...line, images: product?.images, imageUrl: product?.imageUrl };
  };

  return (
    <MobileCommerceLayout>
      <Helmet><title>{t('cart.tab')}</title></Helmet>
      <main className="mobile-page mobile-cart-page" style={{ background: 'var(--editorial-paper)' }}>
        <StaleCatalogNotice stale={products.stale} className="mx-4 mt-3" />
        <section style={{ padding: '20px 16px', borderBottom: '1px solid var(--editorial-stone)' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--editorial-brass)' }}>
            {t('cart.title')}
          </div>
          <div style={{ marginTop: 4, fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.15, color: 'var(--editorial-charcoal)', fontFamily: 'Georgia, "Times New Roman", serif' }}>
            {totalUsd ? `US$${totalUsd}` : (lines.length ? `${bottles} × 30 ml` : t('cart.startShopping'))}
          </div>
          <p style={{ marginTop: 8, fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--editorial-muted)' }}>
            {lines.length ? t('cart.intl.lead') : t('cart.emptyMobileBody')}
          </p>
          {/* Two buttons, because the sentence above offers two things. It is the same string the
              Indonesian cart uses — "pick a bottle in stock, or start a bespoke request" — and this
              shop printed it over a single Shop button, promising a door it did not show. */}
          {lines.length ? null : (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Button type="button" className="h-11 rounded-xl gap-2" style={{ background: 'var(--editorial-charcoal)', color: 'var(--editorial-paper)' }} onClick={() => navigate('/mobile/catalog')}>
                <ShoppingBag className="h-4 w-4" /> {t('mcart.shop')}
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-xl gap-2" style={{ borderColor: 'var(--editorial-stone)', background: 'var(--editorial-paper)', color: 'var(--editorial-charcoal)' }} onClick={() => navigate('/mobile/bespoke')}>
                {t('cart.bespoke')}
              </Button>
            </div>
          )}
        </section>
        {unfulfillable.length ? (
          <p role="alert" style={{ margin: '12px 16px 0', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', padding: '8px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#b91c1c' }}>
            {t('cart.intl.unavailable', { names: unfulfillable.map((line) => line.name).join(', ') })}
          </p>
        ) : null}
        {unpriced.length ? (
          <p role="alert" style={{ margin: '12px 16px 0', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', padding: '8px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#b91c1c' }}>
            {t('cart.intl.unpriced', { names: unpriced.map((line) => line.name).join(', ') })}
          </p>
        ) : null}
        <section style={{ display: 'grid', gap: 0 }}>
          {lines.map((line) => (
            <article key={line.slug} style={{ padding: '16px', borderBottom: '1px solid var(--editorial-stone)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '76px minmax(0,1fr) 42px', alignItems: 'start', gap: 12 }}>
                <ProductVisual product={visualFor(line)} className="h-[76px] rounded-[10px]" label={false} sizes="76px" />
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.3, color: 'var(--editorial-charcoal)' }}>{line.name}</h2>
                  <p style={{ marginTop: 4, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--editorial-brass)' }}>
                    {line.unitUsd ? `US$${line.unitUsd}` : t('intlQuote.onRequest.destination')} / {line.size}
                  </p>
                </div>
                <Button type="button" size="icon" variant="outline" aria-label={t('cart.removeOf', { name: line.name })} className="h-10 w-10 shrink-0 rounded-[10px] tap-44" style={{ borderColor: 'var(--editorial-stone)', background: 'var(--editorial-paper)', color: 'var(--editorial-muted)' }} onClick={() => removeItem(line.slug)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 10, border: '1px solid var(--editorial-stone)', background: 'var(--editorial-paper)', padding: 4 }}>
                  <Button type="button" size="icon" variant="ghost" aria-label={t('cart.decreaseOf', { name: line.name })} className="h-8 w-8 rounded-lg tap-44" onClick={() => decrease(line)}><Minus className="h-4 w-4" /></Button>
                  <span style={{ display: 'grid', height: 32, minWidth: 40, placeItems: 'center', fontSize: '0.875rem', fontWeight: 600 }}>{line.quantity}</span>
                  <Button type="button" size="icon" variant="ghost" aria-label={t('cart.increaseOf', { name: line.name })} className="h-8 w-8 rounded-lg tap-44" onClick={() => updateQuantity(line.slug, line.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--editorial-charcoal)' }}>{line.lineUsd ? `US$${line.lineUsd}` : ''}</div>
              </div>
            </article>
          ))}
        </section>
        {/* Same rule as the desktop cart — see the note there. */}
        <FreeVialPicker items={items} products={products} onPick={setGift} />
        {/* An empty cart ended here in this shop: one button and nothing to look at, in the shop that
            has taken no orders at all. The Indonesian cart has shown four bottles in this spot all
            along. Prices in dollars, because this is the shop that reads in dollars. */}
        {!lines.length && recommended.length ? (
          <section style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--editorial-charcoal)' }}>{t('cart.recommendations')}</h2>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {recommended.map((product) => (
                <button
                  key={product.slug}
                  type="button"
                  onClick={() => navigate(`/mobile/products/${product.slug}`)}
                  style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <ProductVisual product={product} className="aspect-[4/5] rounded-[10px]" label={false} sizes="(max-width: 480px) 45vw, 180px" />
                  <span style={{ display: 'block', marginTop: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--editorial-charcoal)' }}>{product.name}</span>
                  {/* CardPrice, not a conversion of my own: the export price is keyed by VARIANT, so
                      pricing from product.priceNumber quotes the DOMESTIC figure converted to dollars —
                      L'iris came out at US$30 against its real US$95. That is the exact mistake the
                      overseas tier exists to prevent, and it was on screen before it was measured. */}
                  <CardPrice product={product} className="block text-[0.78rem] text-[color:var(--editorial-muted)]" />
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {lines.length ? (
          <section style={{ padding: '16px' }}>
            <InternationalShippingQuote quote={quote} />
            <p style={{ marginTop: 10, fontSize: '0.72rem', lineHeight: 1.5, color: 'var(--editorial-muted)' }}>{t('cart.intl.howItWorks')}</p>
          </section>
        ) : null}
        {lines.length ? (
          <StickyBottomActionBar fixed reserveSpace aria-label={t('cart.actionsAria')} className="mobile-cart-action-bar" contentClassName="rounded-xl" style={{ borderColor: 'var(--editorial-stone)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 12, background: 'rgba(255,250,240,0.97)', borderRadius: 12, padding: '4px 4px 4px 12px' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--editorial-muted)' }}>{t(bottles === 1 ? 'intlQuote.bottleOne' : 'intlQuote.bottleMany', { count: bottles })}</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--editorial-charcoal)' }}>{totalUsd ? `US$${totalUsd}` : (quote.goodsUsd ? `US$${quote.goodsUsd}` : '')}</p>
              </div>
              <a
                href={canOrder ? buildWhatsAppCheckoutUrl(message, phone) : '#'}
                onClick={needsDestination ? focusDestinationPicker : undefined}
                target={canOrder ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="m-editorial-pdp__sticky-btn"
                aria-disabled={!canOrder && !needsDestination}
              >
                <Globe className="h-4 w-4" /> {t(needsDestination ? 'intlQuote.pickFirst' : 'cart.intl.order')}
              </a>
            </div>
          </StickyBottomActionBar>
        ) : null}
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileInternationalCartPage;
