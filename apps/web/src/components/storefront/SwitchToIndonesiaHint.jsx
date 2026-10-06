import React from 'react';
import { useStorefrontRegion } from '@/hooks/useStorefrontRegion.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { REGION_ID } from '@/utils/storefrontRegion.js';

/**
 * The way back, for the reader the region guessed wrong about.
 *
 * The region is a GUESS about the reader, not proof of where the parcel goes. An Indonesian who reads
 * English, or anyone shipping to an Indonesian address, is quoted in dollars and offered an export
 * parcel they do not need — and the rupiah price, the voucher box and the domestic courier all live in
 * the other shop. One line and one tap.
 *
 * It read "In the English shop the cart is not offered" and called itself the reason hiding the cart was
 * safe. That was true from 18 Sep to 6 Oct 2026; the English shop has its own cart now, and this is a
 * correction for a wrong guess rather than a way around a missing feature.
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
