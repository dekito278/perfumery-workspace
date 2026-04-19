import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const IngredientSelect = ({
  value,
  onChange,
  placeholder = 'Type material name',
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
      return [];
    }

    return sorted
      .filter((ing) => ing.name.toLowerCase().includes(normalizedTerm))
      .slice(0, 3);
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
    if (!autoFocus || !inputRef.current || disabled) {
      return;
    }

    requestAnimationFrame(() => {
      if (!inputRef.current) {
        return;
      }

      inputRef.current.focus();
      inputRef.current.select();
      onAutoFocusHandled?.();
    });
  }, [autoFocus, disabled, onAutoFocusHandled]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (wrapperRef.current?.contains(event.target)) {
        return;
      }

      setOpen(false);
      setSearchTerm(selectedIngredient?.name || '');
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [selectedIngredient]);

  const handleSelect = (ingredientId) => {
    onChange(ingredientId);
    setOpen(false);
    const ingredient = ingredients.find((entry) => entry.id === ingredientId);
    setSearchTerm(ingredient?.name || '');
  };

  const handleKeyDown = (event) => {
    if (!open && ['ArrowDown', 'Enter'].includes(event.key)) {
      setOpen(true);
      return;
    }

    if (!open) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex((current) =>
          current < filteredIngredients.length - 1 ? current + 1 : current
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex((current) => (current > 0 ? current - 1 : 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredIngredients[highlightedIndex]) {
          handleSelect(filteredIngredients[highlightedIndex].id);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        setSearchTerm(selectedIngredient?.name || '');
        break;
      default:
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={searchTerm}
        onChange={(event) => {
          setSearchTerm(event.target.value);
          setOpen(Boolean(event.target.value.trim()));
        }}
        onFocus={() => !disabled && searchTerm.trim() && setOpen(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="h-10 rounded-xl border-white/70 bg-white/85 text-foreground"
        autoComplete="off"
      />
      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 rounded-2xl border border-stone-200 bg-stone-50 p-1.5 text-foreground shadow-[0_30px_80px_-42px_rgba(64,38,12,0.45)] ring-1 ring-black/5 backdrop-blur-sm">
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
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    'w-full rounded-xl px-3 py-2.5 text-left transition-colors',
                    'bg-stone-50 text-foreground hover:bg-amber-100/80',
                    highlightedIndex === index && 'bg-amber-100/90',
                    value === ingredient.id && 'bg-primary/12'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{ingredient.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {ingredient.type === 'solvent' ? 'Solvent' : 'Raw material'} - {ingredient.unit}
                      </div>
                    </div>
                    {value === ingredient.id ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default IngredientSelect;
