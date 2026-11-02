// The prerendered HTML carries each page's head tags, for a crawler that runs no JavaScript and for link
// previews (WhatsApp, Instagram). react-helmet then adds its own and leaves those in place, so every shop
// page ended up with two canonicals, two descriptions, two og:url and two Product blocks — on an
// Indonesian address read by a US browser, two canonicals that disagreed (measured 2026-11-02; the same
// before the redesign). Google ignores canonicals that contradict each other.
//
// The tag React writes knows the live catalogue, so it replaces its prerendered twin. A prerendered tag
// React never writes (hreflang, og:locale) stays.
const keyOf = (el) => {
  if (el.matches('link[rel="canonical"]')) return 'canonical';
  if (el.matches('meta[name]')) return `name:${el.getAttribute('name')}`;
  if (el.matches('meta[property]')) return `property:${el.getAttribute('property')}`;
  if (el.matches('script[type="application/ld+json"]')) {
    try {
      return `ld:${JSON.parse(el.textContent)['@type']}`;
    } catch {
      return null;
    }
  }
  return null;
};

const dropPrerenderedTwins = (head) => {
  const live = new Set([...head.querySelectorAll('[data-react-helmet]')].map(keyOf).filter(Boolean));
  if (!live.size) return;
  for (const el of head.querySelectorAll(':scope > :not([data-react-helmet])')) {
    const key = keyOf(el);
    if (key && live.has(key)) el.remove();
  }
};

export const installPrerenderedHeadHandover = () => {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  new MutationObserver(() => dropPrerenderedTwins(document.head)).observe(document.head, { childList: true });
};
