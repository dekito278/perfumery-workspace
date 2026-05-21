import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, WandSparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Spinner } from '@/components/ui/spinner.jsx';
import { cn } from '@/lib/utils.js';

const previewCards = Array.from({ length: 3 }, (_, index) => `storefront-loading-card-${index}`);

const StorefrontLoadingState = ({
  className,
  title = 'Preparing Solivagant',
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
      <section className="border-b border-[#263d27]/15 bg-[#050705] text-[#eef2e8]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/home" className="inline-flex items-center">
            <img
              src="/brand/solivagant-logo.png"
              alt="Solivagant"
              className="h-11 w-32 rounded-xl object-contain"
              loading="eager"
              decoding="async"
              width="128"
              height="44"
            />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/cart" className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/8" aria-label="Open cart">
              <ShoppingBag className="h-4 w-4" />
            </Link>
            <Link to="/catalog" className="inline-flex h-10 items-center rounded-2xl border border-white/15 bg-white/8 px-4 text-sm font-bold text-[#eef2e8]">
              Catalog
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:px-8">
        <div className="rounded-[28px] border border-[#263d27]/12 bg-white/86 p-5 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#263d27]/15 bg-[#eef2e8] px-3 py-1 text-xs font-bold uppercase text-[#263d27]">
            <Spinner className="h-4 w-4" />
            Loading
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
