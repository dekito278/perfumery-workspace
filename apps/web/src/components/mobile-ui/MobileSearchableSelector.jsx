import React, { useMemo, useState } from 'react';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import MobileSearchBar from '@/components/mobile-ui/MobileSearchBar.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';

const MobileSearchableSelector = ({
  open,
  onOpenChange,
  title,
  description,
  options = [],
  onSelect,
  placeholder = 'Search options...',
  getLabel = (option) => option.label || option.name,
  getMeta = (option) => option.meta || option.code || option.category,
}) => {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(7);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options;
    }
    return options.filter((option) => [getLabel(option), getMeta(option)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized)));
  }, [getLabel, getMeta, options, query]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <MobileBottomSheet open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="mobile-sticky-search">
        <MobileSearchBar value={query} onChange={(value) => {
          setQuery(value);
          setVisibleCount(7);
        }} placeholder={placeholder} />
      </div>
      <div className="space-y-2">
        {visible.map((option) => (
          <button
            key={option.id || option.value || getLabel(option)}
            type="button"
            onClick={() => {
              onSelect(option);
              onOpenChange(false);
            }}
            className="mobile-card flex w-full items-center justify-between gap-3 p-4 text-left"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[#1f2937]">{getLabel(option)}</span>
              {getMeta(option) ? <span className="mt-1 block truncate text-xs text-[#6b7280]">{getMeta(option)}</span> : null}
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Select</span>
          </button>
        ))}
      </div>
      <PaginationOrLoadMore
        visibleCount={visible.length}
        totalCount={filtered.length}
        onLoadMore={() => setVisibleCount((current) => current + 7)}
      />
    </MobileBottomSheet>
  );
};

export default MobileSearchableSelector;
