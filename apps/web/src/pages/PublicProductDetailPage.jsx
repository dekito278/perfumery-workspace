import { useOverseasPrice } from '@/hooks/useOverseasPrice.js';
import { quotedInternationalPrice } from '@/utils/overseasEnquiry.js';
import { cardLabels } from '@/utils/productBadge.js';
import CardPrice from '@/components/storefront/CardPrice.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import ProductGallery from '@/components/storefront/ProductGallery.jsx';
import { splitScriptName } from '@/utils/scriptName.js';
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
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import BriefText from '@/components/BriefText.jsx';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import StaleCatalogNotice from '@/components/storefront/StaleCatalogNotice.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import ProductStoryLink from '@/components/storefront/ProductStoryLink.jsx';
import { relatedFor } from '@/utils/relatedProducts.js';
import { productCopyFor } from '@/utils/productCopy.js';
import InternationalPrice from '@/components/storefront/InternationalPrice.jsx';
import FreeVialNote from '@/components/storefront/FreeVialNote.jsx';
import BuyerAnswers from '@/components/storefront/BuyerAnswers.jsx';
import ProductTestimonials from '@/components/storefront/ProductTestimonials.jsx';
import InternationalShippingQuote from '@/components/storefront/InternationalShippingQuote.jsx';
import SwitchToIndonesiaHint from '@/components/storefront/SwitchToIndonesiaHint.jsx';
import { formatRupiah, getPrimaryVariant, isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { DEFAULT_SHARE_IMAGE, buildBreadcrumbJsonLd, buildProductJsonLd, getSiteOrigin, shopCanonicalUrl, toAbsoluteUrl } from '@/utils/seo.js';
import { usdPriceFor } from '@/utils/usdPrice.js';
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
          <div className="solivagant-editorial-home">
            <PublicHeader />
            <main
              role="status"
              aria-live="polite"
              aria-busy="true"
              className="grid min-h-[60vh] place-items-center px-6 py-12"
            >
              <p className="ng-mono m-0 text-ng-ash">{t('pdp.loading')}</p>
            </main>
            <StorefrontFooter />
          </div>
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
      // Top, not the default bottom: on a phone the gift prompt this add opens is a bottom sheet, and a
      // toast at the bottom lands on its buttons. See oneAnnouncement.selfcheck.
      position: 'top-center',
    });
    window.setTimeout(() => {
      setLastAddedSlug((current) => (current === product.slug ? '' : current));
    }, 1800);
  };

  const related = relatedFor(product, catalog);
  const named = splitScriptName(product.name);
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
        <div className="solivagant-editorial-home">
          <PublicHeader />
          <main role="status" aria-live="polite" aria-busy="true" className="grid min-h-[60vh] place-items-center">
            <p className="ng-mono m-0 text-ng-ash">{t('pdp.loading')}</p>
          </main>
          <StorefrontFooter />
        </div>
      </>
    );
  }

  if (productStory) {
    return <ImmersiveProductPage product={product} story={productStory} stale={studioProducts.stale} />;
  }

  const siteOrigin = getSiteOrigin();
  const canonicalUrl = shopCanonicalUrl(`/catalog/${product.slug}`, region, siteOrigin);
  const shareImage = toAbsoluteUrl(product.imageUrl || product.images?.[0] || DEFAULT_SHARE_IMAGE, siteOrigin);
  const metaDescription = `${product.name} — ${product.subtitle || product.story || ''}`.trim().slice(0, 155);
  const productJsonLd = buildProductJsonLd(product, {
    origin: siteOrigin,
    canonicalUrl,
    // The English shop states its OWN price to Google. exportPrice is the overseas tier in rupiah and
    // usdPriceFor is the shop's own rounding, so the structured data carries the same US$ figure the
    // buyer is reading — not the Rp this used to emit to every visitor on earth.
    offer: exportPrice ? { currency: 'USD', price: usdPriceFor(exportPrice) } : null,
  });
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

        <section className="ng-section !pt-10">
          <div className="ng-container flex flex-col gap-10">
            <nav className="ng-mono flex flex-wrap items-center gap-3 text-ng-ash" aria-label={t('a11y.breadcrumb')}>
              <Link to="/catalog" className="ng-link">{t('pdp.collection')}</Link>
              <span aria-hidden="true">/</span>
              <span className="text-ng-bone">{named.name}</span>
            </nav>

            <div className="grid items-start gap-10 md:grid-cols-2 md:gap-[72px]">
              <div className="relative">
                {/* Every photo the product has, with zoom — the gallery the phone page always had and the
                    desktop page never showed. One page for both now, so both get it. */}
                <ProductGallery product={product} visualClassName="aspect-[4/5]" imageFit="cover" priority />
                {named.script ? (
                  <span className="ng-script-mark pointer-events-none absolute left-6 top-5 text-[96px] md:text-[120px]" aria-hidden="true">{named.script}</span>
                ) : null}
              </div>

              <div className="ng-pdp__info flex flex-col gap-7">
                <p className="ng-mono m-0 text-ng-ember">{cardLabels(product).join(' · ')}</p>
                <div>
                  <h1 className="ng-display text-[56px] font-normal md:text-[88px]">{named.name}</h1>
                  {named.script ? <p className="m-0 mt-2.5 font-ng-java text-[28px] text-ng-ash">{named.script}</p> : null}
                </div>

                <div className="flex flex-col gap-3 border-y border-ng-bone/15 py-5">
                  {/* One price, for the shop being read. In the English shop the Indonesian price and the
                      member/tier line are not shown at all: three prices on one screen left the reader to guess
                      which was theirs, which is what Dekito saw on his own phone. */}
                  {exportPrice ? (
                    <InternationalPrice price={exportPrice} />
                  ) : (
                    <>
                      <p className="m-0 font-ng-display text-[40px] leading-none">{product.price}</p>
                      <PriceNote product={product} variant={selectedVariant} />
                    </>
                  )}
                  {scarcity ? <p className="ng-mono m-0 text-ng-ember">{scarcity}</p> : null}
                </div>

                {/* The written description carries blank lines the author typed; a bare {story} collapsed
                    them into one run-on block, the same way bespoke briefs used to render. */}
                <div className="ng-prose text-base leading-[1.7] text-ng-sand">
                  <BriefText text={copy.description} />
                </div>

                {variants.length > 1 ? (
                  <div className="flex flex-col gap-2">
                    <label className="ng-mono text-ng-dust" htmlFor="pdp-variant-select">{t('pdp.size')}</label>
                    <select
                      id="pdp-variant-select"
                      value={selectedVariantKey}
                      onChange={(event) => setSelectedVariantId(event.target.value)}
                      className="ng-field"
                    >
                      {variants.map((v) => {
                        const key = v.id || v.size;
                        return (
                          <option key={key} value={key}>
                            {v.size} — {formatRupiah(v.priceNumber)}{v.availability !== 'Available' ? t('pdp.soldOutOption') : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3.5">
                  {/* Both shops add to the cart since 2026-10-06. The English cart prices the basket in dollars,
                      asks for the destination and hands the order to WhatsApp; it never reaches the domestic
                      checkout. The gate that hid this button in the English shop from 18 Sep to 6 Oct is gone
                      with the reason for it. */}
                  <FreeVialNote products={studioProducts} />
                  <button ref={addBtnRef} type="button" className="ng-btn ng-btn--lg ng-btn--block" onClick={() => handleAddToCart()} disabled={soldOut}>
                    {soldOut ? (
                      <>{t('pdp.soldOut')}</>
                    ) : lastAddedSlug === product.slug ? (
                      <><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t('pdp.inCart')}</>
                    ) : (
                      <><ShoppingBag className="h-4 w-4" aria-hidden="true" /> {t('pdp.addToCartWithPrice', { price: quotedInternationalPrice(exportPrice, selectedPriceLabel) })}</>
                    )}
                  </button>
                  <OverseasInquiryButton product={product} variant={selectedVariant} size={selectedSize} price={selectedPriceLabel} />
                  <ShareProductButton product={product} />
                  <SwitchToIndonesiaHint />
                </div>

                {/* Under the buy button for the reason written out on the phone page: the form stood between
                    the price and the first word about the perfume. */}
                {exportPrice ? (
                  <InternationalShippingQuote product={product} variant={selectedVariant} />
                ) : null}
                {/* Customs and reviewers read this, not shoppers: a US shipment was held over the word
                    oud. Shown only where the page is quoting internationally. */}
                {exportPrice ? <p className="pdp-synthetic-accords m-0 text-xs leading-relaxed text-ng-dust">{t('pdp.syntheticAccords')}</p> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="ng-section ng-section--deep" aria-labelledby="pdp-pyramid-heading" data-reveal>
          <div className="ng-container flex flex-col gap-14">
            <h2 id="pdp-pyramid-heading" className="ng-display ng-h2">{t('pdp.ngPyramidHeading')} <em>{t('pdp.ngPyramidHeadingEm')}</em></h2>
            <ScentPyramid product={{ ...product, ...copy }} />

            <div className="flex flex-col gap-4">
              <p className="ng-mono m-0 text-ng-ash">{t('pdp.ngDetails')}</p>
              <ul className="ng-tags">
                {isPlaceholderMood(product.mood) ? null : <li>{product.mood}</li>}
                {product.concentration ? <li>{product.concentration}</li> : null}
                {product.intensity ? <li>{t('pdp.intensity', { level: product.intensity.toLowerCase() })}</li> : null}
                {(product.sizeVariants || []).length ? <li>{(product.sizeVariants || []).map((v) => v.size).join(' / ')}</li> : null}
                {/* Shown only once the atelier has stated it. A fragrance database records a launch year
                    for everything it lists, and an absent year is answered honestly rather than guessed —
                    created_at is right there and means something else entirely. */}
                {product.launchYear ? <li>{t('pdp.released', { year: product.launchYear })}</li> : null}
              </ul>
            </div>

            {/* The catalogue filter promises this bottle suits a moment; the product page has to
                say the same thing, or a customer arriving from search never sees the claim. */}
            {describeWear(product.wear, t).length ? (
              <div className="flex flex-col gap-4">
                <p className="ng-mono m-0 text-ng-ash">{t('pdp.wearFor')}</p>
                <ul className="ng-tags">
                  {describeWear(product.wear, t).map((label) => <li key={label}>{label}</li>)}
                </ul>
              </div>
            ) : null}

            {product.materialHighlights?.length ? (
              <div className="flex flex-col gap-4">
                <p className="ng-mono m-0 text-ng-ash">{t('pdp.rawMaterials')}</p>
                <ul className="ng-tags">
                  {product.materialHighlights.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {/* The story, before the other bottles. Someone still deciding about THIS perfume is better
            served by what was written about it than by four alternatives. */}
        <div className="ng-section empty:hidden">
          <ProductStoryLink product={product} className="ng-container" />
        </div>
        <ProductTestimonials product={product} />
        <BuyerAnswers />

        {related.length ? (
          <section className="ng-section" aria-labelledby="pdp-related-heading" data-reveal>
            <div className="ng-container flex flex-col gap-10">
              <div className="flex flex-col gap-3.5">
                <p className="ng-mono m-0 text-ng-ash">{t('pdp.youMayLike')}</p>
                <h2 id="pdp-related-heading" className="ng-display text-[44px] md:text-[56px]">{t('pdp.youMayLikeSub')}</h2>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-6">
                {related.map((item) => (
                  <Link key={item.slug} to={`/catalog/${item.slug}`} className="ng-card">
                    <ProductVisual product={item} className="aspect-[4/5] w-full" imageFit="cover" label={false} sizes="(max-width: 767px) 50vw, 320px" />
                    <span className="ng-mono text-ng-ash">{item.category}</span>
                    <span className="font-ng-display text-[26px] leading-none md:text-[28px]">{splitScriptName(item.name).name}</span>
                    <span className="flex flex-col gap-1 text-[15px]">
                      <CardPrice product={item} memberClassName="ng-mono text-ng-dust" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <StorefrontFooter />
      </main>

      {/* Sticky buy-bar — appears after the main CTA scrolls away. On a phone it is the buy button. */}
      <div className={`ng-buybar${showStickyBar ? ' is-visible' : ''}`} aria-hidden={!showStickyBar}>
        <div className="ng-buybar__inner">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden h-14 w-11 shrink-0 sm:block">
              <ProductVisual product={product} className="h-full w-full" imageFit="cover" label={false} soldOut={false} sizes="44px" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-ng-display text-xl leading-none">{named.name}</span>
              {/* The dollar, for the same reason the headline shows it — see the note at the top of
                  InternationalPrice.jsx. The rupiah of an export price is Dekito's book figure, not the
                  amount the buyer is asked to send. */}
              <span className="text-sm text-ng-dust">{quotedInternationalPrice(exportPrice, selectedPriceLabel)}</span>
            </div>
          </div>
          {/* The sticky bar is a second add-to-cart, in both shops. From 18 Sep to 6 Oct 2026 it carried
              a WhatsApp order in the English shop instead; the order lives in the English cart now. */}
          <button
            type="button"
            className="ng-btn shrink-0"
            onClick={() => handleAddToCart()}
            tabIndex={showStickyBar ? 0 : -1}
            disabled={soldOut}
          >
            {soldOut ? (
              <>{t('pdp.soldOut')}</>
            ) : lastAddedSlug === product.slug ? (
              <><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t('pdp.inCart')}</>
            ) : (
              <><ShoppingBag className="h-4 w-4" aria-hidden="true" /> {t('pdp.addToCart')}</>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default PublicProductDetailPage;
