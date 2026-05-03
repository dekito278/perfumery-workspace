import React from 'react';
import { ArrowRight, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import { formatDate } from '@/utils/formatting.js';

const BriefCardMobile = ({ brief, linkedFormula, onOpen }) => (
  <article className="mobile-card p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="mobile-line-clamp-2 text-base font-bold text-[#1f2937]">{brief.title}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <MobileStatusBadge status={brief.status || 'draft'} />
          {linkedFormula ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-semibold text-blue-700">
              <Link2 className="h-3 w-3" />
              Linked
            </span>
          ) : null}
        </div>
      </div>
      <Button type="button" size="icon" variant="outline" onClick={onOpen} className="h-11 w-11 shrink-0 rounded-2xl bg-white">
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
    <div className="mt-4 rounded-2xl bg-[#f8f7f4] p-3">
      <div className="text-xs font-semibold uppercase text-[#9ca3af]">Progress</div>
      <div className="mt-1 text-sm font-semibold text-[#374151]">
        {brief.formula_id ? `Formula: ${linkedFormula?.name || 'Linked formula'}` : 'Needs project follow-up'}
      </div>
    </div>
    <div className="mt-3 text-xs font-medium text-[#6b7280]">Updated {formatDate(brief.updated || brief.created)}</div>
  </article>
);

export default BriefCardMobile;
