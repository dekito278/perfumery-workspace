import React, { useRef } from 'react';
import { Star } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';

const STARS = [1, 2, 3, 4, 5];

/**
 * Five stars, filled up to `rating` in half stars (an average of 4,5 is four and a half, not five). Read by a
 * screen reader as "4,5 dari 5 bintang".
 */
export const ReviewStars = ({ rating = 0, size = 'h-4 w-4', className = '' }) => {
  const { t, isInternational } = useTranslate();
  const value = Math.round((Number(rating) || 0) * 2) / 2;
  const label = Number.isInteger(value) ? value : value.toLocaleString(isInternational ? 'en-US' : 'id-ID');
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`.trim()} role="img" aria-label={t('review.starsOf', { count: label })}>
      {STARS.map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className={`relative inline-block ${size}`} aria-hidden="true">
            <Star className={`absolute inset-0 ${size} text-ng-ash/50`} strokeWidth={1.5} />
            {fill > 0 ? (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`${size} fill-current text-ng-sand`} strokeWidth={1.5} />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
};

/**
 * The 1–5 picker: a radio group, so arrow keys move between stars and a screen reader says which one is
 * chosen. Big enough to hit with a thumb (44 px).
 */
export const ReviewStarsInput = ({ value = 0, onChange, labelledBy }) => {
  const { t } = useTranslate();
  const refs = useRef([]);
  const move = (event, n) => {
    let next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(5, n + 1);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(1, n - 1);
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    refs.current[next - 1]?.focus();
  };
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex items-center gap-1">
      {STARS.map((n) => {
        const checked = value === n;
        return (
          <button
            key={n}
            ref={(node) => { refs.current[n - 1] = node; }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={t('review.starsOf', { count: n })}
            tabIndex={checked || (!value && n === 1) ? 0 : -1}
            onClick={() => onChange(n)}
            onKeyDown={(event) => move(event, n)}
            className="grid h-11 w-11 place-items-center text-ng-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-ng-bone"
          >
            <Star aria-hidden="true" className={`h-7 w-7 ${n <= value ? 'fill-current' : 'text-ng-ash'}`} strokeWidth={1.5} />
          </button>
        );
      })}
    </div>
  );
};

export default ReviewStars;
