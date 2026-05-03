import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import { formatDate, formatStatus } from '@/utils/formatting.js';

const ValidationCardMobile = ({ log, formula, onOpen }) => (
  <article className="mobile-card p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-bold text-[#1f2937]">{formula?.name || 'Unknown formula'}</h3>
        <div className="mt-1 font-mono text-xs font-semibold text-[#6b7280]">{formula?.code || 'No code'} · {formatStatus(log.test_type || 'revision')}</div>
      </div>
      <MobileStatusBadge status={log.status || 'logged'} />
    </div>
    <p className="mobile-line-clamp-2 mt-3 text-sm text-[#374151]">{log.note || 'No note recorded'}</p>
    {log.next_action ? <p className="mobile-line-clamp-2 mt-2 text-xs font-medium text-[#6b7280]">Next: {log.next_action}</p> : null}
    <div className="mt-4 flex items-center justify-between gap-3">
      <div className="text-xs font-semibold text-[#9ca3af]">Due {formatDate(log.tested_at || log.created)}</div>
      <Button type="button" variant="outline" size="icon" onClick={onOpen} className="h-11 w-11 rounded-2xl bg-white">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  </article>
);

export default ValidationCardMobile;
