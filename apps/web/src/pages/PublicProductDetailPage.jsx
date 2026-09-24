import { useOverseasPrice } from '@/hooks/useOverseasPrice.js';
import { formatUsdPrice } from '@/utils/usdPrice.js';
import { cardLabels } from '@/utils/productBadge.js';
import CardPrice from '@/components/storefront/CardPrice.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScentPyramid from '@/components/storefront/ScentPyramid.jsx';
import OverseasInquiryButton from '@/components/storefront/OverseasInquiryButton.jsx';
import ShareProductButton from '@/components/storefront/ShareProductButton.jsx';
import PriceNote from '@/components/storefront/PriceNote.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import ImmersiveProductPage from '@/pages/ImmersiveProductPage.jsx';
import { findPublicFragrance, getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { getProductStory } from '@/data/stories/index.js';
import useProductStory from '@/hooks/useProductStory.js';
import { useCart } from '@/hooks/useCart.js';
import { useMicroInteractions } from '@/hooks/useParallax.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import BriefText from '@/components/BriefText.jsx';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import StaleCatalogNotice from '@/components/storefront/StaleCatalogNotice.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import { relatedFor } from '@/utils/relatedProducts.js';
import { productCopyFor } from '@/utils/productCopy.js';
import InternationalPrice from '@/components/storefront/InternationalPrice.jsx';
import SwitchToIndonesiaHint from '@/components/storefront/SwitchToIndonesiaHint.jsx';
import { formatRupiah, getPrimaryVariant, isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import {


  DEFAULT_SHARE_IMAGE,
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  getSiteOrigin,
  toAbsoluteUrl,
} from '@/utils/seo.js';
import { getScarcityLabel } from '@/utils/stockScarcity.js';
import { isPlaceholderMood } from '@/utils/productMood.js';
import { describeWear } from '@/utils/productWear.js';





const PublicProductDetailPage = ({ slug: slugProp = '' } = {}) => {
  const { slug: slugParam = '' } = useParams();
  const slug = slugProp || slugParam;
  const studioProducts = useStorefrontProducts();
  const { t, region, isInternational } = useTranslate();
  const visibleProducts = studioProducts.filter(isProductVisibleInStorefront);
  const catalog = getPublicFragranceCatalog(visibleProducts);
  const product = findPublicFragrance(slug, visibleProducts);
  // The product's own words, in the language of the shop being read. Per field: a bottle with an
  // English description but no English notes shows both rather than hiding the half that is done.
  // Declared AFTER `product` — putting it above threw "Cannot access before initialization" and killed
  // the whole page while the build stayed green.
  const copy = productCopyFor(product, region);
  const productsLoading = Boolean(studioProducts.loading);
  const { story: supabaseStory, loading: storyLoading } = useProductStory(slug);
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [lastAddedSlug, setLastAddedSlug] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [showStickyBar, setShowStickyBar] = useState(false);
  const addBtnRef = useRef(null);
  const revealRef = useScrollReveal();
  const { magnetic, tilt, resetTilt } = useMicroInteractions();

  // Below every useState it reads and above every early return: useOverseasPrice is a HOOK, so it cannot
  // sit after a conditional return, and selectedVariantId is a const, so it cannot be read before its own
  // declaration. Putting this block above the state threw "Cannot access 'selectedVariantId' before
  // initialization" and killed the page — with the build still green, for the second time.
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  // Default to the bottle the headline price belongs to, not whichever variant happens to be first —
  // otherwise the page can open quoting Rp 129.000 above a button that charges Rp 310.000.
  const selectedVariant = variants.find((v) => (v.id || v.size) === selectedVariantId) || getPrimaryVariant(variants) || null;
  // useOverseasPrice, not useExportPrice: the second hands the export price to the Indonesian shop too.
  const exportPrice = useOverseasPrice(product, selectedVariant);

  // Reveal a compact sticky buy-bar once the main add-to-cart button scrolls out of view.
  useEffect(() => {
    const target = addBtnRef.current;
    if (!target) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { rootMargin: '0px 0px -80px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [product?.slug]);

  if (!product) {
    // Don't 404 while the catalog is still loading (cold cache / shared deep link):
    // wait for the async fetch before deciding the product doesn't exist.
    if (productsLoading) {
      return (
        <>
          <PublicHeader />
          <main
            role="status"
            aria-live="polite"
            aria-busy="true"
            style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: '48px 24px' }}
          >
            <p className="editorial-eyebrow">{t('pdp.loading')}</p>
          </main>
          <StorefrontFooter />
        </>
      );
    }
    return <Navigate to="/not-found" replace />;
  }

  // Pick the selected size variant (default the first), so desktop buyers can choose size and are
  // charged that variant's price — matching mobile, instead of always the product default.
  const selectedPrice = Number(selectedVariant?.priceNumber || product.priceNumber || 0);
  const selectedSize = selectedVariant?.size || product.size;
  const selectedVariantKey = selectedVariant?.id || selectedVariant?.size || '';
  const selectedPriceLabel = selectedPrice > 0 ? formatRupiah(selectedPrice) : product.price;
  // What the buy button says, and what the cart will total: the international price where there is one.
  // A domestic figure on an English button is the oldest version of this bug.
  //
  // Declared AFTER selectedPriceLabel, not before it. Putting it above threw "Cannot access
  // 'selectedPriceLabel' before initialization" and killed the whole page — with the build still green,
  // for the third time in this file.
  // In dollars where the buyer pays in dollars. The headline above this button reads US$80; a button
  // reading Rp 1.260.000 under it asks them to reconcile two currencies before they can press it.
  const buyPriceLabel = exportPrice ? (formatUsdPrice(exportPrice) || formatRupiah(exportPrice)) : selectedPriceLabel;
  // Public variants carry `availability` ('Available'|'Inquire'), not a raw stock count — use it so we
  // don't expose exact inventory. Fall back to the product-level publicStatus when there are no variants.
  const selectedAvailable = selectedVariant ? selectedVariant.availability === 'Available' : product.publicStatus === 'Available';
  const soldOut = !selectedAvailable;
  const scarcity = soldOut ? '' : getScarcityLabel(selectedVariant?.stock, t);

  const handleAddToCart = () => {
    if (soldOut) {
      toast.error(t('catalog.outOfStockToast', { name: product.name }));
      return;
    }
    addItem({
      ...product,
      cartSlug: `${product.slug}-${selectedVariant?.id || selectedSize}`,
      variantId: selectedVariant?.id || '',
      size: selectedSize,
      price: selectedPriceLabel,
      priceNumber: selectedPrice,
    }, 1);
    setLastAddedSlug(product.slug);
    toast.success(t('pdp.addedToast', { name: `${product.name} (${selectedSize})` }), {
      description: t('pdp.cartUpdated'),
      action: { label: t('pdp.viewCart'), onClick: () => navigate('/cart') },
    });
    window.setTimeout(() => {
      setLastAddedSlug((current) => (current === product.slug ? '' : current));
    }, 1800);
  };

  const related = relatedFor(product, catalog);
  // The immersive story is a long editorial narrative — a letter, not UI copy. The English shop gets it
  // only when an ENGLISH one exists; it never falls back to the Indonesian, because a full-screen
  // Javanese letter is a whole page in a language the reader did not pick, and worse than the ordinary
  // product page, whose description and notes do have English text.
  //
  // The story written in Studio is Indonesian by construction — the editor has one set of fields — so it
  // is only ever offered to the Indonesian shop. The English side reads the file pair, where a story that
  // has no English twin simply answers null.
  const productStory = isInternational
    ? getProductStory(slug, region)
    : (supabaseStory || getProductStory(slug, region));

  if (storyLoading) {
    return (
      <>
        <PublicHeader />
        <main role="status" aria-live="polite" aria-busy="true" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
          <p className="editorial-eyebrow">{t('pdp.loading')}</p>
        </main>
        <StorefrontFooter />
      </>
    );
  }

  if (productStory) {
    return <ImmersiveProductPage product={product} story={productStory} />;
  }

  const siteOrigin = getSiteOrigin();
  const canonicalUrl = toAbsoluteUrl(`/catalog/${product.slug}`, siteOrigin);
  const shareImage = toAbsoluteUrl(product.imageUrl || product.images?.[0] || DEFAULT_SHARE_IMAGE, siteOrigin);
  const metaDescription = `${product.name} — ${product.subtitle || product.story || ''}`.trim().slice(0, 155);
  const productJsonLd = buildProductJsonLd(product, { origin: siteOrigin, canonicalUrl });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: t('pdp.home'), path: '/home' },
    { name: t('pdp.collection'), path: '/catalog' },
    { name: product.name, path: `/catalog/${product.slug}` },
  ], siteOrigin);

  return (
    <>
      <Helmet>
        <title>{product.name} - SOLIVAGANT</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:site_name" content="SOLIVAGANT" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={`${product.name} - SOLIVAGANT`} />
        <meta property="og:description" content={metaDescription} />
        {shareImage ? <meta property="og:image" content={shareImage} /> : null}
        {shareImage ? <meta property="og:image:alt" content={product.name} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${product.name} - SOLIVAGANT`} />
        <meta name="twitter:description" content={metaDescription} />
        {shareImage ? <meta name="twitter:image" content={shareImage} /> : null}
        {product.priceNumber > 0 ? <meta property="product:price:amount" content={String(product.priceNumber)} /> : null}
        {product.priceNumber > 0 ? <meta property="product:price:currency" content="IDR" /> : null}
        {productJsonLd ? <script type="application/ld+json">{JSON.stringify(productJsonLd)}</script> : null}
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <StaleCatalogNotice stale={studioProducts.stale} className="mx-auto mt-4 w-[min(1180px,92vw)]" />
        <ScrollProgress />
        <PublicHeader />

        {/* Breadcrumb */}
        <nav className="pdp-breadcrumb hero-animate-fade" aria-label="Breadcrumb">
          <Link to="/catalog">{t('pdp.collection')}</Link>
          <ChevronRight className="h-3 w-3" />
          <span>{product.name}</span>
        </nav>

        {/* Product detail — large image + info */}
        <section className="pdp-main">
          <div className="pdp-gallery img-hover-zoom hero-animate-image">
            <ProductVisual product={product} className="pdp-gallery__image" imageFit="cover" priority label={false} />
          </div>
          <div className="pdp-info">
            <p className="editorial-eyebrow hero-animate-text hero-animate-text--d1">{cardLabels(product).join(' · ')}</p>
            <h1 className="hero-animate-text hero-animate-text--d2">{product.name}</h1>
            {/* One price, for the shop being read. In the English shop the Indonesian price and the
                member/tier line are not shown at all: three prices on one screen left the reader to guess
                which was theirs, which is what Dekito saw on his own phone. */}
            {exportPrice ? (
              <InternationalPrice price={exportPrice} className="hero-animate-text hero-animate-text--d3" />
            ) : (
              <>
                <p className="pdp-price hero-animate-text hero-animate-text--d3">{product.price}</p>
                <PriceNote product={product} variant={selectedVariant} />
              </>
            )}
            {scarcity ? <p className="pdp-scarcity hero-animate-text hero-animate-text--d3">{scarcity}</p> : null}
            {/* The written description carries blank lines the author typed; a bare {story} collapsed
                them into one run-on block, the same way bespoke briefs used to render. */}
            <div className="pdp-story hero-animate-text hero-animate-text--d4">
              <BriefText text={copy.description} />
            </div>

            {/* Scent pyramid */}
            <div data-reveal>
              <ScentPyramid product={{ ...product, ...copy }} />
            </div>

            {/* Meta details */}
            <div className="pdp-meta" data-reveal>
              {isPlaceholderMood(product.mood) ? null : <span>{product.mood}</span>}
              <span>{product.concentration}</span>
              {product.intensity ? <span>{t('pdp.intensity', { level: product.intensity.toLowerCase() })}</span> : null}
              <span>{(product.sizeVariants || []).map((v) => v.size).join(' / ')}</span>
            </div>

            {/* The catalogue filter promises this bottle suits a moment; the product page has to
                say the same thing, or a customer arriving from search never sees the claim. */}
            {describeWear(product.wear, t).length ? (
              <div className="pdp-materials" data-reveal>
                <p className="editorial-eyebrow">{t('pdp.wearFor')}</p>
                <div className="pdp-meta">
                  {describeWear(product.wear, t).map((label) => <span key={label}>{label}</span>)}
                </div>
              </div>
            ) : null}

            {product.materialHighlights?.length ? (
              <div className="pdp-materials" data-reveal>
                <p className="editorial-eyebrow">RAW MATERIAL HIGHLIGHTS</p>
                <div className="pdp-meta">
                  {product.materialHighlights.map((m) => <span key={m}>{m}</span>)}
                </div>
              </div>
            ) : null}

            {variants.length > 1 ? (
              <div className="pdp-variants" data-reveal>
                <label className="editorial-eyebrow" htmlFor="pdp-variant-select">{t('pdp.size')}</label>
                <select
                  id="pdp-variant-select"
                  value={selectedVariantKey}
                  onChange={(event) => setSelectedVariantId(event.target.value)}
                  className="pdp-variant-select"
                >
                  {variants.map((v) => {
                    const key = v.id || v.size;
                    return (
                      <option key={key} value={key}>
                        {v.size} — {formatRupiah(v.priceNumber)}{v.availability !== 'Available' ? ' (Habis)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : null}

            <div className="pdp-actions" data-reveal>
              {/* Offered in both shops since 2026-09-25. The cart was domestic-only while shipping came
                  from RajaOngkir — a foreign address returned an empty area list — and while the cart
                  totalled the Indonesian price under a page quoting the international one. The checkout
                  now asks for a destination country instead of a courier, and the cart totals what this
                  page shows, so the buyer can finish the form they start.
                  The price on the button is the one they are actually charged, which in the English shop
                  is the international price — the domestic figure on an English button is the oldest
                  version of this bug. */}
              <button ref={addBtnRef} type="button" className="pdp-add-btn magnetic-hover" onClick={() => handleAddToCart()} onMouseMove={magnetic} disabled={soldOut}>
                {soldOut ? (
                  <>{t('pdp.soldOut')}</>
                ) : lastAddedSlug === product.slug ? (
                  <><CheckCircle2 className="h-4 w-4" /> {t('pdp.inCart')}</>
                ) : (
                  <><ShoppingBag className="h-4 w-4" /> {t('pdp.addToCartWithPrice', { price: buyPriceLabel })}</>
                )}
              </button>
              <OverseasInquiryButton product={product} variant={selectedVariant} size={selectedSize} price={exportPrice ? formatRupiah(exportPrice) : selectedPriceLabel} className="mt-3" />
              <ShareProductButton product={product} className="mt-3" />
              <SwitchToIndonesiaHint className="mt-3" />
            </div>
          </div>
        </section>

        {/* Related products */}
        {related.length ? (
          <section className="pdp-related" data-reveal>
            <div className="home-section__head">
              <p className="editorial-eyebrow">{t('pdp.youMayLike')}</p>
              <h2>{t('pdp.youMayLikeSub')}</h2>
            </div>
            <div className="catalog-grid catalog-grid--four" data-reveal data-stagger-children>
              {related.map((item) => (
                <Link key={item.slug} to={`/catalog/${item.slug}`} className="catalog-card card-lift card-tilt img-hover-zoom" onMouseMove={tilt} onMouseLeave={resetTilt}>
                  <ProductVisual product={item} className="catalog-card__visual" imageFit="cover" label={false} />
                  <div className="catalog-card__info">
                    <span className="catalog-card__category">{item.category}</span>
                    <h3>{item.name}</h3>
                    <CardPrice product={item} className="catalog-card__price" memberClassName="text-[11px] font-bold uppercase tracking-[0.1em] text-amber-700" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <StorefrontFooter />
      </main>

      {/* Sticky buy-bar — appears after the main CTA scrolls away */}
      <div className={`pdp-sticky-bar${showStickyBar ? ' is-visible' : ''}`} aria-hidden={!showStickyBar}>
        <div className="pdp-sticky-bar__inner">
          <div className="pdp-sticky-bar__product">
            <div className="pdp-sticky-bar__thumb">
              <ProductVisual product={product} imageFit="cover" label={false} />
            </div>
            <div className="pdp-sticky-bar__text">
              <span className="pdp-sticky-bar__name">{product.name}</span>
              <span className="pdp-sticky-bar__price">{exportPrice ? formatRupiah(exportPrice) : selectedPriceLabel}</span>
            </div>
          </div>
          {/* The sticky bar is a second add-to-cart and must say the same thing as the first. It carried
              the WhatsApp enquiry while the cart was domestic-only; a bar that disagreed with the button
              above it is how the English shop leaked a domestic price twice. */}
          <button
            type="button"
            className="pdp-add-btn magnetic-hover"
            onClick={() => handleAddToCart()}
            onMouseMove={magnetic}
            tabIndex={showStickyBar ? 0 : -1}
            disabled={soldOut}
          >
            {soldOut ? (
              <>{t('pdp.soldOut')}</>
            ) : lastAddedSlug === product.slug ? (
              <><CheckCircle2 className="h-4 w-4" /> {t('pdp.inCart')}</>
            ) : (
              <><ShoppingBag className="h-4 w-4" /> {t('pdp.addToCart')}</>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default PublicProductDetailPage;
