import React from 'react';
import { Button } from '@/components/ui/button.jsx';

const PaginationOrLoadMore = ({ visibleCount, totalCount, onLoadMore, loading = false }) => {
  if (visibleCount >= totalCount) {
    return totalCount ? (
      <div className="py-2 text-center text-[11px] font-semibold text-[#9ca3af]">Showing {totalCount} of {totalCount}</div>
    ) : null;
  }

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 py-2">
      <div className="text-[11px] font-semibold text-[#9ca3af]">Showing 1-{visibleCount} of {totalCount}</div>
      <Button type="button" variant="outline" onClick={onLoadMore} disabled={loading} className="h-8 rounded-xl bg-white px-3 text-[11px]">
        {loading ? 'Loading...' : 'Load more'}
      </Button>
    </div>
  );
};

export default PaginationOrLoadMore;
