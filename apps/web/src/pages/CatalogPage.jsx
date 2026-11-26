import CardPrice from '@/components/storefront/CardPrice.jsx';
import CardRating from '@/components/storefront/CardRating.jsx';
import { useReviewStats } from '@/hooks/useReviews.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isDiscoverySet } from '@/utils/discoverySet.js';
import { hasBottlePhoto } from '@/utils/curatedProducts.js';
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
import { shopPrefixForRegion } from '@/utils/storefrontRegion.js';
import { buildBreadcrumbJsonLd, getSiteOrigin, shopCanonicalUrl } from '@/utils/seo.js';
import { matchesWear } from '@/utils/productWear.js';
import WearFilter from '@/components/storefront/WearFilter.jsx';
import { splitScriptName, plainName } from '@/utils/scriptName.js';
import { productCopyFor } from '@/utils/productCopy.js';
import { matchesCatalogSearch } from '@/utils/catalogSearch.js';

// Three notes is what fits on a card at phone width without wrapping to a third line.
const CARD_NOTE_LIMIT = 3;

const CatalogPage = () => {
  const fetchedProducts = useStorefrontProducts();
  const { t, region } = useTranslate();
  // Published-review stars per perfume; a card shows them from three reviews up (CardRating).
  const reviewStats = useReviewStats();
  // No fallback to the bundled seed data. featuredProducts is six invented perfumes — Santal Morn,
  // Petal Smoke and so on — that this shop has never sold. When the catalogue query came back empty, a
  // customer was shown all six with prices, and clicking one landed on "Halaman tidak ditemukan". An
  // honest empty state is better than a shop that appears to stock things it does not.
  const allProducts = fetchedProducts;
  // THE ADDRESS HOLDS THE FILTERS (fourth visitor audit, 13 Nov 2026). Woody + "gaharu", open a perfume,
  // Back — and the catalogue was "Semua 19" with an empty search box, because the choices lived only in
  // this page's state and the page was mounted afresh. Now the family is read from ?family=, and the
  // search and the wear filters are written to ?q= / ?occasion= / ?time= / ?weather= as they change
  // (replace, so typing adds no history entries). Back restores them; the address can also be shared.
  const [searchParams, setSearchParams] = useSearchParams();
  const familyParam = searchParams.get('family') || '';
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [wearSelection, setWearSelection] = useState(() => ({
    occasions: searchParams.get('occasion') || '',
    times: searchParams.get('time') || '',
    weather: searchParams.get('weather') || '',
  }));
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
      toast.error(t('catalog.outOfStockToast', { name: plainName(product.name) }));
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
    const added = addItem({
      ...product,
      cartSlug: variantKey ? `${product.slug}-${variantKey}` : product.slug,
      variantId: variant?.id || '',
    }, 1);
    if (added === 0) {
      toast.info(t('cart.stockAllIn', { name: plainName(product.name) }), { position: 'top-center' });
      return;
    }
    setAddedSlug(product.slug);
    toast.success(t('pdp.addedToast', { name: plainName(product.name) }), {
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
  // A family the catalogue really has, else 'All' — an unknown ?family= never yields an empty list.
  // Matched without regard to case (19 Nov 2026): the address carries the family in lower case, and
  // capitalising its first letter could not find a two-word family — "Discovery Set" did nothing when tapped.
  const activeCategory = useMemo(() => {
    const wanted = String(familyParam || '').trim().toLowerCase();
    return (wanted && catalogCategories.find((category) => String(category).toLowerCase() === wanted)) || 'All';
  }, [familyParam, catalogCategories]);
  const setActiveCategory = useCallback((category) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (category === 'All') next.delete('family');
      else next.set('family', category.toLowerCase());
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  // The search and the wear filters, written back to the address as they change — and ONLY when they
  // change it. Writing an unchanged address is still a navigation, and that REPLACE cancelled the scroll
  // restore on Back: the buyer landed ~600px above the perfume they had opened (fifth visitor audit).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const write = (key, value) => (value ? next.set(key, value) : next.delete(key));
    write('q', searchTerm.trim());
    write('occasion', wearSelection.occasions);
    write('time', wearSelection.times);
    write('weather', wearSelection.weather);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [searchTerm, wearSelection, searchParams, setSearchParams]);

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
      // And the English words, so "vanilla" finds what "vanila" names.
      product.descriptionEn, product.notesEn, ...(product.topNotesEn || []), ...(product.heartNotesEn || []), ...(product.baseNotesEn || []),
    ].join(' ').toLowerCase();
    // "segar" finds FRESH, "fresh" finds "segar" (utils/catalogSearch.js).
    return matchesCatalogSearch(searchable, query);
  }, [searchTerm, wearSelection]);

  const narrowedProducts = useMemo(() => products.filter(matchesSearchAndWear), [products, matchesSearchAndWear]);
  const pillCounts = useMemo(
    () => catalogPillCounts(narrowedProducts, catalogCategories, matchesCatalogCategory),
    [narrowedProducts, catalogCategories],
  );
  // What can be bought comes first, in the shop's own order; what has sold out follows, in the same order
  // (eleventh visitor audit, 15 Nov 2026: the catalogue opened on two SOLD OUT cards, because new rows
  // arrive first). A stable sort, so nothing else moves.
  const filteredProducts = useMemo(
    () => narrowedProducts
      .filter((product) => matchesCatalogCategory(product, activeCategory))
      .map((product, index) => ({ product, index, soldOut: product.publicStatus !== 'Available', set: isDiscoverySet(product), card: !hasBottlePhoto(product) }))
      // In stock first; then perfumes before discovery sets (19 Nov 2026: the sets are the newest rows, and
      // five near-identical boxes would otherwise open the collection); then bottles with a photograph before
      // the ones still on a label card (26 Nov 2026 — the grid is photos now, and a page that opened on white
      // cards looked unfinished); then the catalogue's own order.
      .sort((a, b) => (Number(a.soldOut) - Number(b.soldOut)) || (Number(a.set) - Number(b.set))
        || (Number(a.card) - Number(b.card)) || (a.index - b.index))
      .map(({ product }) => product),
    [narrowedProducts, activeCategory],
  );
  const perfumeCount = products.filter((product) => !isDiscoverySet(product)).length;
  const shownPerfumeCount = filteredProducts.filter((product) => !isDiscoverySet(product)).length;
  const shownSetsOnly = filteredProducts.length > 0 && shownPerfumeCount === 0;

  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);

  useEffect(() => { setVisibleCount(CATALOG_PAGE_SIZE); }, [activeCategory, searchTerm, wearSelection]);


  const siteOrigin = getSiteOrigin();
  const catalogCanonical = shopCanonicalUrl('/catalog', region, siteOrigin);
  const catalogBreadcrumb = buildBreadcrumbJsonLd([
    { name: t('pdp.home'), path: '/home' },
    { name: t('pdp.collection'), path: '/catalog' },
  ], siteOrigin, shopPrefixForRegion(region));

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

      <div className="solivagant-editorial-home" ref={revealRef}>
        {/* First, before the header: the redesign had put it after the header's links, so a keyboard reached
            it only after the stops it exists to skip (2026-11-02). */}
        <SkipToResults />
        <StaleCatalogNotice stale={fetchedProducts.stale && products.length > 0} className="mx-auto mt-4 w-[min(1180px,92vw)]" />
        <ScrollProgress />
        <PublicHeader />
        {/* Only the page content is the main landmark; header and footer sit beside it (fresh buyer audit, 15 Nov 2026). */}
        <main id="main-content">

          {/* On a phone the title, the filters and the list share one screen: tighter here so the first perfume
              is on it (it sat at y=880 of 844). Desktop keeps the canvas spacing. */}
          <header className="ng-section !pb-8 !pt-8 md:!pb-14 md:!pt-24">
            <div className="ng-container flex flex-wrap items-end justify-between gap-4 md:gap-8">
              <div className="flex flex-col gap-5">
                <p className="ng-eyebrow ng-mono m-0">{/* "19 KARYA" over a single search result read as a count of what is shown (fifth visitor
                    audit, 13 Nov 2026): a narrowed list says how many of how many. */}
                  {/* Perfumes are counted as perfumes (audit, 19 Nov 2026: "27 parfum" counted the five discovery
                      sets); a list narrowed to sets alone says so. */}
                  {!products.length ? t('catalog.ngEyebrowBare')
                    : shownSetsOnly ? t('catalog.ngEyebrowSets', { count: filteredProducts.length })
                      : filteredProducts.length !== products.length ? t('catalog.ngEyebrowFiltered', { shown: shownPerfumeCount, count: perfumeCount })
                        : t('catalog.ngEyebrow', { count: perfumeCount })}</p>
                <h1 className="ng-display ng-h1">{t('catalog.title')}</h1>
              </div>
              <p className="ng-lead max-w-[440px] !text-base">{t('catalog.ngLead')}</p>
            </div>
          </header>

          <section className="ng-section ng-section--deep !py-5 md:!py-8" aria-label={t('catalog.ngFilters')}>
            <div className="ng-container flex flex-col gap-4 md:gap-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* One row that scrolls sideways on a phone, edge to edge, instead of three stacked rows. */}
                <div className="-mx-[var(--ng-gutter)] flex w-[calc(100%+2*var(--ng-gutter))] shrink-0 gap-2.5 overflow-x-auto [&>*]:shrink-0 [&>*]:whitespace-nowrap px-[var(--ng-gutter)] md:mx-0 md:w-auto md:shrink md:flex-wrap md:overflow-visible md:px-0" role="list" aria-label={t('catalog.filterBy', { facet: t('catalog.category') })}>
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
                      {products.length ? <span className="ng-chip__count">{pillCounts[category] ?? 0}</span> : null}
                    </button>
                  ))}
                  {/* Until the catalogue arrives the families are unknown; placeholders hold their room so the
                      search field and the list do not jump when the real chips land. */}
                  {isLoading ? Array.from({ length: 5 }, (_, i) => <span key={i} aria-hidden="true" className="editorial-skel block h-11 w-28" />) : null}
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
              {isLoading ? <span aria-hidden="true" className="editorial-skel block h-11 w-full max-w-[460px]" /> : <WearFilter products={products} selection={wearSelection} onChange={setWearSelection} />}
            </div>
          </section>

          <section className="ng-section !pt-6 md:!pt-12" aria-label={t('catalog.ngResults')}>
            <div className="ng-container">
              {isLoading ? (
                <div className="ng-cat-grid" aria-hidden="true">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-3">
                      <span className="editorial-skel block aspect-[4/5] w-full" />
                      <span className="editorial-skel block h-7 w-2/3" />
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length ? (
                // A grid of photographs (Dekito, 26 Nov 2026: "foto produknya belum banyak … orang buat nyari seluruh
                // fragrance itu agak sulit"). It was a table with a 72 px thumbnail; a buyer choosing a bottle
                // wants to see the bottle. 2 columns on a phone, 3 on a tablet, 4 on a laptop.
                <ul className="ng-cat-grid m-0 list-none p-0" id="catalog-results" tabIndex={-1}>
                  {visibleProducts.map((product, index) => {
                    const named = splitScriptName(product.name);
                    const available = product.publicStatus === 'Available';
                    return (
                      <li key={product.slug || product.id} className="ng-cat-card">
                        {/* The photo and the name are the two links; the add button sits below them, not
                            inside an <a> — a button nested in a link is two controls a keyboard cannot
                            tell apart, which is how the old card was built. */}
                        <Link to={`/catalog/${product.slug}`} className="block" tabIndex={-1} aria-hidden="true">
                          <ProductVisual
                            product={product}
                            className="aspect-[4/5] w-full"
                            imageFit="cover"
                            priority={index < 4}
                            label={false}
                            sizes="(max-width: 767px) 50vw, (max-width: 1099px) 33vw, 300px"
                          />
                        </Link>
                        <Link to={`/catalog/${product.slug}`} className="ng-cat-card__name">
                          <span className="ng-cat-card__label ng-mono text-ng-ash">{cardLabels(product).join(' · ') || t('catalog.cardFallbackLabel')}</span>
                          {/* A heading per perfume, so a screen reader can move through the list by name (fifth
                              visitor audit, 13 Nov 2026: 19 perfumes under one h1 and nothing else). */}
                          <h2 className="m-0 font-ng-display text-[24px] font-normal leading-none [overflow-wrap:anywhere] md:text-[28px]">{named.name}</h2>
                          <CardRating stats={reviewStats[product.slug]} className="self-start" />
                        </Link>
                        {/* What it smells of, in three words — the clamp the cart lines already use. */}
                        <span className="text-[14px] leading-normal text-ng-dust">
                          {shortNoteList(productCopyFor(product, region).notes, CARD_NOTE_LIMIT)}
                        </span>
                        <span className="flex flex-col gap-1 text-[15px]">
                          <CardPrice product={product} />
                        </span>
                        <span className="mt-auto pt-1">
                          {/* Quick-add in both shops since 2026-10-06. It once added the bottle at the
                              DOMESTIC price into a cart the English shop could not open. The English cart
                              now prices every line at its export price on read, so what the card adds is a
                              line, not a price. */}
                          <button
                            type="button"
                            className="ng-btn ng-btn--ghost !min-h-[44px] w-full !px-3"
                            onClick={(event) => handleQuickAdd(event, product)}
                            aria-label={!available ? t('catalog.soldOutAria', { name: plainName(product.name) }) : t('catalog.addAria', { name: plainName(product.name) })}
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
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col items-start gap-5 py-14">
                  {/* Two different situations, two different messages: nothing matched the filter, or the
                      catalogue itself did not load. Offering "Reset Katalog" for an outage sends the customer
                      round a loop that cannot help them. */}
                  <p className="ng-mono m-0 text-ng-ash">{products.length ? t('catalog.noMatchEyebrow') : t('catalog.notLoadedEyebrow')}</p>
                  <h2 className="ng-display text-[36px] font-normal md:text-[44px]">
                    {/* A typed search is not a filter (fresh buyer audit, 15 Nov 2026): say the words back. */}
                    {products.length
                      ? (searchTerm.trim() ? t('catalog.noMatchSearch', { term: searchTerm.trim() }) : t('catalog.noMatch'))
                      : t('catalog.notLoaded')}
                  </h2>
                  {products.length ? (
                    <button type="button" className="ng-btn" onClick={() => { setActiveCategory('All'); setSearchTerm(''); setWearSelection({ occasions: '', times: '', weather: '' }); }}>
                      {searchTerm.trim() ? t('catalog.clearSearch') : t('catalog.resetCatalog')}
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

        </main>
        <StorefrontFooter />
      </div>
    </>
  );
};

export default CatalogPage;
