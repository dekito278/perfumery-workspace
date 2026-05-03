import React from 'react';
import { ChevronRight } from 'lucide-react';
import { formatDate } from '@/utils/formatting.js';

const ActivityCardMobile = ({ title, meta, date, onClick }) => (
  <button type="button" onClick={onClick} className="mobile-card flex w-full items-center gap-3 p-3 text-left">
    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-bold text-[#1f2937]">{title}</span>
      <span className="mt-1 block truncate text-xs text-[#6b7280]">{meta} · {formatDate(date)}</span>
    </span>
    <ChevronRight className="h-4 w-4 shrink-0 text-[#9ca3af]" />
  </button>
);

export default ActivityCardMobile;
