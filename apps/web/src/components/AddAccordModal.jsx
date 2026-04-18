
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, AlertCircle } from 'lucide-react';
import { useAccords } from '@/hooks/useAccords.js';
import AccordItemRow from '@/components/AccordItemRow.jsx';
import { calculateAccordPercentages, calculateAccordTotalGrams } from '@/utils/calculateAccordPercentages.js';
import { validateGramAmount } from '@/utils/validation.js';
import { formatGramAmount, formatPercentage } from '@/utils/formatting.js';
import { getRawMaterials } from '@/services/rawMaterialsService.js';

const AddAccordModal = ({ open, onOpenChange, onSuccess }) => {
  const { addAccord, loading } = useAccords();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [recipeItems, setRecipeItems] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (open) {
      console.log('=== ADD ACCORD MODAL OPENED ===');
      loadMaterials();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setName('');
    setNotes('');
    setRecipeItems([]);
    setValidationErrors({});
  };

  const loadMaterials = async () => {
    setLoadingMaterials(true);
    try {
      const data = await getRawMaterials();
      console.log('Materials loaded:', data.length);
      setMaterials(data);
    } catch (error) {
      console.error('Failed to load materials:', error);
      toast.error('Failed to load materials');
    } finally {
      setLoadingMaterials(false);
    }
  };

  const addRecipeItem = () => {
    console.log('=== ITEM ADDED ===');
    const newItem = { raw_material_id: '', gram_amount: '' };
    console.log('New item:', newItem);
    setRecipeItems([...recipeItems, newItem]);
  };

  const removeRecipeItem = (index) => {
    console.log('Item removed at index:', index);
    setRecipeItems(recipeItems.filter((_, i) => i !== index));
    const newErrors = { ...validationErrors };
    delete newErrors[`item_${index}`];
    setValidationErrors(newErrors);
  };

  const updateRecipeItem = (index, materialId) => {
    console.log('=== UPDATING RECIPE ITEM ===');
    console.log('Index:', index);
    console.log('Material ID:', materialId);
    console.log('Material ID type:', typeof materialId);
    
    // Ensure materialId is a string ID, not an object
    const idString = typeof materialId === 'string' ? materialId : (materialId?.id || '');
    console.log('Extracted ID string:', idString);
    
    const updated = [...recipeItems];
    updated[index].raw_material_id = idString;
    
    console.log('Updated item:', updated[index]);
    setRecipeItems(updated);
  };

  const updateGramAmount = (index, gramAmount) => {
    console.log('Updating gram amount:', { index, gramAmount, type: typeof gramAmount });
    
    const updated = [...recipeItems];
    updated[index].gram_amount = gramAmount;
    setRecipeItems(updated);
    
    const error = validateGramAmount(gramAmount);
    const newErrors = { ...validationErrors };
    if (error) {
      newErrors[`item_${index}`] = error;
    } else {
      delete newErrors[`item_${index}`];
    }
    setValidationErrors(newErrors);
  };

  const totalGrams = calculateAccordTotalGrams(recipeItems);
  const itemsWithPercentages = totalGrams > 0 ? calculateAccordPercentages(recipeItems) : [];
  const totalPercentage = itemsWithPercentages.reduce((sum, item) => sum + item.percentage, 0);

  const validateForm = () => {
    const errors = {};

    if (!name.trim()) {
      errors.name = 'Accord name is required';
    }

    if (recipeItems.length === 0) {
      errors.ingredients = 'Please add at least one recipe item';
    }

    recipeItems.forEach((item, index) => {
      if (!item.raw_material_id) {
        errors[`item_${index}`] = 'Material is required';
      }
      if (!item.gram_amount || item.gram_amount === '') {
        errors[`item_${index}`] = 'Amount is required';
      } else {
        const gramError = validateGramAmount(item.gram_amount);
        if (gramError) {
          errors[`item_${index}`] = gramError;
        }
      }
    });

    const materialIds = new Set();
    recipeItems.forEach((item, index) => {
      if (item.raw_material_id && materialIds.has(item.raw_material_id)) {
        errors[`item_${index}`] = 'Duplicate material';
      } else if (item.raw_material_id) {
        materialIds.add(item.raw_material_id);
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('=== SAVE CLICKED ===');
    console.log('Checkpoint: Form submitted');
    console.log('Form data:', { name, notes });
    console.log('Recipe items (raw):', JSON.stringify(recipeItems, null, 2));
    console.log('Items with percentages:', JSON.stringify(itemsWithPercentages, null, 2));
    console.log('Total grams:', totalGrams);
    console.log('Total percentage:', totalPercentage);

    if (!validateForm()) {
      console.error('Form validation failed:', validationErrors);
      toast.error('Please fix validation errors');
      return;
    }

    try {
      // Prepare accord data
      const accordData = {
        name: name.trim(),
        notes: notes.trim() || undefined,
        unit: 'ml'
      };

      // Prepare items with percentages
      // Ensure raw_material_id is a string and percentage is a number
      const itemsForSubmit = itemsWithPercentages.map((item, index) => {
        const materialId = String(item.raw_material_id || '').trim();
        const percentage = Number(item.percentage);
        
        console.log(`Preparing item ${index + 1} for submit:`, {
          raw_material_id: materialId,
          raw_material_id_type: typeof materialId,
          percentage: percentage,
          percentage_type: typeof percentage,
          percentage_isNumber: !isNaN(percentage)
        });
        
        return {
          raw_material_id: materialId,
          percentage: percentage
        };
      });

      console.log('=== SUBMITTING TO SERVICE ===');
      console.log('Accord data:', JSON.stringify(accordData, null, 2));
      console.log('Items for submit:', JSON.stringify(itemsForSubmit, null, 2));

      const result = await addAccord(accordData, itemsForSubmit);
      
      console.log('✓ Accord created successfully:', result);
      toast.success('Accord created successfully');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('✗ Failed to create accord:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        data: error.data,
        validationErrors: error.data?.data
      });
      
      // Extract and display detailed validation errors
      if (error.data?.data) {
        const validationErrors = Object.entries(error.data.data)
          .map(([field, err]) => {
            const message = err.message || err.code || JSON.stringify(err);
            return `${field}: ${message}`;
          })
          .join(', ');
        
        console.error('Formatted validation errors:', validationErrors);
        toast.error(`Validation failed: ${validationErrors}`);
      } else {
        toast.error(error.message || 'Failed to create accord');
      }
    }
  };

  const hasErrors = Object.keys(validationErrors).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>Create new accord</DialogTitle>
          <DialogDescription>Build a custom accord by specifying gram amounts for each ingredient.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <h3 className="font-semibold text-base">Basic information</h3>
            <div className="space-y-2">
              <Label htmlFor="accord-name" className="text-sm font-medium">Accord name *</Label>
              <Input
                id="accord-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Rose Accord, Citrus Blend"
                required
                className="text-foreground"
              />
              {validationErrors.name && (
                <p className="text-xs text-destructive">{validationErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="accord-notes" className="text-sm font-medium">Notes</Label>
              <Textarea
                id="accord-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Description, usage notes, or characteristics..."
                rows={2}
                className="text-foreground text-sm"
              />
            </div>
          </div>

          <div className="border-t pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">Recipe ingredients</h3>
              <Button type="button" onClick={addRecipeItem} size="sm" variant="outline" className="gap-2 h-9">
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

            {recipeItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg text-sm">
                No ingredients yet. Click "Add ingredient" to start building your accord.
              </div>
            ) : (
              <div className="space-y-2">
                {recipeItems.map((item, index) => (
                  <AccordItemRow
                    key={index}
                    item={item}
                    index={index}
                    onItemChange={updateRecipeItem}
                    onGramAmountChange={updateGramAmount}
                    onRemove={removeRecipeItem}
                    rawMaterials={materials}
                    error={validationErrors[`item_${index}`]}
                  />
                ))}
              </div>
            )}

            {recipeItems.length > 0 && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                <div className="flex justify-between items-center font-semibold text-sm">
                  <span>Total:</span>
                  <span className="font-mono">{formatGramAmount(totalGrams)}</span>
                </div>
                
                {totalGrams > 0 && (
                  <div className="pt-3 border-t space-y-2">
                    <h4 className="font-medium text-xs text-muted-foreground">Calculated composition</h4>
                    {itemsWithPercentages.map((item, index) => {
                      const itemName = materials.find(m => m.id === item.raw_material_id)?.name || 'Unknown';
                      
                      return (
                        <div key={index} className="flex justify-between text-xs">
                          <span>{itemName}</span>
                          <span className="font-mono">
                            {formatGramAmount(item.gram_amount)} ({formatPercentage(item.percentage)})
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between items-center pt-2 border-t font-semibold text-xs">
                      <span>Total percentage:</span>
                      <span className="font-mono">{formatPercentage(totalPercentage)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} size="sm">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || hasErrors || recipeItems.length === 0} size="sm">
              {loading ? 'Creating...' : 'Create accord'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddAccordModal;
