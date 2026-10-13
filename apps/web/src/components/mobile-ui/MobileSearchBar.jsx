import React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

// Both strings a user hears here come from the caller. The shop is bilingual and Studio is not, so a
// default baked in below would be read out in the wrong language on one side or the other; the defaults
// that remain are Studio's, and buyerTextComesFromTheMessageFile.selfcheck.mjs makes every buyer-facing
// caller override them.
const MobileSearchBar = ({
  value,
  onChange,
  placeholder = 'Search...',
  clearLabel = 'Clear search',
  disabled = false,
}) => (
  <div className="relative">
    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
    <input
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-2xl border border-[#e5e7eb] bg-white py-2 pl-11 pr-12 text-sm font-medium outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100 disabled:opacity-60"
    />
    {value ? (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onChange('')}
        className="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 rounded-xl"
        aria-label={clearLabel}
      >
        <X className="h-4 w-4" />
      </Button>
    ) : null}
  </div>
);

export default MobileSearchBar;
