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
import { createReferenceMetadataPatch } from '@/utils/canonicalReferenceProfile.js';

const normalizeCategoryValue = (value) => String(value || '').trim().toLowerCase();
const familyOptions = WORKBOOK_ABC_CLASSIFICATIONS.map((entry) => ({
  value: entry.familyName,
  label: `${entry.letter} - ${entry.familyName}`,
}));

const shouldOverrideNumericGuidance = ({ currentValue, nextValue }) => {
  if (nextValue === null || nextValue === undefined || nextValue === '') {
    return false;
  }

  const currentNumericValue = Number(currentValue);
  return !Number.isFinite(currentNumericValue) || currentNumericValue <= 0;
};

const createInitialFormData = () => ({
  name: '',
  workbook_code: '',
  category: '',
  type: 'material',
  scent_family: '',
  unit: 'ml',
  cost_per_unit: '',
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
  dilution_percentage: '',
});

const EditRawMaterialModal = ({ open, onOpenChange, material, onSuccess }) => {
  const { updateMaterial, loading } = useRawMaterials();
  const [solvents, setSolvents] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [formData, setFormData] = useState(createInitialFormData());
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState({});
  const [touched, setTouched] = useState({});
  const [scentreeUrl, setScentreeUrl] = useState('');
  const [perfumersWorldUrl, setPerfumersWorldUrl] = useState('');
  const [tgscUrl, setTgscUrl] = useState('');
  const [inferenceLines, setInferenceLines] = useState([]);
  const [importingUrl, setImportingUrl] = useState(false);
  const [sourceSnapshots, setSourceSnapshots] = useState({});

  const isSolvent = formData.type === 'solvent';

  useEffect(() => {
    if (open) {
      loadSolvents();
      loadCategories();
    }
  }, [open]);

  useEffect(() => {
    if (!material) {
      return;
    }

    setFormData({
      name: material.name || '',
      workbook_code: material.workbook_code || '',
      category: normalizeCategoryValue(material.category),
      type: material.type || 'material',
      scent_family: material.scent_family || '',
      unit: material.unit || 'ml',
      cost_per_unit: material.cost_per_unit?.toString() || '',
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
      dilution_percentage: material.dilution_percentage?.toString() || '',
    });
    setErrors({});
    setWarnings({});
    setTouched({});
    setScentreeUrl('');
    setPerfumersWorldUrl('');
    setTgscUrl('');
    setInferenceLines([]);
    setSourceSnapshots(material.guidance_reference_profile?.source_snapshots || {});
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
      case 'unit':
        error = validateRequired(value, 'Unit');
        break;
      case 'cost_per_unit':
        error = validateNonNegativeNumber(value, 'Purchase price');
        break;
      case 'ifra_limit':
      case 'reference_use_level_typical_percent':
      case 'reference_use_level_max_percent':
        if (value !== '') {
          const numValue = Number(value);
          if (Number.isNaN(numValue)) {
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
            if (Number.isNaN(numValue)) {
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
      default:
        break;
    }

    return error;
  };

  const checkWarnings = () => {
    const newWarnings = {};

    if (formData.cost_per_unit && parseFloat(formData.cost_per_unit) === 0) {
      newWarnings.cost_per_unit = 'Purchase price is 0 - this may affect formula calculations';
    }

    setWarnings(newWarnings);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => {
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
      }

      return next;
    });

    if (touched[field]) {
      const error = validateField(field, field === 'category' ? normalizeCategoryValue(value) : value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: error }));
    checkWarnings();
  };

  const applyImportedGuidance = (updater) => {
    setFormData((current) => ({
      ...updater(current),
    }));
  };

  const appendSourceSnapshot = (sourceKey, payload) => {
    setSourceSnapshots((current) => ({
      ...current,
      [sourceKey]: payload,
    }));
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
        reference_impact: shouldOverrideNumericGuidance({ currentValue: current.reference_impact, nextValue: imported.reference_impact })
          ? String(imported.reference_impact)
          : current.reference_impact,
        reference_life_hours: shouldOverrideNumericGuidance({ currentValue: current.reference_life_hours, nextValue: imported.reference_life_hours })
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
      ]);
      appendSourceSnapshot('perfumersworld', imported);
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
        cas_number: imported.cas_number || current.cas_number,
        description: imported.description || current.description,
        ifra_limit: imported.ifra_limit !== null && imported.ifra_limit !== undefined ? String(imported.ifra_limit) : current.ifra_limit,
        reference_abc_primary_family: imported.reference_abc_primary_family || current.reference_abc_primary_family,
        reference_impact: shouldOverrideNumericGuidance({ currentValue: current.reference_impact, nextValue: imported.reference_impact })
          ? String(imported.reference_impact)
          : current.reference_impact,
        reference_life_hours: shouldOverrideNumericGuidance({ currentValue: current.reference_life_hours, nextValue: imported.reference_life_hours })
          ? String(imported.reference_life_hours)
          : current.reference_life_hours,
      }));

      setInferenceLines([
        imported.classification_path?.length ? `ScenTree path: ${imported.classification_path.join(' > ')}` : 'ScenTree path tidak tersedia.',
        imported.volatility ? `Volatility: ${imported.volatility}` : 'Volatility tidak tersedia di ScenTree.',
        imported.detection_threshold ? `Detection threshold: ${imported.detection_threshold}` : 'Detection threshold tidak tersedia di ScenTree.',
        imported.ifra_notes ? `IFRA: ${imported.ifra_notes}` : 'IFRA note tidak tersedia di ScenTree.',
      ]);
      appendSourceSnapshot('scentree', imported);
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
        reference_impact: shouldOverrideNumericGuidance({ currentValue: current.reference_impact, nextValue: imported.reference_impact })
          ? String(imported.reference_impact)
          : current.reference_impact,
        reference_life_hours: shouldOverrideNumericGuidance({ currentValue: current.reference_life_hours, nextValue: imported.reference_life_hours })
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
      appendSourceSnapshot('tgsc', imported);
      toast.success('TGSC URL imported');
    } catch (error) {
      toast.error(error.message || 'Failed to import TGSC URL');
    } finally {
      setImportingUrl(false);
    }
  };

  const validateForm = () => {
    const nextErrors = {};
    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key]);
      if (error) {
        nextErrors[key] = error;
      }
    });
    setErrors(nextErrors);
    checkWarnings();
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

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
        unit: formData.unit,
        cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : 0,
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
        dilution_percentage: formData.is_diluted ? parseFloat(formData.dilution_percentage) : null,
        ...createReferenceMetadataPatch({
          sourceSnapshots,
        }),
      });

      toast.success('Material updated successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error.message || 'Failed to update material');
    }
  };

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] max-h-[90vh] overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit material</DialogTitle>
          <DialogDescription className="text-xs">Update library metadata, guidance, and dilution setup for this material.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-3">
            <FormField
              label="Name"
              value={formData.name}
              onChange={(event) => handleChange('name', event.target.value)}
              onBlur={() => handleBlur('name')}
              error={errors.name}
              required
              placeholder="e.g., Bergamot Essential Oil"
              maxLength={FIELD_CONSTRAINTS.name.maxLength}
            />

            <FormField
              label="Workbook code"
              value={formData.workbook_code}
              onChange={(event) => handleChange('workbook_code', event.target.value)}
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
                  id="edit-is-diluted"
                  checked={formData.is_diluted}
                  onCheckedChange={(checked) => handleChange('is_diluted', checked)}
                />
                <Label htmlFor="edit-is-diluted" className="text-sm font-medium cursor-pointer">
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
                    onChange={(event) => handleChange('dilution_percentage', event.target.value)}
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
                    Import workbook guidance for CAS, family, impact, life, and use-level enrichment.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-background px-3 py-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <Label htmlFor="edit-material-perfumersworld-url">PerfumersWorld URL</Label>
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
                    id="edit-material-perfumersworld-url"
                    value={perfumersWorldUrl}
                    onChange={(event) => setPerfumersWorldUrl(event.target.value)}
                    placeholder="https://www.perfumersworld.com/view.php?pro_id=..."
                    className="h-11 rounded-2xl"
                  />
                </div>

                <div className="rounded-xl border border-border/60 bg-background px-3 py-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <Label htmlFor="edit-material-scentree-url">ScenTree URL</Label>
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
                    id="edit-material-scentree-url"
                    value={scentreeUrl}
                    onChange={(event) => setScentreeUrl(event.target.value)}
                    placeholder="https://www.scentree.co/en/..."
                    className="h-11 rounded-2xl"
                  />
                </div>

                <div className="rounded-xl border border-border/60 bg-background px-3 py-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <Label htmlFor="edit-material-tgsc-url">TGSC URL</Label>
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
                    id="edit-material-tgsc-url"
                    value={tgscUrl}
                    onChange={(event) => setTgscUrl(event.target.value)}
                    placeholder="https://www.thegoodscentscompany.com/data/..."
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
              <FormSelect
                label="Unit"
                value={formData.unit}
                onChange={(value) => handleChange('unit', value)}
                onBlur={() => handleBlur('unit')}
                options={UNIT_OPTIONS}
                error={errors.unit}
                required
              />
              <div className="space-y-1.5">
                <FormNumber
                  label={`Unit price (per 10 ${formData.unit || 'ml'})`}
                  value={formData.cost_per_unit}
                  onChange={(event) => handleChange('cost_per_unit', event.target.value)}
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
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <FormField
              label="Vendor"
              value={formData.vendor}
              onChange={(event) => handleChange('vendor', event.target.value)}
              placeholder="e.g., PerfumersWorld"
            />

            <FormField
              label="CAS number"
              value={formData.cas_number}
              onChange={(event) => handleChange('cas_number', event.target.value)}
              onBlur={() => handleBlur('cas_number')}
              error={errors.cas_number}
              placeholder="e.g., 8007-75-8"
            />

            <FormNumber
              label="IFRA limit"
              value={formData.ifra_limit}
              onChange={(event) => handleChange('ifra_limit', event.target.value)}
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
                  Optional. These values keep a manual reference profile in sync when workbook data is not yet linked.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-material-workbook-family">Workbook family / class</Label>
                <Select
                  value={formData.reference_abc_primary_family || '__none__'}
                  onValueChange={(value) => handleChange('reference_abc_primary_family', value === '__none__' ? '' : value)}
                >
                  <SelectTrigger id="edit-material-workbook-family" className="h-10 rounded-xl">
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormNumber
                  label="Impact"
                  value={formData.reference_impact}
                  onChange={(event) => handleChange('reference_impact', event.target.value)}
                  onBlur={() => handleBlur('reference_impact')}
                  error={errors.reference_impact}
                  min="0"
                  step="0.1"
                />
                <FormNumber
                  label="Life hours"
                  value={formData.reference_life_hours}
                  onChange={(event) => handleChange('reference_life_hours', event.target.value)}
                  onBlur={() => handleBlur('reference_life_hours')}
                  error={errors.reference_life_hours}
                  min="0"
                  step="0.1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormNumber
                  label="Typical use level"
                  value={formData.reference_use_level_typical_percent}
                  onChange={(event) => handleChange('reference_use_level_typical_percent', event.target.value)}
                  onBlur={() => handleBlur('reference_use_level_typical_percent')}
                  error={errors.reference_use_level_typical_percent}
                  min="0"
                  max="100"
                  step="0.1"
                  unit="%"
                />
                <FormNumber
                  label="Max use level"
                  value={formData.reference_use_level_max_percent}
                  onChange={(event) => handleChange('reference_use_level_max_percent', event.target.value)}
                  onBlur={() => handleBlur('reference_use_level_max_percent')}
                  error={errors.reference_use_level_max_percent}
                  min="0"
                  max="100"
                  step="0.1"
                  unit="%"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-material-description">Description</Label>
              <Textarea
                id="edit-material-description"
                value={formData.description}
                onChange={(event) => handleChange('description', event.target.value)}
                rows={3}
                placeholder="Short description or odour profile"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-material-notes">Notes</Label>
              <Textarea
                id="edit-material-notes"
                value={formData.notes}
                onChange={(event) => handleChange('notes', event.target.value)}
                rows={3}
                placeholder="Optional notes, source context, or evaluation remarks"
              />
            </div>
          </div>

          {Object.keys(warnings).length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <div className="space-y-1">
                  {Object.values(warnings).map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || hasErrors}>
              {loading ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditRawMaterialModal;
