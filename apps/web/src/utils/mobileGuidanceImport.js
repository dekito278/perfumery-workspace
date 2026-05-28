import { importPerfumersWorldByUrl, importScentreeByUrl, importTgscByUrl } from '@/services/scentreeImportService.js';
import { createReferenceMetadataPatch } from '@/utils/canonicalReferenceProfile.js';

export const GUIDANCE_SOURCE_OPTIONS = [
  { value: 'perfumersworld', label: "Perfumer's World" },
  { value: 'scentree', label: 'ScenTree' },
  { value: 'tgsc', label: 'TGSC' },
];

export const getGuidanceSourceLabel = (sourceType) =>
  GUIDANCE_SOURCE_OPTIONS.find((option) => option.value === sourceType)?.label || 'Guidance';

export const importGuidanceBySource = async ({ sourceType, url }) => {
  if (sourceType === 'scentree') {
    return importScentreeByUrl(url);
  }

  if (sourceType === 'tgsc') {
    return importTgscByUrl(url);
  }

  return importPerfumersWorldByUrl(url);
};

const hasPositiveNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
};

const preferPositiveNumber = (nextValue, currentValue) => (
  hasPositiveNumber(nextValue) ? Number(nextValue) : hasPositiveNumber(currentValue) ? Number(currentValue) : null
);

const isSyntheticWorkbookCode = (value) => /^RAW-(?:MANUAL|[A-Z0-9]+)/i.test(String(value || '').trim());

const preferImportedWorkbookCode = (importedWorkbookCode, currentWorkbookCode) => {
  if (importedWorkbookCode) {
    return importedWorkbookCode;
  }

  return currentWorkbookCode && !isSyntheticWorkbookCode(currentWorkbookCode) ? currentWorkbookCode : null;
};

const sanitizeImportedGuidance = (imported = {}) => ({
  ...imported,
  reference_impact: hasPositiveNumber(imported.reference_impact) ? Number(imported.reference_impact) : null,
  reference_life_hours: hasPositiveNumber(imported.reference_life_hours ?? imported.substantivity_hours)
    ? Number(imported.reference_life_hours ?? imported.substantivity_hours)
    : null,
  substantivity_hours: hasPositiveNumber(imported.substantivity_hours) ? Number(imported.substantivity_hours) : null,
  reference_use_level_typical_percent: hasPositiveNumber(imported.reference_use_level_typical_percent) ? Number(imported.reference_use_level_typical_percent) : null,
  reference_use_level_max_percent: hasPositiveNumber(imported.reference_use_level_max_percent) ? Number(imported.reference_use_level_max_percent) : null,
  ifra_limit: hasPositiveNumber(imported.ifra_limit) ? Number(imported.ifra_limit) : null,
});

export const buildGuidancePatch = ({ material = {}, sourceType, imported }) => {
  const normalizedImported = sanitizeImportedGuidance(imported);
  const importedWorkbookCode = normalizedImported.workbook_code || null;
  const nextWorkbookCode = preferImportedWorkbookCode(importedWorkbookCode, material.workbook_code);
  const importedWithTarget = {
    ...normalizedImported,
    source_kind: normalizedImported.source_kind || sourceType,
    source: normalizedImported.source || sourceType,
    source_url: normalizedImported.source_url || normalizedImported.url || null,
    url: normalizedImported.url || normalizedImported.source_url || null,
    target_raw_material_id: material.id || null,
    target_raw_material_name: material.name || null,
  };
  const sourceSnapshots = {
    ...(material.guidance_reference_profile?.source_snapshots || {}),
    [sourceType]: importedWithTarget,
  };
  const fieldLocks = {
    ...(material.guidance_reference_profile?.field_locks || {}),
    workbook_code: Boolean(nextWorkbookCode),
    cas_number: Boolean(normalizedImported.cas_number || material.cas_number),
    reference_abc_primary_family: Boolean(normalizedImported.reference_abc_primary_family || material.reference_abc_primary_family),
    reference_impact: Boolean(hasPositiveNumber(normalizedImported.reference_impact) || hasPositiveNumber(material.reference_impact)),
    reference_life_hours: Boolean(hasPositiveNumber(normalizedImported.reference_life_hours) || hasPositiveNumber(material.reference_life_hours)),
    reference_use_level_typical_percent: Boolean(hasPositiveNumber(normalizedImported.reference_use_level_typical_percent) || hasPositiveNumber(material.reference_use_level_typical_percent)),
    reference_use_level_max_percent: Boolean(hasPositiveNumber(normalizedImported.reference_use_level_max_percent) || hasPositiveNumber(material.reference_use_level_max_percent)),
  };

  return {
    workbook_code: nextWorkbookCode,
    cas_number: normalizedImported.cas_number || material.cas_number || null,
    ifra_limit: preferPositiveNumber(normalizedImported.ifra_limit, material.ifra_limit),
    reference_abc_primary_family: normalizedImported.reference_abc_primary_family || material.reference_abc_primary_family || null,
    reference_impact: preferPositiveNumber(normalizedImported.reference_impact, material.reference_impact),
    reference_life_hours: preferPositiveNumber(normalizedImported.reference_life_hours, material.reference_life_hours),
    reference_use_level_typical_percent: preferPositiveNumber(normalizedImported.reference_use_level_typical_percent, material.reference_use_level_typical_percent),
    reference_use_level_max_percent: preferPositiveNumber(normalizedImported.reference_use_level_max_percent, material.reference_use_level_max_percent),
    description: normalizedImported.description || normalizedImported.odor_description || material.description || null,
    ...createReferenceMetadataPatch({ sourceSnapshots, fieldLocks }),
  };
};

export const summarizeImportedGuidance = ({ sourceType, imported }) => {
  const sourceLabel = getGuidanceSourceLabel(sourceType);
  return [
    `${sourceLabel} imported`,
    imported.workbook_code ? `Workbook ${imported.workbook_code}` : null,
    imported.cas_number ? `CAS ${imported.cas_number}` : null,
    imported.pw_price_label ? `Price ${imported.pw_price_label}` : null,
    hasPositiveNumber(imported.reference_impact) ? `Impact ${imported.reference_impact}` : null,
    hasPositiveNumber(imported.reference_life_hours) ? `Life ${imported.reference_life_hours}h` : null,
    hasPositiveNumber(imported.substantivity_hours) ? `Substantivity ${imported.substantivity_hours}h` : null,
    hasPositiveNumber(imported.reference_use_level_typical_percent) ? `Typical ${imported.reference_use_level_typical_percent}%` : null,
    hasPositiveNumber(imported.reference_use_level_max_percent) ? `Max ${imported.reference_use_level_max_percent}%` : null,
  ].filter(Boolean);
};
