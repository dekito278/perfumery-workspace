
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
        <Input
          id={inputId}
          type="number"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          className={`text-foreground ${unit ? 'pr-12' : ''} ${error ? 'border-destructive' : ''}`}
          {...props}
        />
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
