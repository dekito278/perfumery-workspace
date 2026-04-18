
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { calculateBatchQuantities } from '@/utils/calculateBatchQuantities.js';
import { formatQuantity, formatPercentage } from '@/utils/formatting.js';
import { getFormulas } from '@/services/formulasSupabaseService.js';
import { getSolvents } from '@/services/rawMaterialsService.js';
import { blurNumberInputOnWheel } from '@/utils/numberInputs.js';

const BatchProductionForm = ({ initialData = null, preSelectedFormulaId = null, onSubmit, onCancel, loading }) => {
  const [formulas, setFormulas] = useState([]);
  const [solvents, setSolvents] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [formData, setFormData] = useState({
    batch_code: '',
    formula_id: preSelectedFormulaId || '',
    solvent_id: '',
    target_quantity: '',
    formula_percentage: '20',
    production_date: new Date().toISOString().split('T')[0],
    notes: '',
    status: 'draft',
    unit: 'ml'
  });
  const [calculatedQuantities, setCalculatedQuantities] = useState({
    formulaQuantityNeeded: 0,
    solventQuantityNeeded: 0,
    solventPercentage: 80
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        batch_code: initialData.batch_code || '',
        formula_id: initialData.formula_id || '',
        solvent_id: initialData.solvent_id || '',
        target_quantity: initialData.target_quantity?.toString() || '',
        formula_percentage: initialData.formula_percentage?.toString() || '20',
        production_date: initialData.production_date || new Date().toISOString().split('T')[0],
        notes: initialData.notes || '',
        status: initialData.status || 'draft',
        unit: initialData.unit || 'ml'
      });
      
      if (initialData.target_quantity && initialData.formula_percentage) {
        calculateQuantities(initialData.target_quantity, initialData.formula_percentage);
      }
    }
  }, [initialData]);

  useEffect(() => {
    if (formData.target_quantity && formData.formula_percentage) {
      calculateQuantities(parseFloat(formData.target_quantity), parseFloat(formData.formula_percentage));
    }
  }, [formData.target_quantity, formData.formula_percentage]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [formulasData, solventsData] = await Promise.all([
        getFormulas(),
        getSolvents()
      ]);
      setFormulas(formulasData);
      setSolvents(solventsData.map((item) => ({ id: item.value, name: item.label })));
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load formulas and solvents');
    } finally {
      setLoadingData(false);
    }
  };

  const calculateQuantities = (targetQty, formulaPercent) => {
    try {
      const quantities = calculateBatchQuantities(targetQty, formulaPercent);
      setCalculatedQuantities(quantities);
    } catch (error) {
      console.error('Calculation error:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.batch_code.trim()) {
      newErrors.batch_code = 'Batch code is required';
    }

    if (!formData.formula_id) {
      newErrors.formula_id = 'Formula is required';
    }

    if (!formData.solvent_id) {
      newErrors.solvent_id = 'Solvent is required';
    }

    if (!formData.target_quantity || parseFloat(formData.target_quantity) <= 0) {
      newErrors.target_quantity = 'Target quantity must be greater than 0';
    }

    if (!formData.formula_percentage || parseFloat(formData.formula_percentage) <= 0 || parseFloat(formData.formula_percentage) > 100) {
      newErrors.formula_percentage = 'Formula percentage must be between 0 and 100';
    }

    if (!formData.production_date) {
      newErrors.production_date = 'Production date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix all errors before submitting');
      return;
    }

    const submitData = {
      batch_code: formData.batch_code,
      formula_id: formData.formula_id,
      solvent_id: formData.solvent_id,
      target_quantity: parseFloat(formData.target_quantity),
      produced_quantity: parseFloat(formData.target_quantity),
      formula_percentage: parseFloat(formData.formula_percentage),
      solvent_percentage: calculatedQuantities.solventPercentage,
      formula_quantity_needed: calculatedQuantities.formulaQuantityNeeded,
      solvent_quantity_needed: calculatedQuantities.solventQuantityNeeded,
      production_date: formData.production_date,
      notes: formData.notes || null,
      status: formData.status,
      unit: formData.unit
    };

    console.log('=== BATCH SUBMISSION DEBUG ===');
    console.log('Form data:', formData);
    console.log('Calculated quantities:', calculatedQuantities);
    console.log('Submit data:', submitData);

    onSubmit(submitData);
  };

  const isDraftBatch = !initialData || initialData.status === 'draft';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-4">
        <h3 className="font-semibold text-base">Basic information</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="batch-code" className="text-sm font-medium">Batch code *</Label>
            <Input
              id="batch-code"
              value={formData.batch_code}
              onChange={(e) => setFormData(prev => ({ ...prev, batch_code: e.target.value }))}
              placeholder="e.g., BATCH-001"
              required
              disabled={!isDraftBatch}
              className="text-foreground"
            />
            {errors.batch_code && (
              <p className="text-xs text-destructive">{errors.batch_code}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="production-date" className="text-sm font-medium">Production date *</Label>
            <Input
              id="production-date"
              type="date"
              value={formData.production_date}
              onChange={(e) => setFormData(prev => ({ ...prev, production_date: e.target.value }))}
              required
              className="text-foreground"
            />
            {errors.production_date && (
              <p className="text-xs text-destructive">{errors.production_date}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="formula" className="text-sm font-medium">Formula *</Label>
          <Select
            value={formData.formula_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, formula_id: value }))}
            disabled={!isDraftBatch || loadingData}
          >
            <SelectTrigger id="formula" className="text-foreground">
              <SelectValue placeholder="Select formula" />
            </SelectTrigger>
            <SelectContent>
              {formulas.map((formula) => (
                <SelectItem key={formula.id} value={formula.id}>
                  {formula.name} ({formula.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.formula_id && (
            <p className="text-xs text-destructive">{errors.formula_id}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status" className="text-sm font-medium">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger id="status" className="text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t pt-5 space-y-4">
        <h3 className="font-semibold text-base">Solvent & dilution</h3>

        <div className="space-y-2">
          <Label htmlFor="solvent" className="text-sm font-medium">Solvent material *</Label>
          <Select
            value={formData.solvent_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, solvent_id: value }))}
            disabled={!isDraftBatch || loadingData}
          >
            <SelectTrigger id="solvent" className="text-foreground">
              <SelectValue placeholder="Select solvent" />
            </SelectTrigger>
            <SelectContent>
              {solvents.map((solvent) => (
                <SelectItem key={solvent.id} value={solvent.id}>
                  {solvent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.solvent_id && (
            <p className="text-xs text-destructive">{errors.solvent_id}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="target-quantity" className="text-sm font-medium">Target batch size *</Label>
            <div className="flex gap-2">
              <Input
                id="target-quantity"
                type="number"
                value={formData.target_quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, target_quantity: e.target.value }))}
                onWheel={blurNumberInputOnWheel}
                placeholder="0.00"
                min="0"
                step="0.01"
                required
                disabled={!isDraftBatch}
                className="text-foreground"
              />
              <Select
                value={formData.unit}
                onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                disabled={!isDraftBatch}
              >
                <SelectTrigger className="w-20 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {errors.target_quantity && (
              <p className="text-xs text-destructive">{errors.target_quantity}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="formula-percentage" className="text-sm font-medium">Formula concentration *</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="formula-percentage"
                type="number"
                value={formData.formula_percentage}
                onChange={(e) => setFormData(prev => ({ ...prev, formula_percentage: e.target.value }))}
                onWheel={blurNumberInputOnWheel}
                placeholder="20"
                min="0"
                max="100"
                step="0.1"
                required
                disabled={!isDraftBatch}
                className="text-foreground"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            {errors.formula_percentage && (
              <p className="text-xs text-destructive">{errors.formula_percentage}</p>
            )}
          </div>
        </div>

        {formData.target_quantity && formData.formula_percentage && (
          <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
            <h4 className="font-medium text-sm">Calculated quantities</h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Formula needed</div>
                <div className="font-mono font-semibold text-primary">
                  {formatQuantity(calculatedQuantities.formulaQuantityNeeded)} {formData.unit}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Solvent needed</div>
                <div className="font-mono font-semibold text-accent">
                  {formatQuantity(calculatedQuantities.solventQuantityNeeded)} {formData.unit}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Solvent %</div>
                <div className="font-mono font-semibold">
                  {formatPercentage(calculatedQuantities.solventPercentage)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t pt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Production notes, observations, or special instructions..."
            rows={3}
            className="text-foreground text-sm"
          />
        </div>
      </div>

      {!isDraftBatch && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-800 shrink-0" />
          <p className="text-xs text-amber-800">
            Only draft batches can have their formula, solvent, and quantities modified. Status can still be updated.
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} size="sm" className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={loading} size="sm" className="flex-1">
          {loading ? 'Saving...' : (initialData ? 'Update batch' : 'Create batch')}
        </Button>
      </div>
    </form>
  );
};

export default BatchProductionForm;
