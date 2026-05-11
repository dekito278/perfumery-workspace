import React, { useRef, useState } from 'react';
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
  hideFooterOnInputFocus = false,
  variant = 'sheet',
}) => {
  const touchStartRef = useRef(null);
  const [inputFocused, setInputFocused] = useState(false);

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
