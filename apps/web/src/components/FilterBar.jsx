
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
        <Select
          key={filter.id}
          value={filter.value}
          onValueChange={(value) => onFilterChange(filter.id, value)}
        >
          <SelectTrigger className="w-full sm:w-48 text-foreground">
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
      ))}
      {activeFilterCount > 0 && (
        <Button variant="outline" onClick={onClearAll} className="gap-2">
          <X className="w-4 h-4" />
          Clear filters
          <Badge variant="secondary" className="ml-1">
            {activeFilterCount}
          </Badge>
        </Button>
      )}
    </div>
  );
};

export default FilterBar;
