
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const DetailPageHeader = ({ 
  eyebrow,
  title, 
  subtitle, 
  badge, 
  onBack, 
  backLabel = 'Back',
  actions,
  meta
}) => {
  return (
    <div className="detail-page-header detail-page-header-card no-print">
      <div className="mb-5">
        <Button variant="outline" onClick={onBack} className="gap-2 h-10">
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Button>
      </div>
      
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            {eyebrow && <div className="detail-page-eyebrow">{eyebrow}</div>}
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl sm:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>
                {title}
              </h1>
              {badge}
            </div>
            {subtitle && (
              <p className="max-w-3xl text-sm text-muted-foreground sm:text-base leading-relaxed">{subtitle}</p>
            )}
          </div>
          
          {actions && (
            <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
              {actions}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {meta && <div className="detail-page-meta-strip">{meta}</div>}
        </div>
      </div>
    </div>
  );
};

export default DetailPageHeader;
