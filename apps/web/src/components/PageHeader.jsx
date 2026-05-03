
import React from 'react';
import { Button } from '@/components/ui/button';

const PageHeader = ({
  title,
  description,
  action,
  actionIcon: ActionIcon,
  onAction,
  secondaryAction,
  secondaryActionIcon: SecondaryActionIcon,
  onSecondaryAction,
  eyebrow = null,
}) => {
  return (
    <div className="page-header page-header-card">
      <div className="flex-1 min-w-0">
        {eyebrow ? <div className="page-header-eyebrow">{eyebrow}</div> : null}
        <h1 className="text-3xl font-bold sm:text-4xl" style={{ letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {(action && onAction) || (secondaryAction && onSecondaryAction) ? (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          {action && onAction ? (
            <Button
              type="button"
              onClick={onAction}
              className="h-11 w-full gap-2 rounded-2xl px-5 shadow-[0_16px_35px_-20px_hsl(var(--primary)/0.8)] sm:w-auto"
            >
              {ActionIcon && <ActionIcon className="w-4 h-4" />}
              {action}
            </Button>
          ) : null}
          {secondaryAction && onSecondaryAction ? (
            <Button
              type="button"
              variant="outline"
              onClick={onSecondaryAction}
              className="h-11 w-full gap-2 rounded-2xl border-white/70 bg-white/75 px-5 sm:w-auto"
            >
              {SecondaryActionIcon && <SecondaryActionIcon className="w-4 h-4" />}
              {secondaryAction}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default PageHeader;
