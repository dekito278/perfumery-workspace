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

// The fixed action bar sits inside the visible viewport, right above the keyboard, so a field scrolled to
// the bottom of that viewport landed behind Simpan/Bayar. StickyBottomActionBar publishes its measured
// height; treat that as part of the obstruction (audit round 7).
const getActionBarHeight = () => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--mobile-action-bar-height');
  const height = Number.parseFloat(raw);
  return Number.isFinite(height) ? height : 0;
};

const getVisibleBounds = () => {
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop || 0;
  const height = viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;

  return {
    top: top + SAFE_TOP_GAP,
    bottom: top + height - SAFE_BOTTOM_GAP - getActionBarHeight(),
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

/**
 * How far to scroll so the focused field — with its label, when that fits — sits between the top gap and
 * the keyboard. Pure, so the guard runs it.
 *
 * The anchor is a guess: the nearest label, or failing that the nearest `.space-y-*` wrapper. On a phone
 * the wrapper is often a whole page section. The Fulfillment queue is one `.space-y-3` holding every order
 * card, so tapping "Kurir" in the first card scrolled the page until the LIST's bottom edge cleared the
 * keyboard — 682px, then 640, then 207 as the settle timers re-measured — and the field being typed into
 * left the screen at the top. Measured 2026-11-08. An anchor taller than the space it has to fit in can
 * only be shown by hiding the field, so it falls back to the field itself.
 */
export const keyboardScrollDelta = ({ field, anchor = field, bounds, padding = 12 }) => {
  const room = bounds.bottom - bounds.top;
  const target = anchor && anchor.bottom - anchor.top <= room ? anchor : field;
  if (target.top >= bounds.top && target.bottom <= bounds.bottom) return 0;
  // Taller than the room (a long textarea): show where typing starts, not where it ends.
  if (target.bottom - target.top > room || target.top < bounds.top) return target.top - bounds.top - padding;
  return target.bottom - bounds.bottom + padding;
};

const scrollElementIntoSafeView = (element, behavior = 'smooth') => {
  if (!element?.matches?.(focusTargets)) return;

  const anchor = getKeyboardAnchor(element);
  const scrollContainer = findScrollContainer(anchor);
  const targetDelta = keyboardScrollDelta({
    field: element.getBoundingClientRect(),
    anchor: anchor.getBoundingClientRect(),
    bounds: getVisibleBounds(),
    padding: element.matches('textarea') ? 24 : 12,
  });
  if (!targetDelta) return;

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
