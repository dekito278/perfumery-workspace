import { useEffect } from 'react';

/**
 * The browser's own "leave site?" prompt, while there is work that has not been saved.
 *
 * All four formula composer pages had NO protection of any kind: closing the tab or hitting reload
 * threw the composition away without a word. The product forms and the journal editor already do this;
 * the composer — where the longest sessions happen — did not.
 *
 * Adapted rather than copied from saas-perfumers: its version also exported a confirmDiscardIfDirty()
 * built on window.confirm, which this repo replaced with confirmAction() in #121 and now forbids by
 * guard. The create pages already ask through confirmAction on their own back buttons, so only the
 * beforeunload half was actually missing.
 */
export const useUnsavedChangesWarning = (enabled) => {
  useEffect(() => {
    if (!enabled) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      // Chrome needs returnValue set; the text itself is ignored by every modern browser.
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled]);
};

export default useUnsavedChangesWarning;
