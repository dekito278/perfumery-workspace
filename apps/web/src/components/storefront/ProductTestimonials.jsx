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
    <section className={`pdp-quotes ${className}`.trim()} aria-labelledby="pdp-quotes-title">
      <h2 id="pdp-quotes-title" className="editorial-eyebrow">{t('quotes.title')}</h2>
      <ul className="pdp-quotes__list">
        {quotes.map((row, index) => {
          const attribution = testimonialAttribution(row);
          return (
            <li key={`${row.quote.slice(0, 24)}-${index}`} className="pdp-quote">
              <blockquote className="pdp-quote__text">{row.quote}</blockquote>
              {attribution ? <cite className="pdp-quote__by">{attribution}</cite> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default ProductTestimonials;
