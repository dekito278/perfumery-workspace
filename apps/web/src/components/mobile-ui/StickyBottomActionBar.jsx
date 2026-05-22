import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils.js';

const StickyBottomActionBar = ({
  children,
  className,
  contentClassName,
  fixed = false,
  keyboardBehavior = 'hide',
  reserveSpace = fixed,
  'aria-label': ariaLabel = 'Mobile actions',
}) => {
  const normalizedKeyboardBehavior = keyboardBehavior === 'stay' ? 'stay' : 'hide';
  const actionBar = (
    <div
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
