import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer.jsx';
import { useMobileKeyboardAvoidance } from '@/hooks/useMobileKeyboardAvoidance.js';
import { cn } from '@/lib/utils.js';
import { triggerMobileHaptic } from '@/hooks/useMobileTouchFeedback.js';

const focusTargets = 'input, textarea, select, [contenteditable="true"], [role="combobox"], [cmdk-input]';
const MIN_KEYBOARD_SHEET_HEIGHT = 260;
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * MobileBottomSheet is for short, interruptible side tasks only:
 * confirmation, option picking, quick edits, or compact forms.
 *
 * Long-running primary flows belong on dedicated routes so they can use the
 * page scroller and avoid nested-scroll / keyboard conflicts on mobile.
 */
const MobileBottomSheet = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  hideFooterOnInputFocus = true,
}) => {
  const contentRef = useRef(null);
  const touchStartRef = useRef(null);
  const [inputFocused, setInputFocused] = useState(false);
  useMobileKeyboardAvoidance(open);

  useEffect(() => {
    if (!open) return undefined;

    const html = document.documentElement;
    const body = document.body;
    const previousStyles = {
      htmlOverscrollBehavior: html.style.overscrollBehavior,
      overflow: body.style.overflow,
    };

    html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overscrollBehavior = previousStyles.htmlOverscrollBehavior;
      body.style.overflow = previousStyles.overflow;
    };
  }, [open]);

  useIsomorphicLayoutEffect(() => {
    if (!open) return undefined;

    const content = contentRef.current;
    if (!content) return undefined;
    let frameId = 0;
    const settleTimers = [];

    const updateViewportMetrics = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const layoutHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
        const visualHeight = viewport?.height || window.innerHeight || layoutHeight;
        const offsetTop = viewport?.offsetTop || 0;
        const keyboardOffset = Math.max(0, layoutHeight - visualHeight - offsetTop);
        const topGap = inputFocused ? 4 : 10;
        const visibleHeight = Math.min(layoutHeight, visualHeight + offsetTop);
        const availableHeight = Math.max(MIN_KEYBOARD_SHEET_HEIGHT, visibleHeight - topGap);

        content.style.setProperty('--mobile-bottom-sheet-available-height', `${availableHeight}px`);
        content.style.setProperty('--mobile-bottom-sheet-keyboard-offset', `${keyboardOffset}px`);
      });
    };

    const scheduleSettledUpdates = () => {
      updateViewportMetrics();
      [80, 180, 320].forEach((delay) => {
        settleTimers.push(window.setTimeout(updateViewportMetrics, delay));
      });
    };

    scheduleSettledUpdates();
    window.visualViewport?.addEventListener('resize', updateViewportMetrics);
    window.visualViewport?.addEventListener('scroll', updateViewportMetrics);
    window.addEventListener('resize', updateViewportMetrics);
    window.addEventListener('orientationchange', scheduleSettledUpdates);

    return () => {
      window.cancelAnimationFrame(frameId);
      settleTimers.forEach((timerId) => window.clearTimeout(timerId));
      window.visualViewport?.removeEventListener('resize', updateViewportMetrics);
      window.visualViewport?.removeEventListener('scroll', updateViewportMetrics);
      window.removeEventListener('resize', updateViewportMetrics);
      window.removeEventListener('orientationchange', scheduleSettledUpdates);
      content.style.removeProperty('--mobile-bottom-sheet-available-height');
      content.style.removeProperty('--mobile-bottom-sheet-keyboard-offset');
    };
  }, [inputFocused, open]);

  const handleTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    const scrollContainer = contentRef.current?.querySelector?.('.mobile-bottom-sheet-scroll');
    const startedOnHeader = Boolean(event.target?.closest?.('[data-mobile-sheet-drag-zone]'));
    const startedAtTop = !scrollContainer || scrollContainer.scrollTop <= 2;
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      startedOnHeader,
      startedAtTop,
      startedAt: performance.now(),
    };
  };

  const handleTouchEnd = (event) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches?.[0];
    touchStartRef.current = null;
    if (!start || !touch) return;

    const deltaY = touch.clientY - start.y;
    const deltaX = Math.abs(touch.clientX - start.x);
    const duration = Math.max(performance.now() - start.startedAt, 1);
    const velocity = deltaY / duration;
    const deliberatePull = deltaY > 112 || (deltaY > 84 && velocity > 0.42);
    const eligibleZone = start.startedOnHeader || start.startedAtTop;
    if (eligibleZone && deliberatePull && deltaX < 56) {
      triggerMobileHaptic('light');
      onOpenChange?.(false);
    }
  };

  const handleFocusCapture = (event) => {
    if (!hideFooterOnInputFocus) return;
    setInputFocused(Boolean(event.target?.matches?.(focusTargets)));
  };

  const handleBlurCapture = (event) => {
    if (!hideFooterOnInputFocus) return;

    window.setTimeout(() => {
      const activeElement = document.activeElement;
      setInputFocused(Boolean(activeElement?.matches?.(focusTargets)));
    }, 0);
  };

  const footerVisible = Boolean(footer) && !(hideFooterOnInputFocus && inputFocused);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        ref={contentRef}
        className={cn(
          'mobile-bottom-sheet-content border-[#e5e7eb]',
          inputFocused && 'mobile-bottom-sheet-keyboard-active'
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
      >
        <DrawerHeader className="mobile-sheet-drag-zone text-left" data-mobile-sheet-drag-zone>
          <DrawerTitle className="text-lg">{title}</DrawerTitle>
          <DrawerDescription className={description ? 'text-xs' : 'sr-only'}>
            {description || `${title} sheet`}
          </DrawerDescription>
        </DrawerHeader>
        <div className={cn('mobile-bottom-sheet-scroll px-4 pb-4', footerVisible && 'mobile-bottom-sheet-scroll-with-footer')}>{children}</div>
        {footer ? (
          <div
            className={cn(
              'mobile-bottom-sheet-footer border-t border-[#e5e7eb] bg-white',
              footerVisible ? 'mobile-overlay-footer-visible' : 'mobile-overlay-footer-hidden'
            )}
          >
            <div className="p-4">{footer}</div>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
};

export default MobileBottomSheet;
