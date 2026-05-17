import React from 'react';
import { Label } from '@/components/ui/label.jsx';
import { cn } from '@/lib/utils.js';

const MobileFormField = ({ id, label, helper, error, children, className }) => (
  <div data-mobile-field className={cn('mobile-form-field space-y-1.5', error && 'mobile-field-has-error', className)}>
    {label ? <Label htmlFor={id} className="text-xs">{label}</Label> : null}
    {children}
    {error ? (
      <p className="mobile-form-error text-xs font-semibold text-rose-700">{error}</p>
    ) : helper ? (
      <p className="mobile-form-helper text-xs font-medium text-[#6b7280]">{helper}</p>
    ) : null}
  </div>
);

export default MobileFormField;
