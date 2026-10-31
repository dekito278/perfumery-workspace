import { useTranslate } from '@/hooks/useTranslate.js';
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
  const { t } = useTranslate();
  // Both shops have a cart since 2026-10-06. The default action list is the only place this header names
  // it; a caller that passes its own actions is responsible for its own.
  const headerActions = actions || [
    { to: '/cart', labelKey: 'nav.cart', icon: 'cart', iconOnly: true },
    { to: '/catalog', labelKey: 'nav.catalog' },
  ];
  const backContent = (
    <>
      <ArrowLeft className="h-4 w-4" />
      {backLabel}
    </>
  );

  return (
    <section className={cn('border-b border-ng-bone/10 bg-ng-ink text-ng-bone', className)}>
      <div className="mx-auto flex max-w-[1344px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
        {backLabel ? (
          onBack ? (
            <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-2 font-ng-mono text-[11px] uppercase tracking-[0.18em] text-ng-bone">
              {backContent}
            </button>
          ) : (
            <Link to={backTo || '/home'} className="inline-flex min-h-[44px] items-center gap-2 font-ng-mono text-[11px] uppercase tracking-[0.18em] text-ng-bone">
              {backContent}
            </Link>
          )
        ) : showLogo ? (
          <Link to="/home" className="font-ng-display text-[20px] font-medium tracking-[0.28em] text-ng-bone no-underline">
            SOLIVAGANT
          </Link>
        ) : <span aria-hidden="true" />}

        <div className="flex items-center gap-2">
          {previewLabel ? (
            <span className="border border-ng-ember/60 px-4 py-2 font-ng-mono text-[11px] uppercase tracking-[0.16em] text-ng-bone">
              {previewLabel}
            </span>
          ) : null}
          {headerActions.map((action) => {
            const icon = renderActionIcon(action.icon);
            // Callers may still pass a plain `label` (Studio previews do); the storefront's own actions
            // carry a key. Both render, only one is translated.
            const label = action.labelKey ? t(action.labelKey) : action.label;
            const content = action.iconOnly ? (
              <>
                {icon}
                <span className="sr-only">{label}</span>
              </>
            ) : (
              <>
                {icon}
                {label}
              </>
            );
            const actionClassName = cn(
              action.iconOnly
                ? 'grid h-11 w-11 place-items-center border border-ng-bone/30 text-ng-bone'
                : 'inline-flex min-h-[44px] items-center gap-2 border border-ng-bone/30 px-4 font-ng-mono text-[11px] uppercase tracking-[0.18em] text-ng-bone',
              action.className
            );

            return (
              <Link key={`${action.to}-${action.labelKey || action.label}`} to={action.to} className={actionClassName} aria-label={action.iconOnly ? label : undefined}>
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
