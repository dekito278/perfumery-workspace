import { useEffect, useRef } from 'react';

const focusTargets = 'input, textarea, select, [contenteditable="true"], [role="combobox"], [cmdk-input]';
const SETTLE_DELAYS = [0, 80, 180, 320];
const SAFE_TOP_GAP = 18;
const SAFE_BOTTOM_GAP = 28;
const keyboardAnchorSelectors = [
  '[data-mobile-keyboard-anchor]',
  'label',
  '.space-y-1',
  '.space-y-2',
  '.space-y-3',
].join(', ');

const isScrollable = (element) => {
  if (!element || element === document.body || element === document.documentElement) {
    return false;
  }

  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  return /(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight > element.clientHeight + 1;
};

const findScrollContainer = (element) => {
  let current = element?.parentElement;
  while (current) {
    if (isScrollable(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return window;
};

const getVisibleBounds = () => {
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop || 0;
  const height = viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;

  return {
    top: top + SAFE_TOP_GAP,
    bottom: top + height - SAFE_BOTTOM_GAP,
  };
};

const getKeyboardAnchor = (element) => {
  const explicitAnchor = element.closest?.('[data-mobile-keyboard-anchor]');
  if (explicitAnchor) return explicitAnchor;

  const labelWrapper = element.closest?.('label');
  if (labelWrapper) return labelWrapper;

  const contextualWrapper = element.parentElement?.closest?.(keyboardAnchorSelectors);
  return contextualWrapper || element;
};

const scrollElementIntoSafeView = (element, behavior = 'smooth') => {
  if (!element?.matches?.(focusTargets)) return;

  const anchor = getKeyboardAnchor(element);
  const rect = anchor.getBoundingClientRect();
  const { top, bottom } = getVisibleBounds();
  const scrollContainer = findScrollContainer(anchor);
  const isTextarea = element.matches('textarea');
  const contextPadding = isTextarea ? 24 : 12;

  if (rect.top >= top && rect.bottom <= bottom) {
    return;
  }

  const targetDelta = rect.bottom > bottom
    ? rect.bottom - bottom + contextPadding
    : rect.top - top - contextPadding;

  if (scrollContainer === window) {
    window.scrollBy({ top: targetDelta, behavior });
    return;
  }

  scrollContainer.scrollBy({ top: targetDelta, behavior });
};

export const useMobileKeyboardAvoidance = (enabled = true) => {
  const settleTimersRef = useRef([]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const clearSettleTimers = () => {
      settleTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      settleTimersRef.current = [];
    };

    const scheduleFocusedElementAdjustment = (behavior = 'smooth') => {
      clearSettleTimers();
      SETTLE_DELAYS.forEach((delay) => {
        settleTimersRef.current.push(window.setTimeout(() => {
          scrollElementIntoSafeView(document.activeElement, delay === 0 ? behavior : 'auto');
        }, delay));
      });
    };

    const handleFocusIn = (event) => {
      if (!event.target?.matches?.(focusTargets)) return;
      scheduleFocusedElementAdjustment('smooth');
    };

    const handleViewportChange = () => {
      if (!document.activeElement?.matches?.(focusTargets)) return;
      scheduleFocusedElementAdjustment('auto');
    };

    document.addEventListener('focusin', handleFocusIn);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    return () => {
      clearSettleTimers();
      document.removeEventListener('focusin', handleFocusIn);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, [enabled]);
};

export default useMobileKeyboardAvoidance;
