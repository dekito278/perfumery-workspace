
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import FormField from '@/components/FormField.jsx';
import FormSelect from '@/components/FormSelect.jsx';
import FormNumber from '@/components/FormNumber.jsx';
import { validateRequired, validateMaxLength, validateNonNegativeNumber } from '@/utils/validation.js';
import { formatName, formatCurrency } from '@/utils/formatting.js';
import { formatDilutionInfo } from '@/utils/calculateDilutionCost.js';
import { UNIT_OPTIONS, FIELD_CONSTRAINTS } from '@/utils/constants.js';
import { getSolvents } from '@/services/rawMaterialsService.js';
import { getRawMaterialCategories } from '@/services/rawMaterialCategoriesService.js';
import { findPerfumersWorldCategoryByValue } from '@/utils/perfumersWorldCategories.js';
import { getRawMaterialCategoryMeta } from '@/utils/rawMaterialCategoryMeta.js';

const EditRawMaterialModal = ({ open, onOpenChange, material, onSuccess }) => {
  const { updateMaterial, loading } = useRawMaterials();
  const [solvents, setSolvents] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    workbook_code: '',
    category: '',
    type: 'material',
    scent_family: '',
    stock_quantity: '',
    unit: 'ml',
    cost_per_unit: '',
    minimum_stock: '',
    low_stock_threshold: '',
    vendor: '',
    description: '',
    cas_number: '',
    ifra_limit: '',
    reference_abc_primary_family: '',
    reference_impact: '',
    reference_life_hours: '',
    reference_use_level_typical_percent: '',
    reference_use_level_max_percent: '',
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
      loadCategories();
    }
  }, [open]);

  useEffect(() => {
    if (material) {
      setFormData({
        name: material.name || '',
        workbook_code: material.workbook_code || '',
        category: material.category || '',
        type: material.type || 'material',
        scent_family: material.scent_family || '',
        stock_quantity: material.stock_quantity?.toString() || '',
        unit: material.unit || 'ml',
        cost_per_unit: material.cost_per_unit?.toString() || '',
        minimum_stock: material.minimum_stock?.toString() || '',
        low_stock_threshold: material.low_stock_threshold?.toString() || '',
        vendor: material.vendor || '',
        description: material.description || '',
        cas_number: material.cas_number || '',
        ifra_limit: material.ifra_limit?.toString() || '',
        reference_abc_primary_family: material.reference_abc_primary_family || '',
        reference_impact: material.reference_impact?.toString() || '',
        reference_life_hours: material.reference_life_hours?.toString() || '',
        reference_use_level_typical_percent: material.reference_use_level_typical_percent?.toString() || '',
        reference_use_level_max_percent: material.reference_use_level_max_percent?.toString() || '',
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
      setSolvents(await getSolvents());
    } catch (error) {
      console.error('Failed to load solvents:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const categories = await getRawMaterialCategories();
      setCategoryOptions(
        categories.map((category) => ({
          value: category.name.toLowerCase(),
          label: findPerfumersWorldCategoryByValue(category.name)?.description
            ? `${category.name} - ${findPerfumersWorldCategoryByValue(category.name).description}`
            : category.name,
        }))
      );
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategoryOptions([]);
    }
  };

  const validateField = (name, value) => {
    let error = '';
    
    switch (name) {
      case 'name':
        error = validateRequired(value, 'Name') || validateMaxLength(value, FIELD_CONSTRAINTS.name.maxLength, 'Name');
        break;
      case 'category':
        error = validateRequired(value, 'Category');
        break;
      case 'scent_family':
        error = validateMaxLength(value, FIELD_CONSTRAINTS.scentFamily.maxLength, 'Scent family');
        break;
      case 'workbook_code':
        error = validateMaxLength(value, FIELD_CONSTRAINTS.code.maxLength, 'Workbook code');
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
        error = '';
        break;
      case 'low_stock_threshold':
        error = validateRequired(value, 'Low stock alert') || validateNonNegativeNumber(value, 'Low stock alert');
        break;
      case 'ifra_limit':
      case 'reference_use_level_typical_percent':
      case 'reference_use_level_max_percent':
        if (value !== '') {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            error = 'Reference percentage must be a valid number';
          } else if (numValue < 0 || numValue > 100) {
            error = 'Reference percentage must be between 0 and 100';
          }
        }
        break;
      case 'reference_impact':
        error = value !== '' ? validateNonNegativeNumber(value, 'Impact') : '';
        break;
      case 'reference_life_hours':
        error = value !== '' ? validateNonNegativeNumber(value, 'Lifetime') : '';
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
      case 'cas_number':
        error = validateMaxLength(value, 100, 'CAS number');
        break;
      case 'reference_abc_primary_family':
        error = validateMaxLength(value, 120, 'ABC family');
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
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'category') {
        const meta = getRawMaterialCategoryMeta(value, prev.type, prev.scent_family);
        const previousCategoryCode = findPerfumersWorldCategoryByValue(prev.category)?.code || '';
        const nextCategoryCode = findPerfumersWorldCategoryByValue(value)?.code || '';
        next.type = meta.type;
        next.scent_family = meta.scentFamily;
        if (nextCategoryCode && (!prev.workbook_code || prev.workbook_code === previousCategoryCode)) {
          next.workbook_code = nextCategoryCode;
        }
      }
      return next;
    });
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
        workbook_code: formData.workbook_code || null,
        category: formData.category,
        type: formData.type,
        scent_family: isSolvent ? null : (formData.scent_family || null),
        stock_quantity: parseFloat(formData.stock_quantity),
        unit: formData.unit,
        cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : 0,
        minimum_stock: formData.low_stock_threshold ? parseFloat(formData.low_stock_threshold) : 0,
        low_stock_threshold: formData.low_stock_threshold ? parseFloat(formData.low_stock_threshold) : null,
        vendor: formData.vendor || null,
        description: formData.description || null,
        cas_number: formData.cas_number || null,
        ifra_limit: formData.ifra_limit ? parseFloat(formData.ifra_limit) : null,
        reference_abc_primary_family: formData.reference_abc_primary_family || null,
        reference_impact: formData.reference_impact ? parseFloat(formData.reference_impact) : null,
        reference_life_hours: formData.reference_life_hours ? parseFloat(formData.reference_life_hours) : null,
        reference_use_level_typical_percent: formData.reference_use_level_typical_percent ? parseFloat(formData.reference_use_level_typical_percent) : null,
        reference_use_level_max_percent: formData.reference_use_level_max_percent ? parseFloat(formData.reference_use_level_max_percent) : null,
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

            <FormField
              label="Workbook code"
              value={formData.workbook_code}
              onChange={(e) => handleChange('workbook_code', e.target.value)}
              onBlur={() => handleBlur('workbook_code')}
              error={errors.workbook_code}
              placeholder="e.g., 3JJ00005"
              maxLength={FIELD_CONSTRAINTS.code.maxLength}
            />

            <FormSelect
              label="Category"
              value={formData.category}
              onChange={(value) => handleChange('category', value)}
              onBlur={() => handleBlur('category')}
              options={categoryOptions}
              error={errors.category}
              required
              searchable
              searchPlaceholder="Find category..."
              placeholder={categoryOptions.length ? 'Select category' : 'Create category first'}
              disabled={!categoryOptions.length}
            />
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
                  label={`Unit price (per 10 ${formData.unit || 'ml'})`}
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
                    {formatCurrency(parseFloat(formData.cost_per_unit))} per 10 {formData.unit || 'ml'}
                  </p>
                )}
              </div>
              <FormNumber
                label="Low stock alert"
                value={formData.low_stock_threshold}
                onChange={(e) => handleChange('low_stock_threshold', e.target.value)}
                onBlur={() => handleBlur('low_stock_threshold')}
                error={errors.low_stock_threshold}
                helperText="Warn when stock goes below this amount."
                required
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <FormField
                label="Vendor"
                value={formData.vendor}
                onChange={(e) => handleChange('vendor', e.target.value)}
                placeholder="e.g., PerfumersWorld"
              />

              <FormField
                label="CAS number"
                value={formData.cas_number}
                onChange={(e) => handleChange('cas_number', e.target.value)}
                onBlur={() => handleBlur('cas_number')}
                error={errors.cas_number}
                placeholder="e.g., 8007-75-8"
              />
            </div>

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

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
              <div>
                <p className="text-sm font-medium">Manual reference guidance</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Optional. These values keep a manual reference profile in sync for IFRA and workbook-style advisory checks when this material does not rely on the seeded library.
                </p>
              </div>

              <FormField
                label="ABC family"
                value={formData.reference_abc_primary_family}
                onChange={(e) => handleChange('reference_abc_primary_family', e.target.value)}
                onBlur={() => handleBlur('reference_abc_primary_family')}
                error={errors.reference_abc_primary_family}
                placeholder="e.g., Floral, Woody, Citrus"
              />

              <div className="grid grid-cols-2 gap-3">
                <FormNumber
                  label="Impact"
                  value={formData.reference_impact}
                  onChange={(e) => handleChange('reference_impact', e.target.value)}
                  onBlur={() => handleBlur('reference_impact')}
                  error={errors.reference_impact}
                  placeholder="0.0"
                  min="0"
                  step="0.1"
                />
                <FormNumber
                  label="Lifetime (hours)"
                  value={formData.reference_life_hours}
                  onChange={(e) => handleChange('reference_life_hours', e.target.value)}
                  onBlur={() => handleBlur('reference_life_hours')}
                  error={errors.reference_life_hours}
                  placeholder="0.0"
                  min="0"
                  step="0.1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormNumber
                  label="Typical use level"
                  value={formData.reference_use_level_typical_percent}
                  onChange={(e) => handleChange('reference_use_level_typical_percent', e.target.value)}
                  onBlur={() => handleBlur('reference_use_level_typical_percent')}
                  error={errors.reference_use_level_typical_percent}
                  placeholder="0.0"
                  min="0"
                  max="100"
                  step="0.1"
                  unit="%"
                />
                <FormNumber
                  label="Max use level"
                  value={formData.reference_use_level_max_percent}
                  onChange={(e) => handleChange('reference_use_level_max_percent', e.target.value)}
                  onBlur={() => handleBlur('reference_use_level_max_percent')}
                  error={errors.reference_use_level_max_percent}
                  placeholder="0.0"
                  min="0"
                  max="100"
                  step="0.1"
                  unit="%"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-raw-material-description">Description</Label>
              <Textarea
                id="edit-raw-material-description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Short material description or odour summary"
                rows={3}
                className="text-foreground text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-raw-material-notes">Notes</Label>
              <Textarea
                id="edit-raw-material-notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Optional notes about vendor, origin, or handling"
                rows={3}
                className="text-foreground text-sm"
              />
            </div>
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
