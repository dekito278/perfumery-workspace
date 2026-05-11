import React, { useEffect, useRef, useState } from 'react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer.jsx';
import { cn } from '@/lib/utils.js';

const focusTargets = 'input, textarea, select, [contenteditable="true"], [role="combobox"], [cmdk-input]';

const MobileBottomSheet = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  hideFooterOnInputFocus = true,
  variant = 'sheet',
}) => {
  const contentRef = useRef(null);
  const touchStartRef = useRef(null);
  const pageScrollRef = useRef(0);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    const body = document.body;
    const previousStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    pageScrollRef.current = window.scrollY || window.pageYOffset || 0;

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${pageScrollRef.current}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      body.style.overflow = previousStyles.overflow;
      body.style.position = previousStyles.position;
      body.style.top = previousStyles.top;
      body.style.left = previousStyles.left;
      body.style.right = previousStyles.right;
      body.style.width = previousStyles.width;
      window.scrollTo(0, pageScrollRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const content = contentRef.current;
    if (!content) return undefined;

    const updateViewportMetrics = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height || window.innerHeight;
      const offsetTop = viewport?.offsetTop || 0;
      const topGap = inputFocused ? 4 : 10;
      const availableHeight = Math.max(360, height - offsetTop - topGap);
      content.style.setProperty('--mobile-bottom-sheet-available-height', `${availableHeight}px`);
    };

    updateViewportMetrics();
    window.visualViewport?.addEventListener('resize', updateViewportMetrics);
    window.visualViewport?.addEventListener('scroll', updateViewportMetrics);
    window.addEventListener('resize', updateViewportMetrics);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewportMetrics);
      window.visualViewport?.removeEventListener('scroll', updateViewportMetrics);
      window.removeEventListener('resize', updateViewportMetrics);
      content.style.removeProperty('--mobile-bottom-sheet-available-height');
    };
  }, [inputFocused, open, variant]);

  const handleTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches?.[0];
    touchStartRef.current = null;
    if (!start || !touch) return;

    const deltaY = touch.clientY - start.y;
    const deltaX = Math.abs(touch.clientX - start.x);
    if (deltaY > 86 && deltaX < 72) {
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
          variant === 'fullscreen' && 'mobile-bottom-sheet-fullscreen',
          inputFocused && 'mobile-bottom-sheet-keyboard-active'
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
      >
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-lg">{title}</DrawerTitle>
          <DrawerDescription className={description ? 'text-xs' : 'sr-only'}>
            {description || `${title} sheet`}
          </DrawerDescription>
        </DrawerHeader>
        <div className={cn('mobile-bottom-sheet-scroll px-4 pb-4', footerVisible && 'mobile-bottom-sheet-scroll-with-footer')}>{children}</div>
        {footerVisible ? <div className="mobile-bottom-sheet-footer border-t border-[#e5e7eb] bg-white p-4">{footer}</div> : null}
      </DrawerContent>
    </Drawer>
  );
};

export default MobileBottomSheet;
