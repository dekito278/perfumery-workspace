import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils.js';

const renderActionIcon = (icon) => {
  if (icon === 'cart') return <ShoppingBag className="h-4 w-4" />;
  return icon || null;
};

const StorefrontHeader = ({
  actions,
  backLabel,
  backTo,
  className,
  onBack,
  previewLabel,
  showLogo = !backLabel,
}) => {
  const headerActions = actions || [
    { to: '/cart', label: 'Keranjang', icon: 'cart', iconOnly: true },
    { to: '/catalog', label: 'Katalog' },
  ];
  const backContent = (
    <>
      <ArrowLeft className="h-4 w-4" />
      {backLabel}
    </>
  );

  return (
    <section className={cn('border-b border-[#263d27]/15 bg-[#050705] text-[#eef2e8]', className)}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        {backLabel ? (
          onBack ? (
            <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-[#eef2e8]">
              {backContent}
            </button>
          ) : (
            <Link to={backTo || '/home'} className="inline-flex items-center gap-2 text-sm font-bold text-[#eef2e8]">
              {backContent}
            </Link>
          )
        ) : showLogo ? (
          <Link to="/home" className="inline-flex items-center gap-2 rounded-2xl bg-[#eef2e8] px-3 py-2 shadow-sm shadow-black/20">
            <img
              src="/brand/solivagant-logo.png"
              alt="Solivagant"
              className="h-6 w-6 rounded-full object-contain"
              loading="eager"
              decoding="async"
              width="24"
              height="24"
            />
            <span className="text-sm font-bold tracking-[0.12em] text-[#0b130c]">Solivagant</span>
          </Link>
        ) : <span aria-hidden="true" />}

        <div className="flex items-center gap-2">
          {previewLabel ? (
            <span className="rounded-2xl border border-amber-200/40 bg-amber-300/15 px-4 py-2 text-sm font-bold text-amber-100">
              {previewLabel}
            </span>
          ) : null}
          {headerActions.map((action) => {
            const icon = renderActionIcon(action.icon);
            const content = action.iconOnly ? (
              <>
                {icon}
                <span className="sr-only">{action.label}</span>
              </>
            ) : (
              <>
                {icon}
                {action.label}
              </>
            );
            const actionClassName = cn(
              action.iconOnly
                ? 'grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/8 text-[#eef2e8]'
                : 'inline-flex h-10 items-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-4 text-sm font-bold text-[#eef2e8]',
              action.className
            );

            return (
              <Link key={`${action.to}-${action.label}`} to={action.to} className={actionClassName} aria-label={action.iconOnly ? action.label : undefined}>
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StorefrontHeader;
