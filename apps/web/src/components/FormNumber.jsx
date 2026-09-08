
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { blurNumberInputOnWheel } from '@/utils/numberInputs.js';
import LocalizedNumberInput from '@/components/LocalizedNumberInput.jsx';

const FormNumber = ({ 
  label, 
  value, 
  onChange, 
  error, 
  helperText, 
  required = false, 
  placeholder = '0', 
  disabled = false,
  id,
  onBlur,
  min,
  max,
  step = '0.01',
  unit,
  localized = false,
  ...props 
}) => {
  const inputId = id || `number-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="relative">
        {localized ? (
          // Money and stock: an Indonesian owner types "150.000", and type="number" hands that back as
          // 150. onChange here receives the parsed number, not an event.
          <LocalizedNumberInput
            as={Input}
            id={inputId}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={`text-foreground ${unit ? 'pr-12' : ''} ${error ? 'border-destructive' : ''}`}
            {...props}
          />
        ) : (
          <Input
            id={inputId}
            type="number"
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            onWheel={blurNumberInputOnWheel}
            placeholder={placeholder}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            className={`text-foreground ${unit ? 'pr-12' : ''} ${error ? 'border-destructive' : ''}`}
            {...props}
          />
        )}
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {!error && helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
};

export default FormNumber;
