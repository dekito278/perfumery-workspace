import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslate } from '@/hooks/useTranslate.js';
import { usePublicReviews } from '@/hooks/useReviews.js';
import { ReviewStars } from '@/components/storefront/ReviewStars.jsx';
import { averageRating, formatAverage, PRODUCT_PAGE_REVIEW_LIMIT, REVIEWS_ANCHOR } from '@/utils/reviews.js';

/**
 * Verified buyer reviews (Dekito, 20 Nov 2026). Separate from ProductTestimonials, which are sentences
 * Dekito pastes from chats: these come only from a signed-in buyer whose order shipped, and show only after
 * Dekito publishes them in Studio.
 *
 * Silent when there are none — the same rule as the quotes, for the same reason: "Ulasan (0)" on most pages
 * would say nobody has bought. A review is printed as written, in the language it was written in; the
 * English shop says so above them, since every buyer so far ordered in Indonesia.
 */

const reviewDate = (value, locale) => {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return '';
  return new Date(time).toLocaleDateString(locale, { month: 'short', year: 'numeric' });
};

export const ReviewItem = ({ review, showProduct = false }) => {
  const { t, isInternational } = useTranslate();
  const locale = isInternational ? 'en-US' : 'id-ID';
  const who = review.displayName ? `${review.displayName} · ${t('review.verifiedBuyer')}` : t('review.verifiedBuyer');
  const date = reviewDate(review.publishedAt, locale);
  return (
    <li className="flex flex-col gap-3 border-t border-ng-bone/15 pt-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ReviewStars rating={review.rating} />
        {showProduct && review.productSlug ? (
          <Link to={`/catalog/${review.productSlug}`} className="font-ng-display text-xl leading-tight text-ng-bone underline-offset-4 hover:underline">
            {review.productName}
          </Link>
        ) : null}
      </div>
      {review.body ? <p className="m-0 whitespace-pre-line text-[17px] leading-relaxed text-ng-sand">{review.body}</p> : null}
      <p className="ng-mono m-0 text-ng-ash">{date ? `${who} · ${date}` : who}</p>
      {review.reply ? (
        <div className="border-l-2 border-ng-bone/20 pl-4">
          <p className="ng-mono m-0 text-ng-ash">{t('review.replyFrom')}</p>
          <p className="m-0 mt-1 whitespace-pre-line text-[15px] leading-relaxed text-ng-dust">{review.reply}</p>
        </div>
      ) : null}
    </li>
  );
};

export const ReviewSummary = ({ reviews }) => {
  const { t, isInternational } = useTranslate();
  const average = formatAverage(averageRating(reviews), isInternational ? 'en-US' : 'id-ID');
  return (
    <div className="flex flex-wrap items-center gap-3 text-ng-dust">
      <ReviewStars rating={averageRating(reviews)} size="h-5 w-5" />
      <span>
        {reviews.length === 1
          ? t('review.summaryOne', { average })
          : t('review.summary', { average, count: reviews.length })}
      </span>
    </div>
  );
};

const ProductReviews = ({ product, className = '' }) => {
  const { t, isInternational } = useTranslate();
  const reviews = usePublicReviews(product?.slug || '');
  if (!reviews?.length) return null;
  const shown = reviews.slice(0, PRODUCT_PAGE_REVIEW_LIMIT);

  return (
    <section className={`ng-section ${className}`.trim()} aria-labelledby="pdp-reviews-title" id={REVIEWS_ANCHOR}>
      <div className="ng-container flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h2 id="pdp-reviews-title" className="ng-mono m-0 font-normal text-ng-ash">{t('review.pdp.kicker')}</h2>
          <ReviewSummary reviews={reviews} />
          {isInternational ? <p className="m-0 text-sm text-ng-ash">{t('review.inIndonesian')}</p> : null}
        </div>
        <ul className="m-0 grid list-none gap-8 p-0 md:grid-cols-3">
          {shown.map((review) => <ReviewItem key={review.id} review={review} />)}
        </ul>
        {reviews.length > shown.length ? (
          <Link to={`/reviews?parfum=${encodeURIComponent(product.slug)}`} className="ng-btn ng-btn--ghost self-start">
            {t('review.pdp.seeAll')}
          </Link>
        ) : null}
      </div>
    </section>
  );
};

export default ProductReviews;
