import React from 'react';

const SummaryMetricCardMobile = ({ icon: Icon, label, value, tone = 'amber' }) => {
  const tones = {
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  };

  return (
    <div className="mobile-card min-w-[126px] p-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone] || tones.amber}`}>
        {Icon ? <Icon className="h-4 w-4" /> : null}
      </div>
      <div className="mt-3 text-xl font-bold leading-none text-[#1f2937]">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase text-[#9ca3af]">{label}</div>
    </div>
  );
};

export default SummaryMetricCardMobile;
