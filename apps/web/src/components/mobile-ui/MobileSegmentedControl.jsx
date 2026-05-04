import React from 'react';
import { cn } from '@/lib/utils.js';

const MobileSegmentedControl = ({ options = [], value, onChange, className }) => (
  <div className={cn('mobile-segment-scroll flex gap-1 overflow-x-auto rounded-2xl bg-[#ece8df] p-1', className)}>
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'h-10 shrink-0 whitespace-nowrap rounded-xl px-3 text-xs font-bold transition',
            active ? 'bg-white text-[#1f2937] shadow-sm' : 'text-[#6b7280]'
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export default MobileSegmentedControl;
