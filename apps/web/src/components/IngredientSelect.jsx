import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Check, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const normalizeSearchValue = (value) => String(value || '').trim().toLowerCase();

const toSearchTokens = (value) =>
  normalizeSearchValue(value)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

const getEditDistance = (left, right) => {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = previous[rightIndex];
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + substitutionCost
      );

      diagonal = current;
    }
  }

  return previous[right.length];
};

const getSuggestionLimit = (term) => {
  if (term.length <= 1) {
    return 6;
  }

  if (term.length <= 3) {
    return 4;
  }

  return 1;
};

const scoreIngredientMatch = (ingredientName, rawQuery) => {
  const normalizedName = normalizeSearchValue(ingredientName);
  const normalizedQuery = normalizeSearchValue(rawQuery);

  if (!normalizedName || !normalizedQuery) {
    return Number.NEGATIVE_INFINITY;
  }

  const nameTokens = toSearchTokens(normalizedName);
  const queryTokens = toSearchTokens(normalizedQuery);
  const compactName = normalizedName.replace(/[^a-z0-9]+/gi, '');
  const compactQuery = normalizedQuery.replace(/[^a-z0-9]+/gi, '');
  const startsWith = normalizedName.startsWith(normalizedQuery);
  const includes = normalizedName.includes(normalizedQuery);
  const tokenPrefixMatches = queryTokens.filter((token) =>
    nameTokens.some((nameToken) => nameToken.startsWith(token))
  ).length;
  const tokenIncludesMatches = queryTokens.filter((token) =>
    nameTokens.some((nameToken) => nameToken.includes(token))
  ).length;

  let score = Number.NEGATIVE_INFINITY;

  if (normalizedName === normalizedQuery) {
    score = 2000;
  } else if (startsWith) {
    score = 1600 - Math.max(0, normalizedName.length - normalizedQuery.length);
  } else if (nameTokens.some((token) => token.startsWith(normalizedQuery))) {
    score = 1450;
  } else if (tokenPrefixMatches > 0) {
    score = 1250 + tokenPrefixMatches * 80;
  } else if (includes) {
    score = 1100 - normalizedName.indexOf(normalizedQuery) * 5;
  } else if (tokenIncludesMatches > 0) {
    score = 950 + tokenIncludesMatches * 40;
  }

  const compactDistance = getEditDistance(compactName, compactQuery);
  const allowedDistance = compactQuery.length >= 6 ? 3 : compactQuery.length >= 4 ? 2 : 1;

  if (compactDistance <= allowedDistance) {
    score = Math.max(score, 900 - compactDistance * 120);
  }

  return score;
};

const IngredientSelect = ({
  value,
  onChange,
  placeholder = 'Type material name',
  disabled = false,
  ingredients = [],
  autoFocus = false,
  onAutoFocusHandled,
  compact = false,
  showSuggestions = true,
  onActivate,
  onCreateMissing,
  createMissingLabel = 'Tambah raw material baru',
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  const selectedIngredient = ingredients.find((ing) => ing.id === value);
  const trimmedSearchTerm = searchTerm.trim();

  const findExactMatch = (rawValue = searchTerm) => {
    const normalizedTerm = String(rawValue || '').trim().toLowerCase();
    if (!normalizedTerm) {
      return null;
    }

    return ingredients.find((ingredient) => ingredient.name.trim().toLowerCase() === normalizedTerm) || null;
  };

  const findCommittedMatch = (rawValue = searchTerm) => {
    const normalizedTerm = normalizeSearchValue(rawValue);
    const exactMatch = findExactMatch(rawValue);
    if (exactMatch) {
      return exactMatch;
    }

    if (showSuggestions && filteredIngredients.length === 1) {
      return filteredIngredients[0];
    }

    if (normalizedTerm.length >= 5) {
      const scoredMatches = ingredients
        .map((ingredient) => ({
          ingredient,
          score: scoreIngredientMatch(ingredient.name, normalizedTerm),
        }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((left, right) => right.score - left.score || left.ingredient.name.localeCompare(right.ingredient.name));

      if (scoredMatches[0]?.score >= 1000) {
        return scoredMatches[0].ingredient;
      }
    }

    return null;
  };

  const filteredIngredients = useMemo(() => {
    if (!showSuggestions) {
      return [];
    }

    const normalizedTerm = normalizeSearchValue(searchTerm);

    if (!normalizedTerm) {
      return [];
    }

    const scoredMatches = ingredients
      .map((ingredient) => ({
        ingredient,
        score: scoreIngredientMatch(ingredient.name, normalizedTerm),
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => right.score - left.score || left.ingredient.name.localeCompare(right.ingredient.name));

    return scoredMatches
      .slice(0, getSuggestionLimit(normalizedTerm))
      .map((entry) => entry.ingredient);
  }, [ingredients, searchTerm]);

  const exactSearchMatch = useMemo(
    () => ingredients.some((ingredient) => normalizeSearchValue(ingredient.name) === normalizeSearchValue(searchTerm)),
    [ingredients, searchTerm]
  );
  const canCreateMissing = Boolean(onCreateMissing && trimmedSearchTerm.length >= 2 && !exactSearchMatch);

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
    if (!showSuggestions) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (wrapperRef.current?.contains(event.target)) {
        return;
      }

      setOpen(false);
      const committedMatch = findCommittedMatch();
      if (committedMatch) {
        if (committedMatch.id !== value) {
          onChange(committedMatch.id);
        }
        setSearchTerm(committedMatch.name);
        return;
      }

      setSearchTerm(selectedIngredient?.name || '');
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [selectedIngredient, showSuggestions]);

  const handleSelect = (ingredientId) => {
    onChange(ingredientId);
    setOpen(false);
    const ingredient = ingredients.find((entry) => entry.id === ingredientId);
    setSearchTerm(ingredient?.name || '');
  };

  const handleCreateMissing = () => {
    if (!canCreateMissing) {
      return;
    }

    const nextName = trimmedSearchTerm;
    setOpen(false);
    onCreateMissing?.(nextName);
  };

  const commitExactMatch = () => {
    const committedMatch = findCommittedMatch();
    if (committedMatch && committedMatch.id !== value) {
      onChange(committedMatch.id);
      setSearchTerm(committedMatch.name);
    } else if (committedMatch) {
      setSearchTerm(committedMatch.name);
    }
  };

  const handleKeyDown = (event) => {
    if (!showSuggestions) {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitExactMatch();
      }
      return;
    }

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
    <div ref={wrapperRef} className="relative min-w-0">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={searchTerm}
        onChange={(event) => {
          const nextValue = event.target.value;
          setSearchTerm(nextValue);
          setOpen(showSuggestions && Boolean(nextValue.trim()));

          if (normalizeSearchValue(nextValue).length >= 5) {
            const autoMatch = findCommittedMatch(nextValue);
            if (autoMatch && autoMatch.id !== value) {
              onChange(autoMatch.id);
            }
          }
        }}
        onFocus={() => {
          onActivate?.();
          if (!disabled && showSuggestions && searchTerm.trim()) {
            setOpen(true);
          }
        }}
        onBlur={() => {
          commitExactMatch();
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={compact ? 'h-9 w-full min-w-0 rounded-lg border-[#ddd3bf] bg-white text-foreground' : 'h-10 w-full min-w-0 rounded-xl border-white/70 bg-white/85 text-foreground'}
        autoComplete="off"
      />
      {showSuggestions && open && !disabled ? (
        <div className={`absolute left-0 right-0 z-50 text-foreground ring-1 ring-black/5 backdrop-blur-sm ${
          compact
            ? 'top-[calc(100%+0.25rem)] rounded-xl border border-stone-200 bg-stone-50 p-1 shadow-[0_22px_60px_-38px_rgba(64,38,12,0.45)]'
            : 'top-[calc(100%+0.5rem)] rounded-2xl border border-stone-200 bg-stone-50 p-1.5 shadow-[0_30px_80px_-42px_rgba(64,38,12,0.45)]'
        }`}>
          <div className="max-h-[238px] overflow-y-auto">
            {filteredIngredients.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
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
          {canCreateMissing ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleCreateMissing}
              className={cn(
                'mt-1 flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2.5 text-left text-amber-950 transition-colors hover:bg-amber-100',
                compact ? 'text-xs' : 'text-sm'
              )}
            >
              <span className="min-w-0">
                <span className="block font-semibold">{createMissingLabel}</span>
                <span className="block truncate text-[11px] text-amber-800">"{trimmedSearchTerm}" akan dibuat sebagai raw material.</span>
              </span>
              <PlusCircle className="h-4 w-4 shrink-0" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default IngredientSelect;
