// Nothing that is on screen may stay invisible.
//
// Three separate times on 2026-09-07/08 an element vanished because its reveal never fired: the line
// motifs (no observer on that page), and — far worse — the desktop product page, where the add-to-cart
// button sat at opacity 0 permanently because useScrollReveal read its ref during a loading branch and
// never re-ran. The button was in the DOM and clickable; a buyer just could not see it.
//
// The root causes are fixed. This is the net under them: once the page has settled, anything carrying
// [data-reveal] that is actually inside the viewport and still not revealed gets revealed. It cannot
// undo the effect for content further down the page — those elements are not intersecting, so they are
// left alone and still animate on scroll. It only converts "invisible forever" into "appeared late".
const REVEAL_ATTR = '[data-reveal]:not(.is-visible)';
const CHECKS_MS = [1200, 3000, 6000];

const revealStranded = () => {
  const viewportH = window.innerHeight || 0;
  document.querySelectorAll(REVEAL_ATTR).forEach((el) => {
    const rect = el.getBoundingClientRect();
    const onScreen = rect.height > 0 && rect.top < viewportH && rect.bottom > 0;
    if (onScreen) el.classList.add('is-visible');
  });
};

export const installRevealSafetyNet = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  const timers = CHECKS_MS.map((ms) => window.setTimeout(revealStranded, ms));
  // Route changes swap the page under us, so re-check shortly after each one.
  const onNavigate = () => window.setTimeout(revealStranded, 1200);
  window.addEventListener('popstate', onNavigate);
  return () => {
    timers.forEach((t) => window.clearTimeout(t));
    window.removeEventListener('popstate', onNavigate);
  };
};

export { revealStranded };
export default installRevealSafetyNet;
