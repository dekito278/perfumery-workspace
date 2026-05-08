import React from 'react';
import { LoaderCircle } from 'lucide-react';

const MobileLoadingState = ({
  eyebrow = 'Solivagant',
  title = 'Loading...',
  subtitle = 'Preparing your mobile workspace.',
  className = '',
}) => (
  <div className={`mobile-page mobile-centered-state ${className}`}>
    <section className="mobile-loading-state mobile-soft-card" role="status" aria-live="polite">
      <div className="mobile-loading-state-spinner" aria-hidden="true">
        <LoaderCircle className="h-9 w-9 animate-spin text-amber-600" />
      </div>
      <div className="mt-4 text-center">
        <p className="text-[10px] font-bold uppercase text-amber-700">{eyebrow}</p>
        <h1 className="mt-1 text-base font-bold text-[#1f2937]">{title}</h1>
        {subtitle ? <p className="mt-1 text-xs font-medium text-[#6b7280]">{subtitle}</p> : null}
      </div>
    </section>
  </div>
);

export default MobileLoadingState;

