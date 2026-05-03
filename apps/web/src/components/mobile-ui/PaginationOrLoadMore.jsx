import React from 'react';
import { Button } from '@/components/ui/button.jsx';

const PaginationOrLoadMore = ({ visibleCount, totalCount, onLoadMore, loading = false }) => {
  if (visibleCount >= totalCount) {
    return totalCount ? (
      <div className="py-4 text-center text-xs font-semibold text-[#9ca3af]">All {totalCount} items visible</div>
    ) : null;
  }

  return (
    <div className="py-4">
      <Button type="button" variant="outline" onClick={onLoadMore} disabled={loading} className="h-12 w-full rounded-2xl bg-white">
        {loading ? 'Loading...' : `Load more (${visibleCount}/${totalCount})`}
      </Button>
    </div>
  );
};

export default PaginationOrLoadMore;
