import React from 'react';
import { cn } from '@/lib/utils.js';

const MobileFilterChips = ({ options = [], value, onChange, className }) => (
  <div className={cn('mobile-filter-chip-wrap mobile-segment-scroll flex flex-nowrap gap-1.5 overflow-x-auto py-1', className)}>
    {options.map((option) => {
      const active = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'mobile-interactive mobile-pressable h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-[11px] font-bold transition',
            // #8a6a35, not #b08b4f: white on the decorative brass is 3.16:1 at 11px, measured on the
            // live catalogue, where WCAG AA asks 4.5. The palette already carries a darker brass for
            // exactly this reason — storefront.css calls it --editorial-brass-text — and white on it
            // reads 5.08:1. The lighter brass stays where it belongs, on the border and the shadow.
            active
              ? 'mobile-selected border-[#b08b4f] bg-[#8a6a35] text-white shadow-lg shadow-[#b08b4f]/20'
              : 'border-editorial-stone bg-white text-editorial-muted'
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export default MobileFilterChips;
