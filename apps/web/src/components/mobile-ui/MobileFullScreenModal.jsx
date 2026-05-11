import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';

const focusTargets = 'input, textarea, select, [contenteditable="true"], [role="combobox"], [cmdk-input]';
const MIN_KEYBOARD_MODAL_HEIGHT = 260;
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const MobileFullScreenModal = ({ open, title, children, footer, onClose, hideFooterOnInputFocus = true }) => {
  const modalRef = useRef(null);
  const [inputFocused, setInputFocused] = useState(false);

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

    const modal = modalRef.current;
    if (!modal) return undefined;
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
        const visibleHeight = Math.min(layoutHeight, visualHeight + offsetTop);
        const availableHeight = Math.max(MIN_KEYBOARD_MODAL_HEIGHT, visibleHeight);

        modal.style.setProperty('--mobile-fullscreen-modal-height', `${availableHeight}px`);
        modal.style.setProperty('--mobile-fullscreen-modal-bottom', `${keyboardOffset}px`);
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
      modal.style.removeProperty('--mobile-fullscreen-modal-height');
      modal.style.removeProperty('--mobile-fullscreen-modal-bottom');
    };
  }, [open]);

  const handleFocusCapture = (event) => {
    if (!hideFooterOnInputFocus) return;
    setInputFocused(Boolean(event.target?.matches?.(focusTargets)));
  };

  const handleBlurCapture = () => {
    if (!hideFooterOnInputFocus) return;

    window.setTimeout(() => {
      const activeElement = document.activeElement;
      setInputFocused(Boolean(activeElement?.matches?.(focusTargets)));
    }, 0);
  };

  const footerVisible = Boolean(footer) && !(hideFooterOnInputFocus && inputFocused);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={modalRef}
      className={cn('fixed inset-0 z-[80] mobile-fullscreen-modal', inputFocused && 'mobile-fullscreen-modal-keyboard-active')}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
    >
      <div className="mobile-page-wide flex h-full flex-col">
        <header className="mb-4 flex items-center gap-3">
          <div className="min-w-0 flex-1 text-xl font-bold">{title}</div>
          <Button type="button" variant="outline" size="icon" onClick={onClose} className="rounded-2xl bg-white">
            <X className="h-5 w-5" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">{children}</div>
        {footerVisible ? <div className="pt-3">{footer}</div> : null}
      </div>
    </div>
  );
};

export default MobileFullScreenModal;
