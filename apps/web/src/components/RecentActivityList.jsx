
import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const RecentActivityList = ({ title, items, columns, emptyMessage, onRowClick, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="rounded-[28px] border-white/80 bg-white/90 p-5 shadow-[0_24px_70px_-42px_rgba(125,86,13,0.35)] sm:p-6">
        <h3 className="text-base font-semibold mb-4">{title}</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-[28px] border-white/80 bg-white/90 p-5 shadow-[0_24px_70px_-42px_rgba(125,86,13,0.35)] sm:p-6">
      <h3 className="text-base font-semibold mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item, index) => (
            <button
              key={item.id || index}
              type="button"
              onClick={() => onRowClick && onRowClick(item)}
              className={`flex w-full items-center justify-between rounded-2xl px-3 py-3.5 text-left transition-colors ${
                onRowClick ? 'cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30' : ''
              }`}
            >
              {columns.map((column, colIndex) => (
                <div key={colIndex} className={column.className || ''}>
                  {column.render ? column.render(item) : item[column.key]}
                </div>
              ))}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};

export default RecentActivityList;
