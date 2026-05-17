import React from 'react';
import { cn } from '@/lib/utils.js';

const MobileSegmentedControl = ({ options = [], value, onChange, className }) => {
  const normalizedOptions = (options || [])
    .map((option) => ({
      value: String(option?.value ?? '').trim(),
      label: String(option?.label ?? option?.value ?? '').trim(),
    }))
    .filter((option) => option.value && option.label);
  const normalizedValue = value === null || value === undefined ? '' : String(value);

  return (
    <div className={cn('mobile-segment-scroll flex gap-1 overflow-x-auto rounded-2xl bg-[#ece8df] p-1', className)}>
      {normalizedOptions.map((option) => {
        const active = option.value === normalizedValue;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'mobile-interactive mobile-pressable h-10 shrink-0 whitespace-nowrap rounded-xl px-3 text-xs font-bold transition',
              active ? 'mobile-selected bg-white text-[#1f2937] shadow-sm' : 'text-[#6b7280]'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default MobileSegmentedControl;
