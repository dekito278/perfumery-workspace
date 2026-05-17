import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';

const MobileTopBar = ({
  title,
  subtitle,
  eyebrow,
  onBack,
  backLabel = 'Back',
  action,
  className,
}) => (
  <header className={cn('mb-3 flex min-w-0 items-center gap-3 pr-12 mobile-top-bar', className)}>
    {onBack ? (
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onBack}
        aria-label={backLabel}
        className="mobile-interactive mobile-pressable h-10 w-10 shrink-0 rounded-2xl border-[#e5e7eb] bg-white"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
    ) : null}
    <div className="min-w-0 flex-1">
      {eyebrow ? <div className="text-[10px] font-bold uppercase text-[#263d27]">{eyebrow}</div> : null}
      <h1 className="truncate text-[22px] font-bold leading-tight text-[#0b130c] mobile-top-bar-title">{title}</h1>
      {subtitle ? <p className="mt-0.5 truncate text-xs font-medium text-[#6b7280]">{subtitle}</p> : null}
    </div>
    {action ? <div className="mobile-top-bar-action shrink-0">{action}</div> : null}
  </header>
);

export default MobileTopBar;
