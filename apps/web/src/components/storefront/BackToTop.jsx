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

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollUp = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  if (onFormPage) return null;

  return (
    <button
      type="button"
      className={`back-to-top${visible ? ' is-visible' : ''}`}
      onClick={scrollUp}
      aria-label={t('a11y.backToTop')}
      tabIndex={visible ? 0 : -1}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
};

export default BackToTop;
