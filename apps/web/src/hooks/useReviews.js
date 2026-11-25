import { useEffect, useMemo, useState } from 'react';
import { getPendingReviewSummary, getPublicReviews, getReviewStats } from '@/services/reviewService.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { SET_NAMES_EN } from '@/utils/discoverySet.js';

/** Published reviews for one perfume (or all, with no slug). `null` while loading. */
// The English shop names a discovery set in English (SET_NAMES_EN); a review carries the stored name.
export const usePublicReviews = (productSlug = '', { all = false } = {}) => {
  const { isInternational } = useTranslate();
  const [reviews, setReviews] = useState(null);
  useEffect(() => {
    if (!all && !productSlug) {
      setReviews([]);
      return undefined;
    }
    let cancelled = false;
    setReviews(null);
    getPublicReviews({ productSlug }).then((rows) => {
      if (!cancelled) setReviews(rows);
    });
    return () => { cancelled = true; };
  }, [productSlug, all]);
  return useMemo(() => (reviews && isInternational
    ? reviews.map((review) => ({ ...review, productName: SET_NAMES_EN[review.productSlug] || review.productName }))
    : reviews), [reviews, isInternational]);
};

/** { [slug]: { count, average } }, read once per page load and shared by every card. */
export const useReviewStats = () => {
  const [stats, setStats] = useState({});
  useEffect(() => {
    let cancelled = false;
    getReviewStats().then((index) => {
      if (!cancelled) setStats(index || {});
    });
    return () => { cancelled = true; };
  }, []);
  return stats;
};

/** Studio: { ready, count, reviews } of reviews waiting to be checked. Read once when the dashboard opens. */
export const usePendingReviewSummary = () => {
  const [summary, setSummary] = useState({ ready: false, count: 0, reviews: [] });
  useEffect(() => {
    let cancelled = false;
    getPendingReviewSummary().then((result) => {
      if (!cancelled) setSummary(result);
    });
    return () => { cancelled = true; };
  }, []);
  return summary;
};
