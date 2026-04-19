
import React from 'react';
import { Button } from '@/components/ui/button';

const PageHeader = ({ title, description, action, actionIcon: ActionIcon, onAction }) => {
  return (
    <div className="page-header page-header-card">
      <div className="flex-1 min-w-0">
        <div className="page-header-eyebrow">Workspace</div>
        <h1 className="mb-2 text-3xl font-bold sm:text-4xl" style={{ letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        {description && (
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>
      {action && onAction && (
        <Button
          onClick={onAction}
          className="h-11 w-full shrink-0 gap-2 rounded-2xl px-5 shadow-[0_16px_35px_-20px_hsl(var(--primary)/0.8)] sm:w-auto"
        >
          {ActionIcon && <ActionIcon className="w-4 h-4" />}
          {action}
        </Button>
      )}
    </div>
  );
};

export default PageHeader;
