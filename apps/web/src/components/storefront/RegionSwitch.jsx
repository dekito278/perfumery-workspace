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
    <div
      role="group"
      aria-label={t('region.label')}
      className={`inline-flex items-center rounded-full border border-editorial-stone/25 bg-white/90 p-0.5 text-[11px] font-bold ${className}`}
    >
      {[
        { value: REGION_ID, label: 'ID', title: t('region.idTitle') },
        { value: REGION_EN, label: 'EN', title: t('region.enTitle') },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setRegion(option.value)}
          aria-pressed={region === option.value}
          title={option.title}
          className={`rounded-full px-2.5 py-1 transition ${
            region === option.value
              ? 'bg-editorial-charcoal text-white'
              : 'text-editorial-charcoal/60'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default RegionSwitch;
