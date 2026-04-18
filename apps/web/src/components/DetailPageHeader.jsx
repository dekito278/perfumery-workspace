
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const DetailPageHeader = ({ 
  title, 
  subtitle, 
  badge, 
  onBack, 
  backLabel = 'Back',
  actions 
}) => {
  return (
    <div className="detail-page-header no-print">
      <div className="mb-4">
        <Button variant="outline" onClick={onBack} className="gap-2 h-10">
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Button>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl sm:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-muted-foreground leading-relaxed">{subtitle}</p>
          )}
        </div>
        
        {actions && (
          <div className="flex gap-2 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailPageHeader;
