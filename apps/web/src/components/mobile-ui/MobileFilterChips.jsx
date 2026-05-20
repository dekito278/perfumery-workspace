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
            active
              ? 'mobile-selected border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-200'
              : 'border-[#e5e7eb] bg-white text-[#6b7280]'
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export default MobileFilterChips;
