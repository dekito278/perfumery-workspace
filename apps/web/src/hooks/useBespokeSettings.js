import { useEffect, useState } from 'react';
import { getBespokeSettings } from '@/services/bespokeSettingsService.js';

export const useBespokeSettings = () => {
  const [settings, setSettings] = useState(() => getBespokeSettings());

  useEffect(() => {
    const syncSettings = () => setSettings(getBespokeSettings());
    window.addEventListener('storage', syncSettings);
    window.addEventListener('dekito:bespoke-settings-updated', syncSettings);
    return () => {
      window.removeEventListener('storage', syncSettings);
      window.removeEventListener('dekito:bespoke-settings-updated', syncSettings);
    };
  }, []);

  return settings;
};
