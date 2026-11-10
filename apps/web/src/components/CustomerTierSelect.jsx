import React, { useState } from 'react';
import { toast } from 'sonner';
import { setCustomerTier } from '@/services/tierPricingService.js';

// This control grants or removes RESELLER and nothing else. Membership is not set here: since 10 Nov 2026
// it comes from a member code (Studio → Kode member) or a paid web order, so "Biasa" means "not a
// reseller" — a customer who joined through a code keeps the member price either way.
const OPTIONS = [
  { value: 'retail', label: 'Biasa' },
  { value: 'reseller', label: 'Reseller' },
];

/** The one control that grants reseller pricing. Shared by the desktop and mobile customer lists. */
const CustomerTierSelect = ({ customer, disabled = false, className = '' }) => {
  const [tier, setTier] = useState(customer.tier === 'reseller' ? 'reseller' : 'retail');
  const [saving, setSaving] = useState(false);

  const change = async (next) => {
    const previous = tier;
    setTier(next);
    setSaving(true);
    try {
      await setCustomerTier(customer.id, next);
      toast.success(next === 'reseller' ? `${customer.customerName} jadi reseller` : `${customer.customerName} bukan reseller lagi`);
    } catch (error) {
      // Put the control back where it was: a select that stayed on "Reseller" after a refused write is
      // the same lie as a toast that says tersimpan.
      setTier(previous);
      toast.error(error.message || 'Gagal mengubah tingkat pelanggan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      aria-label={`Tingkat harga ${customer.customerName}`}
      value={tier}
      disabled={disabled || saving}
      onChange={(event) => change(event.target.value)}
      className={`h-10 rounded-2xl border px-3 text-xs font-bold outline-none focus:border-amber-300 disabled:bg-[#f3f1ec] disabled:text-muted-foreground ${className}`}
    >
      {OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
};

export default CustomerTierSelect;
