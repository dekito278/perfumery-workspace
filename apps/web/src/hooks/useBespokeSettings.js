import { useEffect, useState } from 'react';
import { getBespokeSettings, getBespokeSettingsAsync } from '@/services/bespokeSettingsService.js';

export const useBespokeSettings = () => {
  const [settings, setSettings] = useState(() => getBespokeSettings());
  const [loading, setLoading] = useState(true);

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

  Object.defineProperty(settings, 'loading', {
    configurable: true,
    enumerable: false,
    value: loading,
  });
  return settings;
};
