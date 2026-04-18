
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import IngredientSelect from '@/components/IngredientSelect.jsx';

const FormulaItemRow = ({ 
  item, 
  index,
  onItemChange, 
  onGramAmountChange, 
  onRemove, 
  rawMaterials,
  accords,
  error
}) => {
  const allIngredients = [
    ...rawMaterials.map(m => ({ ...m, type: 'raw_material' })),
    ...accords.map(a => ({ ...a, type: 'accord', unit: a.unit || 'g' }))
  ];

  return (
    <div className="space-y-2 mb-5">
      <div className="flex gap-4 items-start p-4 border rounded-lg bg-muted/30">
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Ingredient</Label>
            <IngredientSelect
              value={item.item_id}
              onChange={(ingredientId) => onItemChange(index, ingredientId)}
              placeholder="Select ingredient"
              ingredients={allIngredients}
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
                placeholder="0.000"
                className="text-foreground"
              />
              <span className="text-sm text-muted-foreground shrink-0">g</span>
            </div>
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

export default FormulaItemRow;
