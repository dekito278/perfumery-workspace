import React from 'react';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

const MobileEmptyState = ({ icon: Icon = SearchX, title, description, action, onAction }) => (
  <div className="mobile-card flex min-h-[220px] flex-col items-center justify-center p-6 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
      <Icon className="h-6 w-6" />
    </div>
    <div className="mt-4 text-lg font-bold text-[#1f2937]">{title}</div>
    {description ? <p className="mt-2 text-sm text-[#6b7280]">{description}</p> : null}
    {action && onAction ? (
      <Button type="button" onClick={onAction} className="mt-5 rounded-2xl">
        {action}
      </Button>
    ) : null}
  </div>
);

export default MobileEmptyState;
