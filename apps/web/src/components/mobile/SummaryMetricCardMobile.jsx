import React from 'react';

const SummaryMetricCardMobile = ({ icon: Icon, label, value, tone = 'amber' }) => {
  const tones = {
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  };

  return (
    <div className="mobile-card min-w-[138px] p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tones[tone] || tones.amber}`}>
        {Icon ? <Icon className="h-5 w-5" /> : null}
      </div>
      <div className="mt-4 text-2xl font-bold leading-none text-[#1f2937]">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase text-[#9ca3af]">{label}</div>
    </div>
  );
};

export default SummaryMetricCardMobile;
