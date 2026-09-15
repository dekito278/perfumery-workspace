import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Where a horizontal scroller is, and whether it can still go either way.
 *
 * A carousel with no position and arrows that never grey out asks the reader to guess twice: how much
 * is left, and whether that arrow is going to do anything. Both answers are already in the DOM — this
 * just reads them.
 *
 * Kept as a hook rather than inlined because the phone shelf needs the same three answers, and two
 * copies of "am I at the end" is how the two of them start disagreeing.
 */
export const useCarouselPosition = (itemCount) => {
  const ref = useRef(null);
  const [position, setPosition] = useState({ index: 0, atStart: true, atEnd: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    // A fractional scroll position is normal — the browser lands mid-pixel, and a zoomed page lands
    // well off. Rounding UP the remaining space keeps `atEnd` from flickering one pixel early.
    const remaining = el.scrollWidth - el.clientWidth - el.scrollLeft;
    const first = el.firstElementChild;
    const step = first ? first.offsetWidth + (parseFloat(getComputedStyle(el).gap) || 0) : el.clientWidth;
    const index = step > 0 ? Math.round(el.scrollLeft / step) : 0;

    const atEnd = remaining <= 1;

    setPosition({
      // At the end, the last item is the answer. The raw index is the LEFTMOST visible card, so a track
      // showing the final three of five reported "3 of 5" while the right arrow sat greyed out — two
      // signals contradicting each other, which is worse than having neither.
      index: atEnd
        ? Math.max(itemCount - 1, 0)
        : Math.min(Math.max(index, 0), Math.max(itemCount - 1, 0)),
      atStart: el.scrollLeft <= 1,
      atEnd,
    });
  }, [itemCount]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    measure();
    el.addEventListener('scroll', measure, { passive: true });
    // The track is not always the width it was on mount: a phone rotating, or a desktop window being
    // dragged narrower, changes how much is left over without ever firing a scroll event.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(el);

    return () => {
      el.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [measure]);

  const scrollBy = useCallback((direction) => {
    const el = ref.current;
    if (!el) return;
    // Someone who asked for less motion gets the jump, not the glide. scrollBy honours the request
    // nowhere on its own.
    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({
      left: (direction === 'right' ? 1 : -1) * el.offsetWidth * 0.6,
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, []);

  return { ref, ...position, scrollBy };
};

export default useCarouselPosition;
