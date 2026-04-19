
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const IngredientSelect = ({ 
  value, 
  onChange, 
  placeholder = "Type material name", 
  disabled = false,
  ingredients = [],
  autoFocus = false,
  onAutoFocusHandled,
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  const selectedIngredient = ingredients.find((ing) => ing.id === value);

  const filteredIngredients = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    const sorted = [...ingredients].sort((a, b) => a.name.localeCompare(b.name));

    if (!normalizedTerm) {
      return sorted.slice(0, 4);
    }

    return sorted
      .filter((ing) => ing.name.toLowerCase().includes(normalizedTerm))
      .slice(0, 4);
  }, [ingredients, searchTerm]);

  useEffect(() => {
    if (selectedIngredient && !open) {
      setSearchTerm(selectedIngredient.name);
      setHighlightedIndex(0);
    } else if (!selectedIngredient && !open) {
      setSearchTerm('');
      setHighlightedIndex(0);
    }
  }, [selectedIngredient, open]);

  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      requestAnimationFrame(() => {
        if (!inputRef.current) return;
        inputRef.current.focus();
        inputRef.current.select();
        setOpen(true);
        onAutoFocusHandled?.();
      });
    }
  }, [autoFocus, disabled, onAutoFocusHandled]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
        if (selectedIngredient) {
          setSearchTerm(selectedIngredient.name);
        }
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [selectedIngredient]);

  const handleKeyDown = (e) => {
    if (!open && ['ArrowDown', 'Enter'].includes(e.key)) {
      setOpen(true);
      return;
    }

    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredIngredients.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredIngredients[highlightedIndex]) {
          handleSelect(filteredIngredients[highlightedIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  const handleSelect = (ingredientId) => {
    onChange(ingredientId);
    setOpen(false);
    const ingredient = ingredients.find((entry) => entry.id === ingredientId);
    setSearchTerm(ingredient?.name || '');
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setOpen(true);
            }}
            onFocus={() => !disabled && setOpen(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="h-10 rounded-xl border-white/70 bg-white/85 text-foreground"
            autoComplete="off"
          />
        </PopoverAnchor>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] rounded-2xl border-white/80 bg-white/96 p-1 shadow-[0_24px_64px_-48px_rgba(125,86,13,0.42)]"
          align="start"
          sideOffset={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="max-h-[238px] overflow-y-auto">
            {filteredIngredients.length === 0 ? (
              <div className="px-3 py-5 text-center text-sm text-muted-foreground">
                No matching materials
              </div>
            ) : (
              filteredIngredients.map((ingredient, index) => (
                <button
                  key={ingredient.id}
                  type="button"
                  onClick={() => handleSelect(ingredient.id)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                    "hover:bg-accent/10",
                    highlightedIndex === index && "bg-accent/10",
                    value === ingredient.id && "bg-primary/10"
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{ingredient.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {ingredient.type === 'solvent' ? 'Solvent' : 'Raw material'} • {ingredient.unit}
                      </div>
                    </div>
                    {value === ingredient.id && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default IngredientSelect;
