import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, AlertCircle } from 'lucide-react';
import { useAccords } from '@/hooks/useAccords.js';
import AccordItemRow from '@/components/AccordItemRow.jsx';
import { calculateAccordPercentages, calculateAccordTotalGrams } from '@/utils/calculateAccordPercentages.js';
import { validateGramAmount } from '@/utils/validation.js';
import { formatGramAmount, formatPercentage } from '@/utils/formatting.js';
import { getRawMaterials } from '@/services/rawMaterialsService.js';

const emptyRecipeItem = () => ({
  raw_material_id: '',
  gram_amount: '',
  dilution_percent: '',
  dilution_solvent_id: '',
  dilution_solvent_name: '',
});

const EditAccordModal = ({ open, onOpenChange, accord, onSuccess }) => {
  const { editAccord, fetchAccordItems, loading } = useAccords();
  const [name, setName] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [notes, setNotes] = useState('');
  const [recipeItems, setRecipeItems] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (open && accord) {
      loadData();
    }
  }, [open, accord]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const materialsData = await getRawMaterials();
      const items = await fetchAccordItems(accord.id);

      setMaterials(materialsData);
      setName(accord.name);
      setAuthorName(accord.author_name || '');
      setNotes(accord.notes || '');
      setRecipeItems(
        items.map((item) => ({
          raw_material_id: item.raw_material_id,
          gram_amount: item.percentage.toString(),
          dilution_percent: item.dilution_percent?.toString() || '',
          dilution_solvent_id: item.dilution_solvent_id || '',
          dilution_solvent_name: item.dilution_solvent_id
            ? materialsData.find((material) => material.id === item.dilution_solvent_id)?.name || ''
            : '',
        }))
      );
      setValidationErrors({});
    } catch (error) {
      console.error('Failed to load accord data:', error);
      toast.error('Failed to load accord data');
    } finally {
      setLoadingData(false);
    }
  };

  const addRecipeItem = () => {
    setRecipeItems((currentItems) => [...currentItems, emptyRecipeItem()]);
  };

  const removeRecipeItem = (index) => {
    setRecipeItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index));
    setValidationErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[`item_${index}`];
      return nextErrors;
    });
  };

  const updateRecipeItem = (index, materialId) => {
    const nextMaterialId = typeof materialId === 'string' ? materialId : (materialId?.id || '');

    setRecipeItems((currentItems) => {
      const nextItems = [...currentItems];
      nextItems[index] = {
        ...nextItems[index],
        raw_material_id: nextMaterialId,
      };
      return nextItems;
    });
  };

  const updateGramAmount = (index, gramAmount) => {
    setRecipeItems((currentItems) => {
      const nextItems = [...currentItems];
      nextItems[index] = {
        ...nextItems[index],
        gram_amount: gramAmount,
      };
      return nextItems;
    });

    const error = validateGramAmount(gramAmount);
    setValidationErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      if (error) {
        nextErrors[`item_${index}`] = error;
      } else {
        delete nextErrors[`item_${index}`];
      }
      return nextErrors;
    });
  };

  const updateDilutionConfig = (index, field, value) => {
    setRecipeItems((currentItems) => {
      const nextItems = [...currentItems];
      const nextItem = { ...nextItems[index] };

      if (field === 'clear_dilution') {
        nextItem.dilution_percent = '';
        nextItem.dilution_solvent_id = '';
        nextItem.dilution_solvent_name = '';
      } else {
        nextItem[field] = value;
      }

      if (field === 'dilution_solvent_id') {
        const solvent = materials.find((material) => material.id === value);
        nextItem.dilution_solvent_name = solvent?.name || '';
      }

      if (field === 'dilution_percent' && (value === '' || Number(value) <= 0)) {
        nextItem.dilution_percent = '';
        nextItem.dilution_solvent_id = '';
        nextItem.dilution_solvent_name = '';
      }

      nextItems[index] = nextItem;
      return nextItems;
    });

    setValidationErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors.ingredients;
      delete nextErrors[`item_${index}`];
      return nextErrors;
    });
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

      const dilutionPercent = parseFloat(item.dilution_percent);
      const hasDilutionPercent = !Number.isNaN(dilutionPercent) && dilutionPercent > 0;
      const hasDilutionConfig = hasDilutionPercent || Boolean(item.dilution_solvent_id);
      if (hasDilutionConfig) {
        if (!hasDilutionPercent || dilutionPercent > 100) {
          errors[`item_${index}`] = 'Dilution percentage must be between 0 and 100';
        } else if (!item.dilution_solvent_id) {
          errors[`item_${index}`] = 'Dilution solvent is required';
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

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix validation errors');
      return;
    }

    try {
      const itemsForSubmit = itemsWithPercentages.map((item) => ({
        raw_material_id: String(item.raw_material_id || '').trim(),
        percentage: Number(item.percentage),
        dilution_percent: item.dilution_percent ? Number(item.dilution_percent) : null,
        dilution_solvent_id: item.dilution_solvent_id || null,
        concentrate_amount: item.dilution_percent
          ? Number(((parseFloat(item.gram_amount) * parseFloat(item.dilution_percent)) / 100).toFixed(3))
          : null,
      }));

      await editAccord(accord.id, { name, author_name: authorName, notes }, itemsForSubmit);

      toast.success('Accord updated successfully');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.message || 'Failed to update accord');
    }
  };

  const hasErrors = Object.keys(validationErrors).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>Edit accord</DialogTitle>
          <DialogDescription>Update the accord recipe and ingredient amounts.</DialogDescription>
        </DialogHeader>
        {loadingData ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <h3 className="font-semibold text-base">Basic information</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-accord-name" className="text-sm font-medium">Accord name *</Label>
                  <Input
                    id="edit-accord-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g., Rose Accord, Citrus Blend"
                    required
                    className="text-foreground"
                  />
                  {validationErrors.name && (
                    <p className="text-xs text-destructive">{validationErrors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-accord-author" className="text-sm font-medium">By</Label>
                  <Input
                    id="edit-accord-author"
                    value={authorName}
                    onChange={(event) => setAuthorName(event.target.value)}
                    placeholder="Optional creator name"
                    className="text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-accord-notes" className="text-sm font-medium">Notes</Label>
                <Textarea
                  id="edit-accord-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
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
                      onDilutionChange={updateDilutionConfig}
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
                        const itemName = materials.find((material) => material.id === item.raw_material_id)?.name || 'Unknown';
                        const solventName = item.dilution_solvent_id
                          ? materials.find((material) => material.id === item.dilution_solvent_id)?.name
                          : '';

                        return (
                          <div key={index} className="flex justify-between text-xs">
                            <span>
                              {itemName}
                              {item.dilution_percent && (
                                <span className="text-muted-foreground">
                                  {` ${item.dilution_percent}%${solventName ? ` in ${solventName}` : ''}`}
                                </span>
                              )}
                            </span>
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
                {loading ? 'Updating...' : 'Update accord'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditAccordModal;
