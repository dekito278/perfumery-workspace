import { useEffect } from 'react';
import { logMobileRenderIssue } from '@/utils/mobileRenderMonitoring.js';

const EMPTY_SECTION_DELAY_MS = 900;

export const useMobileRenderSectionMonitor = ({
  active = true,
  loading = false,
  section,
  visibleCount = 0,
  expectedCount,
  reason,
}) => {
  useEffect(() => {
    if (!active || loading || visibleCount > 0 || !section) return undefined;

    const timeoutId = window.setTimeout(() => {
      logMobileRenderIssue('empty-section', {
        section,
        visibleCount,
        expectedCount,
        reason,
      }, {
        throttleKey: `empty-section:${section}:${reason || 'unknown'}`,
      });
    }, EMPTY_SECTION_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [active, expectedCount, loading, reason, section, visibleCount]);
};
