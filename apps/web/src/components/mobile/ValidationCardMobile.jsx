import React from 'react';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import { formatDate, formatStatus } from '@/utils/formatting.js';

const ValidationCardMobile = ({ log, formula, onDelete, onEdit, onOpen }) => (
  <article className="mobile-card mobile-compact-card mobile-list-card p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-[#1f2937]">{formula?.name || 'Unknown formula'}</h3>
        <div className="mt-0.5 font-mono text-[11px] font-semibold text-[#6b7280]">{formula?.code || 'No code'} - {formatStatus(log.test_type || 'revision')}</div>
      </div>
      <MobileStatusBadge status={log.status || 'logged'} className="h-5 px-2 text-[10px]" />
    </div>
    <p className="mobile-line-clamp-2 mt-2 text-xs text-[#374151]">{log.note || 'No note recorded'}</p>
    {log.next_action ? <p className="mobile-line-clamp-2 mt-1 text-[11px] font-medium text-[#6b7280]">Next: {log.next_action}</p> : null}
    <div className="mt-2 flex items-center justify-between gap-2">
      <div className="min-w-0 text-[11px] font-semibold text-[#9ca3af]">
        {formatDate(log.tested_at || log.created)}
        {log.evaluator_name ? ` - ${log.evaluator_name}` : ''}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button type="button" variant="outline" size="icon" onClick={onEdit} className="h-9 w-9 rounded-xl bg-white" aria-label="Edit validation log">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={onDelete} className="h-9 w-9 rounded-xl bg-white text-rose-600" aria-label="Delete validation log">
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={onOpen} className="h-9 w-9 rounded-xl bg-white" aria-label="Open formula">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </article>
);

export default ValidationCardMobile;
