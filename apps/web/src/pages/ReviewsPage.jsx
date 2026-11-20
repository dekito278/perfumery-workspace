import React, { useId, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { ReviewItem, ReviewSummary } from '@/components/storefront/ProductReviews.jsx';
import { usePublicReviews } from '@/hooks/useReviews.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { shopCanonicalUrl } from '@/utils/seo.js';

/**
 * Every published buyer review, newest first, narrowed to one perfume with ?parfum=<slug> (Dekito, 20 Nov
 * 2026). Reached from "Lihat semua ulasan" on a product page. Not in the sitemap, and not indexed while it
 * has nothing to show.
 */
const ReviewsPage = () => {
  const { t, region, isInternational } = useTranslate();
  const filterId = useId();
  const [params, setParams] = useSearchParams();
  const reviews = usePublicReviews('', { all: true });
  const chosen = params.get('parfum') || '';

  const perfumes = useMemo(() => {
    const seen = new Map();
    (reviews || []).forEach((review) => {
      if (review.productSlug && !seen.has(review.productSlug)) seen.set(review.productSlug, review.productName);
    });
    return [...seen.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [reviews]);

  const known = perfumes.some((perfume) => perfume.slug === chosen);
  const shown = (reviews || []).filter((review) => !known || review.productSlug === chosen);

  const choose = (slug) => {
    const next = new URLSearchParams(params);
    if (slug) next.set('parfum', slug); else next.delete('parfum');
    setParams(next, { replace: true });
  };

  return (
    <>
      <Helmet>
        <title>{t('review.page.tab')}</title>
        <meta name="description" content={t('review.page.description')} />
        <link rel="canonical" href={shopCanonicalUrl('/reviews', region)} />
        {reviews && !reviews.length ? <meta name="robots" content="noindex" /> : null}
      </Helmet>
      <div className="solivagant-editorial-home">
        <PublicHeader />
        <main id="main-content">
          <section className="ng-section !pt-16">
            <div className="ng-container flex flex-col gap-10">
              <div className="flex max-w-[720px] flex-col gap-4">
                <p className="ng-mono m-0 text-ng-ash">{t('review.page.title')}</p>
                <h1 className="ng-display m-0 text-[44px] leading-none md:text-[64px]">{t('review.page.heading')}</h1>
                <p className="m-0 text-[17px] leading-relaxed text-ng-dust">{t('review.page.intro')}</p>
                {isInternational ? <p className="m-0 text-sm text-ng-ash">{t('review.inIndonesian')}</p> : null}
              </div>

              {reviews === null ? (
                <div className="h-40" aria-busy="true" />
              ) : !reviews.length ? (
                <div className="flex flex-col items-start gap-4">
                  <p className="m-0 text-ng-dust">{t('review.page.none')}</p>
                  <Link to="/catalog" className="ng-btn ng-btn--ghost">{t('review.page.toCatalog')}</Link>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <ReviewSummary reviews={shown} />
                    {perfumes.length > 1 ? (
                      <label htmlFor={filterId} className="flex flex-col gap-1 text-sm text-ng-ash">
                        {t('review.page.filterLabel')}
                        <select
                          id={filterId}
                          value={known ? chosen : ''}
                          onChange={(event) => choose(event.target.value)}
                          className="h-11 min-w-[220px] rounded-none border border-ng-bone/20 bg-ng-ink px-3 text-[15px] text-ng-bone"
                        >
                          <option value="">{t('review.page.filterAll')}</option>
                          {perfumes.map((perfume) => <option key={perfume.slug} value={perfume.slug}>{perfume.name}</option>)}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <ul className="m-0 grid list-none gap-8 p-0 md:grid-cols-2">
                    {shown.map((review) => <ReviewItem key={review.id} review={review} showProduct />)}
                  </ul>
                </>
              )}
            </div>
          </section>
        </main>
        <StorefrontFooter />
      </div>
    </>
  );
};

export default ReviewsPage;
