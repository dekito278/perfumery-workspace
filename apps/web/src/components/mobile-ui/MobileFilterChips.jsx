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
              ? 'mobile-selected border-[#b08b4f] bg-[#b08b4f] text-white shadow-lg shadow-[#b08b4f]/20'
              : 'border-[#e5decf] bg-white text-[#6f695f]'
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export default MobileFilterChips;
