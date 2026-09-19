import { useEffect, useMemo, useState } from 'react';
import { getBespokeSettings, getBespokeSettingsAsync, translateBespokeSettings } from '@/services/bespokeSettingsService.js';
import { useStorefrontRegion } from '@/hooks/useStorefrontRegion.js';

/**
 * @param forShop  true for the two storefront bespoke pages, which must show the options in the shop's
 *                 own language. Studio's editor leaves it off on purpose: it SAVES these rows, and a
 *                 translated label handed to it would be written back over the Indonesian one.
 */
export const useBespokeSettings = ({ forShop = false } = {}) => {
  const [settings, setSettings] = useState(() => getBespokeSettings());
  const [loading, setLoading] = useState(true);
  const { isInternational } = useStorefrontRegion();

  useEffect(() => {
    let isMounted = true;
    const syncSettings = async () => {
      setLoading(true);
      const nextSettings = await getBespokeSettingsAsync();
      if (isMounted) {
        setSettings(nextSettings);
        setLoading(false);
      }
    };

    window.addEventListener('storage', syncSettings);
    window.addEventListener('dekito:bespoke-settings-updated', syncSettings);
    syncSettings();

    return () => {
      isMounted = false;
      window.removeEventListener('storage', syncSettings);
      window.removeEventListener('dekito:bespoke-settings-updated', syncSettings);
    };
  }, []);

  const shown = useMemo(
    () => (forShop ? translateBespokeSettings(settings, isInternational) : settings),
    [settings, forShop, isInternational],
  );

  Object.defineProperty(shown, 'loading', {
    configurable: true,
    enumerable: false,
    value: loading,
  });
  return shown;
};
