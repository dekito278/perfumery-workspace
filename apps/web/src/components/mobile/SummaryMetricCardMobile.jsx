import React from 'react';
import { Link } from 'react-router-dom';

const SummaryMetricCardMobile = ({ icon: Icon, label, onClick, to, value, tone = 'amber' }) => {
  const tones = {
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  const Component = to ? Link : (onClick ? 'button' : 'div');
  const actionProps = to ? { to } : (onClick ? { type: 'button', onClick } : {});

  return (
    <Component {...actionProps} className="mobile-card block w-full p-3.5 text-left">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone] || tones.amber}`}>
        {Icon ? <Icon className="h-4 w-4" /> : null}
      </div>
      <div className="mt-3 text-xl font-bold leading-none text-[#1f2937]">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase leading-snug text-[#9ca3af]">{label}</div>
    </Component>
  );
};

export default SummaryMetricCardMobile;
