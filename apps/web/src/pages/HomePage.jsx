import CardPrice from '@/components/storefront/CardPrice.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import WhyBuyDirect from '@/components/storefront/WhyBuyDirect.jsx';
import { buildWhatsAppCheckoutUrl } from '@/services/cartService.js';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import TextReveal from '@/components/storefront/TextReveal.jsx';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { CURATED_LIMIT_DESKTOP, pickCuratedProducts } from '@/utils/curatedProducts.js';
import { useMicroInteractions } from '@/hooks/useParallax.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { LineDivider } from '@/components/line/LineArt.jsx';
import { useSiteImages } from '@/hooks/useSiteImages.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { getPublishedJournalPosts, getJournalCategoryLabel, getJournalPublicPath } from '@/services/journalPostsSupabaseService.js';
import {
  DEFAULT_SHARE_IMAGE,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  getSiteOrigin,
  toAbsoluteUrl,
} from '@/utils/seo.js';
import { getOptimizedStorageImageUrl as img, getStorageImageSrcSet as srcSet } from '@/utils/storageImage.js';

// `family` is the perfumery family and stays as it is in both languages — Fresh, Gourmand, Woody, Floral
// are the same words on an Indonesian shelf. `filter` is the real catalog category used in the link (the
// catalog has no "Fresh" category — those scents live under "Aquatic"). Only the mood name and the
// description are copy.
const moodCategories = [
  { nameKey: 'mood.fresh.name', family: 'Fresh', filter: 'fresh', bodyKey: 'mood.fresh.body', siteImageKey: 'mood-fresh' },
  { nameKey: 'mood.gourmand.name', family: 'Gourmand', filter: 'gourmand', bodyKey: 'mood.gourmand.body', siteImageKey: 'mood-gourmand' },
  { nameKey: 'mood.woody.name', family: 'Woody', filter: 'woody', bodyKey: 'mood.woody.body', siteImageKey: 'mood-woody' },
  { nameKey: 'mood.floral.name', family: 'Floral', filter: 'floral', bodyKey: 'mood.floral.body', siteImageKey: 'mood-floral' },
];

const getArticleExcerpt = (article) =>
  article?.excerpt || String(article?.content || '').replace(/[`*_>#-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);

const HomePage = () => {
  const fetchedProducts = useStorefrontProducts();
  const { t } = useTranslate();
  // Same reason as CatalogPage: the bundled seed is six perfumes this shop does not sell, and showing
  // them during an outage put phantom stock on the front page.
  const catalogProducts = fetchedProducts;
  const { images: siteImages, loading: siteImagesLoading } = useSiteImages();
  const [publishedArticles, setPublishedArticles] = useState([]);
  const [activeMood, setActiveMood] = useState(0);
  const revealRef = useScrollReveal();
  const { magnetic: handleMagnetic, tilt, resetTilt } = useMicroInteractions();
  const carouselRef = useRef(null);

  const visibleProducts = useMemo(
    () => catalogProducts.filter(isProductVisibleInStorefront),
    [catalogProducts]
  );
  const publicCatalog = useMemo(() => getPublicFragranceCatalog(visibleProducts), [visibleProducts]);
  const collectionProducts = useMemo(() => pickCuratedProducts(publicCatalog, CURATED_LIMIT_DESKTOP), [publicCatalog]);
  const { currentUser } = useAuth();

  // Journal articles
  useEffect(() => {
    let active = true;
    getPublishedJournalPosts()
      .then((posts) => { if (active) setPublishedArticles(posts.slice(0, 3)); })
      .catch(() => { if (active) setPublishedArticles([]); });
    return () => { active = false; };
  }, []);

  // Carousel scroll
  const scrollCarousel = (direction) => {
    if (!carouselRef.current) return;
    const scrollAmount = carouselRef.current.offsetWidth * 0.6;
    carouselRef.current.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
  };

  const siteOrigin = getSiteOrigin();
  const homeCanonical = toAbsoluteUrl('/home', siteOrigin);
  const homeShareImage = toAbsoluteUrl(DEFAULT_SHARE_IMAGE, siteOrigin);

  return (
    <>
      <Helmet>
        <title>{t('home.tab')}</title>
        <meta name="description" content="SOLIVAGANT adalah atelier parfum artisan oleh Dekito — merakit karya olfaktori yang tenang dari raw material, kenangan, dan ritual pribadi." />
        <link rel="canonical" href={homeCanonical} />
        <meta property="og:title" content="SOLIVAGANT - Artisan Perfumery Atelier" />
        <meta property="og:description" content="Rumah parfum editorial oleh perfumer Dekito." />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SOLIVAGANT" />
        <meta property="og:url" content={homeCanonical} />
        <meta property="og:image" content={homeShareImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SOLIVAGANT - Artisan Perfumery Atelier" />
        <meta name="twitter:description" content="Rumah parfum editorial oleh perfumer Dekito." />
        <meta name="twitter:image" content={homeShareImage} />
        <script type="application/ld+json">{JSON.stringify(buildOrganizationJsonLd(siteOrigin))}</script>
        <script type="application/ld+json">{JSON.stringify(buildWebSiteJsonLd(siteOrigin))}</script>
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <ScrollProgress />
        <PublicHeader />

        {/* ── 1. Hero Slideshow ── */}
        <section className="home-hero">
          {/* No photograph until the upload list settles: the bundled fallback is a different
              picture, so seeding with it flashed the old hero on every first paint. */}
          {siteImagesLoading ? null : (
            <img src={img(siteImages['home-hero'], 1600) || '/brand/home/raw-material-library.jpg'} srcSet={srcSet(siteImages['home-hero'])} sizes="100vw" alt={t('home.heroAlt')} className="home-hero__slide-image home-hero__slide--active" style={{ objectFit: 'cover' }} />
          )}
          <div className="home-hero__overlay home-hero__overlay--editorial">
            <p className="home-hero__eyebrow">{t('home.eyebrow')}</p>
            {/* One word per span is what the reveal animation staggers, and word ORDER differs between
                languages — the Indonesian sentence and the English one are not a word-for-word
                match. So the words come from the sentence rather than being written out here, and the
                message carries the line break that keeps the two-line hero shape in both. */}
            <h1 className="home-hero__title" data-text-reveal>
              {t('home.heroTitle').split('\n').map((line, lineIndex) => (
                <React.Fragment key={line}>
                  {lineIndex ? <br /> : null}
                  {line.split(' ').filter(Boolean).map((word, wordIndex) => (
                    <React.Fragment key={`${line}-${word}-${wordIndex}`}>
                      {wordIndex ? ' ' : null}
                      <span className="text-reveal-word"><span>{word}</span></span>
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </h1>
            <p className="home-hero__subtitle">{t('home.lead')}</p>
            {/* The one line that says why to buy here rather than on a marketplace. Brand voice stays; a reason
                is added under it, not instead of it. */}
            <p className="home-hero__note">{t('home.note')}</p>
            <div className="home-hero__actions">
              <Link to="/catalog" className="home-hero__cta magnetic-hover" onMouseMove={handleMagnetic}>
                {t('home.seeCollection').toUpperCase()} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/customer" className="home-hero__cta home-hero__cta--quiet">
                {t(currentUser ? 'nav.account' : 'nav.accountSub').toUpperCase()}
              </Link>
            </div>
          </div>
        </section>

        {/* ── 2. Brand Mark + Tagline ── */}
        <section className="home-brandmark" data-reveal>
          <div className="home-brandmark__inner">
            <span className="home-brandmark__logo">SOLIVAGANT</span>
            <TextReveal as="h2" className="home-brandmark__tagline" text={t('home.brandTagline')} />
            <Link to="/catalog" className="home-brandmark__cta magnetic-hover" onMouseMove={handleMagnetic}>
              {t('home.seeCollection')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <LineDivider className="line-divider" draw data-reveal />

        {/* ── 3. Horizontal Scroll Carousel — "Current Collection" ── */}
        <section className="home-section home-section--flush" data-reveal>
          <div className="home-carousel__header">
            <div>
              <p className="editorial-eyebrow">{t('home.currentCollection')}</p>
              <h2>{t('home.featured')}</h2>
            </div>
            <Link to="/catalog" className="home-carousel__see-all">{t('home.seeCollection')} <ArrowRight className="h-4 w-4" /></Link>
          </div>
          {collectionProducts.length ? (
            <div className="home-carousel__wrapper">
              <button className="home-carousel__arrow home-carousel__arrow--left" onClick={() => scrollCarousel('left')} aria-label={t('home.scrollLeft')}>&larr;</button>
              <div className="home-carousel__track" ref={carouselRef}>
                {collectionProducts.map((product, index) => (
                  <Link
                    key={product.slug || product.id}
                    to={`/catalog/${product.slug}`}
                    className="home-carousel__card card-lift card-tilt img-hover-zoom"
                    onMouseMove={tilt}
                    onMouseLeave={resetTilt}
                  >
                    <ProductVisual
                      product={product}
                      className="home-carousel__card-visual"
                      imageFit="cover"
                      priority={index < 3}
                    />
                    <div className="home-carousel__card-info">
                      <h3>{product.name}</h3>
                      <div className="home-carousel__card-meta">
                        <span className="home-carousel__card-perfumer">{t('home.byDekito')}</span>
                        {(product.price || product.priceNumber) ? (
                          <CardPrice product={product} className="home-carousel__card-price" />
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <button className="home-carousel__arrow home-carousel__arrow--right" onClick={() => scrollCarousel('right')} aria-label={t('home.scrollRight')}>&rarr;</button>
            </div>
          ) : (
            <div className="editorial-empty-state editorial-empty-state--inline">
              <p>{t('home.emptyCollection')}</p>
            </div>
          )}
        </section>

        <LineDivider className="line-divider" draw data-reveal />

        {/* ── 3b. Why buy here — the four things a marketplace cannot offer ── */}
        <WhyBuyDirect />

        {/* ── 4. Full-bleed Editorial Statement ── */}
        <section className="home-statement" data-reveal="scale">
          {/* No photograph until the upload list settles: the bundled fallback is a different
              picture, so seeding with it flashed the old hero on every first paint. */}
          {siteImagesLoading ? null : (
            <img src={img(siteImages['home-statement'], 1280) || '/brand/home/perfumer-pipettes.jpg'} srcSet={srcSet(siteImages['home-statement'])} sizes="100vw" loading="lazy" decoding="async" alt={t('home.statementAlt')} className="home-statement__image" />
          )}
          <div className="home-statement__overlay">
            <TextReveal text={t('home.statementTitle')} />
            <p>{t('home.statementBody')}</p>
            <Link to="/bespoke" className="home-statement__cta magnetic-hover" onMouseMove={handleMagnetic}>
              {t('home.statementCta')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── 5. Tabbed "Explore by Mood" ── */}
        <section className="home-section" data-reveal>
          <div className="home-section__head">
            <p className="editorial-eyebrow">{t('home.byMood')}</p>
            <TextReveal text={t('home.moodLead')} />
          </div>
          <div className="home-moods">
            <div className="home-moods__tabs">
              {moodCategories.map((mood, i) => (
                <button
                  key={mood.nameKey}
                  className={`home-moods__tab ${i === activeMood ? 'home-moods__tab--active' : ''}`}
                  onClick={() => setActiveMood(i)}
                >
                  <span className="home-moods__tab-name">{t(mood.nameKey)}</span>
                  <ArrowRight className="home-moods__tab-arrow h-4 w-4" />
                </button>
              ))}
            </div>
            <div className="home-moods__panel">
              <div className="home-moods__panel-visual" data-family={moodCategories[activeMood].family.toLowerCase()}>
                {siteImages[moodCategories[activeMood].siteImageKey] ? (
                  <img src={img(siteImages[moodCategories[activeMood].siteImageKey], 720)} alt={t(moodCategories[activeMood].nameKey)} className="home-moods__panel-image" />
                ) : null}
                <span className="home-moods__panel-family">{moodCategories[activeMood].family}</span>
              </div>
              <div className="home-moods__panel-body">
                <h3>{t(moodCategories[activeMood].nameKey)}</h3>
                <p>{t(moodCategories[activeMood].bodyKey)}</p>
                <Link to={`/catalog?family=${moodCategories[activeMood].filter}`} className="home-moods__panel-link">
                  {t('home.shopMood', { mood: t(moodCategories[activeMood].nameKey) })} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <LineDivider className="line-divider" draw data-reveal />

        {/* ── 6. Journal Section ── */}
        {publishedArticles.length ? (
          <section className="home-section" data-reveal>
            <div className="home-section__head">
              <p className="editorial-eyebrow">{t('home.journal')}</p>
              <TextReveal text={t('home.journalHeading')} />
            </div>
            <div className="home-journal-grid" data-reveal data-stagger-children>
              {publishedArticles.map((article) => (
                <Link key={article.id} to={getJournalPublicPath(article)} className="home-journal-card">
                  <span className="home-journal-card__category">{getJournalCategoryLabel(article.category)}</span>
                  <h3>{article.title}</h3>
                  <p>{getArticleExcerpt(article)}</p>
                  <span className="home-journal-card__read-more">{t('home.readMore')} <ArrowRight className="h-3 w-3" /></span>
                </Link>
              ))}
            </div>
            <div className="home-section__action">
              <Link to="/journal">{t('home.readJournal')} <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>
        ) : null}

        {/* ── 7. Newsletter Section ── */}
        <section className="home-newsletter" data-reveal>
          {/* No photograph until the upload list settles: the bundled fallback is a different
              picture, so seeding with it flashed the old hero on every first paint. */}
          {siteImagesLoading ? null : (
            <img src={img(siteImages['home-newsletter'], 1600) || '/brand/home/raw-material-library.jpg'} srcSet={srcSet(siteImages['home-newsletter'])} sizes="100vw" loading="lazy" decoding="async" alt={t('home.atelierAlt')} className="home-newsletter__bg" />
          )}
          <div className="home-newsletter__inner">
            <p className="editorial-eyebrow">{t('home.collabEyebrow')}</p>
            <h2>{t('home.collabHeading')}</h2>
            <p className="home-newsletter__sub">{t('home.collabBody')}</p>
            <a
              href={buildWhatsAppCheckoutUrl(t('home.collabMessage'))}
              target="_blank"
              rel="noopener noreferrer"
              className="home-newsletter__wa magnetic-hover"
              onMouseMove={handleMagnetic}
            >
              <MessageCircle className="h-4 w-4" /> {t('home.collabCta')}
            </a>
          </div>
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default HomePage;
