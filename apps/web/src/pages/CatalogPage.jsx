import CardPrice from '@/components/storefront/CardPrice.jsx';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { useCart } from '@/hooks/useCart.js';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import StaleCatalogNotice from '@/components/storefront/StaleCatalogNotice.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import { CATALOG_PAGE_SIZE } from '@/utils/catalogPageSize.js';
import { cardLabels, catalogCategoryPills, matchesCatalogCategory } from '@/utils/productBadge.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import SkipToResults from '@/components/storefront/SkipToResults.jsx';
import { catalogPillCounts, pillIsOffered } from '@/utils/catalogFacets.js';
import { shortNoteList } from '@/utils/shortNoteList.js';
import { getPrimaryVariant, isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { buildBreadcrumbJsonLd, getSiteOrigin, shopCanonicalUrl } from '@/utils/seo.js';
import { matchesWear } from '@/utils/productWear.js';
import WearFilter from '@/components/storefront/WearFilter.jsx';
import { splitScriptName } from '@/utils/scriptName.js';

// Three notes is what fits on a card at phone width without wrapping to a third line.
const CARD_NOTE_LIMIT = 3;

const CatalogPage = () => {
  const fetchedProducts = useStorefrontProducts();
  const { t, region } = useTranslate();
  // No fallback to the bundled seed data. featuredProducts is six invented perfumes — Santal Morn,
  // Petal Smoke and so on — that this shop has never sold. When the catalogue query came back empty, a
  // customer was shown all six with prices, and clicking one landed on "Halaman tidak ditemukan". An
  // honest empty state is better than a shop that appears to stock things it does not.
  const allProducts = fetchedProducts;
  const [searchParams] = useSearchParams();
  const initialFamily = searchParams.get('family') || '';
  // Start at 'All'; the effect below promotes it to the URL family only when that
  // family is a real catalog category, so an unknown ?family= never yields an empty list.
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [wearSelection, setWearSelection] = useState({ occasions: '', times: '', weather: '' });
  const [visibleCount, setVisibleCount] = useState(CATALOG_PAGE_SIZE);
  const revealRef = useScrollReveal();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [addedSlug, setAddedSlug] = useState('');
  const isLoading = Boolean(fetchedProducts.loading) && !fetchedProducts.length;

  const handleQuickAdd = useCallback((event, product) => {
    // The card is a <Link>; keep the click from navigating to the PDP.
    event.preventDefault();
    event.stopPropagation();
    if (product.publicStatus !== 'Available') {
      toast.error(t('catalog.outOfStockToast', { name: product.name }));
      return;
    }
    // THE VARIANT, which this call used to leave out. Export prices are keyed by (product, variant), so
    // a line with variantId '' matched nothing and the English cart printed "quoted on request" under a
    // card that had just advertised US$95 — a price offered on the shelf and withdrawn at the till.
    // Measured on production 2026-10-23: added from here, L'iris and Maskumambang both lost their
    // price; the same two bottles added from the product page kept it. The other three addItem callers
    // already build the line this way; this one is brought into line with them rather than given its
    // own rule.
    const variant = getPrimaryVariant(Array.isArray(product?.variants) ? product.variants : []);
    const variantKey = variant?.id || variant?.size || '';
    addItem({
      ...product,
      cartSlug: variantKey ? `${product.slug}-${variantKey}` : product.slug,
      variantId: variant?.id || '',
    }, 1);
    setAddedSlug(product.slug);
    toast.success(t('pdp.addedToast', { name: product.name }), {
      description: t('pdp.cartUpdated'),
      action: { label: t('pdp.viewCart'), onClick: () => navigate('/cart') },
      // Top, not the default bottom: on a phone the gift prompt this add opens is a bottom sheet, and a
      // toast at the bottom lands on its buttons. See oneAnnouncement.selfcheck.
      position: 'top-center',
    });
    window.setTimeout(() => {
      setAddedSlug((current) => (current === product.slug ? '' : current));
    }, 1800);
  }, [addItem, navigate, t]);

  const products = useMemo(() => {
    const visible = allProducts.filter(isProductVisibleInStorefront);
    return getPublicFragranceCatalog(visible);
  }, [allProducts]);

  const catalogCategories = useMemo(() => catalogCategoryPills(products), [products]);

  // Everything EXCEPT the category, kept separate so the pills can count what they would show. A pill
  // counted against the whole catalogue would read "FLORAL 8" to someone who has typed "vanilla" and
  // would see two — a number worse than no number.
  const matchesSearchAndWear = useCallback((product) => {
    const query = searchTerm.trim().toLowerCase();
    // matchesWear ignores facets the customer left unset, and refuses products with no tags
    // at all once a facet is set. An untagged bottle stays out rather than being guessed at.
    if (!matchesWear(product.wear, wearSelection)) return false;
    if (!query) return true;
    const searchable = [
      product.name, product.subtitle, product.description,
      product.notes, product.mood, product.category,
      ...(product.topNotes || []), ...(product.heartNotes || []), ...(product.baseNotes || []),
    ].join(' ').toLowerCase();
    return searchable.includes(query);
  }, [searchTerm, wearSelection]);

  const narrowedProducts = useMemo(() => products.filter(matchesSearchAndWear), [products, matchesSearchAndWear]);
  const pillCounts = useMemo(
    () => catalogPillCounts(narrowedProducts, catalogCategories, matchesCatalogCategory),
    [narrowedProducts, catalogCategories],
  );
  const filteredProducts = useMemo(
    () => narrowedProducts.filter((product) => matchesCatalogCategory(product, activeCategory)),
    [narrowedProducts, activeCategory],
  );

  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);

  useEffect(() => { setVisibleCount(CATALOG_PAGE_SIZE); }, [activeCategory, searchTerm, wearSelection]);

  // Sync family param from homepage mood cards
  useEffect(() => {
    if (initialFamily) {
      const capitalized = initialFamily.charAt(0).toUpperCase() + initialFamily.slice(1);
      if (catalogCategories.includes(capitalized)) {
        setActiveCategory(capitalized);
      }
    }
  }, [initialFamily, catalogCategories]);

  const siteOrigin = getSiteOrigin();
  const catalogCanonical = shopCanonicalUrl('/catalog', region, siteOrigin);
  const catalogBreadcrumb = buildBreadcrumbJsonLd([
    { name: t('pdp.home'), path: '/home' },
    { name: t('pdp.collection'), path: '/catalog' },
  ], siteOrigin);

  return (
    <>
      <Helmet>
        <title>{t('catalog.tab')}</title>
        <meta name="description" content={t('catalog.meta')} />
        <link rel="canonical" href={catalogCanonical} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SOLIVAGANT" />
        <meta property="og:url" content={catalogCanonical} />
        <meta property="og:title" content={t('catalog.tab')} />
        <meta property="og:description" content={t('catalog.meta')} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(catalogBreadcrumb)}</script>
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <StaleCatalogNotice stale={fetchedProducts.stale} className="mx-auto mt-4 w-[min(1180px,92vw)]" />
        <ScrollProgress />
        <PublicHeader />

        <header className="ng-section !pb-14 !pt-16 md:!pt-24">
          <div className="ng-container flex flex-wrap items-end justify-between gap-8">
            <div className="flex flex-col gap-5">
              <p className="ng-eyebrow ng-mono m-0">{t('catalog.ngEyebrow', { count: products.length })}</p>
              <h1 className="ng-display ng-h1">{t('catalog.title')}</h1>
            </div>
            <p className="ng-lead max-w-[440px] !text-base">{t('catalog.ngLead')}</p>
          </div>
        </header>

        <section className="ng-section ng-section--deep !py-8" aria-label={t('catalog.ngFilters')}>
          <div className="ng-container flex flex-col gap-6">
            <SkipToResults />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2.5" role="list" aria-label={t('catalog.filterBy', { facet: t('catalog.category') })}>
                {catalogCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={category === activeCategory}
                    className="ng-chip ng-filter"
                    disabled={!pillIsOffered(category, pillCounts[category])}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category === 'All' ? t('catalog.all') : category}
                    <span className="ng-chip__count">{pillCounts[category] ?? 0}</span>
                  </button>
                ))}
              </div>
              <input
                type="search"
                className="ng-field md:!w-[320px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('catalog.searchPlaceholder')}
                aria-label={t('catalog.searchLabel')}
              />
            </div>
            <WearFilter products={products} selection={wearSelection} onChange={setWearSelection} />
          </div>
        </section>

        <section className="ng-section !pt-12" aria-label={t('catalog.ngResults')}>
          <div className="ng-container">
            {isLoading ? (
              <div className="flex flex-col" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="ng-cat-row">
                    <span />
                    <span className="editorial-skel block h-[90px] w-[72px]" />
                    <span className="editorial-skel block h-8 w-2/3" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length ? (
              <div className="flex flex-col" id="catalog-results" tabIndex={-1}>
                <div className="ng-cat-row ng-cat-row--head ng-mono" aria-hidden="true">
                  <span />
                  <span />
                  <span>{t('home.ngColWork')}</span>
                  <span className="ng-cat-row__notes">{t('home.ngColNotes')}</span>
                  <span>{t('home.ngColPrice')}</span>
                  <span />
                </div>
                {visibleProducts.map((product, index) => {
                  const named = splitScriptName(product.name);
                  const available = product.publicStatus === 'Available';
                  return (
                    <div key={product.slug || product.id} className="ng-cat-row">
                      <span className="ng-cat-row__no ng-mono text-ng-ember">{String(index + 1).padStart(2, '0')}</span>
                      {/* The photo and the name are the two links; the add button sits beside them, not
                          inside an <a> — a button nested in a link is two controls a keyboard cannot
                          tell apart, which is how the old card was built. */}
                      <Link to={`/catalog/${product.slug}`} className="ng-cat-row__thumb" tabIndex={-1} aria-hidden="true">
                        <ProductVisual
                          product={product}
                          className="h-full w-full"
                          imageFit="cover"
                          priority={index < 4}
                          label={false}
                          sizes="72px"
                        />
                      </Link>
                      <Link to={`/catalog/${product.slug}`} className="ng-cat-row__name">
                        <span className="font-ng-display text-[28px] leading-none [overflow-wrap:anywhere] md:text-[34px]">{named.name}</span>
                        <span className="ng-cat-row__label ng-mono text-ng-ash">{cardLabels(product).join(' · ') || 'Atelier'}</span>
                      </Link>
                      {/* What it smells of, in three words. The field holds the full material list since
                          2026-10-07 — far too long for a row — so this reuses the clamp the cart lines
                          already use rather than inventing a second idea of how much is too much. */}
                      <span className="ng-cat-row__notes text-[15px] leading-normal text-ng-dust">
                        {shortNoteList(product.notes, CARD_NOTE_LIMIT)}
                      </span>
                      <span className="ng-cat-row__price flex flex-col gap-1 text-base">
                        <CardPrice product={product} memberClassName="ng-mono text-ng-dust" />
                      </span>
                      <span className="ng-cat-row__act">
                        {/* Quick-add in both shops since 2026-10-06. It once added the bottle at the
                            DOMESTIC price into a cart the English shop could not open. The English cart
                            now prices every line at its export price on read, so what the row adds is a
                            line, not a price. */}
                        <button
                          type="button"
                          className="ng-btn ng-btn--ghost !min-h-[44px] !px-4"
                          onClick={(event) => handleQuickAdd(event, product)}
                          aria-label={!available ? t('catalog.soldOutAria', { name: product.name }) : t('catalog.addAria', { name: product.name })}
                          disabled={!available}
                        >
                          {!available ? (
                            <>{t('catalog.soldOutShort')}</>
                          ) : addedSlug === product.slug ? (
                            <><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t('catalog.added')}</>
                          ) : (
                            <><Plus className="h-4 w-4" aria-hidden="true" /> {t('catalog.quickAdd')}</>
                          )}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-5 py-14">
                {/* Two different situations, two different messages: nothing matched the filter, or the
                    catalogue itself did not load. Offering "Reset Katalog" for an outage sends the customer
                    round a loop that cannot help them. */}
                <p className="ng-mono m-0 text-ng-ash">{products.length ? t('catalog.noMatchEyebrow') : t('catalog.notLoadedEyebrow')}</p>
                <h2 className="ng-display text-[36px] font-normal md:text-[44px]">
                  {products.length
                    ? t('catalog.noMatch')
                    : t('catalog.notLoaded')}
                </h2>
                {products.length ? (
                  <button type="button" className="ng-btn" onClick={() => { setActiveCategory('All'); setSearchTerm(''); setWearSelection({ occasions: '', times: '', weather: '' }); }}>
                    {t('catalog.resetCatalog')}
                  </button>
                ) : (
                  <button type="button" className="ng-btn" onClick={() => window.location.reload()}>
                    {t('catalog.reload')}
                  </button>
                )}
              </div>
            )}

            {visibleProducts.length < filteredProducts.length ? (
              <div className="mt-12 flex flex-wrap items-center gap-6">
                <button type="button" className="ng-btn ng-btn--ghost" onClick={() => setVisibleCount((c) => c + CATALOG_PAGE_SIZE)}>
                  {t('catalog.showMore')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="ng-mono text-ng-ash">{t('catalog.shownOf', { shown: visibleProducts.length, total: filteredProducts.length })}</span>
              </div>
            ) : null}
          </div>
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default CatalogPage;
