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
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span>
          <span className="block text-sm font-bold text-[#1f2937]">{title}</span>
          {meta ? <span className="mt-1 block text-xs text-[#6b7280]">{meta}</span> : null}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-[#6b7280] transition-transform duration-200 ease-out', open ? 'rotate-180' : '')} />
      </button>
      {/* inert while closed. A closed section is only squeezed to zero height, so its fields stayed in the
          tab order: the phone keyboard's "next" arrow walked into them and the owner typed into a box nobody
          could see. React 18 does not know the attribute, so it is passed as a string or not at all. */}
      <div className="mobile-accordion-content" data-open={open} inert={open ? undefined : ''}>
        <div className="mobile-accordion-content-inner">
          <div className="border-t border-[#e5e7eb] p-4">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default MobileAccordion;
