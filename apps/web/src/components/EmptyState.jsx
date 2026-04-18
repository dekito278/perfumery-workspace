
import React from 'react';
import { Button } from '@/components/ui/button';

const EmptyState = ({ icon: Icon, title, description, action, actionIcon: ActionIcon, onAction }) => {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="empty-state-title">{title}</h3>
      {description && (
        <p className="empty-state-description">{description}</p>
      )}
      {action && onAction && (
        <Button onClick={onAction} className="gap-2 h-10">
          {ActionIcon && <ActionIcon className="w-4 h-4" />}
          {action}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
