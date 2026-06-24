import React from 'react';
import { AlertCircle, Loader2, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';

const icons = {
  empty: SearchX,
  error: AlertCircle,
  loading: Loader2,
};

const toneClasses = {
  empty: 'bg-[#f7f1e5] text-[#1b1a16]',
  error: 'bg-rose-50 text-rose-700',
  loading: 'bg-amber-50 text-amber-700',
};

const StateBlock = ({
  action,
  className,
  description,
  icon,
  onAction,
  title,
  tone = 'empty',
}) => {
  const Icon = icon || icons[tone] || icons.empty;
  const loading = tone === 'loading';

  return (
    <section className={cn('rounded-2xl border border-dashed bg-white p-8 text-center shadow-sm', className)}>
      <span className={cn('mx-auto grid h-12 w-12 place-items-center rounded-2xl', toneClasses[tone] || toneClasses.empty)}>
        <Icon className={cn('h-5 w-5', loading ? 'animate-spin' : '')} aria-hidden="true" />
      </span>
      <h2 className="mt-3 text-xl font-bold text-[#1b1a16]">{title}</h2>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm font-medium leading-relaxed text-muted-foreground">{description}</p> : null}
      {action && onAction ? (
        <Button type="button" onClick={onAction} className="mt-4 h-11 rounded-2xl">
          {action}
        </Button>
      ) : null}
    </section>
  );
};

export default StateBlock;
