import React from 'react';
import { WandSparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Spinner } from '@/components/ui/spinner.jsx';
import StorefrontHeader from '@/components/storefront/StorefrontHeader.jsx';
import { cn } from '@/lib/utils.js';

const previewCards = Array.from({ length: 3 }, (_, index) => `storefront-loading-card-${index}`);

const StorefrontLoadingState = ({
  className,
  title = 'Menyiapkan Solivagant',
  description = 'Sebentar, halaman sedang disiapkan.',
  mode = 'page',
}) => {
  return (
    <main
      className={cn('storefront-loading min-h-screen bg-[#f7f8f2] text-[#0b130c]', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <StorefrontHeader />

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:px-8">
        <div className="rounded-[28px] border border-[#263d27]/12 bg-white/86 p-5 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#263d27]/15 bg-[#eef2e8] px-3 py-1 text-xs font-bold uppercase text-[#263d27]">
            <Spinner className="h-4 w-4" />
            Memuat
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-none sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-xl text-sm font-semibold leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Skeleton className="h-11 w-36 rounded-2xl" />
            <Skeleton className="h-11 w-32 rounded-2xl" />
          </div>
        </div>

        {mode === 'product' ? (
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <Skeleton className="min-h-[520px] rounded-[28px]" />
            <div className="rounded-[28px] border border-[#263d27]/12 bg-white/82 p-5">
              <Skeleton className="h-8 w-32 rounded-full" />
              <Skeleton className="mt-6 h-12 w-3/4" />
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-3 h-4 w-5/6" />
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {previewCards.map((card) => (
              <div key={card} className="rounded-[28px] border border-[#263d27]/12 bg-white/82 p-3 shadow-sm">
                <Skeleton className="aspect-[4/3] rounded-2xl" />
                <div className="p-3">
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <Skeleton className="h-8 w-24 rounded-full" />
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
                      <WandSparkles className="h-4 w-4" />
                    </span>
                  </div>
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
