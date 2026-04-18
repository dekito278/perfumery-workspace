
import React from 'react';
import { Button } from '@/components/ui/button';

const PageHeader = ({ title, description, action, actionIcon: ActionIcon, onAction }) => {
  return (
    <div className="page-header">
      <div className="flex-1 min-w-0">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        {description && (
          <p className="text-base text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && onAction && (
        <Button onClick={onAction} className="gap-2 shrink-0 h-10">
          {ActionIcon && <ActionIcon className="w-4 h-4" />}
          {action}
        </Button>
      )}
    </div>
  );
};

export default PageHeader;
