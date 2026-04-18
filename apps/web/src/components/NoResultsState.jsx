
import React from 'react';
import { Button } from '@/components/ui/button';
import { SearchX } from 'lucide-react';

const NoResultsState = ({ searchTerm, onClearFilters }) => {
  return (
    <div className="empty-state">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <SearchX className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="empty-state-title">No results found</h3>
      <p className="empty-state-description">
        {searchTerm
          ? `No items match "${searchTerm}". Try adjusting your search or filters.`
          : 'No items match your current filters. Try adjusting your filters.'}
      </p>
      {onClearFilters && (
        <Button onClick={onClearFilters} variant="outline" className="h-10">
          Clear filters
        </Button>
      )}
    </div>
  );
};

export default NoResultsState;
