import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils.js';

const StickyBottomActionBar = ({
  children,
  className,
  contentClassName,
  fixed = false,
  // 'stay' by default: the bar carries the page's primary action, and every form page that left this at
  // 'hide' made Simpan/Bayar vanish the moment the buyer or admin started typing (audit round 7).
  keyboardBehavior = 'stay',
  reserveSpace = fixed,
  'aria-label': ariaLabel = 'Mobile actions',
}) => {
  const normalizedKeyboardBehavior = keyboardBehavior === 'hide' ? 'hide' : 'stay';
  const barRef = useRef(null);

  // Publish the bar's real height so the spacer below the page and the keyboard-avoidance scrolling both
  // reserve exactly what the bar occupies. It used to be a hardcoded 118px that was too much for a
  // one-row bar and too little once the keyboard shrank the spacer to 18px, hiding the last field behind
  // the bar (audit round 7).
  useEffect(() => {
    const node = barRef.current;
    if (!fixed || !node || typeof ResizeObserver === 'undefined') return undefined;

    const publishHeight = () => {
      const height = Math.round(node.getBoundingClientRect().height);
      if (height > 0) {
        document.documentElement.style.setProperty('--mobile-action-bar-height', `${height}px`);
      }
    };

    const observer = new ResizeObserver(publishHeight);
    observer.observe(node);
    publishHeight();

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--mobile-action-bar-height');
    };
  }, [fixed]);

  const actionBar = (
    <div
      ref={barRef}
      className={cn(
        'mobile-action-bar',
        fixed ? 'mobile-fixed-action' : 'mobile-inline-action',
        fixed && `mobile-action-bar--keyboard-${normalizedKeyboardBehavior}`,
        className
      )}
      role="region"
      aria-label={ariaLabel}
    >
      <div className={cn('mobile-action-bar-surface rounded-[18px] border border-[#e5e7eb] bg-white/96 p-2 shadow-xl shadow-slate-300/25 backdrop-blur', contentClassName)}>
        {children}
      </div>
    </div>
  );

  return (
    <>
      {fixed && typeof document !== 'undefined' ? createPortal(actionBar, document.body) : actionBar}
      {fixed && reserveSpace ? <div className="mobile-action-bar-spacer" aria-hidden="true" /> : null}
    </>
  );
};

export default StickyBottomActionBar;
