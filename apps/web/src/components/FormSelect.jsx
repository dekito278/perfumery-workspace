
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const FormSelect = ({ 
  label, 
  value, 
  onChange, 
  options = [], 
  error, 
  helperText, 
  required = false, 
  placeholder = 'Select option', 
  disabled = false,
  id,
  onBlur,
  ...props 
}) => {
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={selectId}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select 
        value={value} 
        onValueChange={onChange}
        disabled={disabled}
        {...props}
      >
        <SelectTrigger 
          id={selectId} 
          className={`text-foreground ${error ? 'border-destructive' : ''}`}
          onBlur={onBlur}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {!error && helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
};

export default FormSelect;
