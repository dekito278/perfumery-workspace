
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
import FormulaItemRow from '@/components/FormulaItemRow.jsx';
import { calculatePercentages, calculateTotalGrams, validateFormulaItems } from '@/utils/formulaCalculations.js';
import { validateGramAmount } from '@/utils/validation.js';
import { formatGramAmount, formatPercentage } from '@/utils/formatting.js';
import { FORMULA_STATUSES, FORMULA_CATEGORIES } from '@/utils/constants.js';
import pb from '@/lib/pocketbaseClient';

const AddFormulaModal = ({ open, onOpenChange, onSuccess }) => {
  const { createFormula, loading } = useFormulas();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [formulaItems, setFormulaItems] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [accords, setAccords] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (open) {
      loadData();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setName('');
    setCode('');
    setCategory('');
    setVersion('');
    setStatus('draft');
    setNotes('');
    setFormulaItems([]);
    setValidationErrors({});
  };

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [materialsData, accordsData] = await Promise.all([
        pb.collection('raw_materials').getFullList({ sort: 'name', $autoCancel: false }),
        pb.collection('accords').getFullList({ sort: 'name', $autoCancel: false })
      ]);
      setRawMaterials(materialsData);
      setAccords(accordsData);
    } catch (error) {
      toast.error('Failed to load materials and accords');
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

  const totalGrams = calculateTotalGrams(formulaItems);
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

      await createFormula({ 
        name, 
        code, 
        category: category || null,
        version: version || null, 
        status,
        notes: notes || null
      }, itemsForSubmit);
      
      toast.success('Formula created successfully');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.message || 'Failed to create formula');
    }
  };

  const hasErrors = Object.keys(validationErrors).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>Create new formula</DialogTitle>
          <DialogDescription>Build a perfume formula by specifying gram amounts for each ingredient.</DialogDescription>
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
                  <Label htmlFor="formula-name" className="text-sm font-medium">Formula name *</Label>
                  <Input
                    id="formula-name"
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
                  <Label htmlFor="formula-code" className="text-sm font-medium">Formula code *</Label>
                  <Input
                    id="formula-code"
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

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="formula-category" className="text-sm font-medium">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="text-foreground h-9">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMULA_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formula-version" className="text-sm font-medium">Version</Label>
                  <Input
                    id="formula-version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="e.g., 1.0"
                    className="text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formula-status" className="text-sm font-medium">Status</Label>
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
              <Label htmlFor="formula-notes" className="text-sm font-medium">Notes</Label>
              <Textarea
                id="formula-notes"
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
                {loading ? 'Creating...' : 'Create formula'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddFormulaModal;
