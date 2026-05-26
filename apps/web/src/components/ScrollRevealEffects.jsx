import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const revealSelector = [
  '.mobile-card',
  '.mobile-soft-card',
  '.mobile-page > section',
  '.mobile-page > article',
  '.dashboard-hero',
  '.dashboard-hero-panel',
  '.dashboard-hero-stat',
  '.table-container',
  '.detail-section',
  'main > section',
].join(',');

const ignoredSelector = [
  '.mobile-bottom-nav',
  '.mobile-commerce-header',
  '.mobile-pwa-install',
  '[role="dialog"]',
  '[data-vaul-drawer]',
  '.sonner-toaster',
  '.solivagant-editorial-home',
].join(',');

const publicStorefrontPaths = [
  '/',
  '/home',
  '/catalog',
  '/products',
  '/bespoke',
  '/materials',
  '/journal',
  '/track-order',
  '/cart',
  '/checkout',
  '/hug',
  '/chant-nocturne',
  '/jaipong',
  '/porte-vers-le-paradis',
  '/trace-daventure',
  '/not-found',
];

const isPublicStorefrontPath = (pathname) => (
  publicStorefrontPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
);

const ScrollRevealEffects = () => {
  const location = useLocation();

  useEffect(() => {
    if (isPublicStorefrontPath(location.pathname)) {
      document.querySelectorAll('.scroll-reveal').forEach((element) => {
        element.classList.remove('scroll-reveal', 'is-visible');
        element.style.removeProperty('--reveal-delay');
      });
      return undefined;
    }

    if (location.pathname.startsWith('/mobile')) {
      document.querySelectorAll('.scroll-reveal').forEach((element) => {
        element.classList.remove('scroll-reveal', 'is-visible');
        element.style.removeProperty('--reveal-delay');
      });
      return undefined;
    }

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.12,
    });

    const scan = () => {
      const elements = Array.from(document.querySelectorAll(revealSelector))
        .filter((element) => !element.closest(ignoredSelector))
        .filter((element) => !element.classList.contains('scroll-reveal'));

      elements.forEach((element, index) => {
        element.classList.add('scroll-reveal');
        element.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 42}ms`);
        observer.observe(element);
      });
    };

    scan();

    const mutationObserver = new MutationObserver(() => {
      window.requestAnimationFrame(scan);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, [location.pathname, location.search]);

  return null;
};

export default ScrollRevealEffects;
