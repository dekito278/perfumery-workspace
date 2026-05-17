import React from 'react';
import { cn } from '@/lib/utils.js';
import { formatStatus } from '@/utils/formatting.js';

const toneByStatus = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ready_for_batch: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ready_for_product: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  converted_to_product: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  published_product: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  validated: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  draft: 'bg-slate-50 text-slate-600 border-slate-200',
  logged: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  in_review: 'bg-blue-50 text-blue-700 border-blue-200',
  produced: 'bg-blue-50 text-blue-700 border-blue-200',
  qc: 'bg-blue-50 text-blue-700 border-blue-200',
  planned: 'bg-slate-50 text-slate-600 border-slate-200',
  action_needed: 'bg-amber-50 text-amber-700 border-amber-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  archived: 'bg-zinc-50 text-zinc-500 border-zinc-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
};

const MobileStatusBadge = ({ status = 'draft', children, className, tone }) => {
  const key = String(tone || status || 'draft').toLowerCase();

  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold capitalize',
        ['active', 'approved', 'completed', 'ready_for_batch', 'ready_for_product', 'converted_to_product', 'published_product', 'validated'].includes(key) && 'mobile-success-pulse',
        toneByStatus[key] || 'bg-amber-50 text-amber-700 border-amber-200',
        className
      )}
    >
      {children || formatStatus(status || 'draft')}
    </span>
  );
};

export default MobileStatusBadge;
