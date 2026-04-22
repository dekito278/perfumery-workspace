
import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ChevronDown, Droplets, Trash2 } from 'lucide-react';
import IngredientSelect from '@/components/IngredientSelect.jsx';
import { blurNumberInputOnWheel } from '@/utils/numberInputs.js';

const FormulaItemRow = ({ 
  item, 
  index,
  onItemChange, 
  onGramAmountChange, 
  onDilutionChange,
  onCommit,
  onRemove, 
  rawMaterials,
  error,
  autoFocusMaterial = false,
  onAutoFocusHandled,
}) => {
  const allIngredients = rawMaterials.map((material) => ({
    ...material,
    type: material.type === 'solvent' ? 'solvent' : 'raw_material',
  }));
  const solventOptions = rawMaterials.filter((material) => material.type === 'solvent');
  const selectedIngredient = allIngredients.find((ingredient) => ingredient.id === item.item_id);
  const canConfigureDilution = item.item_type === 'raw_material' || item.item_type === 'solvent';
  const dilutionEnabled = Boolean(item.dilution_percent || item.dilution_solvent_id);
  const canCommit = Boolean(item.item_id && parseFloat(item.gram_amount) > 0);
  const isReady = Boolean(item.item_id || item.gram_amount);
  const [showDilutionPanel, setShowDilutionPanel] = useState(dilutionEnabled);
  const materialTypeLabel = selectedIngredient?.type === 'solvent' ? 'Solvent' : 'Raw material';

  useEffect(() => {
    if (dilutionEnabled) {
      setShowDilutionPanel(true);
    }
  }, [dilutionEnabled]);

  const handleDilutionSolventChange = (value) => {
    onDilutionChange(index, 'dilution_solvent_id', value === '__none__' ? '' : value);
  };

  const handleClearDilution = () => {
    onDilutionChange(index, 'clear_dilution', '');
  };

  return (
    <div className="space-y-2">
      <div className={`rounded-[24px] border p-4 shadow-sm transition-colors ${
        isReady
          ? 'border-[#e4d8b4] bg-[linear-gradient(180deg,rgba(255,251,240,0.92)_0%,rgba(255,255,255,0.95)_100%)]'
          : 'border-white/80 bg-white/72'
      }`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-3.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="outline" className="rounded-full border-[#d8cfb5] bg-white/85 px-2.5 text-[10px] uppercase tracking-[0.16em] text-[#72664c]">
                Row {index + 1}
              </Badge>
              {selectedIngredient ? (
                <span className="font-medium text-foreground/80">{materialTypeLabel}</span>
              ) : null}
              {dilutionEnabled ? <span className="text-[#7d6840]">Diluted</span> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(148px,0.65fr)]">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Material</Label>
                <IngredientSelect
                  value={item.item_id}
                  onChange={(ingredientId) => onItemChange(index, ingredientId)}
                  placeholder="Type Hedione, Iso E Super, DPG..."
                  ingredients={allIngredients}
                  autoFocus={autoFocusMaterial}
                  onAutoFocusHandled={onAutoFocusHandled}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Amount (g)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max="999999"
                    value={item.gram_amount || ''}
                    onChange={(e) => onGramAmountChange(index, e.target.value)}
                    onWheel={blurNumberInputOnWheel}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        if (canCommit) {
                          onCommit?.(index);
                        }
                      }
                    }}
                    placeholder="0.000"
                    className="text-foreground"
                  />
                  <Button
                    type="button"
                    variant={canCommit ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => onCommit?.(index)}
                    disabled={!canCommit}
                    className="h-10 w-10 shrink-0 rounded-[0.95rem]"
                    title="Save ingredient and continue"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground shrink-0">g</span>
                </div>
                <div className="text-[11px] leading-relaxed text-muted-foreground">
                  {canCommit
                    ? 'Ready to commit into composition.'
                    : 'Choose a material and amount to add it into the formula.'}
                </div>
              </div>
            </div>

            {canConfigureDilution && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDilutionPanel((current) => !current)}
                    className="h-8 gap-2 rounded-xl border-[#d9cfbb] bg-white/70 px-3 text-xs"
                  >
                    <Droplets className="h-3.5 w-3.5" />
                    {dilutionEnabled ? 'Diluted' : 'Dilution'}
                    <ChevronDown className={`h-4 w-4 transition-transform ${showDilutionPanel ? 'rotate-180' : ''}`} />
                  </Button>
                  {dilutionEnabled && (
                    <div className="min-w-0 rounded-full border border-[#e5dac3] bg-[#f8f2e1] px-2.5 py-1 text-right text-[11px] text-[#71623f]">
                      {item.dilution_percent}%{item.dilution_solvent_name ? ` in ${item.dilution_solvent_name}` : ''}
                    </div>
                  )}
                </div>

                {showDilutionPanel && (
                  <div className="rounded-2xl border border-[#ddd3bf] bg-background/80 p-3">
                    <div className="grid gap-4 md:grid-cols-[0.7fr_1fr_1fr]">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Dilution %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.dilution_percent || ''}
                          onChange={(e) => onDilutionChange(index, 'dilution_percent', e.target.value)}
                          onWheel={blurNumberInputOnWheel}
                          placeholder={selectedIngredient?.dilution_percentage ? String(selectedIngredient.dilution_percentage) : 'Optional'}
                          className="text-foreground"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Dilution solvent</Label>
                        <Select
                          value={item.dilution_solvent_id || ''}
                          onValueChange={handleDilutionSolventChange}
                        >
                          <SelectTrigger className="h-10 text-foreground">
                            <SelectValue placeholder="Select solvent" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No solvent</SelectItem>
                            {solventOptions.map((solvent) => (
                              <SelectItem key={solvent.id} value={solvent.id}>
                                {solvent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Formula dilution info</Label>
                        <div className="flex min-h-10 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                          {dilutionEnabled
                            ? `${item.dilution_percent}%${item.dilution_solvent_name ? ` in ${item.dilution_solvent_name}` : ''}`
                            : 'No formula-level dilution'}
                        </div>
                      </div>
                    </div>
                    {dilutionEnabled && (
                      <div className="mt-3 flex justify-end">
                        <Button type="button" variant="ghost" size="sm" onClick={handleClearDilution}>
                          Clear dilution
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            className="mt-6 h-9 w-9 shrink-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-xs text-destructive px-1">{error}</p>
      )}
    </div>
  );
};

export default FormulaItemRow;
