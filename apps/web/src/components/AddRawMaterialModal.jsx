
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Link2 } from 'lucide-react';
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
import { importPerfumersWorldByUrl, importScentreeByUrl, importTgscByUrl } from '@/services/scentreeImportService.js';
import { WORKBOOK_ABC_CLASSIFICATIONS } from '@/utils/workbookAbcClassification.js';

const normalizeCategoryValue = (value) => String(value || '').trim().toLowerCase();
const familyOptions = WORKBOOK_ABC_CLASSIFICATIONS.map((entry) => ({
  value: entry.familyName,
  label: `${entry.letter} - ${entry.familyName}`,
}));
const parseOptionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const shouldOverrideNumericGuidance = ({ currentValue, nextValue }) => {
  if (nextValue === null || nextValue === undefined || nextValue === '') {
    return false;
  }

  const currentNumericValue = Number(currentValue);
  return !Number.isFinite(currentNumericValue) || currentNumericValue <= 0;
};

const AddRawMaterialModal = ({ open, onOpenChange, onSuccess }) => {
  const { addMaterial, loading } = useRawMaterials();
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
  const [scentreeUrl, setScentreeUrl] = useState('');
  const [perfumersWorldUrl, setPerfumersWorldUrl] = useState('');
  const [tgscUrl, setTgscUrl] = useState('');
  const [inferenceLines, setInferenceLines] = useState([]);
  const [importingUrl, setImportingUrl] = useState(false);

  const isSolvent = formData.type === 'solvent';

  useEffect(() => {
    if (open) {
      loadSolvents();
      loadCategories();
    }
  }, [open]);

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
      const normalizedValue = field === 'category' ? normalizeCategoryValue(value) : value;
      const next = { ...prev, [field]: normalizedValue };
      if (field === 'category') {
        const meta = getRawMaterialCategoryMeta(normalizedValue, prev.type, prev.scent_family);
        const previousCategoryCode = findPerfumersWorldCategoryByValue(prev.category)?.code || '';
        const nextCategoryCode = findPerfumersWorldCategoryByValue(normalizedValue)?.code || '';
        next.type = meta.type;
        next.scent_family = meta.scentFamily;
        if (nextCategoryCode && (!prev.workbook_code || prev.workbook_code === previousCategoryCode)) {
          next.workbook_code = nextCategoryCode;
        }
        if (!next.low_stock_threshold) {
          next.low_stock_threshold = prev.minimum_stock || '';
        }
      }
      return next;
    });
    if (touched[field]) {
      const error = validateField(field, field === 'category' ? normalizeCategoryValue(value) : value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors(prev => ({ ...prev, [field]: error }));
    checkWarnings();
  };

  const applyImportedGuidance = (updater) => {
    setFormData((current) => {
      const next = updater(current);
      return {
        ...next,
        reference_impact: next.reference_impact ?? '',
        reference_life_hours: next.reference_life_hours ?? '',
        reference_use_level_typical_percent: next.reference_use_level_typical_percent ?? '',
        reference_use_level_max_percent: next.reference_use_level_max_percent ?? '',
        ifra_limit: next.ifra_limit ?? '',
      };
    });
  };

  const handleImportPerfumersWorldUrl = async () => {
    if (!perfumersWorldUrl.trim()) {
      toast.error('Masukkan URL PerfumersWorld dulu');
      return;
    }

    setImportingUrl(true);
    try {
      const imported = await importPerfumersWorldByUrl(perfumersWorldUrl.trim());

      applyImportedGuidance((current) => ({
        ...current,
        workbook_code: imported.workbook_code || current.workbook_code,
        cas_number: imported.cas_number || current.cas_number,
        description: imported.description || current.description,
        reference_abc_primary_family: imported.reference_abc_primary_family || current.reference_abc_primary_family,
        reference_impact: shouldOverrideNumericGuidance({
          currentValue: current.reference_impact,
          nextValue: imported.reference_impact,
        })
          ? String(imported.reference_impact)
          : current.reference_impact,
        reference_life_hours: shouldOverrideNumericGuidance({
          currentValue: current.reference_life_hours,
          nextValue: imported.reference_life_hours,
        })
          ? String(imported.reference_life_hours)
          : current.reference_life_hours,
        reference_use_level_typical_percent: imported.reference_use_level_typical_percent !== null && imported.reference_use_level_typical_percent !== undefined
          ? String(imported.reference_use_level_typical_percent)
          : current.reference_use_level_typical_percent,
        reference_use_level_max_percent: imported.reference_use_level_max_percent !== null && imported.reference_use_level_max_percent !== undefined
          ? String(imported.reference_use_level_max_percent)
          : current.reference_use_level_max_percent,
      }));

      setInferenceLines([
        imported.workbook_code ? `Workbook code: ${imported.workbook_code}` : 'Workbook code tidak tersedia di PerfumersWorld.',
        imported.reference_impact !== null && imported.reference_impact !== undefined ? `Impact: ${imported.reference_impact}` : 'Impact tidak tersedia di PerfumersWorld.',
        imported.reference_life_hours !== null && imported.reference_life_hours !== undefined ? `Life: ${imported.reference_life_hours} h` : 'Life tidak tersedia di PerfumersWorld.',
        imported.reference_use_level_typical_percent !== null && imported.reference_use_level_typical_percent !== undefined ? `Typical use level: ${imported.reference_use_level_typical_percent}%` : 'Typical use level tidak tersedia di PerfumersWorld.',
        imported.reference_use_level_max_percent !== null && imported.reference_use_level_max_percent !== undefined ? `Max use level: ${imported.reference_use_level_max_percent}%` : 'Max use level tidak tersedia di PerfumersWorld.',
        imported.cas_number ? `CAS: ${imported.cas_number}` : 'CAS tidak tersedia di PerfumersWorld.',
      ]);
      toast.success('PerfumersWorld URL imported');
    } catch (error) {
      toast.error(error.message || 'Failed to import PerfumersWorld URL');
    } finally {
      setImportingUrl(false);
    }
  };

  const handleImportScentreeUrl = async () => {
    if (!scentreeUrl.trim()) {
      toast.error('Masukkan URL ScenTree dulu');
      return;
    }

    setImportingUrl(true);
    try {
      const imported = await importScentreeByUrl(scentreeUrl.trim());

      applyImportedGuidance((current) => ({
        ...current,
        workbook_code: imported.workbook_code || current.workbook_code,
        cas_number: imported.cas_number || current.cas_number,
        description: imported.description || current.description,
        ifra_limit: imported.ifra_limit !== null && imported.ifra_limit !== undefined
          ? String(imported.ifra_limit)
          : current.ifra_limit,
        reference_abc_primary_family: imported.reference_abc_primary_family || current.reference_abc_primary_family,
        reference_impact: shouldOverrideNumericGuidance({
          currentValue: current.reference_impact,
          nextValue: imported.reference_impact,
        })
          ? String(imported.reference_impact)
          : current.reference_impact,
        reference_life_hours: shouldOverrideNumericGuidance({
          currentValue: current.reference_life_hours,
          nextValue: imported.reference_life_hours,
        })
          ? String(imported.reference_life_hours)
          : current.reference_life_hours,
        reference_use_level_typical_percent: imported.reference_use_level_typical_percent !== null && imported.reference_use_level_typical_percent !== undefined
          ? String(imported.reference_use_level_typical_percent)
          : current.reference_use_level_typical_percent,
        reference_use_level_max_percent: imported.reference_use_level_max_percent !== null && imported.reference_use_level_max_percent !== undefined
          ? String(imported.reference_use_level_max_percent)
          : current.reference_use_level_max_percent,
      }));

      setInferenceLines([
        imported.classification_path?.length ? `ScenTree path: ${imported.classification_path.join(' > ')}` : 'ScenTree path tidak tersedia.',
        imported.volatility ? `Volatility: ${imported.volatility}` : 'Volatility tidak tersedia di ScenTree.',
        imported.detection_threshold ? `Detection threshold: ${imported.detection_threshold}` : 'Detection threshold tidak tersedia di ScenTree.',
        imported.uses_in_perfumery ? `Uses in perfumery: ${imported.uses_in_perfumery}` : 'Uses in perfumery tidak tersedia di ScenTree.',
        imported.ifra_notes ? `IFRA: ${imported.ifra_notes}` : 'IFRA note tidak tersedia di ScenTree.',
      ]);
      toast.success('ScenTree URL imported');
    } catch (error) {
      toast.error(error.message || 'Failed to import ScenTree URL');
    } finally {
      setImportingUrl(false);
    }
  };

  const handleImportTgscUrl = async () => {
    if (!tgscUrl.trim()) {
      toast.error('Masukkan URL TGSC dulu');
      return;
    }

    setImportingUrl(true);
    try {
      const imported = await importTgscByUrl(tgscUrl.trim());

      applyImportedGuidance((current) => ({
        ...current,
        cas_number: imported.cas_number || current.cas_number,
        description: imported.description || current.description,
        reference_abc_primary_family: imported.reference_abc_primary_family || current.reference_abc_primary_family,
        reference_impact: shouldOverrideNumericGuidance({
          currentValue: current.reference_impact,
          nextValue: imported.reference_impact,
        })
          ? String(imported.reference_impact)
          : current.reference_impact,
        reference_life_hours: shouldOverrideNumericGuidance({
          currentValue: current.reference_life_hours,
          nextValue: imported.reference_life_hours,
        })
          ? String(imported.reference_life_hours)
          : current.reference_life_hours,
      }));

      setInferenceLines([
        imported.cas_number ? `CAS: ${imported.cas_number}` : 'CAS tidak tersedia di TGSC.',
        imported.odor_type ? `Odor type: ${imported.odor_type}` : 'Odor type tidak tersedia di TGSC.',
        imported.odor_strength ? `Odor strength: ${imported.odor_strength}` : 'Odor strength tidak tersedia di TGSC.',
        imported.substantivity_hours !== null && imported.substantivity_hours !== undefined ? `Substantivity: ${imported.substantivity_hours} h` : 'Substantivity tidak tersedia di TGSC.',
        imported.odor_description ? `Odor description: ${imported.odor_description}` : 'Odor description tidak tersedia di TGSC.',
      ]);
      toast.success('TGSC URL imported');
    } catch (error) {
      toast.error(error.message || 'Failed to import TGSC URL');
    } finally {
      setImportingUrl(false);
    }
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
      const result = await addMaterial({
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

      if (result?._creationResolution?.action === 'matched_existing') {
        toast.info(result._creationResolution.message);
      } else {
        toast.success('Material added successfully');
      }
      setFormData({
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
      setErrors({});
      setWarnings({});
      setTouched({});
      setScentreeUrl('');
      setPerfumersWorldUrl('');
      setTgscUrl('');
      setInferenceLines([]);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.message || 'Failed to add material');
    }
  };

  const hasErrors = Object.values(errors).some(error => error);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] max-h-[90vh] overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="text-lg">Add new material</DialogTitle>
          <DialogDescription className="text-xs">Enter the details of the raw material you want to add to your inventory.</DialogDescription>
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

          {!isSolvent && (
            <div className="border-t pt-3 space-y-3">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium">Workbook guidance import</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gunakan importer seperti workflow workbook untuk mengisi workbook code, CAS, family, impact, life, typical, dan max use level.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-background px-3 py-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <Label htmlFor="add-material-perfumersworld-url">PerfumersWorld URL</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tempel link produk PerfumersWorld untuk import workbook code, impact, life, CAS, dan use level.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={handleImportPerfumersWorldUrl} className="rounded-2xl" disabled={importingUrl}>
                      <Link2 className="mr-2 h-4 w-4" />
                      {importingUrl ? 'Importing...' : 'Import URL'}
                    </Button>
                  </div>
                  <Input
                    id="add-material-perfumersworld-url"
                    value={perfumersWorldUrl}
                    onChange={(e) => setPerfumersWorldUrl(e.target.value)}
                    placeholder="https://www.perfumersworld.com/view.php?pro_id=..."
                    className="h-11 rounded-2xl"
                  />
                </div>

                <div className="rounded-xl border border-border/60 bg-background px-3 py-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <Label htmlFor="add-material-scentree-url">ScenTree URL</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tempel URL ingredient dari ScenTree untuk import family, CAS, IFRA, volatility, dan descriptor ringkas.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={handleImportScentreeUrl} className="rounded-2xl" disabled={importingUrl}>
                      <Link2 className="mr-2 h-4 w-4" />
                      {importingUrl ? 'Importing...' : 'Import URL'}
                    </Button>
                  </div>
                  <Input
                    id="add-material-scentree-url"
                    value={scentreeUrl}
                    onChange={(e) => setScentreeUrl(e.target.value)}
                    placeholder="https://www.scentree.co/en/Adoxal%C2%AE.html"
                    className="h-11 rounded-2xl"
                  />
                </div>

                <div className="rounded-xl border border-border/60 bg-background px-3 py-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <Label htmlFor="add-material-tgsc-url">TGSC URL</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tempel URL The Good Scents Company untuk import CAS, odor profile, impact heuristic, dan life dari substantivity.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={handleImportTgscUrl} className="rounded-2xl" disabled={importingUrl}>
                      <Link2 className="mr-2 h-4 w-4" />
                      {importingUrl ? 'Importing...' : 'Import URL'}
                    </Button>
                  </div>
                  <Input
                    id="add-material-tgsc-url"
                    value={tgscUrl}
                    onChange={(e) => setTgscUrl(e.target.value)}
                    placeholder="https://www.thegoodscentscompany.com/data/es1002952.html"
                    className="h-11 rounded-2xl"
                  />
                </div>

                {inferenceLines.length > 0 && (
                  <div className="rounded-xl border border-border/60 bg-background px-3 py-3 text-xs text-muted-foreground">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
                      Import notes
                    </div>
                    <div className="space-y-1">
                      {inferenceLines.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
                  Optional. Fill this if the material is new and not linked to workbook reference data yet. We will create a manual reference profile from these values.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-material-workbook-family">Workbook family / class</Label>
                <Select
                  value={formData.reference_abc_primary_family || '__none__'}
                  onValueChange={(value) => handleChange('reference_abc_primary_family', value === '__none__' ? '' : value)}
                >
                  <SelectTrigger id="add-material-workbook-family" className="h-10 rounded-xl">
                    <SelectValue placeholder="Select workbook family" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No family selected</SelectItem>
                    {familyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.reference_abc_primary_family ? (
                  <p className="text-xs text-destructive">{errors.reference_abc_primary_family}</p>
                ) : null}
              </div>

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
                  helperText="Kisaran pakai yang biasanya nyaman dipakai di formula."
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
                  helperText="Batas saran praktis sebelum bahan terasa terlalu dominan."
                  placeholder="0.0"
                  min="0"
                  max="100"
                  step="0.1"
                  unit="%"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="raw-material-description">Description</Label>
              <Textarea
                id="raw-material-description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Short material description or odour summary"
                rows={3}
                className="text-foreground text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="raw-material-notes">Notes</Label>
              <Textarea
                id="raw-material-notes"
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
              {loading ? 'Adding...' : 'Add material'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddRawMaterialModal;
