
import React from 'react';
import { Button } from '@/components/ui/button';
import { SearchX } from 'lucide-react';

const NoResultsState = ({ searchTerm, onClearFilters }) => {
  return (
    <div className="empty-state rounded-[32px] border border-dashed border-border/80 bg-white/70 shadow-[0_30px_80px_-50px_rgba(98,84,57,0.35)]">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-muted/70">
        <SearchX className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="empty-state-title">Nothing matches yet</h3>
      {onClearFilters && (
        <Button onClick={onClearFilters} variant="outline" className="h-11 rounded-2xl border-white/70 bg-white/80 px-5">
          Clear filters
        </Button>
      )}
    </div>
  );
};

export default NoResultsState;
