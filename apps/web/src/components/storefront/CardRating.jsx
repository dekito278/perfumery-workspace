import React from 'react';
import { Star } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';
import { cardShowsRating, formatAverage } from '@/utils/reviews.js';

/**
 * "★ 4,8 (12)" on a catalogue card — only from CARD_RATING_MIN_REVIEWS published reviews up (see
 * utils/reviews.js). Below that it renders nothing, so a card never announces "(1)" or "(0)".
 */
const CardRating = ({ stats, className = '' }) => {
  const { t, isInternational } = useTranslate();
  if (!cardShowsRating(stats)) return null;
  const average = formatAverage(stats.average, isInternational ? 'en-US' : 'id-ID');
  return (
    <span className={`inline-flex items-center gap-1 text-sm text-ng-sand ${className}`.trim()}>
      <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" strokeWidth={1.5} />
      <span aria-hidden="true">{average} ({stats.count})</span>
      <span className="sr-only">{t('review.cardLabel', { average, count: stats.count })}</span>
    </span>
  );
};

export default CardRating;
