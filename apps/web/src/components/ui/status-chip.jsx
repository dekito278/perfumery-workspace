import React from 'react';
import { cn } from '@/lib/utils.js';

const toneClasses = {
  neutral: 'border-stone-200 bg-stone-100 text-stone-600',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  primary: 'border-[#1b1a16]/20 bg-[#f7f1e5] text-[#1b1a16]',
};

export const getPaymentStatusTone = (status) => {
  if (status === 'paid') return 'success';
  if (['failed', 'expired', 'refunded'].includes(status)) return 'danger';
  if (['pending', 'unpaid'].includes(status)) return 'warning';
  return 'neutral';
};

export const getOrderStatusTone = (status) => {
  if (['completed', 'delivered'].includes(status)) return 'success';
  if (status === 'cancelled') return 'danger';
  if (['paid', 'processing', 'shipped'].includes(status)) return 'primary';
  return 'warning';
};

export const getShipmentStatusTone = (status) => {
  if (['delivered', 'completed'].includes(status)) return 'success';
  if (status === 'shipped') return 'info';
  if (['packing', 'ready_to_ship'].includes(status)) return 'primary';
  return 'neutral';
};

const sizeClasses = {
  sm: 'px-2.5 py-1 text-[10px] sm:px-3 sm:text-xs',
  md: 'px-3 py-1 text-xs',
};

const StatusChip = ({ children, className, icon: Icon, size = 'sm', tone = 'neutral' }) => (
  <span className={cn(
    'inline-flex shrink-0 items-center gap-1 rounded-full border font-bold uppercase leading-none',
    toneClasses[tone] || toneClasses.neutral,
    sizeClasses[size] || sizeClasses.sm,
    className,
  )}>
    {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
    {children}
  </span>
);

export default StatusChip;
