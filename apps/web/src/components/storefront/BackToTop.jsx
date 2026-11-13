import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTranslate } from '@/hooks/useTranslate.js';

const BackToTop = () => {
  const { t } = useTranslate();
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  // Not on the pages where a form ends in a button: it floated over "Buat order & bayar" on the bespoke
  // checkout (third visitor audit, 13 Nov 2026). Those pages are read top to bottom anyway.
  const onFormPage = /^\/(cart|checkout|bespoke|payment|pay)(\/|$)/.test(pathname);

  // Stands aside once the footer is on screen: it sat on the footer's email button while scrolling
  // (seventh visitor audit, 13 Nov 2026), and at the footer the top is one swipe away anyway.
  const [footerInView, setFooterInView] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setFooterInView(entry.isIntersecting));
    observer.observe(footer);
    return () => observer.disconnect();
  }, [pathname]);
  const shown = visible && !footerInView;

  const scrollUp = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  if (onFormPage) return null;

  return (
    <button
      type="button"
      className={`back-to-top${shown ? ' is-visible' : ''}`}
      onClick={scrollUp}
      aria-label={t('a11y.backToTop')}
      tabIndex={shown ? 0 : -1}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
};

export default BackToTop;
