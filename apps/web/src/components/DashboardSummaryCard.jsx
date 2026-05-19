
import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const DashboardSummaryCard = ({ icon: Icon, label, count, color = 'text-primary', onClick, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="rounded-2xl border-white/80 bg-white/90 p-5 shadow-[0_24px_70px_-42px_rgba(125,86,13,0.45)]">
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
    <Card className="overflow-hidden rounded-2xl border-white/80 bg-white/90 shadow-[0_24px_70px_-42px_rgba(125,86,13,0.45)]">
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`w-full p-5 text-left transition-all duration-200 sm:p-6 ${
          onClick ? 'group cursor-pointer hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-3 text-[2rem] font-bold tracking-tight sm:text-4xl">{count}</p>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60 sm:h-14 sm:w-14 ${color}`}>
            <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110 sm:h-6 sm:w-6" />
          </div>
        </div>
      </button>
    </Card>
  );
};

export default DashboardSummaryCard;
