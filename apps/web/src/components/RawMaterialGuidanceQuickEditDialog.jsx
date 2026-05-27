import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { createReferenceMetadataPatch, REFERENCE_FIELD_KEYS } from '@/utils/canonicalReferenceProfile.js';
import { WORKBOOK_ABC_CLASSIFICATIONS } from '@/utils/workbookAbcClassification.js';
import { importPerfumersWorldByUrl, importScentreeByUrl, importTgscByUrl } from '@/services/scentreeImportService.js';

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

const hasMeaningfulText = (value) => Boolean(String(value || '').trim());

const hasMeaningfulNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return false;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0;
};

const normalizeWorkbookCode = (value) => String(value || '').trim().toUpperCase();

const shouldOverrideNumericGuidance = ({
  currentValue,
  nextValue,
  applyMissingOnly,
  nextSourceKind,
}) => {
  if (nextValue === null || nextValue === undefined || nextValue === '') {
    return false;
  }

  if (!applyMissingOnly) {
    return true;
  }

  if (!hasMeaningfulNumber(currentValue)) {
    return true;
  }

  return nextSourceKind === 'explicit';
};

const isSyntheticWorkbookCode = (value) => /^RAW-(?:MANUAL|[A-Z0-9]+)/i.test(String(value || '').trim());

const normalizeWorkbookCodeForForm = (preferredValue, fallbackValue = '') => {
  if (preferredValue && !isSyntheticWorkbookCode(preferredValue)) {
    return String(preferredValue).trim();
  }

  if (fallbackValue && !isSyntheticWorkbookCode(fallbackValue)) {
    return String(fallbackValue).trim();
  }

  return '';
};

const buildImportedSourceSnapshot = (sourceKey, imported, targetUrl) => ({
  ...imported,
  source: imported?.source || sourceKey,
  source_kind: imported?.source_kind || sourceKey,
  source_url: imported?.source_url || imported?.url || targetUrl,
  url: imported?.url || imported?.source_url || targetUrl,
});

const displayGuidanceNumber = (value, suffix = '') => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 'Not set';
  }

  return `${numericValue}${suffix}`;
};

const RawMaterialGuidanceQuickEditDialog = ({
  open,
  onOpenChange,
  material,
  guidanceStatus,
  onSaved,
}) => {
  const { fetchMaterials, updateMaterial, loading } = useRawMaterials();
  const [formData, setFormData] = useState({
    workbook_code: '',
    cas_number: '',
    ifra_limit: '',
    reference_abc_primary_family: '',
    reference_impact: '',
    reference_life_hours: '',
    reference_use_level_typical_percent: '',
    reference_use_level_max_percent: '',
  });
  const [scentreeUrl, setScentreeUrl] = useState('');
  const [perfumersWorldUrl, setPerfumersWorldUrl] = useState('');
  const [tgscUrl, setTgscUrl] = useState('');
  const [inferenceLines, setInferenceLines] = useState([]);
  const [suggestedDescription, setSuggestedDescription] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);
  const [workbookCodeNotice, setWorkbookCodeNotice] = useState('');
  const [fieldLocks, setFieldLocks] = useState(Object.fromEntries(REFERENCE_FIELD_KEYS.map((key) => [key, true])));
  const [sourceSnapshots, setSourceSnapshots] = useState({});
  const [pendingWorkbookBulkImport, setPendingWorkbookBulkImport] = useState(null);

  useEffect(() => {
    if (!material) {
      return;
    }

    const resolvedValues = material.guidance_resolved_values || {};

    setFormData({
      workbook_code: normalizeWorkbookCodeForForm(material.workbook_code, resolvedValues.workbook_code),
      cas_number: resolvedValues.cas_number || material.cas_number || '',
      ifra_limit: resolvedValues.ifra_limit?.toString() || material.ifra_limit?.toString() || '',
      reference_abc_primary_family: resolvedValues.reference_abc_primary_family || material.reference_abc_primary_family || '',
      reference_impact: resolvedValues.reference_impact?.toString() || material.reference_impact?.toString() || '',
      reference_life_hours: resolvedValues.reference_life_hours?.toString() || material.reference_life_hours?.toString() || '',
      reference_use_level_typical_percent: resolvedValues.reference_use_level_typical_percent?.toString() || material.reference_use_level_typical_percent?.toString() || '',
      reference_use_level_max_percent: resolvedValues.reference_use_level_max_percent?.toString() || material.reference_use_level_max_percent?.toString() || '',
    });
    setScentreeUrl('');
    setPerfumersWorldUrl('');
    setTgscUrl('');
    setInferenceLines([]);
    setSuggestedDescription('');
    setWorkbookCodeNotice('');
    setFieldLocks({
      workbook_code: material.guidance_reference_profile?.field_locks?.workbook_code ?? true,
      cas_number: material.guidance_reference_profile?.field_locks?.cas_number ?? true,
      ifra_limit: material.guidance_reference_profile?.field_locks?.ifra_limit ?? true,
      reference_abc_primary_family: material.guidance_reference_profile?.field_locks?.reference_abc_primary_family ?? true,
      reference_impact: material.guidance_reference_profile?.field_locks?.reference_impact ?? true,
      reference_life_hours: material.guidance_reference_profile?.field_locks?.reference_life_hours ?? true,
      reference_use_level_typical_percent: material.guidance_reference_profile?.field_locks?.reference_use_level_typical_percent ?? true,
      reference_use_level_max_percent: material.guidance_reference_profile?.field_locks?.reference_use_level_max_percent ?? true,
    });
    setSourceSnapshots(material.guidance_reference_profile?.source_snapshots || {});
    setPendingWorkbookBulkImport(null);
  }, [material]);

  const toggleFieldLock = (fieldKey, checked) => {
    setFieldLocks((current) => ({
      ...current,
      [fieldKey]: Boolean(checked),
    }));
  };

  const appendSourceSnapshot = (sourceKey, payload) => {
    setSourceSnapshots((current) => ({
      ...current,
      [sourceKey]: payload,
    }));
  };

  const buildBulkWorkbookPayload = (targetMaterial, importedPayload) => ({
    workbook_code: targetMaterial.workbook_code || importedPayload.workbook_code || null,
    cas_number: importedPayload.cas_number || targetMaterial.cas_number || null,
    ifra_limit: targetMaterial.ifra_limit ?? null,
    reference_abc_primary_family: importedPayload.reference_abc_primary_family || targetMaterial.reference_abc_primary_family || null,
    reference_impact: importedPayload.reference_impact ?? targetMaterial.reference_impact ?? null,
    reference_life_hours: importedPayload.reference_life_hours ?? targetMaterial.reference_life_hours ?? null,
    reference_use_level_typical_percent: importedPayload.reference_use_level_typical_percent ?? targetMaterial.reference_use_level_typical_percent ?? null,
    reference_use_level_max_percent: importedPayload.reference_use_level_max_percent ?? targetMaterial.reference_use_level_max_percent ?? null,
    description: importedPayload.description || targetMaterial.description || null,
    ...createReferenceMetadataPatch({
      sourceSnapshots: {
        ...(targetMaterial.guidance_reference_profile?.source_snapshots || {}),
        perfumersworld: importedPayload,
      },
      fieldLocks: {
        ...(targetMaterial.guidance_reference_profile?.field_locks || {}),
        workbook_code: true,
        cas_number: true,
        reference_abc_primary_family: true,
        reference_impact: true,
        reference_life_hours: true,
        reference_use_level_typical_percent: true,
        reference_use_level_max_percent: true,
      },
    }),
  });

  const applyWorkbookImportToMatchingMaterials = async (importedPayload) => {
    const normalizedWorkbookCode = normalizeWorkbookCode(importedPayload?.workbook_code);
    if (!normalizedWorkbookCode) {
      return { syncedCount: 0, workbookCode: null };
    }

    const materials = await fetchMaterials();
    const matchingMaterials = (materials || []).filter((entry) => (
      entry?.id
      && normalizeWorkbookCode(entry.workbook_code) === normalizedWorkbookCode
    ));

    for (const targetMaterial of matchingMaterials) {
      if (!targetMaterial?.id || targetMaterial.id === material?.id) {
        continue;
      }

      await updateMaterial(targetMaterial.id, buildBulkWorkbookPayload(targetMaterial, importedPayload));
    }

    return {
      syncedCount: Math.max(0, matchingMaterials.length - 1),
      workbookCode: normalizedWorkbookCode,
    };
  };

  const warningLines = useMemo(() => {
    if (!guidanceStatus) {
      return [];
    }

    return [
      guidanceStatus.missingGuidance ? 'Belum ada workbook/manual guidance.' : null,
      guidanceStatus.missingImpact ? 'Nilai impact belum ada.' : null,
      guidanceStatus.missingLife ? 'Nilai life belum ada.' : null,
      guidanceStatus.missingClass ? 'Family/class workbook untuk pie-bar display belum ada.' : null,
      guidanceStatus.missingCas ? 'CAS number belum ada.' : null,
      guidanceStatus.missingIfra ? 'IFRA limit belum ada.' : null,
    ].filter(Boolean);
  }, [guidanceStatus]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!material?.id) {
      return;
    }

    setWorkbookCodeNotice('');

    try {
      const nextPayload = {
        workbook_code: formData.workbook_code || null,
        cas_number: formData.cas_number || null,
        ifra_limit: parseOptionalNumber(formData.ifra_limit),
        reference_abc_primary_family: formData.reference_abc_primary_family || null,
        reference_impact: parseOptionalNumber(formData.reference_impact),
        reference_life_hours: parseOptionalNumber(formData.reference_life_hours),
        reference_use_level_typical_percent: parseOptionalNumber(formData.reference_use_level_typical_percent),
        reference_use_level_max_percent: parseOptionalNumber(formData.reference_use_level_max_percent),
        description: suggestedDescription || material.description,
        ...createReferenceMetadataPatch({
          sourceSnapshots,
          fieldLocks,
        }),
      };

      const updatedMaterial = await updateMaterial(material.id, nextPayload);
      const workbookImportResult = pendingWorkbookBulkImport
        ? await applyWorkbookImportToMatchingMaterials(pendingWorkbookBulkImport)
        : { syncedCount: 0, workbookCode: null };

      toast.success(
        workbookImportResult.syncedCount > 0
          ? `Workbook guidance for ${material.name} updated. ${workbookImportResult.syncedCount} matching material(s) on workbook ${workbookImportResult.workbookCode} also synced.`
          : `Workbook guidance for ${material.name} updated`
      );
      onOpenChange(false);
      onSaved?.(updatedMaterial);
    } catch (error) {
      const duplicateWorkbookCode = String(error.message || '').includes('Workbook code');
      if (duplicateWorkbookCode) {
        try {
          const updatedMaterial = await updateMaterial(material.id, {
            workbook_code: material.workbook_code || null,
            cas_number: formData.cas_number || null,
            ifra_limit: parseOptionalNumber(formData.ifra_limit),
            reference_abc_primary_family: formData.reference_abc_primary_family || null,
            reference_impact: parseOptionalNumber(formData.reference_impact),
            reference_life_hours: parseOptionalNumber(formData.reference_life_hours),
            reference_use_level_typical_percent: parseOptionalNumber(formData.reference_use_level_typical_percent),
            reference_use_level_max_percent: parseOptionalNumber(formData.reference_use_level_max_percent),
            description: suggestedDescription || material.description,
            ...createReferenceMetadataPatch({
              sourceSnapshots,
              fieldLocks,
            }),
          });

          setFormData((current) => ({
            ...current,
            workbook_code: material.workbook_code || '',
          }));
          setWorkbookCodeNotice(error.message || 'Workbook code bentrok dengan raw material lain, jadi field ini tidak ikut disimpan.');
            const workbookImportResult = pendingWorkbookBulkImport
              ? await applyWorkbookImportToMatchingMaterials(pendingWorkbookBulkImport)
              : { syncedCount: 0, workbookCode: null };
            toast.success(
              workbookImportResult.syncedCount > 0
                ? `Workbook guidance for ${material.name} updated. Workbook code tidak diubah karena bentrok, tetapi ${workbookImportResult.syncedCount} matching material(s) on workbook ${workbookImportResult.workbookCode} also synced.`
                : `Workbook guidance for ${material.name} updated. Workbook code tidak diubah karena bentrok.`
            );
          onSaved?.(updatedMaterial);
          return;
        } catch (retryError) {
          toast.error(retryError.message || error.message || 'Failed to update workbook guidance');
          return;
        }
      }

      toast.error(error.message || 'Failed to update workbook guidance');
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

      setFormData((current) => ({
        workbook_code: imported.workbook_code || current.workbook_code,
        cas_number: imported.cas_number || current.cas_number,
        ifra_limit: imported.ifra_limit !== null && imported.ifra_limit !== undefined ? String(imported.ifra_limit) : current.ifra_limit,
        reference_abc_primary_family: imported.reference_abc_primary_family || current.reference_abc_primary_family,
        reference_impact: shouldOverrideNumericGuidance({
          currentValue: current.reference_impact,
          nextValue: imported.reference_impact,
          applyMissingOnly: false,
          nextSourceKind: imported.reference_impact_source,
        })
          ? String(imported.reference_impact)
          : current.reference_impact,
        reference_life_hours: shouldOverrideNumericGuidance({
          currentValue: current.reference_life_hours,
          nextValue: imported.reference_life_hours,
          applyMissingOnly: false,
          nextSourceKind: imported.reference_life_hours_source,
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

      setSuggestedDescription(imported.description || material?.description || '');
      appendSourceSnapshot('scentree', buildImportedSourceSnapshot('scentree', imported, scentreeUrl.trim()));
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

  const handleImportPerfumersWorldUrl = async () => {
    if (!perfumersWorldUrl.trim()) {
      toast.error('Masukkan URL PerfumersWorld dulu');
      return;
    }

    setImportingUrl(true);
    try {
      const imported = await importPerfumersWorldByUrl(perfumersWorldUrl.trim());

      setFormData((current) => ({
        workbook_code: imported.workbook_code || current.workbook_code,
        cas_number: imported.cas_number || current.cas_number,
        ifra_limit: current.ifra_limit,
        reference_abc_primary_family: imported.reference_abc_primary_family || current.reference_abc_primary_family,
        reference_impact: shouldOverrideNumericGuidance({
          currentValue: current.reference_impact,
          nextValue: imported.reference_impact,
          applyMissingOnly: false,
          nextSourceKind: imported.reference_impact_source,
        })
          ? String(imported.reference_impact)
          : current.reference_impact,
        reference_life_hours: shouldOverrideNumericGuidance({
          currentValue: current.reference_life_hours,
          nextValue: imported.reference_life_hours,
          applyMissingOnly: false,
          nextSourceKind: imported.reference_life_hours_source,
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

      setSuggestedDescription(imported.description || material?.description || '');
      appendSourceSnapshot('perfumersworld', buildImportedSourceSnapshot('perfumersworld', imported, perfumersWorldUrl.trim()));
      setPendingWorkbookBulkImport(imported.workbook_code ? imported : null);
      setInferenceLines([
        imported.workbook_code ? `Workbook code: ${imported.workbook_code}` : 'Workbook code tidak tersedia di PerfumersWorld.',
        imported.reference_impact !== null && imported.reference_impact !== undefined ? `Impact: ${imported.reference_impact}` : 'Impact tidak tersedia di PerfumersWorld.',
        imported.reference_life_hours !== null && imported.reference_life_hours !== undefined ? `Life: ${imported.reference_life_hours} h` : 'Life tidak tersedia di PerfumersWorld.',
        imported.reference_use_level_typical_percent !== null && imported.reference_use_level_typical_percent !== undefined ? `Typical use level: ${imported.reference_use_level_typical_percent}%` : 'Typical use level tidak tersedia di PerfumersWorld.',
        imported.reference_use_level_max_percent !== null && imported.reference_use_level_max_percent !== undefined ? `Max use level: ${imported.reference_use_level_max_percent}%` : 'Max use level tidak tersedia di PerfumersWorld.',
        imported.ifra_notes ? `IFRA: ${imported.ifra_notes}` : 'IFRA numeric limit tidak tersedia langsung di halaman PerfumersWorld.',
        imported.workbook_code ? `Saat disimpan, workbook ${imported.workbook_code} akan disinkronkan ke semua raw material dengan workbook code yang sama.` : 'Workbook code belum terbaca, jadi sinkronisasi massal tidak akan dijalankan.',
      ]);
      toast.success('PerfumersWorld URL imported');
    } catch (error) {
      toast.error(error.message || 'Failed to import PerfumersWorld URL');
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

      setFormData((current) => ({
        workbook_code: current.workbook_code,
        cas_number: imported.cas_number || current.cas_number,
        ifra_limit: current.ifra_limit,
        reference_abc_primary_family: imported.reference_abc_primary_family || current.reference_abc_primary_family,
        reference_impact: shouldOverrideNumericGuidance({
          currentValue: current.reference_impact,
          nextValue: imported.reference_impact,
          applyMissingOnly: false,
          nextSourceKind: imported.reference_impact_source,
        })
          ? String(imported.reference_impact)
          : current.reference_impact,
        reference_life_hours: shouldOverrideNumericGuidance({
          currentValue: current.reference_life_hours,
          nextValue: imported.reference_life_hours,
          applyMissingOnly: false,
          nextSourceKind: imported.reference_life_hours_source,
        })
          ? String(imported.reference_life_hours)
          : current.reference_life_hours,
        reference_use_level_typical_percent: current.reference_use_level_typical_percent,
        reference_use_level_max_percent: current.reference_use_level_max_percent,
      }));

      setSuggestedDescription(imported.description || material?.description || '');
      appendSourceSnapshot('tgsc', buildImportedSourceSnapshot('tgsc', imported, tgscUrl.trim()));
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto rounded-[24px] border-[#e6deca] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(249,246,239,1)_100%)] p-6">
        <DialogHeader>
          <DialogTitle className="text-xl tracking-[-0.02em]">Workbook guidance</DialogTitle>
          <DialogDescription>
            Lengkapi data penting untuk {material?.name || 'material ini'} agar impact, life, pie, dan bar display lebih akurat.
          </DialogDescription>
        </DialogHeader>

        {material?.guidance_resolved_values ? (
          <div className="rounded-2xl border border-[#e6deca] bg-white/80 px-4 py-4">
            <div className="mb-4 flex flex-col gap-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                Current values
              </div>
              <div className="text-lg font-semibold tracking-[-0.02em] text-[#433821]">
                {material?.name || 'Unknown material'}
              </div>
              {hasMeaningfulText(material?.guidance_resolved_values?.workbook_code) ? (
                <div className="text-xs text-muted-foreground">
                  Workbook code {material.guidance_resolved_values.workbook_code}
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">CAS</div>
                <div className="mt-1.5 font-medium text-foreground">
                  {material.guidance_resolved_values.cas_number || 'Not set'}
                </div>
              </div>
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">IFRA</div>
                <div className="mt-1.5 font-medium text-foreground">
                  {displayGuidanceNumber(material.guidance_resolved_values.ifra_limit, ' %')}
                </div>
              </div>
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Family</div>
                <div className="mt-1.5 font-medium text-foreground">
                  {material.guidance_resolved_values.reference_abc_primary_family || 'No family selected'}
                </div>
              </div>
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Impact</div>
                <div className="mt-1.5 font-medium text-foreground">
                  {displayGuidanceNumber(material.guidance_resolved_values.reference_impact)}
                </div>
              </div>
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Life</div>
                <div className="mt-1.5 font-medium text-foreground">
                  {displayGuidanceNumber(material.guidance_resolved_values.reference_life_hours, ' h')}
                </div>
              </div>
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Typical use level</div>
                <div className="mt-1.5 font-medium text-foreground">
                  {displayGuidanceNumber(material.guidance_resolved_values.reference_use_level_typical_percent, ' %')}
                </div>
              </div>
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3 md:col-span-2 xl:col-span-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Max use level</div>
                <div className="mt-1.5 font-medium text-foreground">
                  {displayGuidanceNumber(material.guidance_resolved_values.reference_use_level_max_percent, ' %')}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {warningLines.length ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div className="space-y-1">
                {warningLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 rounded-2xl border border-[#e6deca] bg-white/75 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
              Import URL
            </div>
            <div className="rounded-xl border border-[#e7decb] bg-white px-3 py-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <Label htmlFor="quick-guidance-perfumersworld-url">PerfumersWorld URL</Label>
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
                id="quick-guidance-perfumersworld-url"
                value={perfumersWorldUrl}
                onChange={(event) => setPerfumersWorldUrl(event.target.value)}
                placeholder="https://www.perfumersworld.com/view.php?pro_id=..."
                className="h-11 rounded-2xl"
              />
            </div>

            <div className="rounded-xl border border-[#e7decb] bg-white px-3 py-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <Label htmlFor="quick-guidance-scentree-url">ScenTree URL</Label>
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
                id="quick-guidance-scentree-url"
                value={scentreeUrl}
                onChange={(event) => setScentreeUrl(event.target.value)}
                placeholder="https://www.scentree.co/en/Adoxal%C2%AE.html"
                className="h-11 rounded-2xl"
              />
            </div>

            <div className="rounded-xl border border-[#e7decb] bg-white px-3 py-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <Label htmlFor="quick-guidance-tgsc-url">TGSC URL</Label>
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
                id="quick-guidance-tgsc-url"
                value={tgscUrl}
                onChange={(event) => setTgscUrl(event.target.value)}
                placeholder="https://www.thegoodscentscompany.com/data/es1002952.html"
                className="h-11 rounded-2xl"
              />
            </div>

            {inferenceLines.length ? (
              <div className="rounded-xl border border-[#e7decb] bg-[#fcfaf4] px-3 py-3 text-xs text-[#5e5239]">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                  Suggestion notes
                </div>
                <div className="space-y-1">
                  {inferenceLines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>
            ) : null}
            {suggestedDescription ? (
              <div className="rounded-xl border border-[#e7decb] bg-white px-3 py-3 text-xs text-[#5e5239]">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                  Workbook summary short
                </div>
                <div>{suggestedDescription}</div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[#e6deca] bg-white/80 p-4">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
              Editable result
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="quick-guidance-workbook-code">Workbook code</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={fieldLocks.workbook_code} onCheckedChange={(checked) => toggleFieldLock('workbook_code', checked)} />
                      <span>Lock</span>
                    </div>
                  </div>
                  <Input
                    id="quick-guidance-workbook-code"
                    value={formData.workbook_code}
                    onChange={(event) => setFormData((current) => ({ ...current, workbook_code: event.target.value }))}
                    placeholder="Optional workbook code"
                    className="h-11 rounded-2xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Jika code bentrok dengan material lain, field lain tetap disimpan dan workbook code akan dikembalikan ke nilai sebelumnya.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="quick-guidance-cas">CAS number</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={fieldLocks.cas_number} onCheckedChange={(checked) => toggleFieldLock('cas_number', checked)} />
                      <span>Lock</span>
                    </div>
                  </div>
                  <Input
                    id="quick-guidance-cas"
                    value={formData.cas_number}
                    onChange={(event) => setFormData((current) => ({ ...current, cas_number: event.target.value }))}
                    placeholder="e.g. 79-09-4"
                    className="h-11 rounded-2xl"
                  />
                </div>
              </div>

              {workbookCodeNotice ? (
                <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-950 [&>svg]:text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Workbook code tidak disimpan</AlertTitle>
                  <AlertDescription>{workbookCodeNotice}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="quick-guidance-family">Workbook family / class</Label>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={fieldLocks.reference_abc_primary_family} onCheckedChange={(checked) => toggleFieldLock('reference_abc_primary_family', checked)} />
                    <span>Lock</span>
                  </div>
                </div>
                <Select
                  value={formData.reference_abc_primary_family || '__none__'}
                  onValueChange={(value) => setFormData((current) => ({
                    ...current,
                    reference_abc_primary_family: value === '__none__' ? '' : value,
                  }))}
                >
                  <SelectTrigger id="quick-guidance-family" className="h-11 rounded-2xl">
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="quick-guidance-impact">Impact</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={fieldLocks.reference_impact} onCheckedChange={(checked) => toggleFieldLock('reference_impact', checked)} />
                      <span>Lock</span>
                    </div>
                  </div>
                  <Input
                    id="quick-guidance-impact"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.reference_impact}
                    onChange={(event) => setFormData((current) => ({ ...current, reference_impact: event.target.value }))}
                    placeholder="0.0"
                    className="h-11 rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="quick-guidance-life">Life (hours)</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={fieldLocks.reference_life_hours} onCheckedChange={(checked) => toggleFieldLock('reference_life_hours', checked)} />
                      <span>Lock</span>
                    </div>
                  </div>
                  <Input
                    id="quick-guidance-life"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.reference_life_hours}
                    onChange={(event) => setFormData((current) => ({ ...current, reference_life_hours: event.target.value }))}
                    placeholder="0.0"
                    className="h-11 rounded-2xl"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="quick-guidance-typical-use">Typical use level (%)</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={fieldLocks.reference_use_level_typical_percent} onCheckedChange={(checked) => toggleFieldLock('reference_use_level_typical_percent', checked)} />
                      <span>Lock</span>
                    </div>
                  </div>
                  <Input
                    id="quick-guidance-typical-use"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.reference_use_level_typical_percent}
                    onChange={(event) => setFormData((current) => ({ ...current, reference_use_level_typical_percent: event.target.value }))}
                    placeholder="0.0"
                    className="h-11 rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="quick-guidance-max-use">Max use level (%)</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={fieldLocks.reference_use_level_max_percent} onCheckedChange={(checked) => toggleFieldLock('reference_use_level_max_percent', checked)} />
                      <span>Lock</span>
                    </div>
                  </div>
                  <Input
                    id="quick-guidance-max-use"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.reference_use_level_max_percent}
                    onChange={(event) => setFormData((current) => ({ ...current, reference_use_level_max_percent: event.target.value }))}
                    placeholder="0.0"
                    className="h-11 rounded-2xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="quick-guidance-ifra">IFRA limit (%)</Label>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={fieldLocks.ifra_limit} onCheckedChange={(checked) => toggleFieldLock('ifra_limit', checked)} />
                    <span>Lock</span>
                  </div>
                </div>
                <Input
                  id="quick-guidance-ifra"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.ifra_limit}
                  onChange={(event) => setFormData((current) => ({ ...current, ifra_limit: event.target.value }))}
                  placeholder="Optional IFRA limit"
                  className="h-11 rounded-2xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-2xl">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="rounded-2xl">
              {loading ? 'Saving...' : 'OK'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RawMaterialGuidanceQuickEditDialog;
