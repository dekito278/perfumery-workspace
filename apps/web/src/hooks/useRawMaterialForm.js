import { useEffect, useState } from 'react';
import { getSolvents } from '@/services/rawMaterialsService.js';
import { getRawMaterialCategories } from '@/services/rawMaterialCategoriesService.js';
import { findPerfumersWorldCategoryByValue } from '@/utils/perfumersWorldCategories.js';
import { getRawMaterialCategoryMeta } from '@/utils/rawMaterialCategoryMeta.js';
import { importPerfumersWorldByUrl, importScentreeByUrl, importTgscByUrl } from '@/services/scentreeImportService.js';
import { toast } from 'sonner';
import { validateRequired, validateMaxLength, validateNonNegativeNumber } from '@/utils/validation.js';
import { FIELD_CONSTRAINTS } from '@/utils/constants.js';
import { createReferenceMetadataPatch } from '@/utils/canonicalReferenceProfile.js';

export const normalizeCategoryValue = (value) => String(value || '').trim().toLowerCase();
export const SOLVENT_CALIBRATION_PRESETS = [
  { key: 'tec', label: 'TEC / TC', impactShiftPercent: -12, lifeShiftPercent: 5 },
  { key: 'dpg', label: 'DPG', impactShiftPercent: -18, lifeShiftPercent: 12 },
  { key: 'dep', label: 'DEP', impactShiftPercent: -9, lifeShiftPercent: 8 },
  { key: 'volatile', label: 'Volatile alcohol / IPM', impactShiftPercent: 14, lifeShiftPercent: -16 },
];

export const createInitialRawMaterialFormData = () => ({
  name: '',
  workbook_code: '',
  category: '',
  type: 'material',
  scent_family: '',
  unit: 'ml',
  stock_quantity: '',
  minimum_stock: '',
  low_stock_threshold: '',
  data_status: 'active',
  review_notes: '',
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
  solvent_impact_shift_percent: '',
  solvent_life_shift_percent: '',
  notes: '',
  is_diluted: false,
  dilution_solvent_id: '',
  dilution_percentage: '',
});

const shouldOverrideNumericGuidance = ({ currentValue, nextValue }) => {
  if (nextValue === null || nextValue === undefined || nextValue === '') {
    return false;
  }

  const currentNumericValue = Number(currentValue);
  return !Number.isFinite(currentNumericValue) || currentNumericValue <= 0;
};

const buildImportedSourceSnapshot = (sourceKey, imported, targetUrl) => ({
  ...imported,
  source: imported?.source || sourceKey,
  source_kind: imported?.source_kind || sourceKey,
  source_url: imported?.source_url || targetUrl,
  url: imported?.url || targetUrl,
});

const createFormDataFromMaterial = (material) => {
  if (!material) {
    return createInitialRawMaterialFormData();
  }

  return {
    name: material.name || '',
    workbook_code: material.workbook_code || '',
    category: normalizeCategoryValue(material.category),
    type: material.type || 'material',
    scent_family: material.scent_family || '',
    unit: material.unit || 'ml',
    stock_quantity: material.stock_quantity?.toString() || '',
    minimum_stock: material.minimum_stock?.toString() || '',
    low_stock_threshold: material.low_stock_threshold?.toString() || '',
    data_status: material.data_status || 'active',
    review_notes: material.review_notes || '',
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
    solvent_impact_shift_percent: material.solvent_impact_shift_percent?.toString() || '',
    solvent_life_shift_percent: material.solvent_life_shift_percent?.toString() || '',
    notes: material.notes || '',
    is_diluted: material.is_diluted || false,
    dilution_solvent_id: material.dilution_solvent_id || '',
    dilution_percentage: material.dilution_percentage?.toString() || '',
  };
};

export const useRawMaterialForm = ({ open, material = null }) => {
  const [solvents, setSolvents] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [formData, setFormData] = useState(createFormDataFromMaterial(material));
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState({});
  const [touched, setTouched] = useState({});
  const [scentreeUrl, setScentreeUrl] = useState('');
  const [perfumersWorldUrl, setPerfumersWorldUrl] = useState('');
  const [tgscUrl, setTgscUrl] = useState('');
  const [inferenceLines, setInferenceLines] = useState([]);
  const [importingUrl, setImportingUrl] = useState(false);
  const [sourceSnapshots, setSourceSnapshots] = useState(
    material?.guidance_reference_profile?.source_snapshots || {}
  );

  const isSolvent = formData.type === 'solvent';

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadOptions = async () => {
      try {
        setSolvents(await getSolvents());
      } catch (error) {
        console.error('Failed to load solvents:', error);
      }

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

    loadOptions();
  }, [open]);

  useEffect(() => {
    if (!material) {
      return;
    }

    setFormData(createFormDataFromMaterial(material));
    setErrors({});
    setWarnings({});
    setTouched({});
    setScentreeUrl('');
    setPerfumersWorldUrl('');
    setTgscUrl('');
    setInferenceLines([]);
    setSourceSnapshots(material.guidance_reference_profile?.source_snapshots || {});
  }, [material]);

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
      case 'stock_quantity':
        error = value !== '' ? validateNonNegativeNumber(value, 'Stock on hand') : '';
        break;
      case 'minimum_stock':
        error = value !== '' ? validateNonNegativeNumber(value, 'Minimum stock') : '';
        break;
      case 'low_stock_threshold':
        error = value !== '' ? validateNonNegativeNumber(value, 'Low stock threshold') : '';
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
      case 'solvent_impact_shift_percent':
      case 'solvent_life_shift_percent':
        if (value !== '') {
          const numValue = Number(value);
          if (Number.isNaN(numValue)) {
            error = 'Calibration must be a valid number';
          } else if (numValue < -100 || numValue > 100) {
            error = 'Calibration must be between -100 and 100';
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
    const nextWarnings = {};

    if (formData.cost_per_unit && parseFloat(formData.cost_per_unit) === 0) {
      nextWarnings.cost_per_unit = 'Purchase price is 0 - this may affect formula calculations';
    }

    setWarnings(nextWarnings);
  };

  const handleChange = (field, value) => {
    setFormData((previous) => {
      const normalizedValue = field === 'category' ? normalizeCategoryValue(value) : value;
      const next = { ...previous, [field]: normalizedValue };

      if (field === 'category') {
        const meta = getRawMaterialCategoryMeta(normalizedValue, previous.type, previous.scent_family);
        const previousCategoryCode = findPerfumersWorldCategoryByValue(previous.category)?.code || '';
        const nextCategoryCode = findPerfumersWorldCategoryByValue(normalizedValue)?.code || '';
        next.type = meta.type;
        next.scent_family = meta.scentFamily;
        if (nextCategoryCode && (!previous.workbook_code || previous.workbook_code === previousCategoryCode)) {
          next.workbook_code = nextCategoryCode;
        }
      }

      return next;
    });

    if (touched[field]) {
      const error = validateField(field, field === 'category' ? normalizeCategoryValue(value) : value);
      setErrors((previous) => ({ ...previous, [field]: error }));
    }
  };

  const handleBlur = (field) => {
    setTouched((previous) => ({ ...previous, [field]: true }));
    setErrors((previous) => ({
      ...previous,
      [field]: validateField(field, formData[field]),
    }));
    checkWarnings();
  };

  const applySolventCalibrationPreset = (presetKey) => {
    const preset = SOLVENT_CALIBRATION_PRESETS.find((entry) => entry.key === presetKey);
    if (!preset) {
      return;
    }

    setFormData((previous) => ({
      ...previous,
      solvent_impact_shift_percent: String(preset.impactShiftPercent),
      solvent_life_shift_percent: String(preset.lifeShiftPercent),
    }));
    setErrors((previous) => ({
      ...previous,
      solvent_impact_shift_percent: '',
      solvent_life_shift_percent: '',
    }));
  };

  const clearSolventCalibrationPreset = () => {
    setFormData((previous) => ({
      ...previous,
      solvent_impact_shift_percent: '',
      solvent_life_shift_percent: '',
    }));
    setErrors((previous) => ({
      ...previous,
      solvent_impact_shift_percent: '',
      solvent_life_shift_percent: '',
    }));
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

  const appendSourceSnapshot = (sourceKey, payload) => {
    setSourceSnapshots((current) => ({
      ...current,
      [sourceKey]: payload,
    }));
  };

  const handleImportPerfumersWorldUrl = async () => {
    const nextUrl = perfumersWorldUrl.trim();
    if (!nextUrl) {
      toast.error('Masukkan URL PerfumersWorld dulu');
      return null;
    }

    setImportingUrl(true);
    try {
      const imported = await importPerfumersWorldByUrl(nextUrl);

      applyImportedGuidance((current) => ({
        ...current,
        workbook_code: imported.workbook_code || current.workbook_code,
        cas_number: imported.cas_number || current.cas_number,
        description: imported.description || current.description,
        notes: imported.notes || current.notes,
        ifra_limit: imported.ifra_limit !== null && imported.ifra_limit !== undefined ? String(imported.ifra_limit) : current.ifra_limit,
        reference_impact: shouldOverrideNumericGuidance({
          currentValue: current.reference_impact,
          nextValue: imported.reference_impact,
        }) ? String(imported.reference_impact) : current.reference_impact,
        reference_life_hours: shouldOverrideNumericGuidance({
          currentValue: current.reference_life_hours,
          nextValue: imported.reference_life_hours,
        }) ? String(imported.reference_life_hours) : current.reference_life_hours,
        reference_use_level_typical_percent: imported.reference_use_level_typical_percent !== null && imported.reference_use_level_typical_percent !== undefined
          ? String(imported.reference_use_level_typical_percent)
          : current.reference_use_level_typical_percent,
        reference_use_level_max_percent: imported.reference_use_level_max_percent !== null && imported.reference_use_level_max_percent !== undefined
          ? String(imported.reference_use_level_max_percent)
          : current.reference_use_level_max_percent,
      }));

      appendSourceSnapshot('perfumersworld', buildImportedSourceSnapshot('perfumersworld', imported, nextUrl));
      setInferenceLines([
        imported.cas_number ? `CAS: ${imported.cas_number}` : 'CAS tidak tersedia di PerfumersWorld.',
        imported.uses_in_perfumery ? `Uses in perfumery: ${imported.uses_in_perfumery}` : 'Uses in perfumery tidak tersedia.',
      ]);
      checkWarnings();
      return imported;
    } catch (error) {
      toast.error(error.message || 'Gagal import data PerfumersWorld');
      return null;
    } finally {
      setImportingUrl(false);
    }
  };

  const handleImportScentreeUrl = async () => {
    const nextUrl = scentreeUrl.trim();
    if (!nextUrl) {
      toast.error('Masukkan URL ScenTree dulu');
      return null;
    }

    setImportingUrl(true);
    try {
      const imported = await importScentreeByUrl(nextUrl);

      applyImportedGuidance((current) => ({
        ...current,
        workbook_code: imported.workbook_code || current.workbook_code,
        cas_number: imported.cas_number || current.cas_number,
        description: imported.description || current.description,
        ifra_limit: imported.ifra_limit !== null && imported.ifra_limit !== undefined ? String(imported.ifra_limit) : current.ifra_limit,
        scent_family: current.scent_family || imported.family || '',
        reference_abc_primary_family: current.reference_abc_primary_family || imported.reference_abc_primary_family || '',
        reference_impact: shouldOverrideNumericGuidance({
          currentValue: current.reference_impact,
          nextValue: imported.reference_impact,
        }) ? String(imported.reference_impact) : current.reference_impact,
        reference_life_hours: shouldOverrideNumericGuidance({
          currentValue: current.reference_life_hours,
          nextValue: imported.reference_life_hours,
        }) ? String(imported.reference_life_hours) : current.reference_life_hours,
        reference_use_level_typical_percent: imported.reference_use_level_typical_percent !== null && imported.reference_use_level_typical_percent !== undefined
          ? String(imported.reference_use_level_typical_percent)
          : current.reference_use_level_typical_percent,
        reference_use_level_max_percent: imported.reference_use_level_max_percent !== null && imported.reference_use_level_max_percent !== undefined
          ? String(imported.reference_use_level_max_percent)
          : current.reference_use_level_max_percent,
      }));

      appendSourceSnapshot('scentree', buildImportedSourceSnapshot('scentree', imported, nextUrl));
      setInferenceLines([
        imported.reference_abc_primary_family ? `Family: ${imported.reference_abc_primary_family}` : 'Family tidak tersedia di ScenTree.',
        imported.reference_impact !== null && imported.reference_impact !== undefined ? `Impact: ${imported.reference_impact}` : 'Impact tidak tersedia di ScenTree.',
        imported.reference_life_hours !== null && imported.reference_life_hours !== undefined ? `Life: ${imported.reference_life_hours} h` : 'Life tidak tersedia di ScenTree.',
        imported.ifra_limit !== null && imported.ifra_limit !== undefined
          ? `IFRA limit: ${imported.ifra_limit}%`
          : 'IFRA limit tidak tersedia di ScenTree.',
      ]);
      checkWarnings();
      return imported;
    } catch (error) {
      toast.error(error.message || 'Gagal import data ScenTree');
      return null;
    } finally {
      setImportingUrl(false);
    }
  };

  const handleImportTgscUrl = async () => {
    const nextUrl = tgscUrl.trim();
    if (!nextUrl) {
      toast.error('Masukkan URL TGSC dulu');
      return null;
    }

    setImportingUrl(true);
    try {
      const imported = await importTgscByUrl(nextUrl);

      applyImportedGuidance((current) => ({
        ...current,
        cas_number: imported.cas_number || current.cas_number,
        description: imported.description || current.description,
        reference_abc_primary_family: current.reference_abc_primary_family || imported.reference_abc_primary_family || '',
        reference_impact: shouldOverrideNumericGuidance({
          currentValue: current.reference_impact,
          nextValue: imported.reference_impact,
        }) ? String(imported.reference_impact) : current.reference_impact,
        reference_life_hours: shouldOverrideNumericGuidance({
          currentValue: current.reference_life_hours,
          nextValue: imported.reference_life_hours,
        }) ? String(imported.reference_life_hours) : current.reference_life_hours,
      }));

      appendSourceSnapshot('tgsc', buildImportedSourceSnapshot('tgsc', imported, nextUrl));
      setInferenceLines([
        imported.reference_abc_primary_family ? `Family: ${imported.reference_abc_primary_family}` : 'Family tidak tersedia di TGSC.',
        imported.reference_impact !== null && imported.reference_impact !== undefined ? `Impact: ${imported.reference_impact}` : 'Impact tidak tersedia di TGSC.',
        imported.reference_life_hours !== null && imported.reference_life_hours !== undefined ? `Life: ${imported.reference_life_hours} h` : 'Life tidak tersedia di TGSC.',
        imported.odor_description ? `Odour profile: ${imported.odor_description}` : 'Odour profile tidak tersedia di TGSC.',
      ]);
      checkWarnings();
      return imported;
    } catch (error) {
      toast.error(error.message || 'Gagal import data TGSC');
      return null;
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
    setTouched(Object.keys(formData).reduce((accumulator, key) => ({ ...accumulator, [key]: true }), {}));
    checkWarnings();
    return Object.keys(nextErrors).length === 0;
  };

  const resetForm = () => {
    setFormData(createInitialRawMaterialFormData());
    setErrors({});
    setWarnings({});
    setTouched({});
    setScentreeUrl('');
    setPerfumersWorldUrl('');
    setTgscUrl('');
    setInferenceLines([]);
    setSourceSnapshots({});
  };

  const buildSubmitPayload = () => ({
    name: formData.name.trim(),
    workbook_code: formData.workbook_code || null,
    category: formData.category,
    type: formData.type,
    scent_family: isSolvent ? null : (formData.scent_family || null),
    unit: formData.unit,
    stock_quantity: formData.stock_quantity ? parseFloat(formData.stock_quantity) : 0,
    minimum_stock: formData.minimum_stock ? parseFloat(formData.minimum_stock) : 0,
    low_stock_threshold: formData.low_stock_threshold ? parseFloat(formData.low_stock_threshold) : null,
    data_status: formData.data_status || 'active',
    review_notes: formData.review_notes || null,
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
    solvent_impact_shift_percent: isSolvent && formData.solvent_impact_shift_percent !== ''
      ? parseFloat(formData.solvent_impact_shift_percent)
      : null,
    solvent_life_shift_percent: isSolvent && formData.solvent_life_shift_percent !== ''
      ? parseFloat(formData.solvent_life_shift_percent)
      : null,
    notes: formData.notes || null,
    is_diluted: formData.is_diluted,
    dilution_solvent_id: formData.is_diluted ? formData.dilution_solvent_id : null,
    dilution_percentage: formData.is_diluted ? parseFloat(formData.dilution_percentage) : null,
    ...createReferenceMetadataPatch({
      sourceSnapshots,
    }),
  });

  return {
    isSolvent,
    solvents,
    categoryOptions,
    formData,
    errors,
    warnings,
    importingUrl,
    scentreeUrl,
    setScentreeUrl,
    perfumersWorldUrl,
    setPerfumersWorldUrl,
    tgscUrl,
    setTgscUrl,
    inferenceLines,
    hasErrors: Object.values(errors).some(Boolean),
    handleChange,
    handleBlur,
    applySolventCalibrationPreset,
    clearSolventCalibrationPreset,
    handleImportPerfumersWorldUrl,
    handleImportScentreeUrl,
    handleImportTgscUrl,
    validateForm,
    resetForm,
    buildSubmitPayload,
    solventCalibrationPresets: SOLVENT_CALIBRATION_PRESETS,
  };
};
