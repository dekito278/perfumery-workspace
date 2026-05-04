import React from 'react';
import { ArrowRight, Link2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import { formatDate } from '@/utils/formatting.js';

const BriefCardMobile = ({ brief, linkedFormula, onOpen, onDelete }) => (
  <article className="mobile-card mobile-compact-card p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-[#1f2937]">{brief.title}</h3>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <MobileStatusBadge status={brief.status || 'draft'} className="h-5 px-2 text-[10px]" />
          {linkedFormula ? (
            <span className="inline-flex h-5 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 text-[10px] font-semibold text-blue-700">
              <Link2 className="h-3 w-3" />
              Linked
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onDelete ? (
          <Button type="button" size="icon" variant="outline" onClick={onDelete} className="h-9 w-9 rounded-xl border-rose-100 bg-rose-50 text-rose-700" aria-label="Delete brief">
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
        <Button type="button" size="icon" variant="outline" onClick={onOpen} className="h-9 w-9 rounded-xl bg-white" aria-label="Open brief">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
    <div className="mt-2 rounded-xl bg-[#f8f7f4] p-2">
      <div className="text-[10px] font-semibold uppercase text-[#9ca3af]">Progress</div>
      <div className="mt-0.5 truncate text-xs font-semibold text-[#374151]">
        {brief.formula_id ? `Formula: ${linkedFormula?.name || 'Linked formula'}` : 'Needs project follow-up'}
      </div>
    </div>
    <div className="mt-2 text-[11px] font-medium text-[#6b7280]">Updated {formatDate(brief.updated || brief.created)}</div>
  </article>
);

export default BriefCardMobile;
