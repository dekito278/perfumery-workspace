import React from 'react';
import { cn } from '@/lib/utils.js';

const StickyBottomActionBar = ({
  children,
  className,
  contentClassName,
  fixed = false,
  keyboardBehavior = 'hide',
  reserveSpace = false,
  'aria-label': ariaLabel = 'Mobile actions',
}) => (
  <>
    <div
      className={cn(
        'mobile-action-bar',
        fixed ? 'mobile-fixed-action' : 'mobile-inline-action',
        fixed && `mobile-action-bar--keyboard-${keyboardBehavior}`,
        className
      )}
      role="region"
      aria-label={ariaLabel}
    >
      <div className={cn('mobile-action-bar-surface rounded-[18px] border border-[#e5e7eb] bg-white/96 p-2 shadow-xl shadow-slate-300/25 backdrop-blur', contentClassName)}>
        {children}
      </div>
    </div>
    {fixed && reserveSpace ? <div className="mobile-action-bar-spacer" aria-hidden="true" /> : null}
  </>
);

export default StickyBottomActionBar;
