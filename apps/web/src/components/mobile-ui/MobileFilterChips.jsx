import React from 'react';
import { cn } from '@/lib/utils.js';

const MobileFilterChips = ({ options = [], value, onChange, className }) => (
  <div className={cn('mobile-segment-scroll -mx-1 flex gap-2 overflow-x-auto px-1 py-1', className)}>
    {options.map((option) => {
      const active = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition',
            active
              ? 'border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-200'
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
