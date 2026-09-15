import React from 'react';
import { useStorefrontRegion } from '@/hooks/useStorefrontRegion.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { REGION_ID } from '@/utils/storefrontRegion.js';

/**
 * The way back, for the one person the English shop would otherwise strand.
 *
 * In the English shop the cart is not offered — but the region is a GUESS about the reader, not proof of
 * where the parcel goes. An Indonesian who reads English, or anyone shipping to an Indonesian address,
 * would otherwise find no way to buy at all. This is one line and one tap, and it is the reason hiding
 * the cart is safe rather than merely tidy.
 */
const SwitchToIndonesiaHint = ({ className = '' }) => {
  const { t, isInternational } = useTranslate();
  const { setRegion } = useStorefrontRegion();

  if (!isInternational) return null;

  return (
    <p className={`text-xs font-semibold leading-relaxed text-muted-foreground ${className}`}>
      {t('intl.fromIndonesia')}{' '}
      <button
        type="button"
        onClick={() => setRegion(REGION_ID)}
        className="font-bold text-editorial-charcoal underline underline-offset-2"
      >
        {t('intl.switchToId')}
      </button>
    </p>
  );
};

export default SwitchToIndonesiaHint;
