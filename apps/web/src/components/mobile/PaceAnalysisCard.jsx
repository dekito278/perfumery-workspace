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
          <div className="text-xs font-bold uppercase text-amber-700">PACE analysis</div>
          <div className="mt-1 text-3xl font-bold text-[#1f2937]">{displayScore}</div>
        </div>
        <MobileStatusBadge tone={hasScore && numericScore >= 80 ? 'active' : 'warning'}>{statusLabel}</MobileStatusBadge>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-amber-100">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${hasScore ? Math.min(Math.max(numericScore, 0), 100) : 0}%` }} />
      </div>
      <div className="mt-4 grid gap-2">
        {warnings.length ? warnings.slice(0, 3).map((warning) => (
          <div key={warning} className="rounded-2xl border border-amber-200 bg-white/80 p-3 text-sm font-medium text-[#6b4e16]">{warning}</div>
        )) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">No active PACE warnings.</div>
        )}
        {recommendations.length ? recommendations.slice(0, 2).map((item) => (
          <div key={item} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{item}</div>
        )) : (
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm font-medium text-[#6b7280]">No recommendations from current formula data.</div>
        )}
      </div>
    </div>
  );
};

export default PaceAnalysisCard;
