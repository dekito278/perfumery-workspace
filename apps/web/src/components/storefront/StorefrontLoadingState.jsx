import React from 'react';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Spinner } from '@/components/ui/spinner.jsx';
import StorefrontHeader from '@/components/storefront/StorefrontHeader.jsx';
import { cn } from '@/lib/utils.js';
import { useTranslate } from '@/hooks/useTranslate.js';

const previewRows = Array.from({ length: 4 }, (_, index) => `storefront-loading-row-${index}`);

const StorefrontLoadingState = ({
  className,
  title = null,
  description = null,
  mode = 'page',
}) => {
  // Defaults come from the message file rather than the parameter list: a default argument is evaluated
  // outside the component's render and cannot see the chosen region, so the loading screen would have
  // stayed Indonesian in the English shop.
  const { t } = useTranslate();
  const heading = title ?? t('loading.title');
  const body = description ?? t('loading.body');

  return (
    <main
      className={cn('storefront-loading min-h-screen bg-ng-ink font-ng-body text-ng-bone', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <StorefrontHeader />

      <section className="mx-auto grid max-w-[1344px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:items-start lg:px-12">
        <div>
          <p className="inline-flex items-center gap-3 font-ng-mono text-[11px] uppercase tracking-[0.2em] text-ng-ash">
            <Spinner className="h-4 w-4" aria-hidden="true" />
            {t('pdp.loading')}
          </p>
          <h1 className="mt-6 font-ng-display text-5xl font-light leading-none sm:text-6xl">{heading}</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ng-dust">{body}</p>
        </div>

        {mode === 'product' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="aspect-[4/5] rounded-none bg-ng-card" />
            <div className="flex flex-col gap-4">
              <Skeleton className="h-4 w-32 rounded-none bg-ng-card" />
              <Skeleton className="h-14 w-3/4 rounded-none bg-ng-card" />
              <Skeleton className="h-4 w-full rounded-none bg-ng-card" />
              <Skeleton className="h-4 w-5/6 rounded-none bg-ng-card" />
              <Skeleton className="mt-6 h-14 w-full rounded-none bg-ng-card" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {previewRows.map((row) => (
              <div key={row} className="grid grid-cols-[72px_1fr] items-center gap-6 border-b border-ng-bone/10 py-5">
                <Skeleton className="h-[90px] w-[72px] rounded-none bg-ng-card" />
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-7 w-1/2 rounded-none bg-ng-card" />
                  <Skeleton className="h-3 w-1/3 rounded-none bg-ng-card" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default StorefrontLoadingState;
