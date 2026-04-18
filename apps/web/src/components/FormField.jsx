
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const FormField = ({ 
  label, 
  value, 
  onChange, 
  error, 
  helperText, 
  required = false, 
  placeholder = '', 
  disabled = false,
  type = 'text',
  id,
  onBlur,
  maxLength,
  ...props 
}) => {
  const inputId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className={`text-foreground ${error ? 'border-destructive' : ''}`}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {!error && helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
};

export default FormField;
