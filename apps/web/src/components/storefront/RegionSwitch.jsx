import React from 'react';
import { useStorefrontRegion } from '@/hooks/useStorefrontRegion.js';
import { REGION_EN, REGION_ID } from '@/utils/storefrontRegion.js';
import { useTranslate } from '@/hooks/useTranslate.js';

/**
 * Indonesia or International, as a control rather than a guess.
 *
 * Deliberately NOT a question on entry. A gate before the shop costs visitors who would otherwise have
 * looked, and an Indonesian who taps "international" by mistake is shown prices 3,5x higher and leaves.
 * The guess still decides the default, so the German customer it was built for chooses nothing at all —
 * this is here for the visitor it reads wrong, and for Dekito, who could not otherwise see his own
 * international shop from Indonesia.
 *
 * Two labels rather than a flag: a flag claims to know a country, and this only knows which price list
 * the visitor wants.
 */
const RegionSwitch = ({ className = '' }) => {
  const { region, setRegion } = useStorefrontRegion();
  const { t } = useTranslate();

  return (
    <div role="group" aria-label={t('region.label')} className={`ng-region ${className}`.trim()}>
      {[
        { value: REGION_ID, label: 'ID', title: t('region.idTitle') },
        { value: REGION_EN, label: 'EN', title: t('region.enTitle') },
      ].map((option) => (
        // 44px both ways: these two switch the whole shop into a language the reader may not read, so
        // they are the last pair on the page that can be allowed to be small (measured 31 and 35px wide
        // on the phone before the mobile UI audit).
        <button
          key={option.value}
          type="button"
          onClick={() => setRegion(option.value)}
          aria-pressed={region === option.value}
          title={option.title}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default RegionSwitch;
