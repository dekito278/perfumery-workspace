
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const IngredientSelect = ({ 
  value, 
  onChange, 
  placeholder = "Select ingredient", 
  disabled = false,
  ingredients = []
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedIngredient = ingredients.find(ing => ing.id === value);

  const filteredIngredients = ingredients
    .filter(ing => 
      ing.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      setSearchTerm('');
      setHighlightedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    if (listRef.current && highlightedIndex >= 0) {
      const highlightedElement = listRef.current.children[highlightedIndex];
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleKeyDown = (e) => {
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
    setSearchTerm('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-foreground"
          disabled={disabled}
        >
          {selectedIngredient ? (
            <span className="truncate">{selectedIngredient.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            ref={inputRef}
            placeholder="Search ingredients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-9 text-foreground"
          />
        </div>
        <div 
          ref={listRef}
          className="max-h-[300px] overflow-y-auto"
        >
          {filteredIngredients.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            filteredIngredients.map((ingredient, index) => (
              <button
                key={ingredient.id}
                onClick={() => handleSelect(ingredient.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
                  highlightedIndex === index && "bg-accent text-accent-foreground",
                  value === ingredient.id && "bg-primary/10"
                )}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">{ingredient.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {ingredient.unit}
                  </span>
                </div>
                {value === ingredient.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default IngredientSelect;
