
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const FormTextarea = ({ 
  label, 
  value, 
  onChange, 
  error, 
  helperText, 
  required = false, 
  placeholder = '', 
  disabled = false,
  id,
  onBlur,
  maxLength,
  rows = 3,
  showCharCount = false,
  ...props 
}) => {
  const textareaId = id || `textarea-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const currentLength = value ? String(value).length : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={textareaId}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {showCharCount && maxLength && (
          <span className="text-xs text-muted-foreground">
            {currentLength}/{maxLength}
          </span>
        )}
      </div>
      <Textarea
        id={textareaId}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        rows={rows}
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

export default FormTextarea;
