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
    if (!container) return;

    const elements = container.querySelectorAll('[data-reveal]');
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);

            // Stagger children if flagged
            if (entry.target.hasAttribute('data-stagger-children')) {
              const children = entry.target.children;
              Array.from(children).forEach((child, i) => {
                child.style.transitionDelay = `${i * 80}ms`;
                child.classList.add('is-visible');
              });
            }
          }
        });
      },
      { threshold, rootMargin }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
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
