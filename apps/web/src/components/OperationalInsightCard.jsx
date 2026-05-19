
import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const OperationalInsightCard = ({ 
  title, 
  icon: Icon, 
  items, 
  emptyMessage, 
  color = 'text-primary', 
  badgeVariant = 'default',
  onItemClick, 
  isLoading 
}) => {
  if (isLoading) {
    return (
      <Card className="rounded-2xl border-white/80 bg-white/90 p-5 shadow-[0_24px_70px_-42px_rgba(125,86,13,0.35)] sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 p-5 shadow-[0_24px_70px_-42px_rgba(125,86,13,0.35)] sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg bg-muted/50 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <button
              key={item.id || index}
              type="button"
              onClick={() => onItemClick && onItemClick(item)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-3.5 text-left transition-colors ${
                onItemClick ? 'cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30' : ''
              }`}
            >
              <span className="text-sm font-medium truncate flex-1">{item.name}</span>
              <Badge variant={badgeVariant} className="ml-2 shrink-0">
                {item.badge}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};

export default OperationalInsightCard;
