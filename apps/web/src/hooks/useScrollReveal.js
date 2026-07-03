import { useEffect, useRef } from 'react';

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
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
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

            // Stagger children if flagged
            if (entry.target.hasAttribute('data-stagger-children')) {
              staggerChildren(entry.target);
            }
          }
        });
      },
      { threshold, rootMargin }
    );

    // (Re)scan the subtree: observe not-yet-revealed [data-reveal] nodes, and immediately
    // reveal freshly-added children of stagger containers whose parent is already visible.
    // Keeps content visible when a list changes (e.g. switching catalog category tabs)
    // without a full remount — otherwise the new nodes stay opacity:0 until a page refresh.
    const scan = () => {
      container.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((el) => observer.observe(el));
      container.querySelectorAll('[data-stagger-children].is-visible').forEach((parent) => staggerChildren(parent, 40));
    };

    scan();

    const mutationObserver = new MutationObserver(() => scan());
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [threshold, rootMargin]);

  return containerRef;
}

/**
 * Lightweight hook for a single element reveal.
 */
export function useRevealOnce(options = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

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
  }, []);

  return ref;
}

export default useScrollReveal;
