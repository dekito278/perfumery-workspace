import CardPrice from '@/components/storefront/CardPrice.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import WhyBuyDirect from '@/components/storefront/WhyBuyDirect.jsx';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { CURATED_LIMIT_MOBILE, pickCuratedProducts } from '@/utils/curatedProducts.js';
import { useSiteImages } from '@/hooks/useSiteImages.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { LineDivider, LineMark } from '@/components/line/LineArt.jsx';
import { getPublishedJournalPosts, getJournalCategoryLabel, getJournalPublicPath } from '@/services/journalPostsSupabaseService.js';
import { getOptimizedStorageImageUrl as img, getStorageImageSrcSet as srcSet } from '@/utils/storageImage.js';

// A phone viewport is ~390 CSS px, so sizes="100vw" asks for ~1170 on a 3x screen and an uncapped
// candidate list answers with 1600 — heavier than the fixed 900 this page used to request. Capped here
// so a 1x phone takes 480 and a 3x phone tops out at the 900 this page already used: never heavier than
// Each image keeps the width it already asked for as its ceiling, so a 3x phone is never handed
// anything heavier than before while a 1x phone drops to 480.
const HERO_WIDTHS = [480, 720, 900];
const STATEMENT_WIDTHS = [480, 600, 750];
import { desktopCanonicalPath, toAbsoluteUrl } from '@/utils/seo.js';

// The notes come from the desktop home page's mood list, shortened. Without them each card was a flat
// pastel square holding one italic word, which reads as unfinished rather than minimal (UX backlog U-11).
const moodCategories = [
  // `family` is the catalogue category in the link AND the perfumery family shown on the card — the same
  // word in both languages. Only the mood name and the note summary are copy.
  { nameKey: 'mood.fresh.name', family: 'Fresh', notesKey: 'mood.fresh.short' },
  { nameKey: 'mood.gourmand.name', family: 'Gourmand', notesKey: 'mood.gourmand.short' },
  { nameKey: 'mood.woody.name', family: 'Woody', notesKey: 'mood.woody.short' },
  { nameKey: 'mood.floral.name', family: 'Floral', notesKey: 'mood.floral.short' },
];

const getArticleExcerpt = (article) =>
  article?.excerpt || String(article?.content || '').replace(/[`*_>#-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);

export const MobileStorefrontContent = ({ active = true }) => {
  const navigate = useNavigate();
  const { t } = useTranslate();
  const catalogProducts = useStorefrontProducts({ active });
  const { images: siteImages, loading: siteImagesLoading } = useSiteImages();
  const [articles, setArticles] = useState([]);

  const visibleProducts = useMemo(
    () => catalogProducts.filter(isProductVisibleInStorefront),
    [catalogProducts]
  );
  const publicCatalog = useMemo(() => getPublicFragranceCatalog(visibleProducts), [visibleProducts]);
  const collection = useMemo(() => pickCuratedProducts(publicCatalog, CURATED_LIMIT_MOBILE), [publicCatalog]);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    getPublishedJournalPosts()
      .then((posts) => { if (!cancelled) setArticles(posts.slice(0, 3)); })
      .catch(() => { if (!cancelled) setArticles([]); });
    return () => { cancelled = true; };
  }, [active]);

  return (
    <>
      {active ? (
        <Helmet>
          <title>{t('home.tabMobile')}</title>
          <link rel="canonical" href={toAbsoluteUrl(desktopCanonicalPath('/mobile/dashboard'))} />
          <meta name="description" content={t('home.metaMobile')} />
        </Helmet>
      ) : null}

      <main className="mobile-page m-editorial-page">
        {/* Hero — fullscreen image */}
        <section className="m-editorial-hero">
          {/* No photograph until the upload list settles: the bundled fallback is a different
              picture, so seeding with it flashed the old hero on every first paint. */}
          {siteImagesLoading ? null : (
            <img src={img(siteImages['home-hero'], 900) || '/brand/home/raw-material-library.jpg'} alt={t('home.heroAlt')} className="m-editorial-hero__image" loading="eager" srcSet={srcSet(siteImages['home-hero'], HERO_WIDTHS)} sizes="100vw" />
          )}
          <div className="m-editorial-hero__overlay">
            <p className="m-editorial-eyebrow">{t('home.eyebrow')}</p>
            <h1>{t('home.headlineMobile')}</h1>
            <p className="m-editorial-hero__lede">{t('home.lead')}</p>
            <p className="m-editorial-hero__note">{t('home.note')}</p>
            <button type="button" className="m-editorial-cta" onClick={() => navigate('/mobile/catalog')}>
              {t('home.seeCollection')} <ArrowRight className="h-4 w-4" />
            </button>
            <Link to="/mobile/customer" className="m-editorial-cta m-editorial-cta--quiet">
              {t(currentUser ? 'nav.account' : 'nav.accountSub')}
            </Link>
          </div>
        </section>

        {/* Collection — image-first cards */}
        {collection.length ? (
          <section className="m-editorial-section">
            <div className="m-editorial-section__head">
              <p className="m-editorial-eyebrow">{t('home.currentCollection')}</p>
              <h2>{t('home.featured')}</h2>
            </div>
            <div className="m-editorial-product-grid">
              {collection.map((product) => (
                <Link key={product.slug} to={`/mobile/products/${product.slug}`} className="m-editorial-product-card">
                  <ProductVisual product={product} className="m-editorial-product-card__visual" imageFit="cover" label={false} sizes="(max-width: 480px) 45vw, 200px" />
                  <div className="m-editorial-product-card__info">
                    <span className="m-editorial-product-card__category">{product.category}</span>
                    <h3>{product.name}</h3>
                    <CardPrice product={product} className="m-editorial-product-card__price" memberClassName="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700" />
                  </div>
                </Link>
              ))}
            </div>
            <div className="m-editorial-section__action">
              <Link to="/mobile/catalog">{t('home.seeAll')} <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </section>
        ) : null}

        <LineDivider className="line-divider" draw data-reveal />

        <WhyBuyDirect mobile />

        <LineDivider className="line-divider" draw data-reveal />

        {/* Mood categories */}
        <section className="m-editorial-section">
          <div className="m-editorial-section__head">
            <p className="m-editorial-eyebrow">{t('home.byMoodMobile')}</p>
            <h2>{t('home.moodLead')}</h2>
          </div>
          <div className="m-editorial-mood-grid">
            {moodCategories.map((mood) => (
              <Link key={mood.nameKey} to={`/mobile/catalog?category=${mood.family}`} className="m-editorial-mood-card">
                <div className="m-editorial-mood-card__visual" data-family={mood.family.toLowerCase()}>
                  <LineMark className="m-editorial-mood-card__mark" />
                  <span>{mood.family}</span>
                </div>
                <h3>{t(mood.nameKey)}</h3>
                <p className="m-editorial-mood-card__notes">{t(mood.notesKey)}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Statement block */}
        <section className="m-editorial-statement">
          {/* No photograph until the upload list settles: the bundled fallback is a different
              picture, so seeding with it flashed the old hero on every first paint. */}
          {siteImagesLoading ? null : (
            <img src={img(siteImages['home-statement'], 750) || '/brand/home/perfumer-pipettes.jpg'} alt={t('home.statementAlt')} className="m-editorial-statement__image" loading="lazy" srcSet={srcSet(siteImages['home-statement'], STATEMENT_WIDTHS)} sizes="100vw" />
          )}
          <div className="m-editorial-statement__overlay">
            <p className="m-editorial-eyebrow">{t('home.atelier')}</p>
            <h2>{t('home.atelierHeading')}</h2>
            <button type="button" className="m-editorial-cta" onClick={() => navigate('/mobile/bespoke')}>
              {t('home.bespokeCta')} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Journal preview */}
        {articles.length ? (
          <section className="m-editorial-section m-editorial-section--dark">
            <div className="m-editorial-section__head">
              <p className="m-editorial-eyebrow">{t('home.journal')}</p>
              <h2>{t('home.journalHeading')}</h2>
            </div>
            <div className="m-editorial-journal-list">
              {articles.map((article) => (
                <Link key={article.id} to={getJournalPublicPath(article)} className="m-editorial-journal-card">
                  <span className="m-editorial-journal-card__category">{getJournalCategoryLabel(article.category)}</span>
                  <h3>{article.title}</h3>
                  <p>{getArticleExcerpt(article)}</p>
                </Link>
              ))}
            </div>
            <div className="m-editorial-section__action">
              <Link to="/mobile/articles">{t('home.readJournal')} <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
};

const MobileStorefrontPage = () => (
  <MobileCommerceLayout>
    <MobileStorefrontContent />
  </MobileCommerceLayout>
);

export default MobileStorefrontPage;
