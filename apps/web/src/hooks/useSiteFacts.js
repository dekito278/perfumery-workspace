import { useEffect, useSyncExternalStore } from 'react';
import { getSiteFacts, loadSiteFacts, subscribeSiteFacts } from '@/services/siteSettingsService.js';

/** The shop facts Dekito sets in Studio, defaults first and the saved row as soon as it arrives. */
export const useSiteFacts = () => {
  useEffect(() => { loadSiteFacts(); }, []);
  return useSyncExternalStore(subscribeSiteFacts, getSiteFacts, getSiteFacts);
};

export default useSiteFacts;
