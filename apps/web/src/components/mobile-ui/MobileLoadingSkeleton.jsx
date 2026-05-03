import React from 'react';
import { Skeleton } from '@/components/ui/skeleton.jsx';

const MobileLoadingSkeleton = ({ count = 4 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="mobile-card p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-full rounded-xl" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default MobileLoadingSkeleton;
