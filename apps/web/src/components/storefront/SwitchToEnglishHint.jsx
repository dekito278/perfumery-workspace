import React, { useState } from 'react';
import { useStorefrontRegion } from '@/hooks/useStorefrontRegion.js';
import { translate } from '@/i18n/messages.js';
import { detectOverseasVisitor } from '@/utils/overseasVisitor.js';
import { REGION_EN, readRegionFromPath } from '@/utils/storefrontRegion.js';

/**
 * The way to the English shop, for a reader on an Indonesian address whose browser looks foreign.
 *
 * Since 2026-11-02 the address decides the language (resolveRegion), so the guess that used to rewrite the
 * page into English and dollars only offers the other address now. In English whatever the shop around it
 * says: the reader it is shown to is the one who cannot read Indonesian.
 *
 * Decided on the first render from the address, not from the region: the region is Indonesian until its
 * effect runs, so a bar appearing a frame later would push the whole page down, and on /en it would flash.
 */
const SwitchToEnglishHint = () => {
  const { setRegion } = useStorefrontRegion();
  const [shown] = useState(() => typeof window !== 'undefined' && !readRegionFromPath() && detectOverseasVisitor());
  if (!shown) return null;

  return (
    <p lang="en" className="ng-abroad-hint">
      {translate(REGION_EN, 'intl.fromAbroad')}{' '}
      <button type="button" onClick={() => setRegion(REGION_EN)}>
        {translate(REGION_EN, 'intl.switchToEn')}
      </button>
    </p>
  );
};

export default SwitchToEnglishHint;
