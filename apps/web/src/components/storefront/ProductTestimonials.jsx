import React from 'react';
import { useTranslate } from '@/hooks/useTranslate.js';
import { normalizeTestimonials, testimonialAttribution } from '@/utils/productTestimonials.js';

/**
 * What buyers said, in their own words, when there are any.
 *
 * Renders NOTHING when the column is empty — which is most products, and will stay that way for a while.
 * That silence is the design, not a gap waiting to be filled: with 24 paid orders and four buyers on the
 * best-selling perfume, a "Reviews (0)" heading on 14 of 18 product pages would announce that nobody has
 * bought. A shop with little to show says less, rather than framing the emptiness.
 *
 * These are not reviews. No stars, no average, no form, no login, no moderation queue — Dekito pastes
 * sentences people really sent him on WhatsApp and Instagram. Nothing in this repo may generate one;
 * a fabricated customer sentence is a fake review whatever it is called.
 *
 * The quotes are printed as written, in whatever language they were written in, in both shops. A buyer's
 * own words are not interface copy to be translated — only the heading above them is.
 */
const ProductTestimonials = ({ product, className = '' }) => {
  const { t } = useTranslate();
  const quotes = normalizeTestimonials(product?.testimonials);
  if (!quotes.length) return null;

  return (
    <section className={`ng-section ng-section--deep ${className}`.trim()} aria-labelledby="pdp-quotes-title">
      <div className="ng-container flex flex-col gap-10">
      <h2 id="pdp-quotes-title" className="ng-mono m-0 font-normal text-ng-ash">{t('quotes.title')}</h2>
      <ul className="m-0 grid list-none gap-10 p-0 md:grid-cols-2">
        {quotes.map((row, index) => {
          const attribution = testimonialAttribution(row);
          return (
            <li key={`${row.quote.slice(0, 24)}-${index}`} className="flex flex-col gap-4 border-t border-ng-bone/15 pt-6">
              <blockquote className="m-0 font-ng-display text-[26px] italic leading-snug text-ng-sand md:text-[30px]">{row.quote}</blockquote>
              {attribution ? <cite className="ng-mono not-italic text-ng-ash">{attribution}</cite> : null}
            </li>
          );
        })}
      </ul>
      </div>
    </section>
  );
};

export default ProductTestimonials;
