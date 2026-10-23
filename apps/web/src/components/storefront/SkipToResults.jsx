import React from 'react';
import { useTranslate } from '@/hooks/useTranslate.js';

/**
 * The first thing a keyboard reaches on the catalogue: a way past the filters.
 *
 * MEASURED ON THE BUILT SITE, 2026-10-23: twenty-six tab stops stand between the top of the catalogue
 * and the first bottle — the header, six category pills, the search box, and thirteen wear chips. A
 * keyboard or switch user who wants to browse rather than filter pays all of them, on every visit.
 * Both of the shops Dekito pointed at ship this link ("SKIP TO RESULTS LIST"); it is the one piece of
 * their markup that is purely a kindness.
 *
 * Invisible until focused, which is the whole trick: it costs a mouse user nothing and saves a keyboard
 * user twenty-five presses. The target takes tabIndex={-1} so the browser moves focus there rather than
 * only scrolling, which is the half of this that is usually forgotten.
 */
const SkipToResults = ({ targetId = 'catalog-results', className = '' }) => {
  const { t } = useTranslate();
  return (
    <a href={`#${targetId}`} className={`skip-to-results ${className}`.trim()}>
      {t('catalog.skipToResults')}
    </a>
  );
};

export default SkipToResults;
