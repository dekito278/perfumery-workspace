import React from 'react';
import { cn } from '@/lib/utils.js';

const StickyBottomActionBar = ({ children, className, fixed = false }) => (
  <div className={cn(fixed ? 'mobile-fixed-action' : 'mobile-inline-action', className)}>
    <div className="rounded-[18px] border border-[#e5e7eb] bg-white/96 p-2 shadow-xl shadow-slate-300/25 backdrop-blur">
      {children}
    </div>
  </div>
);

export default StickyBottomActionBar;
