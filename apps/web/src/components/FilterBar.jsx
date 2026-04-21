
import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

const FilterBar = ({ filters, onFilterChange, onClearAll, compact = false, disabled = false }) => {
  const activeFilterCount = filters.filter(f => f.value && f.value !== 'all').length;

  return (
    <div className={compact ? 'grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]' : 'filter-bar-container'}>
      {filters.map((filter) => (
        <div key={filter.id} className={compact ? 'min-w-0' : 'min-w-0 flex-1 sm:min-w-[180px] sm:flex-none'}>
          {!compact && (
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {filter.placeholder}
            </div>
          )}
          <Select
            value={filter.value}
            onValueChange={(value) => onFilterChange(filter.id, value)}
            disabled={disabled}
          >
            <SelectTrigger className={compact ? 'h-11 w-full rounded-2xl border-white/70 bg-white/88 px-3 text-foreground shadow-sm' : 'h-11 w-full rounded-2xl border-white/70 bg-white/88 text-foreground shadow-sm sm:w-48'}>
              {compact && filter.icon ? <filter.icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
              <SelectValue placeholder={filter.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value} className="capitalize">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      {activeFilterCount > 0 && (
        <Button
          variant="outline"
          onClick={onClearAll}
          disabled={disabled}
          className={compact ? 'h-11 w-full gap-2 rounded-2xl border-white/70 bg-white/88 px-4 xl:w-auto' : 'mt-[22px] h-11 w-full gap-2 rounded-2xl border-white/70 bg-white/88 px-4 sm:w-auto'}
        >
          <X className="w-4 h-4" />
          {!compact ? 'Clear filters' : 'Clear'}
          <Badge variant="secondary" className="ml-1 rounded-full">
            {activeFilterCount}
          </Badge>
        </Button>
      )}
    </div>
  );
};

export default FilterBar;
