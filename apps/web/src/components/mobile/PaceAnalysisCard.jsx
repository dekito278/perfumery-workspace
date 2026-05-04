import React from 'react';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';

const PaceAnalysisCard = ({ score = null, warnings = [], recommendations = [] }) => {
  const numericScore = Number(score);
  const hasScore = Number.isFinite(numericScore);
  const displayScore = hasScore ? Math.round(numericScore) : '-';
  const statusLabel = hasScore ? (numericScore >= 80 ? 'Balanced' : 'Review') : 'No score';

  return (
    <div className="mobile-soft-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase text-amber-700">PACE</div>
          <div className="mt-1 text-2xl font-bold text-[#1f2937]">{displayScore}</div>
        </div>
        <MobileStatusBadge tone={hasScore && numericScore >= 80 ? 'active' : 'warning'}>{statusLabel}</MobileStatusBadge>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-amber-100">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${hasScore ? Math.min(Math.max(numericScore, 0), 100) : 0}%` }} />
      </div>
      <div className="mt-3 grid gap-2">
        {warnings.length ? warnings.slice(0, 3).map((warning) => (
          <div key={warning} className="rounded-xl border border-amber-200 bg-white/80 p-2 text-xs font-medium text-[#6b4e16]">{warning}</div>
        )) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs font-medium text-emerald-800">No active warnings.</div>
        )}
        {recommendations.length ? recommendations.slice(0, 2).map((item) => (
          <div key={item} className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs font-medium text-emerald-800">{item}</div>
        )) : (
          <div className="rounded-xl border border-slate-200 bg-white/80 p-2 text-xs font-medium text-[#6b7280]">No recommendations.</div>
        )}
      </div>
    </div>
  );
};

export default PaceAnalysisCard;
