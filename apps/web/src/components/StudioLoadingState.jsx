import React from 'react';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Spinner } from '@/components/ui/spinner.jsx';
import { cn } from '@/lib/utils.js';

const listRows = Array.from({ length: 6 }, (_, index) => `loading-row-${index}`);
const summaryCards = Array.from({ length: 4 }, (_, index) => `loading-card-${index}`);

const StudioLoadingState = ({
  className,
  eyebrow = 'Loading workspace',
  title = 'Preparing your studio',
  description = 'Mengambil data terbaru dan menyiapkan tampilan desktop.',
  variant = 'list',
}) => {
  return (
    <section
      className={cn('studio-loading-state', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="studio-loading-header">
        <span className="studio-loading-icon">
          <Spinner className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="studio-loading-eyebrow">{eyebrow}</p>
          <h1 className="studio-loading-title">{title}</h1>
          {description ? <p className="studio-loading-description">{description}</p> : null}
        </div>
      </div>

      <div className="studio-loading-grid" aria-hidden="true">
        {summaryCards.map((card) => (
          <div key={card} className="studio-loading-card">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-8 w-16" />
            <Skeleton className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>

      {variant === 'detail' ? (
        <div className="studio-loading-detail" aria-hidden="true">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-4 h-10 w-2/3 max-w-xl" />
          <Skeleton className="mt-4 h-4 w-full max-w-2xl" />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          <Skeleton className="mt-6 h-64 rounded-2xl" />
        </div>
      ) : (
        <div className="studio-loading-table" aria-hidden="true">
          {listRows.map((row) => (
            <div key={row} className="studio-loading-row">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="mt-3 h-3 w-72 max-w-full" />
              </div>
              <Skeleton className="hidden h-8 w-24 rounded-full sm:block" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default StudioLoadingState;
