
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, AlertCircle } from 'lucide-react';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import FormulaItemRow from '@/components/FormulaItemRow.jsx';
import { calculatePercentages, validateFormulaItems } from '@/utils/formulaCalculations.js';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { validateGramAmount } from '@/utils/validation.js';
import { formatGramAmount, formatPercentage } from '@/utils/formatting.js';
import { FORMULA_STATUSES } from '@/utils/constants.js';
import { getRawMaterials } from '@/services/rawMaterialsService.js';
import { getAccords } from '@/services/accordsSupabaseService.js';
import { blurNumberInputOnWheel } from '@/utils/numberInputs.js';

const EditFormulaModal = ({ open, onOpenChange, formula, onSuccess }) => {
  const { updateFormula, loading } = useFormulas();
  const { getFormulaItems } = useFormulaItems();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('draft');
  const [markupPercentage, setMarkupPercentage] = useState('0');
  const [packagingCost, setPackagingCost] = useState('0');
  const [bottleCost, setBottleCost] = useState('0');
  const [capCost, setCapCost] = useState('0');
  const [notes, setNotes] = useState('');
  const [formulaItems, setFormulaItems] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [accords, setAccords] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (open && formula) {
      loadData();
    }
  }, [open, formula]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [materialsData, accordsData, itemsData] = await Promise.all([
        getRawMaterials(),
        getAccords(),
        getFormulaItems(formula.id)
      ]);

      setRawMaterials(materialsData);
      setAccords(accordsData);

      const formattedItems = itemsData.map((item) => ({
        item_type: item.item_type,
        item_id: item.item_id,
        gram_amount: item.grams || (item.percentage || 0).toString()
      }));

      setName(formula.name);
      setCode(formula.code);
      setVersion(formula.version || '');
      setStatus(formula.status || 'draft');
      setMarkupPercentage((formula.markup_percentage ?? 0).toString());
      setPackagingCost((formula.packaging_cost ?? 0).toString());
      setBottleCost((formula.bottle_cost ?? 0).toString());
      setCapCost((formula.cap_cost ?? 0).toString());
      setNotes(formula.notes || '');
      setFormulaItems(formattedItems);
      setValidationErrors({});
    } catch (error) {
      toast.error('Failed to load formula data');
    } finally {
      setLoadingData(false);
    }
  };

  const addFormulaItem = () => {
    setFormulaItems([...formulaItems, { item_id: '', gram_amount: '' }]);
  };

  const removeFormulaItem = (index) => {
    setFormulaItems(formulaItems.filter((_, i) => i !== index));
    const newErrors = { ...validationErrors };
    delete newErrors[`item_${index}`];
    setValidationErrors(newErrors);
  };

  const updateItem = (index, itemId) => {
    const updated = [...formulaItems];
    updated[index].item_id = itemId;
    
    const isRawMaterial = rawMaterials.some(m => m.id === itemId);
    const isAccord = accords.some(a => a.id === itemId);
    
    if (isRawMaterial) {
      const material = rawMaterials.find(m => m.id === itemId);
      updated[index].item_type = material.type === 'solvent' ? 'solvent' : 'raw_material';
    } else if (isAccord) {
      updated[index].item_type = 'accord';
    }
    
    setFormulaItems(updated);
  };

  const updateGramAmount = (index, gramAmount) => {
    const updated = [...formulaItems];
    updated[index].gram_amount = gramAmount;
    setFormulaItems(updated);
    
    const error = validateGramAmount(gramAmount);
    const newErrors = { ...validationErrors };
    if (error) {
      newErrors[`item_${index}`] = error;
    } else {
      delete newErrors[`item_${index}`];
    }
    setValidationErrors(newErrors);
  };

  const totalGrams = calculateTotalAmount(formulaItems);
  const itemsWithPercentages = totalGrams > 0 ? calculatePercentages(formulaItems, totalGrams) : [];

  const validateForm = () => {
    const errors = {};

    if (!name.trim()) {
      errors.name = 'Formula name is required';
    }
    if (!code.trim()) {
      errors.code = 'Formula code is required';
    }

    const ingredientErrors = validateFormulaItems(formulaItems);
    if (ingredientErrors.length > 0) {
      errors.ingredients = ingredientErrors.join(', ');
    }

    const materialIds = new Set();
    formulaItems.forEach((item, index) => {
      if (item.item_id && materialIds.has(item.item_id)) {
        errors[`item_${index}`] = 'Duplicate material';
      } else if (item.item_id) {
        materialIds.add(item.item_id);
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix validation errors');
      return;
    }

    try {
      const itemsForSubmit = itemsWithPercentages.map(item => ({
        item_type: item.item_type,
        item_id: item.item_id,
        percentage: item.percentage,
        grams: parseFloat(item.gram_amount)
      }));

      const totalAmount = calculateTotalAmount(formulaItems);

      await updateFormula(formula.id, { 
        name, 
        code, 
        category: null,
        version: version || null, 
        status,
        markup_percentage: markupPercentage ? parseFloat(markupPercentage) : 0,
        packaging_cost: packagingCost ? parseFloat(packagingCost) : 0,
        bottle_cost: bottleCost ? parseFloat(bottleCost) : 0,
        cap_cost: capCost ? parseFloat(capCost) : 0,
        notes: notes || null,
        total_amount: totalAmount
      }, itemsForSubmit);
      
      toast.success('Formula updated successfully');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.message || 'Failed to update formula');
    }
  };

  const hasErrors = Object.keys(validationErrors).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>Edit formula</DialogTitle>
          <DialogDescription>Update the formula details and ingredient amounts.</DialogDescription>
        </DialogHeader>
        
        {loadingData ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <h3 className="font-semibold text-base">Basic information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-formula-name" className="text-sm font-medium">Formula name *</Label>
                  <Input
                    id="edit-formula-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Summer Breeze"
                    className="text-foreground"
                  />
                  {validationErrors.name && (
                    <p className="text-xs text-destructive">{validationErrors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-formula-code" className="text-sm font-medium">Formula code *</Label>
                  <Input
                    id="edit-formula-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g., SB-001"
                    className="text-foreground"
                  />
                  {validationErrors.code && (
                    <p className="text-xs text-destructive">{validationErrors.code}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-formula-version" className="text-sm font-medium">Version</Label>
                  <Input
                    id="edit-formula-version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="e.g., 1.0"
                    className="text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-formula-status" className="text-sm font-medium">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="text-foreground h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMULA_STATUSES.map(stat => (
                        <SelectItem key={stat.value} value={stat.value}>
                          {stat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-formula-markup" className="text-sm font-medium">Markup %</Label>
                  <Input
                    id="edit-formula-markup"
                    type="number"
                    min="0"
                    step="0.1"
                    value={markupPercentage}
                    onChange={(e) => setMarkupPercentage(e.target.value)}
                    onWheel={blurNumberInputOnWheel}
                    placeholder="0"
                    className="text-foreground"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-formula-packaging-cost" className="text-sm font-medium">Packaging cost</Label>
                  <Input
                    id="edit-formula-packaging-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={packagingCost}
                    onChange={(e) => setPackagingCost(e.target.value)}
                    onWheel={blurNumberInputOnWheel}
                    placeholder="0"
                    className="text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-formula-bottle-cost" className="text-sm font-medium">Bottle cost</Label>
                  <Input
                    id="edit-formula-bottle-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={bottleCost}
                    onChange={(e) => setBottleCost(e.target.value)}
                    onWheel={blurNumberInputOnWheel}
                    placeholder="0"
                    className="text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-formula-cap-cost" className="text-sm font-medium">Cap cost</Label>
                  <Input
                    id="edit-formula-cap-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={capCost}
                    onChange={(e) => setCapCost(e.target.value)}
                    onWheel={blurNumberInputOnWheel}
                    placeholder="0"
                    className="text-foreground"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">Formula ingredients</h3>
                <Button type="button" onClick={addFormulaItem} size="sm" variant="outline" className="gap-2 h-9">
                  <Plus className="w-4 h-4" />
                  Add ingredient
                </Button>
              </div>

              {validationErrors.ingredients && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">{validationErrors.ingredients}</p>
                </div>
              )}

              {formulaItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg text-sm">
                  No ingredients yet. Click "Add ingredient" to start building your formula.
                </div>
              ) : (
                <div className="space-y-2">
                  {formulaItems.map((item, index) => (
                    <FormulaItemRow
                      key={index}
                      item={item}
                      index={index}
                      onItemChange={updateItem}
                      onGramAmountChange={updateGramAmount}
                      onRemove={removeFormulaItem}
                      rawMaterials={rawMaterials}
                      accords={accords}
                      error={validationErrors[`item_${index}`]}
                    />
                  ))}
                </div>
              )}

              {formulaItems.length > 0 && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex justify-between items-center font-semibold text-sm">
                    <span>Total:</span>
                    <span className="font-mono">{formatGramAmount(totalGrams)}</span>
                  </div>
                  
                  {totalGrams > 0 && (
                    <div className="pt-3 border-t space-y-2">
                      <h4 className="font-medium text-xs text-muted-foreground">Calculated composition</h4>
                      {itemsWithPercentages.map((item, index) => {
                        const itemName = item.item_type === 'accord' 
                          ? accords.find(a => a.id === item.item_id)?.name
                          : rawMaterials.find(m => m.id === item.item_id)?.name;
                        
                        return (
                          <div key={index} className="flex justify-between text-xs">
                            <span>{itemName || 'Unknown'}</span>
                            <span className="font-mono">
                              {formatGramAmount(item.gram_amount)} ({formatPercentage(item.percentage)})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-formula-notes" className="text-sm font-medium">Notes</Label>
              <Textarea
                id="edit-formula-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Formula description, usage notes..."
                rows={2}
                className="text-foreground text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} size="sm">
                Cancel
              </Button>
              <Button type="submit" disabled={loading || hasErrors || formulaItems.length === 0} size="sm">
                {loading ? 'Updating...' : 'Update formula'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditFormulaModal;
