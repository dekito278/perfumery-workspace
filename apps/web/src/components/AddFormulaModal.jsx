
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import { useFormulas } from '@/hooks/useFormulas.js';
import FormulaItemRow from '@/components/FormulaItemRow.jsx';
import { calculatePercentages, calculateTotalGrams, validateFormulaItems } from '@/utils/formulaCalculations.js';
import { validateGramAmount } from '@/utils/validation.js';
import { formatGramAmount, formatPercentage } from '@/utils/formatting.js';
import { FORMULA_CATEGORIES, FORMULA_STATUSES } from '@/utils/constants.js';
import { getRawMaterials } from '@/services/rawMaterialsService.js';
import { getReferenceLinksByRawMaterialIds } from '@/services/materialReferenceService.js';
import FormulaWorkbookSimulationPanel from '@/components/FormulaWorkbookSimulationPanel.jsx';

const AddFormulaModal = ({ open, onOpenChange, onSuccess }) => {
  const { createFormula, loading } = useFormulas();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('perfume');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [formulaItems, setFormulaItems] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [referenceLinksMap, setReferenceLinksMap] = useState(new Map());
  const [loadingData, setLoadingData] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [focusRowIndex, setFocusRowIndex] = useState(null);

  const createEmptyFormulaItem = () => ({
    item_id: '',
    gram_amount: '',
    dilution_percent: '',
    dilution_solvent_id: '',
    dilution_solvent_name: '',
    item_type: '',
  });

  const getActiveFormulaItems = (items) =>
    items.filter((item) => item.item_id || item.gram_amount || item.dilution_percent || item.dilution_solvent_id);

  const normalizeFormulaItems = (items) => [createEmptyFormulaItem(), ...getActiveFormulaItems(items)];

  useEffect(() => {
    if (open) {
      loadData();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setName('');
    setCode('');
    setCategory('perfume');
    setVersion('');
    setStatus('draft');
    setNotes('');
    setFormulaItems([createEmptyFormulaItem()]);
    setValidationErrors({});
    setFocusRowIndex(0);
  };

  const loadData = async () => {
    setLoadingData(true);
    try {
      const materialsData = await getRawMaterials();
      setRawMaterials(materialsData);
    } catch (error) {
      toast.error('Failed to load raw materials');
    } finally {
      setLoadingData(false);
    }
  };

  const removeFormulaItem = (index) => {
    const remainingItems = formulaItems.filter((_, i) => i !== index);
    setFormulaItems(normalizeFormulaItems(remainingItems));
    const newErrors = { ...validationErrors };
    delete newErrors[`item_${index}`];
    setValidationErrors(newErrors);
  };

  const updateItem = (index, itemId) => {
    const updated = [...formulaItems];
    updated[index].item_id = itemId;
    updated[index].item_type = '';
    
    const isRawMaterial = rawMaterials.some(m => m.id === itemId);
    if (isRawMaterial) {
      const material = rawMaterials.find(m => m.id === itemId);
      updated[index].item_type = material.type === 'solvent' ? 'solvent' : 'raw_material';
    }
    
    setFormulaItems(updated);
  };

  const handleCommitRow = (index) => {
    setFormulaItems((currentItems) => {
      const committedItem = currentItems[index];

      if (!committedItem?.item_id || parseFloat(committedItem.gram_amount) <= 0) {
        return currentItems;
      }

      const remainingItems = currentItems.filter((_, itemIndex) => itemIndex !== index);
      setFocusRowIndex(0);
      return [createEmptyFormulaItem(), committedItem, ...getActiveFormulaItems(remainingItems)];
    });
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

  const updateDilutionConfig = (index, field, value) => {
    const updated = [...formulaItems];

    if (field === 'clear_dilution') {
      updated[index].dilution_percent = '';
      updated[index].dilution_solvent_id = '';
      updated[index].dilution_solvent_name = '';
    } else {
      updated[index][field] = value;
    }

    if (field === 'dilution_solvent_id') {
      const solvent = rawMaterials.find((material) => material.id === value);
      updated[index].dilution_solvent_name = solvent?.name || '';
    }

    if (field === 'dilution_percent' && (value === '' || Number(value) <= 0)) {
      updated[index].dilution_percent = '';
      updated[index].dilution_solvent_id = '';
      updated[index].dilution_solvent_name = '';
    }

    setFormulaItems(updated);
    const nextErrors = { ...validationErrors };
    delete nextErrors.ingredients;
    delete nextErrors[`item_${index}`];
    setValidationErrors(nextErrors);
  };

  const activeFormulaItems = getActiveFormulaItems(formulaItems);
  const totalGrams = calculateTotalGrams(activeFormulaItems);
  const itemsWithPercentages = totalGrams > 0 ? calculatePercentages(activeFormulaItems, totalGrams) : [];
  const rawMaterialsById = useMemo(
    () => new Map(rawMaterials.map((material) => [material.id, material])),
    [rawMaterials]
  );
  const selectedRawMaterialIdsKey = useMemo(
    () => [...new Set(activeFormulaItems.map((item) => item.item_id).filter(Boolean))].sort().join('|'),
    [activeFormulaItems]
  );
  const selectedRawMaterialIds = useMemo(
    () => (selectedRawMaterialIdsKey ? selectedRawMaterialIdsKey.split('|') : []),
    [selectedRawMaterialIdsKey]
  );

  useEffect(() => {
    let active = true;

    const loadReferenceLinks = async () => {
      if (!selectedRawMaterialIds.length) {
        if (active) {
          setReferenceLinksMap(new Map());
        }
        return;
      }

      try {
        const nextMap = await getReferenceLinksByRawMaterialIds(selectedRawMaterialIds);
        if (active) {
          setReferenceLinksMap(nextMap);
        }
      } catch (error) {
        if (active) {
          setReferenceLinksMap(new Map());
        }
      }
    };

    loadReferenceLinks();

    return () => {
      active = false;
    };
  }, [selectedRawMaterialIds]);

  const validateForm = () => {
    const errors = {};

    if (!name.trim()) {
      errors.name = 'Formula name is required';
    }
    if (!code.trim()) {
      errors.code = 'Formula code is required';
    }

    const ingredientErrors = validateFormulaItems(activeFormulaItems);
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
        grams: parseFloat(item.gram_amount),
        dilution_percent: item.dilution_percent ? parseFloat(item.dilution_percent) : null,
        dilution_solvent_id: item.dilution_solvent_id || null,
        concentrate_amount: item.dilution_percent
          ? Number(((parseFloat(item.gram_amount) * parseFloat(item.dilution_percent)) / 100).toFixed(3))
          : null,
      }));

      await createFormula({ 
        name, 
        code, 
        category,
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
          <DialogDescription>Type a material, enter the grams, then confirm it while the next input stays ready at the top.</DialogDescription>
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="formula-category" className="text-sm font-medium">Formula category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="formula-category" className="text-foreground h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMULA_CATEGORIES.map((formulaCategory) => (
                        <SelectItem key={formulaCategory.value} value={formulaCategory.value}>
                          {formulaCategory.label}
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
                <div className="space-y-2 md:col-span-2">
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
              <div className="space-y-1">
                <h3 className="font-semibold text-base">Formula ingredients</h3>
                <p className="text-sm text-muted-foreground">
                  Start at the top. After you confirm one ingredient, it moves into the list and a fresh row stays ready above it.
                </p>
              </div>

              {validationErrors.ingredients && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">{validationErrors.ingredients}</p>
                </div>
              )}

              <div className="space-y-3">
                {formulaItems.map((item, index) => (
                  <FormulaItemRow
                    key={index}
                    item={item}
                    index={index}
                    onItemChange={updateItem}
                    onGramAmountChange={updateGramAmount}
                    onDilutionChange={updateDilutionConfig}
                    onCommit={handleCommitRow}
                    onRemove={removeFormulaItem}
                    rawMaterials={rawMaterials}
                    error={validationErrors[`item_${index}`]}
                    autoFocusMaterial={focusRowIndex === index}
                    onAutoFocusHandled={() => setFocusRowIndex(null)}
                  />
                ))}
              </div>

              {activeFormulaItems.length > 0 && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex justify-between items-center font-semibold text-sm">
                    <span>Total:</span>
                    <span className="font-mono">{formatGramAmount(totalGrams)}</span>
                  </div>
                  
                  {totalGrams > 0 && (
                    <div className="pt-3 border-t space-y-2">
                      <h4 className="font-medium text-xs text-muted-foreground">Calculated composition</h4>
                      {itemsWithPercentages.map((item, index) => {
                        const itemName = rawMaterials.find(m => m.id === item.item_id)?.name;
                        const solventName = item.dilution_solvent_id
                          ? rawMaterials.find((material) => material.id === item.dilution_solvent_id)?.name
                          : '';
                        
                        return (
                          <div key={index} className="flex justify-between text-xs">
                            <span>
                              {itemName || 'Unknown'}
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
                    </div>
                  )}
                </div>
              )}

              {itemsWithPercentages.length > 0 && (
                <FormulaWorkbookSimulationPanel
                  items={itemsWithPercentages}
                  rawMaterialsById={rawMaterialsById}
                  referenceLinksMap={referenceLinksMap}
                  description="Workbook metrics update live while you build the formula. IFRA checks stay informational and never block create."
                />
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
              <Button type="submit" disabled={loading || hasErrors || activeFormulaItems.length === 0} size="sm">
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
