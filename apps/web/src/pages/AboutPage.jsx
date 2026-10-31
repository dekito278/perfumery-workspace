import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { brandFacts } from '@/data/brandProfile.js';
import { shopCanonicalUrl } from '@/utils/seo.js';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';

// The page a stranger is sent to when they ask "who are you".
//
// Written in October 2026 for the Fragrantica submission: an editor adding a house to that database
// reads one page and copies the brand off it, and until now there was none — /about was a 404 and the
// brand's details were scattered across a hero and a footer with nothing to link to. It is a buyer's
// page first, though; the facts table underneath is for whoever needs to transcribe it.
//
// The fragrance count is COUNTED from the live catalogue rather than written down. A number typed into
// a page is right on the day it is typed, and this one changes every time Dekito publishes a bottle.
const AboutContent = () => {
  const { t } = useTranslate();
  const catalog = useCatalogProducts();
  const fragranceCount = useMemo(
    () => catalog.filter(isProductVisibleInStorefront).length,
    [catalog],
  );
  const facts = brandFacts({ fragranceCount });

  return (
    <>
      <p className="ng-eyebrow ng-mono m-0">{t('about.eyebrow')}</p>
      <h1 className="ng-display mt-5 text-4xl text-ng-bone sm:text-6xl">
        {t('about.title')}
      </h1>

      <div className="mt-6 grid gap-4 text-base leading-7 text-ng-dust sm:text-lg sm:leading-8">
        <p>{t('about.p1')}</p>
        <p>{t('about.p2')}</p>
        <p>{t('about.p3')}</p>
      </div>

      {/* The transcribable half. A definition list rather than prose because the reader who needs it is
          copying it into a form, and a fact buried in a paragraph gets copied wrong. */}
      <section className="mt-8 rounded-none border border-ng-bone/12 bg-transparent p-5">
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-ng-bone">{t('about.factsTitle')}</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.key} className="flex flex-wrap items-baseline gap-2 border-b border-ng-bone/8 pb-2">
              <dt className="text-xs font-bold uppercase tracking-[0.1em] text-ng-dust">{t(`about.fact.${fact.key}`)}</dt>
              <dd className="ml-auto text-sm font-semibold text-ng-bone">{fact.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-ng-dust">{t('about.factsNote')}</p>
      </section>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-2 rounded-none bg-ng-bone px-5 py-3 text-sm font-bold text-ng-ink"
        >
          {t('about.seeCollection')}<ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/bespoke"
          className="inline-flex items-center gap-2 rounded-none border border-ng-bone/20 px-5 py-3 text-sm font-bold text-ng-bone"
        >
          {t('about.bespoke')}
        </Link>
      </div>
    </>
  );
};

const AboutPage = () => {
  const { t, region } = useTranslate();
  const head = (
    <Helmet>
      <title>{t('about.tab')}</title>
      <meta name="description" content={t('about.meta')} />
      {/* Indexable on purpose, unlike /welcome: this is the page a brand is meant to be found by. */}
      <link rel="canonical" href={shopCanonicalUrl('/about', region)} />
    </Helmet>
  );

  return (
    <>
      {head}
      <main className="solivagant-editorial-home">
        <PublicHeader />
        <section className="tracking-content !pt-16">
          <div className="tracking-card">
            <AboutContent />
          </div>
        </section>
        <StorefrontFooter />
      </main>
    </>
  );
};

export default AboutPage;
