import React from 'react';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

const MobileEmptyState = ({ icon: Icon = SearchX, title, description, action, onAction }) => (
  <div className="mobile-card flex min-h-[180px] flex-col items-center justify-center p-5 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
      <Icon className="h-5 w-5" />
    </div>
    <div className="mt-3 text-base font-bold text-[#1f2937]">{title}</div>
    {description ? <p className="mt-1.5 max-w-[260px] text-xs font-medium text-[#6b7280]">{description}</p> : null}
    {action && onAction ? (
      <Button type="button" onClick={onAction} className="mt-4 h-10 rounded-2xl text-xs">
        {action}
      </Button>
    ) : null}
  </div>
);

export default MobileEmptyState;
