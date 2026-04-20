import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import IngredientSelect from '@/components/IngredientSelect.jsx';
import { blurNumberInputOnWheel } from '@/utils/numberInputs.js';

const FormulaItemTableEditor = ({
  items,
  rawMaterials,
  focusRowIndex,
  activeRowIndex,
  onAutoFocusHandled,
  onActivateRow,
  onItemChange,
  onGramAmountChange,
  onDilutionChange,
  onRemove,
  validationErrors,
}) => {
  const solventOptions = rawMaterials.filter((material) => material.type === 'solvent');
  const ingredientOptions = rawMaterials.map((material) => ({
    ...material,
    type: material.type === 'solvent' ? 'solvent' : 'raw_material',
  }));

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#d7cfbf] bg-white shadow-sm">
      <div className="shrink-0 border-b border-[#ddd3bf] bg-[#f3ecdd] px-4 py-2.5 max-md:hidden">
        <div className="grid grid-cols-[38px_minmax(0,2.7fr)_96px_92px_minmax(0,1.5fr)_44px] gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
          <span>No.</span>
          <span>Raw material</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Dil. %</span>
          <span>Solvent</span>
          <span className="text-right">Del</span>
        </div>
      </div>

      <div className="overflow-hidden">
        <div className="space-y-3 p-3 md:hidden">
          {items.map((item, index) => {
            const rowNumber = index + 1;

            return (
              <div
                key={index}
                className={`overflow-hidden rounded-2xl border px-3 py-3 shadow-sm transition-colors ${
                  index === activeRowIndex
                    ? 'border-[#dfbf7d] bg-[#fff7e8]'
                    : index === 0
                      ? 'border-[#eadfc8] bg-[#fffaf1]'
                      : 'border-[#ece4d3] bg-white'
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="rounded-full border border-[#ded1b2] bg-[#f6eedc] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f603d]">
                    Row {rowNumber}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(index)}
                    className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                    title="Remove row"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="min-w-0">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                      Raw material
                    </div>
                    <IngredientSelect
                      value={item.item_id}
                      onChange={(ingredientId) => onItemChange(index, ingredientId)}
                      placeholder="Type material name"
                      ingredients={ingredientOptions}
                      autoFocus={focusRowIndex === index}
                      onAutoFocusHandled={onAutoFocusHandled}
                      compact
                      showSuggestions={false}
                      onActivate={() => onActivateRow?.(index)}
                    />
                    {validationErrors[`item_${index}`] ? (
                      <div className="mt-1.5 text-[11px] text-destructive">{validationErrors[`item_${index}`]}</div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                        Amount
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          step="0.001"
                          min="0.001"
                          max="999999"
                          value={item.gram_amount || ''}
                          onChange={(event) => onGramAmountChange(index, event.target.value)}
                          onWheel={blurNumberInputOnWheel}
                          onFocus={() => onActivateRow?.(index)}
                          placeholder="0.000"
                          className="h-9 w-full rounded-xl border-[#d8cfbf] px-3 text-right text-sm"
                        />
                        <span className="shrink-0 text-[11px] text-muted-foreground">g</span>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                        Dil. %
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.dilution_percent || ''}
                        onChange={(event) => onDilutionChange(index, 'dilution_percent', event.target.value)}
                        onWheel={blurNumberInputOnWheel}
                        onFocus={() => onActivateRow?.(index)}
                        placeholder="-"
                        className="h-9 w-full rounded-xl border-[#d8cfbf] px-3 text-right text-sm"
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                      Solvent
                    </div>
                    <Select
                      value={item.dilution_solvent_id || '__none__'}
                      onValueChange={(value) => onDilutionChange(index, 'dilution_solvent_id', value === '__none__' ? '' : value)}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0 rounded-xl border-[#d8cfbf] px-3 text-sm" onClick={() => onActivateRow?.(index)}>
                        <SelectValue placeholder="No solvent" />
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
                </div>
              </div>
            );
          })}

          {items.length === 0 ? (
            <div className="rounded-xl bg-white px-4 py-8 text-sm text-muted-foreground">
              No rows yet.
            </div>
          ) : null}
        </div>

        <div className="max-md:hidden">
          {items.map((item, index) => {
            const rowNumber = index + 1;

            return (
              <div
                key={index}
                className={`grid grid-cols-[38px_minmax(0,2.7fr)_96px_92px_minmax(0,1.5fr)_44px] items-center gap-2 border-b border-[#ece4d3] px-4 py-2 transition-colors ${
                  index === activeRowIndex
                    ? 'bg-[#fff6e6]'
                    : index === 0
                      ? 'bg-[#fffaf0]'
                      : 'bg-white'
                }`}
              >
                <div className="text-xs font-semibold tabular-nums text-[#5e5239]">
                  {rowNumber}
                </div>

                <div className="min-w-0">
                  <IngredientSelect
                    value={item.item_id}
                    onChange={(ingredientId) => onItemChange(index, ingredientId)}
                    placeholder="Type material name"
                    ingredients={ingredientOptions}
                    autoFocus={focusRowIndex === index}
                    onAutoFocusHandled={onAutoFocusHandled}
                    compact
                    showSuggestions={false}
                    onActivate={() => onActivateRow?.(index)}
                  />
                  {validationErrors[`item_${index}`] ? (
                    <div className="mt-1 truncate text-[10px] text-destructive">{validationErrors[`item_${index}`]}</div>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max="999999"
                    value={item.gram_amount || ''}
                    onChange={(event) => onGramAmountChange(index, event.target.value)}
                    onWheel={blurNumberInputOnWheel}
                    onFocus={() => onActivateRow?.(index)}
                    placeholder="0.000"
                    className="h-8 rounded-md border-[#d8cfbf] px-2 text-right text-sm"
                  />
                  <span className="shrink-0 text-[10px] text-muted-foreground">g</span>
                </div>

                <div>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.dilution_percent || ''}
                    onChange={(event) => onDilutionChange(index, 'dilution_percent', event.target.value)}
                    onWheel={blurNumberInputOnWheel}
                    onFocus={() => onActivateRow?.(index)}
                    placeholder="-"
                    className="h-8 rounded-md border-[#d8cfbf] px-2 text-right text-sm"
                  />
                </div>

                <div className="min-w-0">
                  <Select
                    value={item.dilution_solvent_id || '__none__'}
                    onValueChange={(value) => onDilutionChange(index, 'dilution_solvent_id', value === '__none__' ? '' : value)}
                  >
                    <SelectTrigger className="h-8 rounded-md border-[#d8cfbf] px-2 text-sm" onClick={() => onActivateRow?.(index)}>
                      <SelectValue placeholder="No solvent" />
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

                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(index)}
                    className="h-8 w-8 rounded-md text-destructive hover:text-destructive"
                    title="Remove row"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}

          {items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              No rows yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default FormulaItemTableEditor;
