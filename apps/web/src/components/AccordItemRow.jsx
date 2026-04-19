
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import IngredientSelect from '@/components/IngredientSelect.jsx';
import { blurNumberInputOnWheel } from '@/utils/numberInputs.js';

const AccordItemRow = ({ 
  item, 
  index,
  onItemChange, 
  onGramAmountChange, 
  onDilutionChange,
  onRemove, 
  rawMaterials,
  error
}) => {
  const solventOptions = rawMaterials.filter((material) => material.type === 'solvent');
  const selectedMaterial = rawMaterials.find((material) => material.id === item.raw_material_id);
  const dilutionEnabled = Boolean(item.dilution_percent || item.dilution_solvent_id);

  const handleDilutionSolventChange = (value) => {
    onDilutionChange(index, 'dilution_solvent_id', value === '__none__' ? '' : value);
  };

  return (
    <div className="space-y-2 mb-5">
      <div className="flex gap-4 items-start p-4 border rounded-lg bg-muted/30">
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Raw material</Label>
              <IngredientSelect
                value={item.raw_material_id}
                onChange={(materialId) => onItemChange(index, materialId)}
                placeholder="Select material"
                ingredients={rawMaterials}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Amount (g)</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  max="999999"
                  value={item.gram_amount || ''}
                  onChange={(e) => onGramAmountChange(index, e.target.value)}
                  onWheel={blurNumberInputOnWheel}
                  placeholder="0.000"
                  className="text-foreground"
                />
                <span className="text-sm text-muted-foreground shrink-0">g</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-background/80 p-3">
            <div className="grid gap-4 md:grid-cols-[0.7fr_1fr_1fr]">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Dilution %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={item.dilution_percent || ''}
                  onChange={(e) => onDilutionChange(index, 'dilution_percent', e.target.value)}
                  onWheel={blurNumberInputOnWheel}
                  placeholder={selectedMaterial?.dilution_percentage ? String(selectedMaterial.dilution_percentage) : 'Optional'}
                  className="text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Dilution solvent</Label>
                <Select
                  value={item.dilution_solvent_id || ''}
                  onValueChange={handleDilutionSolventChange}
                >
                  <SelectTrigger className="text-foreground h-10">
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
                <Label className="text-xs font-medium">Accord dilution info</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                  {dilutionEnabled
                    ? `${item.dilution_percent}%${item.dilution_solvent_name ? ` in ${item.dilution_solvent_name}` : ''}`
                    : 'No accord-level dilution'}
                </div>
              </div>
            </div>
            {dilutionEnabled && (
              <div className="mt-3 flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => onDilutionChange(index, 'clear_dilution', '')}>
                  Clear dilution
                </Button>
              </div>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          className="mt-7 text-destructive hover:text-destructive h-9 w-9"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive px-4">{error}</p>
      )}
    </div>
  );
};

export default AccordItemRow;
