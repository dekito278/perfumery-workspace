import React from 'react';
import { AlertCircle, CheckCircle2, Info, LoaderCircle, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';

const icons = {
  empty: SearchX,
  error: AlertCircle,
  info: Info,
  loading: LoaderCircle,
  success: CheckCircle2,
};

const toneClasses = {
  empty: 'border-[#e7e2d7] bg-white text-[#6b7280]',
  error: 'border-rose-100 bg-rose-50 text-rose-700',
  info: 'border-sky-100 bg-sky-50 text-sky-700',
  loading: 'border-amber-100 bg-amber-50 text-amber-700',
  success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
};

const iconClasses = {
  empty: 'bg-[#f3f4f6] text-[#6b7280]',
  error: 'bg-white/80 text-rose-700',
  info: 'bg-white/80 text-sky-700',
  loading: 'bg-white/80 text-amber-700',
  success: 'bg-white/80 text-emerald-700',
};

const MobileStatePanel = ({
  action,
  children,
  className,
  description,
  eyebrow,
  icon,
  onAction,
  secondaryAction,
  onSecondaryAction,
  title,
  tone = 'empty',
}) => {
  const Icon = icon || icons[tone] || icons.empty;
  const loading = tone === 'loading';
  const success = tone === 'success';

  return (
    <section
      className={cn(
        'mobile-state-panel mobile-card flex min-h-[180px] flex-col items-center justify-center border p-5 text-center',
        toneClasses[tone] || toneClasses.empty,
        success && 'mobile-success-pulse',
        className
      )}
      role={tone === 'error' ? 'alert' : tone === 'loading' ? 'status' : undefined}
      aria-live={tone === 'loading' ? 'polite' : tone === 'error' ? 'assertive' : undefined}
    >
      <span className={cn('grid h-12 w-12 place-items-center rounded-xl', iconClasses[tone] || iconClasses.empty)}>
        <Icon className={cn('h-5 w-5', loading && 'animate-spin')} aria-hidden="true" />
      </span>
      {eyebrow ? <p className="mt-3 text-[10px] font-bold uppercase">{eyebrow}</p> : null}
      {title ? <h2 className={cn('text-base font-bold text-[#1f2937]', eyebrow ? 'mt-1' : 'mt-3')}>{title}</h2> : null}
      {description ? <p className="mt-1.5 max-w-[280px] text-xs font-medium leading-relaxed text-[#6b7280]">{description}</p> : null}
      {children}
      {(action && onAction) || (secondaryAction && onSecondaryAction) ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {secondaryAction && onSecondaryAction ? (
            <Button type="button" variant="outline" onClick={onSecondaryAction} className="mobile-interactive mobile-pressable h-10 rounded-xl bg-white px-4 text-xs">
              {secondaryAction}
            </Button>
          ) : null}
          {action && onAction ? (
            <Button type="button" onClick={onAction} className="mobile-interactive mobile-pressable h-10 rounded-xl px-4 text-xs">
              {action}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default MobileStatePanel;
