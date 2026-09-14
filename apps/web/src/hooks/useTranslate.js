import { useCallback } from 'react';
import { useStorefrontRegion } from '@/hooks/useStorefrontRegion.js';
import { translate } from '@/i18n/messages.js';

/**
 * The storefront's strings, in the language of the shop this visitor chose.
 *
 * The region comes from useStorefrontRegion and nowhere else — the same one value the price panel and
 * the header switch read. A component resolving its own would let one paragraph be English while the
 * button under it is Indonesian.
 */
export const useTranslate = () => {
  const { region, isInternational } = useStorefrontRegion();
  const t = useCallback((key, vars) => translate(region, key, vars), [region]);
  return { t, region, isInternational };
};

export default useTranslate;
