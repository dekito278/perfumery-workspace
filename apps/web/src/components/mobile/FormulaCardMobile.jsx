import React from 'react';
import { Copy, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import { formatDate, formatGramAmount } from '@/utils/formatting.js';

const FormulaCardMobile = ({ formula, metrics, pipeline = {}, onView, onDuplicate, onEdit, onDelete, duplicating = false }) => (
  <article className="mobile-card mobile-compact-card mobile-list-card mobile-interactive p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-[#1f2937]">{formula.name}</h3>
        <div className="mt-0.5 font-mono text-[11px] font-semibold text-[#6b7280]">{formula.code}</div>
      </div>
      <MobileStatusBadge status={formula.status || 'draft'} className="h-5 px-2 text-[10px]" />
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2">
      <div className="rounded-lg bg-amber-50 p-2">
        <div className="text-[10px] font-bold uppercase text-amber-700">Impact</div>
        <div className="mt-0.5 truncate text-xs font-bold text-[#1f2937]">{metrics?.impactDisplay ?? '-'}</div>
      </div>
      <div className="rounded-lg bg-blue-50 p-2">
        <div className="text-[10px] font-bold uppercase text-blue-700">Life</div>
        <div className="mt-0.5 text-xs font-bold text-[#1f2937]">{metrics?.lifetimeDisplay ?? '-'}</div>
      </div>
      <div className="rounded-lg bg-slate-50 p-2">
        <div className="text-[10px] font-bold uppercase text-slate-600">Total</div>
        <div className="mt-0.5 text-xs font-bold text-[#1f2937]">{metrics ? formatGramAmount(metrics.totalGrams) : '-'}</div>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-1.5">
      <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-bold text-[#6b7280]">
        {pipeline.briefCount ? `Brief ${pipeline.briefCount}` : 'Standalone'}
      </span>
      <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-bold text-[#6b7280]">Logs {pipeline.validationCount || 0}</span>
      {pipeline.actionNeededCount ? <MobileStatusBadge status="action_needed">Action {pipeline.actionNeededCount}</MobileStatusBadge> : null}
      {metrics ? (
        <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-bold text-[#6b7280]">
          Guidance {metrics.guidanceBackedCount || 0}/{metrics.itemCount || 0}
        </span>
      ) : null}
    </div>
    <div className="mt-3 text-[11px] font-medium text-[#9ca3af]">Updated {formatDate(formula.updated || formula.created)}</div>
    <div className="mt-3 grid grid-cols-4 gap-2">
      <Button type="button" variant="outline" size="icon" onClick={onView} className="mobile-interactive mobile-pressable h-9 w-full rounded-xl bg-white" aria-label="View formula"><Eye className="h-4 w-4" /></Button>
      <Button type="button" variant="outline" size="icon" onClick={onDuplicate} disabled={duplicating} className="mobile-interactive mobile-pressable h-9 w-full rounded-xl bg-white" aria-label="Duplicate formula"><Copy className="h-4 w-4" /></Button>
      <Button type="button" variant="outline" size="icon" onClick={onEdit} className="mobile-interactive mobile-pressable h-9 w-full rounded-xl bg-white" aria-label="Edit formula"><Pencil className="h-4 w-4" /></Button>
      <Button type="button" variant="outline" size="icon" onClick={onDelete} className="mobile-interactive mobile-delete-action h-9 w-full rounded-xl border-rose-200 bg-rose-50 text-rose-700" aria-label="Delete formula"><Trash2 className="h-4 w-4" /></Button>
    </div>
  </article>
);

export default FormulaCardMobile;
