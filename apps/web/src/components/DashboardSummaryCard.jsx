
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
    <Card className="overflow-hidden rounded-[28px] border-white/80 bg-white/90 shadow-[0_24px_70px_-42px_rgba(125,86,13,0.45)]">
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`w-full p-6 text-left transition-all duration-200 ${
          onClick ? 'group cursor-pointer hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-3 text-4xl font-bold tracking-tight">{count}</p>
          </div>
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 ${color}`}>
            <Icon className="w-6 h-6 transition-transform duration-200 group-hover:scale-110" />
          </div>
        </div>
      </button>
    </Card>
  );
};

export default DashboardSummaryCard;
