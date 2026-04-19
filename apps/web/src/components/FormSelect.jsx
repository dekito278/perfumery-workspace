
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  searchable = false,
  searchPlaceholder = 'Search options...',
  id,
  onBlur,
  ...props 
}) => {
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (!searchable || !open || !inputRef.current) {
      return;
    }

    inputRef.current.focus();
    setSearchTerm('');
    setHighlightedIndex(0);
  }, [open, searchable]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    if (!searchable || !listRef.current || highlightedIndex < 0) {
      return;
    }

    const highlightedElement = listRef.current.children[highlightedIndex];
    if (highlightedElement) {
      highlightedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, searchable]);

  const handleSearchKeyDown = (event) => {
    if (!searchable || !open) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex((current) => (
          current < filteredOptions.length - 1 ? current + 1 : current
        ));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex((current) => (current > 0 ? current - 1 : 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].value);
          setOpen(false);
          setSearchTerm('');
        }
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={selectId}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {searchable ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={selectId}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              onBlur={onBlur}
              className={cn(
                'w-full justify-between text-foreground',
                error && 'border-destructive'
              )}
            >
              {selectedOption ? (
                <span className="truncate">{selectedOption.label}</span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="border-b p-2">
              <Input
                ref={inputRef}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                className="h-9 text-foreground"
              />
            </div>
            <div ref={listRef} className="max-h-72 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No results found
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setSearchTerm('');
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                      highlightedIndex === index && 'bg-accent text-accent-foreground',
                      value === option.value && 'bg-primary/10'
                    )}
                  >
                    <span className="pr-3">{option.label}</span>
                    {value === option.value && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
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
      )}
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
