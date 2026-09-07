import { useCallback, useEffect, useState } from 'react';

/**
 * Scroll-reveal hook using IntersectionObserver.
 * Elements with `data-reveal` attribute get `.is-visible` added when scrolled into view.
 *
 * Usage:
 *   const revealRef = useScrollReveal();
 *   <section ref={revealRef}>
 *     <div data-reveal>I fade in</div>
 *     <div data-reveal="up">I slide up</div>
 *     <div data-reveal="stagger" data-stagger-children>
 *       <div>child 1</div> <div>child 2</div>
 *     </div>
 *   </section>
 */
export function useScrollReveal({ threshold = 0.12, rootMargin = '0px 0px -40px 0px' } = {}) {
  // A callback ref backed by state, not useRef. With useRef the effect ran once on mount and read
  // whatever was there — and a page that renders a loading branch first (PublicProductDetailPage does,
  // twice) had nothing there, so no observer was ever created. Every [data-reveal] on that page then
  // stayed at opacity 0 for good, including the add-to-cart button. State makes the effect re-run the
  // moment the real container mounts.
  const [container, setContainer] = useState(null);
  const containerRef = useCallback((node) => setContainer(node), []);

  useEffect(() => {
    if (!container) return undefined;

    const staggerChildren = (parent, step = 80) => {
      Array.from(parent.children).forEach((child, i) => {
        if (child.classList.contains('is-visible')) return;
        child.style.transitionDelay = `${i * step}ms`;
        child.classList.add('is-visible');
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);

            if (entry.target.hasAttribute('data-stagger-children')) {
              staggerChildren(entry.target);
            }
          }
        });
      },
      { threshold, rootMargin }
    );

    const textObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('text-revealed');
            textObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05 }
    );

    const scan = () => {
      container.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((el) => observer.observe(el));
      container.querySelectorAll('[data-stagger-children].is-visible').forEach((parent) => staggerChildren(parent, 40));
      container.querySelectorAll('[data-text-reveal]:not(.text-revealed)').forEach((el) => textObserver.observe(el));
    };

    scan();

    const mutationObserver = new MutationObserver(() => scan());
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      textObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [container, threshold, rootMargin]);

  return containerRef;
}

/**
 * Lightweight hook for a single element reveal.
 */
export function useRevealOnce(options = {}) {
  const [el, setEl] = useState(null);
  const ref = useCallback((node) => setEl(node), []);

  useEffect(() => {
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold: options.threshold || 0.15, rootMargin: options.rootMargin || '0px 0px -30px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [el, options.threshold, options.rootMargin]);

  return ref;
}

export default useScrollReveal;
