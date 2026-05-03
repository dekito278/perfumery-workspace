import React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

const MobileSearchBar = ({ value, onChange, placeholder = 'Search...', disabled = false }) => (
  <div className="relative">
    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
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
        aria-label="Clear search"
      >
        <X className="h-4 w-4" />
      </Button>
    ) : null}
  </div>
);

export default MobileSearchBar;
