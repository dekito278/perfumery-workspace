import React from 'react';
import { Copy, Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import { formatDate, formatGramAmount, formatNullable } from '@/utils/formatting.js';

const FormulaCardMobile = ({ formula, metrics, pipeline = {}, onView, onDuplicate, onEdit, onDelete, duplicating = false }) => (
  <article className="mobile-card p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-bold text-[#1f2937]">{formula.name}</h3>
        <div className="mt-1 font-mono text-xs font-semibold text-[#6b7280]">{formula.code}</div>
      </div>
      <MobileStatusBadge status={formula.status || 'draft'} />
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="rounded-2xl bg-amber-50 p-3">
        <div className="text-[11px] font-bold uppercase text-amber-700">Category</div>
        <div className="mt-1 truncate text-sm font-bold text-[#1f2937]">{formatNullable(formula.category, 'uncategorized')}</div>
      </div>
      <div className="rounded-2xl bg-blue-50 p-3">
        <div className="text-[11px] font-bold uppercase text-blue-700">Total</div>
        <div className="mt-1 text-sm font-bold text-[#1f2937]">{metrics ? formatGramAmount(metrics.totalGrams) : '-'}</div>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-1.5">
      <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-bold text-[#6b7280]">
        {pipeline.briefCount ? `Brief ${pipeline.briefCount}` : 'Standalone'}
      </span>
      <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-bold text-[#6b7280]">Logs {pipeline.validationCount || 0}</span>
      {pipeline.actionNeededCount ? <MobileStatusBadge status="action_needed">Action {pipeline.actionNeededCount}</MobileStatusBadge> : null}
    </div>
    <div className="mt-3 text-xs font-medium text-[#9ca3af]">Updated {formatDate(formula.updated || formula.created)}</div>
    <div className="mt-4 grid grid-cols-4 gap-2">
      <Button type="button" variant="outline" size="icon" onClick={onView} className="rounded-2xl bg-white" aria-label="View formula"><Eye className="h-4 w-4" /></Button>
      <Button type="button" variant="outline" size="icon" onClick={onDuplicate} disabled={duplicating} className="rounded-2xl bg-white" aria-label="Duplicate formula"><Copy className="h-4 w-4" /></Button>
      <Button type="button" variant="outline" size="icon" onClick={onEdit} className="rounded-2xl bg-white" aria-label="Edit formula"><Pencil className="h-4 w-4" /></Button>
      <Button type="button" variant="outline" size="icon" onClick={onDelete} className="rounded-2xl border-rose-200 bg-rose-50 text-rose-700" aria-label="Delete formula"><Trash2 className="h-4 w-4" /></Button>
    </div>
  </article>
);

export default FormulaCardMobile;
