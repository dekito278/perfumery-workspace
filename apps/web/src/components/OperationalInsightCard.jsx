
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
      <Card className="p-6">
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
    <Card className="p-6">
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
            <div
              key={item.id || index}
              onClick={() => onItemClick && onItemClick(item)}
              className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
                onItemClick ? 'cursor-pointer hover:bg-muted/50' : ''
              }`}
            >
              <span className="text-sm font-medium truncate flex-1">{item.name}</span>
              <Badge variant={badgeVariant} className="ml-2 shrink-0">
                {item.badge}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default OperationalInsightCard;
