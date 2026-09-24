import CardPrice from '@/components/storefront/CardPrice.jsx';
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, Globe, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import BriefText from '@/components/BriefText.jsx';
import ProductGallery from '@/components/storefront/ProductGallery.jsx';
import { useMobileBackNavigation } from '@/hooks/useMobileBackNavigation.js';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import StaleCatalogNotice from '@/components/storefront/StaleCatalogNotice.jsx';
import OverseasInquiryButton from '@/components/storefront/OverseasInquiryButton.jsx';
import ShareProductButton from '@/components/storefront/ShareProductButton.jsx';
import PriceNote from '@/components/storefront/PriceNote.jsx';
import { useCart } from '@/hooks/useCart.js';
import useProductStory from '@/hooks/useProductStory.js';
import ImmersiveProductPage from '@/pages/ImmersiveProductPage.jsx';
import { getProductStory } from '@/data/stories/index.js';
import { buildOverseasDraft, overseasDraftKeys } from '@/utils/overseasEnquiry.js';
import { cardLabels } from '@/utils/productBadge.js';
import { useOverseasPrice } from '@/hooks/useOverseasPrice.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { relatedFor } from '@/utils/relatedProducts.js';
import { productCopyFor } from '@/utils/productCopy.js';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import InternationalPrice from '@/components/storefront/InternationalPrice.jsx';
import SwitchToIndonesiaHint from '@/components/storefront/SwitchToIndonesiaHint.jsx';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { formatRupiah, getPrimaryVariant, isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { getScarcityLabel } from '@/utils/stockScarcity.js';
import { isPlaceholderMood } from '@/utils/productMood.js';
import { desktopCanonicalPath, toAbsoluteUrl } from '@/utils/seo.js';





const MobileProductDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = useMobileBackNavigation('/mobile/catalog');
  const { slug } = useParams();
  const allProducts = useStorefrontProducts();
  const visibleProducts = useMemo(() => allProducts.filter(isProductVisibleInStorefront), [allProducts]);
  const catalog = useMemo(() => getPublicFragranceCatalog(visibleProducts), [visibleProducts]);
  const previewProduct = location.state?.previewMode && location.state?.previewProduct?.slug === slug
    ? location.state.previewProduct
    : null;
  const product = previewProduct || catalog.find((p) => p.slug === slug);
  const previewMode = Boolean(previewProduct);
  const previewBackTo = location.state?.previewBackTo || '/mobile/studio/products/new';
  const { addItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [cartPromptOpen, setCartPromptOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState(null);

  const selectedVariant = useMemo(() => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    // Same as desktop: the size the headline price belongs to.
    return variants.find((v) => (v.id || v.size) === selectedVariantId) || getPrimaryVariant(variants) || null;
  }, [product, selectedVariantId]);

  // Above the early returns: this page bails out for "loading" and "not found", and a hook that runs on
  // some renders and not others is a crash, not a bug report.
  const overseasPrice = useOverseasPrice(product, selectedVariant);
  const { t, region, isInternational } = useTranslate();
  // The same handoff the desktop product page makes, and for the same reason: a perfume with a story
  // gets the story, not the ordinary page. It was missing here, so the one story this shop has was shown
  // only to desktop visitors — in a shop whose buyers are mostly on a phone.
  //
  // The resolution rule is copied deliberately, not invented: the English shop gets a story ONLY when an
  // English one exists and never falls back to the Indonesian, because a full-screen Javanese letter is
  // worse than the ordinary page, whose description and notes do have English.
  const { story: supabaseStory, loading: storyLoading } = useProductStory(slug);
  const productStory = isInternational
    ? getProductStory(slug, region)
    : (supabaseStory || getProductStory(slug, region));
  // Same rule as desktop: the product's own words follow the shop being read, per field.
  const copy = productCopyFor(product, region);
  // exportPrice here is the price for THIS shop: useOverseasPrice returns null unless the visitor is
  // reading the international one. useExportPrice would hand it to everyone — it did, and the Indonesian
  // product page briefly led with Rp 2.630.000.
  const exportPrice = useOverseasPrice(product, selectedVariant);

  if (!product && allProducts.loading) {
    return (
      <MobileCommerceLayout>
        <main className="mobile-page m-editorial-page">
          <div className="m-editorial-pdp-skeleton" />
        </main>
      </MobileCommerceLayout>
    );
  }

  // Waited for, not raced: rendering the ordinary page first and swapping to the story a moment later
  // would show the buyer two different pages for the same tap.
  if (storyLoading) {
    return (
      <MobileCommerceLayout>
        <main className="mobile-page m-editorial-page" role="status" aria-live="polite" aria-busy="true">
          <div className="m-editorial-pdp-skeleton" />
        </main>
      </MobileCommerceLayout>
    );
  }

  if (product && productStory) {
    return <ImmersiveProductPage product={product} story={productStory} mobile />;
  }

  if (!product) {
    return (
      <MobileCommerceLayout>
        <Helmet><title>{t('pdp.notFoundTab')}</title></Helmet>
        <main className="mobile-page m-editorial-page">
          <div className="m-editorial-empty">
            <p className="m-editorial-eyebrow">{t('pdp.notFoundEyebrow')}</p>
            <h2>{t('pdp.notFoundTitle')}</h2>
            <button type="button" className="m-editorial-cta" onClick={() => navigate('/mobile/catalog')}>
              {t('pdp.backToCollection')} <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </main>
      </MobileCommerceLayout>
    );
  }

  const selectedPrice = Number(selectedVariant?.priceNumber || product.priceNumber || 0);
  const selectedSize = selectedVariant?.size || product.size;
  const selectedVariantKey = selectedVariant?.id || selectedVariant?.size || '';
  // Public catalog objects expose `availability`/`publicStatus`, not a raw stock count (see
  // publicStorefront.js). Mirror the desktop PDP — reading `.stock` here always yields 0 → sold out.
  const selectedAvailable = selectedVariant ? selectedVariant.availability === 'Available' : product.publicStatus === 'Available';
  const scarcity = selectedAvailable ? getScarcityLabel(selectedVariant?.stock, t) : '';
  const soldOut = !selectedAvailable;

  const addSelectedVariant = () => {
    if (previewMode) { toast.error(t('pdp.previewDisabled')); return; }
    if (soldOut) { toast.error(t('pdp.outOfStockToast')); return; }
    addItem({
      ...product,
      cartSlug: `${product.slug}-${selectedVariant?.id || selectedSize}`,
      variantId: selectedVariant?.id || '',
      size: selectedSize,
      price: formatRupiah(selectedPrice),
      priceNumber: selectedPrice,
    }, 1);
    setLastAddedItem({ name: product.name, size: selectedSize, price: formatRupiah(selectedPrice) });
    // No toast here. The sheet below says the same thing with the size and the price in it, and a toast
    // lands at the bottom of the screen — exactly where the sheet keeps "Lanjut belanja" and "Checkout".
    // Two announcements of one event, and the louder one covered the way forward (reported 2026-09-21).
    setCartPromptOpen(true);
  };

  // Related products
  // One rule for both surfaces. The phone used to take the first four in the catalogue, full stop.
  const related = relatedFor(product, catalog);

  return (
    <MobileCommerceLayout>
      <Helmet>
        <title>{product.name} - SOLIVAGANT</title>
        <meta name="description" content={`${product.name}: ${product.story || product.description}`} />
        {/* This page is a second copy of /catalog/<slug>. Google crawls mobile-first, so without this it
            is the duplicate the crawler sees and the prerendered twin the sitemap advertises. */}
        <link rel="canonical" href={toAbsoluteUrl(desktopCanonicalPath(`/mobile/products/${product.slug}`))} />
      </Helmet>

      <main className="mobile-page m-editorial-page m-editorial-pdp">
        <StaleCatalogNotice stale={allProducts.stale} className="mx-4 mt-3" />
        {/* Back button */}
        <nav className="m-editorial-pdp__nav">
          <button type="button" onClick={previewMode ? () => navigate(previewBackTo) : handleBack} className="m-editorial-pdp__back">
            <ChevronLeft className="h-4 w-4" /> {t('pdp.back')}
          </button>
        </nav>

        {/* Product image gallery with swipe + zoom */}
        <ProductGallery product={product} className="m-editorial-pdp__gallery" visualClassName="m-editorial-pdp__image" compact priority />

        {/* Product info */}
        <div className="m-editorial-pdp__info">
          <p className="m-editorial-eyebrow">{cardLabels(product).join(' · ')}</p>
          <h1>{product.name}</h1>
          {/* Same rule as desktop: one price, for the shop being read. */}
          {exportPrice ? (
            <InternationalPrice price={exportPrice} />
          ) : (
            <>
              <p className="m-editorial-pdp__price">{product.price}</p>
              <PriceNote product={product} variant={selectedVariant} />
            </>
          )}
          {scarcity ? <p className="pdp-scarcity">{scarcity}</p> : null}

          {previewMode ? (
            <div className="m-editorial-pdp__preview-badge">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{t('pdp.previewBadge')}</span>
            </div>
          ) : null}

          {/* BriefText, same as desktop: a bare <p> collapses every newline, so a story written in
              paragraphs arrives on the phone as one wall of text. */}
          <BriefText text={copy.description} className="m-editorial-pdp__story" />

          {/* Notes */}
          <div className="m-editorial-pdp__notes">
            <div className="m-editorial-pdp__notes-row">
              <span className="m-editorial-pdp__notes-label">Top</span>
              <span className="m-editorial-pdp__notes-values">{copy.topNotes.join(', ')}</span>
            </div>
            <div className="m-editorial-pdp__notes-row">
              <span className="m-editorial-pdp__notes-label">Heart</span>
              <span className="m-editorial-pdp__notes-values">{copy.heartNotes.join(', ')}</span>
            </div>
            <div className="m-editorial-pdp__notes-row">
              <span className="m-editorial-pdp__notes-label">Base</span>
              <span className="m-editorial-pdp__notes-values">{copy.baseNotes.join(', ')}</span>
            </div>
          </div>

          {/* Variant selector */}
          {product.variants?.length > 1 ? (
            <div className="m-editorial-pdp__variants">
              <label className="m-editorial-eyebrow" htmlFor="m-variant-select">{t('pdp.size')}</label>
              <select
                id="m-variant-select"
                value={selectedVariantKey}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                className="m-editorial-pdp__variant-select"
              >
                {product.variants.map((v) => {
                  const key = v.id || v.size;
                  return <option key={key} value={key}>{v.size} — {formatRupiah(v.priceNumber)}{v.availability !== 'Available' ? t('pdp.soldOutOption') : ''}</option>;
                })}
              </select>
            </div>
          ) : null}

          <OverseasInquiryButton product={product} variant={selectedVariant} size={selectedSize} price={formatRupiah(exportPrice || selectedPrice)} compact className="mt-4" />
          <ShareProductButton product={product} compact className="mt-3" />
          <SwitchToIndonesiaHint className="mt-3" />

          {/* Meta */}
          <div className="m-editorial-pdp__meta">
            {isPlaceholderMood(product.mood) ? null : <span>{product.mood}</span>}
            {product.concentration ? <span>{product.concentration}</span> : null}
            {product.intensity ? <span>{t('pdp.intensity', { level: product.intensity.toLowerCase() })}</span> : null}
            {product.sizeVariants?.length ? <span>{product.sizeVariants.map((v) => v.size).join(' / ')}</span> : null}
          </div>
        </div>

        {/* Related */}
        {related.length ? (
          <section className="m-editorial-section m-editorial-pdp__related">
            <div className="m-editorial-section__head">
              <p className="m-editorial-eyebrow">{t('pdp.youMayLike')}</p>
            </div>
            <div className="m-editorial-product-grid">
              {related.map((item) => (
                <Link key={item.slug} to={`/mobile/products/${item.slug}`} className="m-editorial-product-card">
                  <ProductVisual product={item} className="m-editorial-product-card__visual" imageFit="cover" label={false} sizes="(max-width: 480px) 45vw, 200px" />
                  <div className="m-editorial-product-card__info">
                    <span className="m-editorial-product-card__category">{item.category}</span>
                    <h3>{item.name}</h3>
                    <CardPrice product={item} className="m-editorial-product-card__price" memberClassName="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* Sticky add-to-cart bar */}
        <StickyBottomActionBar
          fixed
          reserveSpace
          aria-label="Product action"
          className="m-editorial-pdp__sticky-bar"
          contentClassName="m-editorial-pdp__sticky-content"
        >
          <div className="m-editorial-pdp__sticky-inner">
            <div className="m-editorial-pdp__sticky-info">
              <span className="m-editorial-pdp__sticky-name">{product.name}</span>
              <span className="m-editorial-pdp__sticky-price">{formatRupiah(exportPrice || selectedPrice)}</span>
              {/* Silent for a visitor being quoted internationally: their price is the export price in
                  the panel above, so offering the member price here promises a number they will never be
                  charged. This bar is a SECOND member nudge, outside PriceNote — which is exactly why it
                  kept showing Rp 550.000 under a Rp 1.400.000 panel until it was caught on the phone. */}
              {!overseasPrice && (selectedVariant?.memberPriceNumber || product.memberPriceNumber) ? (
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700">{t('price.memberIs', { price: formatRupiah(selectedVariant?.memberPriceNumber || product.memberPriceNumber) })}</span>
              ) : null}
            </div>
            {/* In the English shop the action is the enquiry, not the cart. A DISABLED cart button would
                be worse than no cart button: it shows the buyer a door and then holds it shut. */}
            {isInternational ? (
              <a
                href={buildWhatsAppCheckoutUrl(buildOverseasDraft({
                  t,
                  name: product.name,
                  size: selectedSize,
                  price: overseasPrice ? formatRupiah(overseasPrice) : formatRupiah(selectedPrice),
                }), getStorefrontWhatsAppNumber())}
                target="_blank"
                rel="noopener noreferrer"
                className="m-editorial-pdp__sticky-btn"
              >
                <Globe className="h-4 w-4" /> {t(overseasDraftKeys().labelKey)}
              </a>
            ) : (
              <button type="button" className="m-editorial-pdp__sticky-btn" onClick={addSelectedVariant} disabled={soldOut || previewMode}>
                <ShoppingBag className="h-4 w-4" />
                {previewMode ? 'Preview' : soldOut ? t('pdp.soldOut') : t('pdp.addToCart')}
              </button>
            )}
          </div>
        </StickyBottomActionBar>
      </main>

      <MobileBottomSheet
        open={cartPromptOpen}
        onOpenChange={setCartPromptOpen}
        title={t('pdp.addedSheetTitle')}
        description={t('pdp.addedSheetBody')}
        footer={(
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12 rounded-2xl bg-white" onClick={() => setCartPromptOpen(false)}>
              {t('pdp.continueShopping')}
            </Button>
            <Button className="h-12 rounded-2xl gap-2" onClick={() => navigate('/mobile/cart')}>
              {t('pdp.checkout')} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      >
        {lastAddedItem ? (
          <div className="m-editorial-pdp__cart-confirm">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <strong>{lastAddedItem.name}</strong>
              <span>{lastAddedItem.size} — {lastAddedItem.price}</span>
            </div>
          </div>
        ) : null}
      </MobileBottomSheet>
    </MobileCommerceLayout>
  );
};

export default MobileProductDetailPage;
