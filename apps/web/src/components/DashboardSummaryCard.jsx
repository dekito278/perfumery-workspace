
import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const DashboardSummaryCard = ({ icon: Icon, label, count, color = 'text-primary', onClick, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="w-12 h-12 rounded-xl" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`p-6 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-2">{label}</p>
          <p className="text-3xl font-bold">{count}</p>
        </div>
        <div className={`p-3 rounded-xl bg-muted/50 ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
};

export default DashboardSummaryCard;
