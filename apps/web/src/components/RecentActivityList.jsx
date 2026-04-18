
import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const RecentActivityList = ({ title, items, columns, emptyMessage, onRowClick, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="p-6">
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
    <Card className="p-6">
      <h3 className="text-base font-semibold mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item, index) => (
            <div
              key={item.id || index}
              onClick={() => onRowClick && onRowClick(item)}
              className={`flex items-center justify-between py-3 px-2 rounded-lg transition-colors ${
                onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''
              }`}
            >
              {columns.map((column, colIndex) => (
                <div key={colIndex} className={column.className || ''}>
                  {column.render ? column.render(item) : item[column.key]}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default RecentActivityList;
