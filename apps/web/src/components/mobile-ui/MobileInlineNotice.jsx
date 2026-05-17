import React from 'react';
import { AlertCircle, CheckCircle2, Info, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils.js';

const config = {
  error: {
    icon: AlertCircle,
    className: 'border-rose-100 bg-rose-50 text-rose-700',
  },
  info: {
    icon: Info,
    className: 'border-sky-100 bg-sky-50 text-sky-700',
  },
  loading: {
    icon: LoaderCircle,
    className: 'border-amber-100 bg-amber-50 text-amber-800',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  },
};

const MobileInlineNotice = ({ tone = 'info', title, description, className }) => {
  const { icon: Icon, className: toneClassName } = config[tone] || config.info;
  const loading = tone === 'loading';

  return (
    <div className={cn('rounded-2xl border px-3 py-2.5', toneClassName, tone === 'success' && 'mobile-success-pulse', className)}>
      <div className="flex items-start gap-2.5">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', loading && 'animate-spin')} aria-hidden="true" />
        <div className="min-w-0">
          {title ? <div className="text-xs font-bold">{title}</div> : null}
          {description ? <p className="mt-0.5 text-[11px] font-medium leading-relaxed opacity-90">{description}</p> : null}
        </div>
      </div>
    </div>
  );
};

export default MobileInlineNotice;
