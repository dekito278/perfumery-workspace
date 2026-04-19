
import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

const FilterBar = ({ filters, onFilterChange, onClearAll }) => {
  const activeFilterCount = filters.filter(f => f.value && f.value !== 'all').length;

  return (
    <div className="filter-bar-container">
      {filters.map((filter) => (
        <div key={filter.id} className="min-w-[180px] flex-1 sm:flex-none">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {filter.placeholder}
          </div>
          <Select
            value={filter.value}
            onValueChange={(value) => onFilterChange(filter.id, value)}
          >
            <SelectTrigger className="h-11 w-full rounded-2xl border-white/70 bg-white/80 text-foreground shadow-sm sm:w-48">
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
        <Button variant="outline" onClick={onClearAll} className="mt-[22px] h-11 gap-2 rounded-2xl border-white/70 bg-white/80 px-4">
          <X className="w-4 h-4" />
          Clear filters
          <Badge variant="secondary" className="ml-1 rounded-full">
            {activeFilterCount}
          </Badge>
        </Button>
      )}
    </div>
  );
};

export default FilterBar;
