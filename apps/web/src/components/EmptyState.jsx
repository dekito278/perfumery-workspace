
import React from 'react';
import { Button } from '@/components/ui/button';

const EmptyState = ({ icon: Icon, title, description, action, actionIcon: ActionIcon, onAction }) => {
  return (
    <div className="empty-state rounded-2xl border border-dashed border-primary/20 bg-white/70 shadow-[0_30px_80px_-50px_rgba(125,86,13,0.45)]">
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="w-8 h-8" />
        </div>
      )}
      <h3 className="empty-state-title">{title}</h3>
      {description ? (
        <p className="mt-2 mb-5 max-w-xl text-center text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action && onAction && (
        <Button onClick={onAction} className={`h-11 gap-2 rounded-xl px-5 ${description ? '' : 'mt-5'}`}>
          {ActionIcon && <ActionIcon className="w-4 h-4" />}
          {action}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
