import React from 'react';
import { WEAR_FACETS, WEAR_KEYS, normalizeWear, toggleWearValue } from '@/utils/productWear.js';

// Chips, not dropdowns. Eighteen products have to be tagged by hand before the wardrobe means
// anything, so every extra tap is a reason it never gets done.
const WearPicker = ({ value, onChange, compact = false }) => {
  const wear = normalizeWear(value);

  return (
    <div className={compact ? 'grid gap-3' : 'grid gap-4'}>
      {WEAR_KEYS.map((facet) => (
        <div key={facet} className="grid gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {WEAR_FACETS[facet].label}
          </span>
          <div className="flex flex-wrap gap-2">
            {WEAR_FACETS[facet].options.map((option) => {
              const active = wear[facet].includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(toggleWearValue(wear, facet, option.value))}
                  // 44px, not h-9: the tagging page is fifty-odd taps on a phone, and 36px misses the touch target.
                  className={`min-h-[44px] rounded-full border px-3 text-xs font-bold transition ${
                    active
                      ? 'border-editorial-charcoal bg-editorial-charcoal text-white'
                      : 'border-[#e5e7eb] bg-white text-[#6b7280]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WearPicker;
