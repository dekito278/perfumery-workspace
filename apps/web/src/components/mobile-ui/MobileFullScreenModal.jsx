import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';

const focusTargets = 'input, textarea, select, [contenteditable="true"], [role="combobox"], [cmdk-input]';

const MobileFullScreenModal = ({ open, title, children, footer, onClose, hideFooterOnInputFocus = true }) => {
  const modalRef = useRef(null);
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

    const modal = modalRef.current;
    if (!modal) return undefined;

    const updateViewportMetrics = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height || window.innerHeight;
      const offsetTop = viewport?.offsetTop || 0;
      const availableHeight = Math.max(360, height - offsetTop);
      modal.style.setProperty('--mobile-fullscreen-modal-height', `${availableHeight}px`);
    };

    updateViewportMetrics();
    window.visualViewport?.addEventListener('resize', updateViewportMetrics);
    window.visualViewport?.addEventListener('scroll', updateViewportMetrics);
    window.addEventListener('resize', updateViewportMetrics);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewportMetrics);
      window.visualViewport?.removeEventListener('scroll', updateViewportMetrics);
      window.removeEventListener('resize', updateViewportMetrics);
      modal.style.removeProperty('--mobile-fullscreen-modal-height');
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
