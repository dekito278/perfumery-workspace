/**
 * Lock page scroll while an overlay is open, and give back exactly what was there before.
 *
 * `document.body.style.overflow` is one global owned by every overlay at once, and the two writers in this
 * app disagreed about it. MobileBottomSheet saved the previous value and restored it. ProductGallery's
 * lightbox set 'hidden' and, on close, wrote '' — clobbering whatever another overlay had set, so the page
 * behind a still-open sheet would start scrolling again.
 *
 * Not reachable on today's screens: the only sheet on the product page is the add-to-cart prompt, which
 * covers the gallery, so the lightbox cannot be opened while it is up. The inconsistency is what matters —
 * the moment one overlay sits inside another, the one that closes first decides for both.
 *
 * Returns the release function, so a caller can hand it straight to useEffect's cleanup. Save-and-restore
 * rather than a counter: these overlays nest last-in-first-out, and a counter would need a module-level
 * number that survives hot reloads and remounts to be worth the extra moving part.
 */
export const lockBodyScroll = () => {
  if (typeof document === 'undefined') return () => {};
  const body = document.body;
  const html = document.documentElement;
  const previous = {
    overflow: body.style.overflow,
    overscrollBehavior: html.style.overscrollBehavior,
  };

  body.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'none';

  return () => {
    body.style.overflow = previous.overflow;
    html.style.overscrollBehavior = previous.overscrollBehavior;
  };
};
