
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import FormField from '@/components/FormField.jsx';
import FormSelect from '@/components/FormSelect.jsx';
import FormTextarea from '@/components/FormTextarea.jsx';
import FormNumber from '@/components/FormNumber.jsx';
import { validateRequired, validateMaxLength, validateNonNegativeNumber } from '@/utils/validation.js';
import { formatName, formatCurrency } from '@/utils/formatting.js';
import { formatDilutionInfo } from '@/utils/calculateDilutionCost.js';
import { MATERIAL_TYPES, MATERIAL_CATEGORIES, SCENT_FAMILIES, NOTE_TYPES, UNIT_OPTIONS, FIELD_CONSTRAINTS } from '@/utils/constants.js';
import pb from '@/lib/pocketbaseClient';

const PYRAMID_PLACEMENTS = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'base', label: 'Base' }
];

const EditRawMaterialModal = ({ open, onOpenChange, material, onSuccess }) => {
  const { updateMaterial, loading } = useRawMaterials();
  const [solvents, setSolvents] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    type: '',
    scent_family: '',
    note_type: '',
    stock_quantity: '',
    unit: 'ml',
    cost_per_unit: '',
    supplier_name: '',
    minimum_stock: '',
    low_stock_threshold: '',
    default_dilution_percent: '',
    vendor: '',
    ifra_limit: '',
    pyramid_placement: '',
    dilution_info: '',
    description: '',
    notes: '',
    is_diluted: false,
    dilution_solvent_id: '',
    dilution_percentage: ''
  });
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState({});
  const [touched, setTouched] = useState({});

  const isSolvent = formData.type === 'solvent';

  useEffect(() => {
    if (open) {
      loadSolvents();
    }
  }, [open]);

  useEffect(() => {
    if (material) {
      setFormData({
        name: material.name || '',
        category: material.category || '',
        type: material.type || '',
        scent_family: material.scent_family || '',
        note_type: material.note_type || '',
        stock_quantity: material.stock_quantity?.toString() || '',
        unit: material.unit || 'ml',
        cost_per_unit: material.cost_per_unit?.toString() || '',
        supplier_name: material.supplier_name || '',
        minimum_stock: material.minimum_stock?.toString() || '',
        low_stock_threshold: material.low_stock_threshold?.toString() || '',
        default_dilution_percent: material.default_dilution_percent?.toString() || '',
        vendor: material.vendor || '',
        ifra_limit: material.ifra_limit?.toString() || '',
        pyramid_placement: material.pyramid_placement || '',
        dilution_info: material.dilution_info || '',
        description: material.description || '',
        notes: material.notes || '',
        is_diluted: material.is_diluted || false,
        dilution_solvent_id: material.dilution_solvent_id || '',
        dilution_percentage: material.dilution_percentage?.toString() || ''
      });
      setErrors({});
      setWarnings({});
      setTouched({});
    }
  }, [material]);

  const loadSolvents = async () => {
    try {
      const materials = await pb.collection('raw_materials').getFullList({
        filter: 'type = "solvent"',
        sort: 'name',
        $autoCancel: false
      });
      setSolvents(materials.map(m => ({ value: m.id, label: m.name })));
    } catch (error) {
      console.error('Failed to load solvents:', error);
    }
  };

  const validateField = (name, value) => {
    let error = '';
    
    switch (name) {
      case 'name':
        error = validateRequired(value, 'Name') || validateMaxLength(value, FIELD_CONSTRAINTS.name.maxLength, 'Name');
        break;
      case 'type':
        error = validateRequired(value, 'Type');
        break;
      case 'category':
        error = validateRequired(value, 'Category');
        break;
      case 'scent_family':
        error = validateMaxLength(value, FIELD_CONSTRAINTS.scentFamily.maxLength, 'Scent family');
        break;
      case 'stock_quantity':
        error = validateRequired(value, 'Stock quantity') || validateNonNegativeNumber(value, 'Stock quantity');
        break;
      case 'unit':
        error = validateRequired(value, 'Unit');
        break;
      case 'cost_per_unit':
        error = validateNonNegativeNumber(value, 'Purchase price');
        if (!error && value !== '') {
          const strValue = String(value);
          const decimalIndex = strValue.indexOf('.');
          if (decimalIndex !== -1) {
            const decimalPart = strValue.substring(decimalIndex + 1);
            if (decimalPart.length > 2) {
              error = 'Purchase price must have at most 2 decimal places';
            }
          }
        }
        break;
      case 'minimum_stock':
        error = validateRequired(value, 'Minimum stock') || validateNonNegativeNumber(value, 'Minimum stock');
        break;
      case 'low_stock_threshold':
        error = validateNonNegativeNumber(value, 'Low stock threshold');
        break;
      case 'default_dilution_percent':
        if (value !== '') {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            error = 'Default dilution must be a valid number';
          } else if (numValue < 0 || numValue > 100) {
            error = 'Default dilution must be between 0 and 100';
          }
        }
        break;
      case 'ifra_limit':
        if (value !== '') {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            error = 'IFRA limit must be a valid number';
          } else if (numValue < 0 || numValue > 100) {
            error = 'IFRA limit must be between 0 and 100';
          }
        }
        break;
      case 'dilution_solvent_id':
        if (formData.is_diluted && !value) {
          error = 'Solvent is required for diluted materials';
        }
        break;
      case 'dilution_percentage':
        if (formData.is_diluted) {
          if (!value) {
            error = 'Dilution percentage is required';
          } else {
            const numValue = Number(value);
            if (isNaN(numValue)) {
              error = 'Dilution percentage must be a valid number';
            } else if (numValue <= 0 || numValue > 100) {
              error = 'Dilution percentage must be between 0 and 100';
            }
          }
        }
        break;
      case 'description':
        error = validateMaxLength(value, FIELD_CONSTRAINTS.description.maxLength, 'Description');
        break;
      case 'notes':
        error = validateMaxLength(value, FIELD_CONSTRAINTS.notes.maxLength, 'Notes');
        break;
    }
    
    return error;
  };

  const checkWarnings = () => {
    const newWarnings = {};
    
    if (formData.cost_per_unit && parseFloat(formData.cost_per_unit) === 0) {
      newWarnings.cost_per_unit = 'Purchase price is 0 - this may affect formula calculations';
    }
    
    if (formData.stock_quantity && parseFloat(formData.stock_quantity) > 10000) {
      newWarnings.stock_quantity = 'Stock quantity is very high - please verify';
    }
    
    if (formData.low_stock_threshold && formData.stock_quantity && 
        parseFloat(formData.low_stock_threshold) > parseFloat(formData.stock_quantity)) {
      newWarnings.low_stock_threshold = 'Low stock threshold is higher than current stock';
    }
    
    setWarnings(newWarnings);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors(prev => ({ ...prev, [field]: error }));
    checkWarnings();
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });
    setErrors(newErrors);
    checkWarnings();
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix all errors before submitting');
      return;
    }

    try {
      await updateMaterial(material.id, {
        name: formatName(formData.name),
        category: formData.category,
        type: formData.type,
        scent_family: isSolvent ? null : (formData.scent_family || null),
        note_type: isSolvent ? null : (formData.note_type || null),
        stock_quantity: parseFloat(formData.stock_quantity),
        unit: formData.unit,
        cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : 0,
        supplier_name: formData.supplier_name || null,
        minimum_stock: parseFloat(formData.minimum_stock),
        low_stock_threshold: formData.low_stock_threshold ? parseFloat(formData.low_stock_threshold) : null,
        default_dilution_percent: isSolvent ? null : (formData.default_dilution_percent ? parseFloat(formData.default_dilution_percent) : null),
        vendor: formData.vendor || null,
        ifra_limit: formData.ifra_limit ? parseFloat(formData.ifra_limit) : null,
        pyramid_placement: isSolvent ? null : (formData.pyramid_placement || null),
        dilution_info: isSolvent ? null : (formData.dilution_info || null),
        description: formData.description || null,
        notes: formData.notes || null,
        is_diluted: formData.is_diluted,
        dilution_solvent_id: formData.is_diluted ? formData.dilution_solvent_id : null,
        dilution_percentage: formData.is_diluted ? parseFloat(formData.dilution_percentage) : null
      });

      toast.success('Material updated successfully');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.message || 'Failed to update material');
    }
  };

  const hasErrors = Object.values(errors).some(error => error);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] max-h-[90vh] overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit material</DialogTitle>
          <DialogDescription className="text-xs">Update the details of this raw material.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-3">
            <div className="space-y-2">
              <FormField
                label="Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                onBlur={() => handleBlur('name')}
                error={errors.name}
                required
                placeholder="e.g., Bergamot Essential Oil"
                maxLength={FIELD_CONSTRAINTS.name.maxLength}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormSelect
                label="Category"
                value={formData.category}
                onChange={(value) => handleChange('category', value)}
                onBlur={() => handleBlur('category')}
                options={MATERIAL_CATEGORIES}
                error={errors.category}
                required
                placeholder="Select category"
              />
              <FormSelect
                label="Type"
                value={formData.type}
                onChange={(value) => handleChange('type', value)}
                onBlur={() => handleBlur('type')}
                options={MATERIAL_TYPES}
                error={errors.type}
                required
                placeholder="Select type"
              />
            </div>

            {!isSolvent && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormSelect
                    label="Scent family"
                    value={formData.scent_family}
                    onChange={(value) => handleChange('scent_family', value)}
                    onBlur={() => handleBlur('scent_family')}
                    options={SCENT_FAMILIES}
                    error={errors.scent_family}
                    placeholder="Select scent family"
                  />
                  <FormSelect
                    label="Note type"
                    value={formData.note_type}
                    onChange={(value) => handleChange('note_type', value)}
                    onBlur={() => handleBlur('note_type')}
                    options={NOTE_TYPES}
                    error={errors.note_type}
                    placeholder="Select note type"
                  />
                </div>

                <FormSelect
                  label="Pyramid placement"
                  value={formData.pyramid_placement}
                  onChange={(value) => handleChange('pyramid_placement', value)}
                  onBlur={() => handleBlur('pyramid_placement')}
                  options={PYRAMID_PLACEMENTS}
                  error={errors.pyramid_placement}
                  placeholder="Select placement"
                />
              </>
            )}
          </div>

          {!isSolvent && (
            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_diluted"
                  checked={formData.is_diluted}
                  onCheckedChange={(checked) => handleChange('is_diluted', checked)}
                />
                <Label htmlFor="is_diluted" className="text-sm font-medium cursor-pointer">
                  This material is diluted
                </Label>
              </div>

              {formData.is_diluted && (
                <div className="space-y-3 pl-6 border-l-2 border-primary/20">
                  <FormSelect
                    label="Dilution solvent"
                    value={formData.dilution_solvent_id}
                    onChange={(value) => handleChange('dilution_solvent_id', value)}
                    onBlur={() => handleBlur('dilution_solvent_id')}
                    options={solvents}
                    error={errors.dilution_solvent_id}
                    required
                    placeholder="Select solvent"
                  />

                  <FormNumber
                    label="Dilution percentage"
                    value={formData.dilution_percentage}
                    onChange={(e) => handleChange('dilution_percentage', e.target.value)}
                    onBlur={() => handleBlur('dilution_percentage')}
                    error={errors.dilution_percentage}
                    required
                    placeholder="e.g., 50"
                    min="0"
                    max="100"
                    step="0.1"
                    unit="%"
                  />

                  {formData.dilution_percentage && (
                    <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-lg">
                      <p className="text-xs text-primary font-medium">
                        {formatDilutionInfo(parseFloat(formData.dilution_percentage))}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormNumber
                label="Stock quantity"
                value={formData.stock_quantity}
                onChange={(e) => handleChange('stock_quantity', e.target.value)}
                onBlur={() => handleBlur('stock_quantity')}
                error={errors.stock_quantity}
                required
                placeholder="0.00"
                min="0"
                step="0.01"
              />
              <FormSelect
                label="Unit"
                value={formData.unit}
                onChange={(value) => handleChange('unit', value)}
                onBlur={() => handleBlur('unit')}
                options={UNIT_OPTIONS}
                error={errors.unit}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FormNumber
                  label="Unit price (per 10 ml)"
                  value={formData.cost_per_unit}
                  onChange={(e) => handleChange('cost_per_unit', e.target.value)}
                  onBlur={() => handleBlur('cost_per_unit')}
                  error={errors.cost_per_unit}
                  placeholder="e.g., 25000"
                  min="0"
                  step="0.01"
                />
                {formData.cost_per_unit && (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(parseFloat(formData.cost_per_unit))} per 10 ml
                  </p>
                )}
              </div>
              <FormNumber
                label="Minimum stock"
                value={formData.minimum_stock}
                onChange={(e) => handleChange('minimum_stock', e.target.value)}
                onBlur={() => handleBlur('minimum_stock')}
                error={errors.minimum_stock}
                required
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormNumber
                label="Low stock threshold"
                value={formData.low_stock_threshold}
                onChange={(e) => handleChange('low_stock_threshold', e.target.value)}
                onBlur={() => handleBlur('low_stock_threshold')}
                error={errors.low_stock_threshold}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
              {!isSolvent && (
                <FormNumber
                  label="Default dilution"
                  value={formData.default_dilution_percent}
                  onChange={(e) => handleChange('default_dilution_percent', e.target.value)}
                  onBlur={() => handleBlur('default_dilution_percent')}
                  error={errors.default_dilution_percent}
                  placeholder="0.0"
                  min="0"
                  max="100"
                  step="0.1"
                  unit="%"
                />
              )}
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <FormField
              label="Vendor"
              value={formData.vendor}
              onChange={(e) => handleChange('vendor', e.target.value)}
              onBlur={() => handleBlur('vendor')}
              error={errors.vendor}
              placeholder="e.g., Aromatics International"
            />

            <FormNumber
              label="IFRA limit"
              value={formData.ifra_limit}
              onChange={(e) => handleChange('ifra_limit', e.target.value)}
              onBlur={() => handleBlur('ifra_limit')}
              error={errors.ifra_limit}
              placeholder="0.0"
              min="0"
              max="100"
              step="0.1"
              unit="%"
            />

            {!isSolvent && (
              <FormTextarea
                label="Dilution info"
                value={formData.dilution_info}
                onChange={(e) => handleChange('dilution_info', e.target.value)}
                onBlur={() => handleBlur('dilution_info')}
                error={errors.dilution_info}
                placeholder="Dilution instructions or notes..."
                rows={2}
              />
            )}

            <FormTextarea
              label="Description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              onBlur={() => handleBlur('description')}
              error={errors.description}
              placeholder="Material description..."
              maxLength={FIELD_CONSTRAINTS.description.maxLength}
              showCharCount
              rows={2}
            />

            <FormTextarea
              label="Notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              onBlur={() => handleBlur('notes')}
              error={errors.notes}
              placeholder="Additional notes..."
              maxLength={FIELD_CONSTRAINTS.notes.maxLength}
              showCharCount
              rows={2}
            />
          </div>

          {Object.keys(warnings).length > 0 && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
              {Object.values(warnings).map((warning, index) => (
                <div key={index} className="flex items-start gap-2 text-xs text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} size="sm">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || hasErrors} size="sm">
              {loading ? 'Updating...' : 'Update material'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditRawMaterialModal;
