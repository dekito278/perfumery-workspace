import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils.js';

const MobileAccordion = ({ title, meta, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mobile-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span>
          <span className="block text-sm font-bold text-[#1f2937]">{title}</span>
          {meta ? <span className="mt-1 block text-xs text-[#6b7280]">{meta}</span> : null}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-[#9ca3af] transition-transform duration-200 ease-out', open ? 'rotate-180' : '')} />
      </button>
      <div className="mobile-accordion-content" data-open={open}>
        <div className="mobile-accordion-content-inner">
          <div className="border-t border-[#e5e7eb] p-4">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default MobileAccordion;
