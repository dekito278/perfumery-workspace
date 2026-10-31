import CardPrice from '@/components/storefront/CardPrice.jsx';
import StaleCatalogNotice from '@/components/storefront/StaleCatalogNotice.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import WhyBuyDirect from '@/components/storefront/WhyBuyDirect.jsx';
import { buildWhatsAppCheckoutUrl } from '@/services/cartService.js';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { shortNoteList } from '@/utils/shortNoteList.js';
import { CURATED_LIMIT_DESKTOP, pickCuratedProducts } from '@/utils/curatedProducts.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { useSiteImages } from '@/hooks/useSiteImages.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { getPublishedJournalPosts, getJournalCategoryLabel, getJournalPublicPath } from '@/services/journalPostsSupabaseService.js';
import { DEFAULT_SHARE_IMAGE, buildOrganizationJsonLd, buildWebSiteJsonLd, getSiteOrigin, shopCanonicalUrl, toAbsoluteUrl } from '@/utils/seo.js';
import { getOptimizedStorageImageUrl as img, getStorageImageSrcSet as srcSet } from '@/utils/storageImage.js';
import { articleExcerpt } from '@/utils/articleExcerpt.js';
import { splitScriptName } from '@/utils/scriptName.js';

// A phone is ~390 CSS px, so sizes="100vw" on a 3x screen asks for ~1170 and the full list answers 1600.
// The phone home this page replaced (2026-10-31) capped its hero at 900 and its second full-bleed image
// at 750; those stay the ceilings, so one responsive home is never heavier on a phone than the old one.
const PHONE_HERO_WIDTHS = [480, 720, 900];
const PHONE_COLLAB_WIDTHS = [480, 600, 750];

// `family` is the perfumery family and stays as it is in both languages — Fresh, Gourmand, Woody, Floral
// are the same words on an Indonesian shelf. `filter` is the real catalog category used in the link (the
// catalog has no "Fresh" category — those scents live under "Aquatic"). Only the mood name and the
// description are copy.
const moodCategories = [
  { nameKey: 'mood.fresh.name', family: 'Fresh', filter: 'fresh', shortKey: 'mood.fresh.short', siteImageKey: 'mood-fresh' },
  { nameKey: 'mood.gourmand.name', family: 'Gourmand', filter: 'gourmand', shortKey: 'mood.gourmand.short', siteImageKey: 'mood-gourmand' },
  { nameKey: 'mood.woody.name', family: 'Woody', filter: 'woody', shortKey: 'mood.woody.short', siteImageKey: 'mood-woody' },
  { nameKey: 'mood.floral.name', family: 'Floral', filter: 'floral', shortKey: 'mood.floral.short', siteImageKey: 'mood-floral' },
];

const getArticleExcerpt = (article) => articleExcerpt(article, 160);

// Three, like the catalogue row. A fourth turns a scent into a spec sheet.
const HOME_CARD_NOTE_LIMIT = 3;

// The first paragraph of the description, for the featured bottle. The whole story belongs on the
// product page; the home page only has to make someone want to open it.
const firstParagraph = (text) => String(text || '').split(/\n\s*\n/)[0].trim();

const familyLine = (product) => [product.category, product.limited && product.category !== 'Limited' ? 'Limited' : null]
  .filter(Boolean)
  .join(' · ');

const HomePage = () => {
  const fetchedProducts = useStorefrontProducts();
  const { t, region } = useTranslate();
  // Same reason as CatalogPage: the bundled seed is six perfumes this shop does not sell, and showing
  // them during an outage put phantom stock on the front page.
  const catalogProducts = fetchedProducts;
  const { images: siteImages, loading: siteImagesLoading } = useSiteImages();
  const [publishedArticles, setPublishedArticles] = useState([]);
  const revealRef = useScrollReveal();

  const visibleProducts = useMemo(
    () => catalogProducts.filter(isProductVisibleInStorefront),
    [catalogProducts]
  );
  const publicCatalog = useMemo(() => getPublicFragranceCatalog(visibleProducts), [visibleProducts]);
  const collectionProducts = useMemo(() => pickCuratedProducts(publicCatalog, CURATED_LIMIT_DESKTOP), [publicCatalog]);
  const { currentUser } = useAuth();
  const featured = collectionProducts[0] || null;
  const featuredName = featured ? splitScriptName(featured.name) : null;

  // Journal articles
  useEffect(() => {
    let active = true;
    getPublishedJournalPosts()
      .then((posts) => { if (active) setPublishedArticles(posts.slice(0, 3)); })
      .catch(() => { if (active) setPublishedArticles([]); });
    return () => { active = false; };
  }, []);

  const siteOrigin = getSiteOrigin();
  const homeCanonical = shopCanonicalUrl('/home', region, siteOrigin);
  const homeShareImage = toAbsoluteUrl(DEFAULT_SHARE_IMAGE, siteOrigin);

  return (
    <>
      <Helmet>
        <title>{t('home.tab')}</title>
        <meta name="description" content={t('home.meta')} />
        <link rel="canonical" href={homeCanonical} />
        <meta property="og:title" content={t('home.tab')} />
        <meta property="og:description" content={t('home.meta')} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SOLIVAGANT" />
        <meta property="og:url" content={homeCanonical} />
        <meta property="og:image" content={homeShareImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={t('home.tab')} />
        <meta name="twitter:description" content={t('home.meta')} />
        <meta name="twitter:image" content={homeShareImage} />
        <script type="application/ld+json">{JSON.stringify(buildOrganizationJsonLd(siteOrigin))}</script>
        <script type="application/ld+json">{JSON.stringify(buildWebSiteJsonLd(siteOrigin))}</script>
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <StaleCatalogNotice stale={fetchedProducts.stale} className="mx-auto mt-4 w-[min(1180px,92vw)]" />
        <ScrollProgress />
        <PublicHeader />

        {/* ── Hero ── */}
        <header className="ng-hero">
          {/* No photograph until the upload list settles: the bundled fallback is a different
              picture, so seeding with it flashed the old hero on every first paint. */}
          {siteImagesLoading ? null : (
            <picture>
              <source media="(max-width: 767px)" srcSet={srcSet(siteImages['home-hero'], PHONE_HERO_WIDTHS)} sizes="100vw" />
              <img src={img(siteImages['home-hero'], 1600) || '/brand/home/raw-material-library.jpg'} srcSet={srcSet(siteImages['home-hero'])} sizes="100vw" alt="" className="ng-hero__image" />
            </picture>
          )}
          <div className="ng-hero__shade" aria-hidden="true" />
          <div className="ng-ring" aria-hidden="true">
            <svg viewBox="0 0 320 320" className="ng-ring__svg">
              <defs><path id="ng-ring-path" d="M160,160 m-132,0 a132,132 0 1,1 264,0 a132,132 0 1,1 -264,0" /></defs>
              <circle cx="160" cy="160" r="108" fill="none" stroke="rgba(237,230,214,0.18)" strokeWidth="1" />
              <circle cx="160" cy="160" r="4" fill="#D4573A" />
              <text className="ng-ring__text"><textPath href="#ng-ring-path">{t('home.ngRing')}{t('home.ngRing')}</textPath></text>
            </svg>
          </div>

          <div className="ng-hero__body">
            <p className="ng-eyebrow ng-mono">{t('home.eyebrow')}</p>
            <h1 className="ng-display ng-hero__title">
              {t('home.ngTitle').split('\n').map((line, index) => (
                index ? <em key={line}><br />{line}</em> : <React.Fragment key={line}>{line}</React.Fragment>
              ))}
            </h1>
            <p className="ng-lead">{t('home.ngLead')}</p>
            {/* The one line that says why to buy here rather than on a marketplace. */}
            <p className="ng-hero__note">{t('home.note')}</p>
            <div className="flex flex-wrap items-center gap-3.5">
              <Link to="/catalog" className="ng-btn">
                {t('home.seeCollection')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/customer" className="ng-btn ng-btn--ghost">
                {t(currentUser ? 'nav.account' : 'nav.accountSub')}
              </Link>
            </div>
          </div>
          <p className="ng-hero__scroll ng-mono" aria-hidden="true">
            <span>{t('home.ngScroll')}</span>
            <svg width="14" height="24" viewBox="0 0 14 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M7 1v21M1 16l6 6 6-6" /></svg>
          </p>
        </header>

        {/* ── The first bottle of the curated set, set large ── */}
        {featured ? (
          <section className="ng-section" aria-labelledby="home-featured-title" data-reveal>
            <div className="ng-container grid items-center gap-10 md:grid-cols-2 md:gap-[72px]">
              <Link to={`/catalog/${featured.slug}`} className="relative block" tabIndex={-1} aria-hidden="true">
                <ProductVisual product={featured} label={false} imageFit="cover" priority className="aspect-[4/5] w-full" sizes="(max-width: 767px) 100vw, 640px" />
                {featuredName.script ? (
                  <span className="ng-script-mark absolute left-6 top-5 text-[96px] md:text-[120px]">{featuredName.script}</span>
                ) : null}
              </Link>
              <div className="flex flex-col gap-7">
                <p className="ng-mono m-0 text-ng-ember">{t('home.ngFeatNo', { family: familyLine(featured) })}</p>
                <div>
                  <h2 id="home-featured-title" className="ng-display text-[56px] font-normal md:text-[84px]">{featuredName.name}</h2>
                  {featuredName.script ? <p className="m-0 mt-2.5 font-ng-java text-[28px] text-ng-ash">{featuredName.script}</p> : null}
                </div>
                {firstParagraph(featured.description) ? (
                  <p className="m-0 max-w-[520px] font-ng-display text-[22px] italic leading-snug text-ng-sand md:text-[26px]">{firstParagraph(featured.description)}</p>
                ) : null}
                <dl className="m-0 flex flex-col border-t border-ng-bone/15">
                  {shortNoteList(featured.notes, HOME_CARD_NOTE_LIMIT) ? (
                    <div className="flex justify-between gap-6 border-b border-ng-bone/15 py-3.5 text-[15px]">
                      <dt className="ng-mono text-ng-ash">{t('home.ngFeatNotes')}</dt>
                      <dd className="m-0 text-right text-ng-sand">{shortNoteList(featured.notes, HOME_CARD_NOTE_LIMIT)}</dd>
                    </div>
                  ) : null}
                  {featured.size ? (
                    <div className="flex justify-between gap-6 border-b border-ng-bone/15 py-3.5 text-[15px]">
                      <dt className="ng-mono text-ng-ash">{t('home.ngFeatSize')}</dt>
                      <dd className="m-0 text-right text-ng-sand">{featured.size}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-6 border-b border-ng-bone/15 py-3.5 text-[15px]">
                    <dt className="ng-mono text-ng-ash">{t('home.ngFeatPrice')}</dt>
                    <dd className="m-0 flex flex-col items-end gap-1 text-right">
                      <CardPrice product={featured} memberClassName="ng-mono text-ng-dust" />
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-3.5">
                  <Link to={`/catalog/${featured.slug}`} className="ng-btn">{t('home.ngFeatCta')}</Link>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── The curated set, as a numbered list ── */}
        <section className="ng-section" aria-labelledby="home-table-title" data-reveal>
          <div className="ng-container flex flex-col gap-12">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="flex flex-col gap-3.5">
                <p className="ng-mono m-0 text-ng-ash">{t('home.ngTableEyebrow', { count: collectionProducts.length })}</p>
                <h2 id="home-table-title" className="ng-display ng-h2">{t('home.ngTableTitle')} <em>{t('home.ngTableTitleEm')}</em></h2>
              </div>
              <Link to="/catalog" className="ng-link ng-mono inline-flex min-h-[44px] items-center gap-3">
                {t('home.seeAll')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {collectionProducts.length ? (
              <div className="flex flex-col">
                <div className="ng-row ng-row--head ng-mono" aria-hidden="true">
                  <span />
                  <span>{t('home.ngColWork')}</span>
                  <span className="ng-row__notes">{t('home.ngColNotes')}</span>
                  <span className="ng-row__size">{t('home.ngColSize')}</span>
                  <span>{t('home.ngColPrice')}</span>
                  <span />
                </div>
                {collectionProducts.map((product, index) => {
                  const named = splitScriptName(product.name);
                  return (
                    <Link key={product.slug || product.id} to={`/catalog/${product.slug}`} className="ng-row">
                      <span className="ng-mono text-ng-ember">{String(index + 1).padStart(2, '0')}</span>
                      <span className="flex flex-col gap-1.5">
                        <span className="font-ng-display text-[28px] leading-none [overflow-wrap:anywhere] md:text-[36px]">{named.name}</span>
                        <span className="ng-mono text-ng-ash">{familyLine(product)}</span>
                      </span>
                      {/* What it smells of, on the first list a visitor ever sees — same helper and the
                          same three notes as the catalogue, so the two cannot drift apart. */}
                      <span className="ng-row__notes text-[15px] leading-normal text-ng-dust">{shortNoteList(product.notes, HOME_CARD_NOTE_LIMIT)}</span>
                      <span className="ng-row__size ng-mono text-ng-dust">{product.size}</span>
                      <span className="ng-row__price flex flex-col gap-1 text-[15px]">
                        {(product.price || product.priceNumber) ? (
                          <CardPrice product={product} memberClassName="ng-mono text-ng-dust" />
                        ) : null}
                      </span>
                      <ArrowRight className="ng-row__arrow h-4 w-4 opacity-60" aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="m-0 text-ng-dust">{t('home.emptyCollection')}</p>
            )}
          </div>
        </section>

        {/* ── Material notes from the journal ── */}
        {publishedArticles.length ? (
          <section className="ng-section ng-section--deep" aria-labelledby="home-spec-title" data-reveal>
            <div className="ng-container flex flex-col gap-14">
              <div className="grid items-end gap-6 md:grid-cols-2 md:gap-12">
                <div className="flex flex-col gap-3.5">
                  <p className="ng-mono m-0 text-ng-ash">{t('home.ngSpecEyebrow')}</p>
                  <h2 id="home-spec-title" className="ng-display ng-h2">{t('home.ngSpecTitle')} <em>{t('home.ngSpecTitleEm')}</em></h2>
                </div>
                <p className="ng-lead md:justify-self-end">{t('home.ngSpecLead')}</p>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {publishedArticles.map((article, index) => (
                  <Link key={article.id} to={getJournalPublicPath(article)} className="ng-specimen">
                    <span className="ng-mono flex justify-between gap-4 text-ng-ash">
                      <span className="text-ng-ember">{t('home.ngSpecLabel', { number: String(index + 1).padStart(2, '0') })}</span>
                      <span>{getJournalCategoryLabel(article.category)}</span>
                    </span>
                    <span className="font-ng-display text-[32px] leading-[1.05]">{article.title}</span>
                    <span className="text-[15px] leading-relaxed text-ng-dust">{getArticleExcerpt(article)}</span>
                    <span className="ng-mono mt-auto">{t('home.ngSpecRead')}</span>
                  </Link>
                ))}
              </div>
              <Link to="/journal" className="ng-link ng-mono inline-flex min-h-[44px] items-center gap-3 self-start">
                {t('home.readJournal')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : null}

        {/* ── Explore by mood ── */}
        <section className="ng-section" aria-labelledby="home-mood-title" data-reveal>
          <div className="ng-container flex flex-col gap-12">
            <div className="flex flex-col gap-3.5">
              <p className="ng-mono m-0 text-ng-ash">{t('home.byMood')}</p>
              <h2 id="home-mood-title" className="ng-display ng-h2">{t('home.ngMoodTitle')} <em>{t('home.ngMoodTitleEm')}</em></h2>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {moodCategories.map((mood) => (
                <Link key={mood.nameKey} to={`/catalog?family=${mood.filter}`} className="ng-mood">
                  <span className="ng-mood__swatch" data-family={mood.family.toLowerCase()}>
                    {siteImages[mood.siteImageKey] ? (
                      <img src={img(siteImages[mood.siteImageKey], 720)} srcSet={srcSet(siteImages[mood.siteImageKey])} sizes="(max-width: 767px) 50vw, 320px" alt="" loading="lazy" decoding="async" />
                    ) : null}
                  </span>
                  <span className="font-ng-display text-[24px] leading-none md:text-[28px]">{t(mood.nameKey)}</span>
                  <span className="ng-mono text-ng-ash">{t(mood.shortKey)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why buy here ── */}
        <WhyBuyDirect />

        {/* ── Bespoke and collaboration ── */}
        <section className="ng-section ng-collab" aria-labelledby="home-collab-title" data-reveal>
          {siteImagesLoading ? null : (
            <picture>
              <source media="(max-width: 767px)" srcSet={srcSet(siteImages['home-newsletter'], PHONE_COLLAB_WIDTHS)} sizes="100vw" />
              <img src={img(siteImages['home-newsletter'], 1600) || '/brand/home/raw-material-library.jpg'} srcSet={srcSet(siteImages['home-newsletter'])} sizes="100vw" loading="lazy" decoding="async" alt="" className="ng-collab__image" />
            </picture>
          )}
          <div className="ng-container relative flex flex-col items-start gap-7">
            <p className="ng-mono m-0 text-ng-ash">{t('home.collabEyebrow')}</p>
            <h2 id="home-collab-title" className="ng-display ng-h2 max-w-[980px]">{t('home.collabHeading')}</h2>
            <p className="ng-lead">{t('home.collabBody')}</p>
            <div className="flex flex-wrap gap-3.5">
              <a
                href={buildWhatsAppCheckoutUrl(t('home.collabMessage'))}
                target="_blank"
                rel="noopener noreferrer"
                className="ng-btn"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> {t('home.collabCta')}
              </a>
              <Link to="/bespoke" className="ng-btn ng-btn--ghost">{t('home.statementCta')}</Link>
            </div>
          </div>
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default HomePage;
