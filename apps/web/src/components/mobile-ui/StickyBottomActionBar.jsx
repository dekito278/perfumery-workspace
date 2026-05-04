import React from 'react';
import { cn } from '@/lib/utils.js';

const StickyBottomActionBar = ({ children, className, fixed = false }) => (
  <div className={cn(fixed ? 'mobile-fixed-action' : 'mobile-sticky-action', className)}>
    <div className="rounded-[24px] border border-[#e5e7eb] bg-white/95 p-2 shadow-2xl shadow-slate-300/40 backdrop-blur">
      {children}
    </div>
  </div>
);

export default StickyBottomActionBar;
