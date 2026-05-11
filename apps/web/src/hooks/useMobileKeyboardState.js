import { useEffect, useRef, useState } from 'react';

const focusTargets = 'input, textarea, select, [contenteditable="true"], [role="combobox"], [cmdk-input]';
const MIN_VISUAL_VIEWPORT_HEIGHT = 260;

const getKeyboardMetrics = () => {
  if (typeof window === 'undefined') {
    return { keyboardOffset: 0, visibleHeight: 0 };
  }

  const viewport = window.visualViewport;
  const layoutHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  const visualHeight = viewport?.height || window.innerHeight || layoutHeight;
  const offsetTop = viewport?.offsetTop || 0;
  const visibleHeight = Math.max(MIN_VISUAL_VIEWPORT_HEIGHT, Math.min(layoutHeight, visualHeight + offsetTop));
  const keyboardOffset = Math.max(0, layoutHeight - visualHeight - offsetTop);

  return { keyboardOffset, visibleHeight };
};

export const useMobileKeyboardState = () => {
  const [keyboardActive, setKeyboardActive] = useState(false);
  const frameRef = useRef(0);
  const blurTimerRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const root = document.documentElement;

    const updateMetrics = () => {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(() => {
        const { keyboardOffset, visibleHeight } = getKeyboardMetrics();
        root.style.setProperty('--mobile-keyboard-offset', `${keyboardOffset}px`);
        root.style.setProperty('--mobile-visual-viewport-height', `${visibleHeight}px`);
      });
    };

    const updateFocusState = () => {
      const activeElement = document.activeElement;
      setKeyboardActive(Boolean(activeElement?.matches?.(focusTargets)));
      updateMetrics();
    };

    const handleFocusIn = (event) => {
      window.clearTimeout(blurTimerRef.current);
      setKeyboardActive(Boolean(event.target?.matches?.(focusTargets)));
      updateMetrics();
    };

    const handleFocusOut = () => {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = window.setTimeout(updateFocusState, 40);
    };

    updateMetrics();
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.visualViewport?.addEventListener('resize', updateMetrics);
    window.visualViewport?.addEventListener('scroll', updateMetrics);
    window.addEventListener('resize', updateMetrics);
    window.addEventListener('orientationchange', updateMetrics);

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      window.clearTimeout(blurTimerRef.current);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.visualViewport?.removeEventListener('resize', updateMetrics);
      window.visualViewport?.removeEventListener('scroll', updateMetrics);
      window.removeEventListener('resize', updateMetrics);
      window.removeEventListener('orientationchange', updateMetrics);
      root.style.removeProperty('--mobile-keyboard-offset');
      root.style.removeProperty('--mobile-visual-viewport-height');
    };
  }, []);

  return keyboardActive;
};
