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

  const numericValue = Number(String(value).trim().replace(',', '.'));
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

// Generated reference ids must never be offered as a workbook code: the guard only knew the RAW- family,
// so a manual profile's MAN-<uuid> was stamped into raw_materials.workbook_code — a column under a unique
// index that the create path matches on first (audit round 8).
const isSyntheticWorkbookCode = (value) => /^(?:RAW|MAN|EXT)-/i.test(String(value || '').trim());

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
    return 'Belum diisi';
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
      guidanceStatus.missingGuidance ? 'Belum ada panduan workbook/manual.' : null,
      guidanceStatus.missingImpact ? 'Nilai kekuatan belum ada.' : null,
      guidanceStatus.missingLife ? 'Nilai ketahanan belum ada.' : null,
      guidanceStatus.missingClass ? 'Keluarga/kelas workbook untuk grafik pie dan bar belum ada.' : null,
      guidanceStatus.missingCas ? 'Nomor CAS belum ada.' : null,
      guidanceStatus.missingIfra ? 'Batas IFRA belum ada.' : null,
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
          ? `Panduan workbook untuk ${material.name} diperbarui. ${workbookImportResult.syncedCount} bahan lain dengan workbook ${workbookImportResult.workbookCode} ikut disinkronkan.`
          : `Panduan workbook untuk ${material.name} diperbarui`
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
          setWorkbookCodeNotice(error.message || 'Kode workbook bentrok dengan bahan lain, jadi kolom ini tidak ikut disimpan.');
            const workbookImportResult = pendingWorkbookBulkImport
              ? await applyWorkbookImportToMatchingMaterials(pendingWorkbookBulkImport)
              : { syncedCount: 0, workbookCode: null };
            toast.success(
              workbookImportResult.syncedCount > 0
                ? `Panduan workbook untuk ${material.name} diperbarui. Kode workbook tidak diubah karena bentrok, tetapi ${workbookImportResult.syncedCount} bahan lain dengan workbook ${workbookImportResult.workbookCode} ikut disinkronkan.`
                : `Panduan workbook untuk ${material.name} diperbarui. Kode workbook tidak diubah karena bentrok.`
            );
          onSaved?.(updatedMaterial);
          return;
        } catch (retryError) {
          toast.error(retryError.message || error.message || 'Gagal memperbarui panduan workbook');
          return;
        }
      }

      toast.error(error.message || 'Gagal memperbarui panduan workbook');
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
        imported.classification_path?.length ? `Jalur ScenTree: ${imported.classification_path.join(' > ')}` : 'Jalur ScenTree tidak tersedia.',
        imported.volatility ? `Volatilitas: ${imported.volatility}` : 'Volatilitas tidak tersedia di ScenTree.',
        imported.detection_threshold ? `Ambang deteksi: ${imported.detection_threshold}` : 'Ambang deteksi tidak tersedia di ScenTree.',
        imported.uses_in_perfumery ? `Kegunaan di parfum: ${imported.uses_in_perfumery}` : 'Kegunaan di parfum tidak tersedia di ScenTree.',
        imported.ifra_notes ? `IFRA: ${imported.ifra_notes}` : 'Catatan IFRA tidak tersedia di ScenTree.',
      ]);
      toast.success('URL ScenTree berhasil diimpor');
    } catch (error) {
      toast.error(error.message || 'Gagal mengimpor URL ScenTree');
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
        imported.workbook_code ? `Kode workbook: ${imported.workbook_code}` : 'Kode workbook tidak tersedia di PerfumersWorld.',
        imported.reference_impact !== null && imported.reference_impact !== undefined ? `Kekuatan: ${imported.reference_impact}` : 'Kekuatan tidak tersedia di PerfumersWorld.',
        imported.reference_life_hours !== null && imported.reference_life_hours !== undefined ? `Ketahanan: ${imported.reference_life_hours} jam` : 'Ketahanan tidak tersedia di PerfumersWorld.',
        imported.reference_use_level_typical_percent !== null && imported.reference_use_level_typical_percent !== undefined ? `Takaran umum: ${imported.reference_use_level_typical_percent}%` : 'Takaran umum tidak tersedia di PerfumersWorld.',
        imported.reference_use_level_max_percent !== null && imported.reference_use_level_max_percent !== undefined ? `Takaran maks: ${imported.reference_use_level_max_percent}%` : 'Takaran maks tidak tersedia di PerfumersWorld.',
        imported.pw_price_label ? `Harga PerfumersWorld: ${imported.pw_price_label}` : 'Harga PerfumersWorld tidak tersedia.',
        imported.ifra_notes ? `IFRA: ${imported.ifra_notes}` : 'Angka batas IFRA tidak tersedia langsung di halaman PerfumersWorld.',
        imported.workbook_code ? `Saat disimpan, workbook ${imported.workbook_code} akan disinkronkan ke semua bahan dengan kode workbook yang sama.` : 'Kode workbook belum terbaca, jadi sinkronisasi massal tidak dijalankan.',
      ]);
      toast.success('URL PerfumersWorld berhasil diimpor');
    } catch (error) {
      toast.error(error.message || 'Gagal mengimpor URL PerfumersWorld');
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
        imported.odor_type ? `Jenis aroma: ${imported.odor_type}` : 'Jenis aroma tidak tersedia di TGSC.',
        imported.odor_strength ? `Kekuatan aroma: ${imported.odor_strength}` : 'Kekuatan aroma tidak tersedia di TGSC.',
        imported.substantivity_hours !== null && imported.substantivity_hours !== undefined ? `Substantivitas: ${imported.substantivity_hours} jam` : 'Substantivitas tidak tersedia di TGSC.',
        imported.odor_description ? `Deskripsi aroma: ${imported.odor_description}` : 'Deskripsi aroma tidak tersedia di TGSC.',
      ]);
      toast.success('URL TGSC berhasil diimpor');
    } catch (error) {
      toast.error(error.message || 'Gagal mengimpor URL TGSC');
    } finally {
      setImportingUrl(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto rounded-[24px] border-[#e6deca] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(249,246,239,1)_100%)] p-6">
        <DialogHeader>
          <DialogTitle className="text-xl tracking-[-0.02em]">Panduan workbook</DialogTitle>
          <DialogDescription>
            Lengkapi data penting untuk {material?.name || 'bahan ini'} supaya kekuatan, ketahanan, serta grafik pie dan bar lebih akurat.
          </DialogDescription>
        </DialogHeader>

        {material?.guidance_resolved_values ? (
          <div className="rounded-2xl border border-[#e6deca] bg-white/80 px-4 py-4">
            <div className="mb-4 flex flex-col gap-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
                Nilai saat ini
              </div>
              <div className="text-lg font-semibold tracking-[-0.02em] text-[#433821]">
                {material?.name || 'Bahan tanpa nama'}
              </div>
              {hasMeaningfulText(material?.guidance_resolved_values?.workbook_code) ? (
                <div className="text-xs text-muted-foreground">
                  Kode workbook {material.guidance_resolved_values.workbook_code}
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">CAS</div>
                <div className="mt-1.5 font-medium text-foreground">
                  {material.guidance_resolved_values.cas_number || 'Belum diisi'}
                </div>
              </div>
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">IFRA</div>
                <div className="mt-1.5 font-medium text-foreground">
                  {displayGuidanceNumber(material.guidance_resolved_values.ifra_limit, ' %')}
                </div>
              </div>
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Keluarga aroma</div>
                <div className="mt-1.5 font-medium text-foreground">
                  {material.guidance_resolved_values.reference_abc_primary_family || 'Belum ada keluarga aroma'}
                </div>
              </div>
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kekuatan</div>
                <div className="mt-1.5 font-medium text-foreground">
                  {displayGuidanceNumber(material.guidance_resolved_values.reference_impact)}
                </div>
              </div>
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ketahanan</div>
                <div className="mt-1.5 font-medium text-foreground">
                  {displayGuidanceNumber(material.guidance_resolved_values.reference_life_hours, ' jam')}
                </div>
              </div>
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Takaran umum</div>
                <div className="mt-1.5 font-medium text-foreground">
                  {displayGuidanceNumber(material.guidance_resolved_values.reference_use_level_typical_percent, ' %')}
                </div>
              </div>
              <div className="rounded-xl border border-[#ece4d3] bg-[#fcfaf4] px-3 py-3 md:col-span-2 xl:col-span-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Takaran maks</div>
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
              Impor URL
            </div>

            <div className="rounded-xl border border-[#e7decb] bg-white px-3 py-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <Label htmlFor="quick-guidance-perfumersworld-url">URL PerfumersWorld</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tempel link produk PerfumersWorld untuk mengimpor kode workbook, kekuatan, ketahanan, CAS, dan takaran.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={handleImportPerfumersWorldUrl} className="rounded-2xl" disabled={importingUrl}>
                  <Link2 className="mr-2 h-4 w-4" />
                  {importingUrl ? 'Mengimpor...' : 'Impor URL'}
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
                  <Label htmlFor="quick-guidance-scentree-url">URL ScenTree</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tempel URL bahan dari ScenTree untuk mengimpor keluarga aroma, CAS, IFRA, volatilitas, dan deskripsi singkat.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={handleImportScentreeUrl} className="rounded-2xl" disabled={importingUrl}>
                  <Link2 className="mr-2 h-4 w-4" />
                  {importingUrl ? 'Mengimpor...' : 'Impor URL'}
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
                  <Label htmlFor="quick-guidance-tgsc-url">URL TGSC</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tempel URL The Good Scents Company untuk mengimpor CAS, profil aroma, perkiraan kekuatan, dan ketahanan dari substantivitas.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={handleImportTgscUrl} className="rounded-2xl" disabled={importingUrl}>
                  <Link2 className="mr-2 h-4 w-4" />
                  {importingUrl ? 'Mengimpor...' : 'Impor URL'}
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
                  Catatan saran
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
                  Ringkasan workbook
                </div>
                <div>{suggestedDescription}</div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[#e6deca] bg-white/80 p-4">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6d4f]">
              Hasil yang bisa diubah
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="quick-guidance-workbook-code">Kode workbook</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={fieldLocks.workbook_code} onCheckedChange={(checked) => toggleFieldLock('workbook_code', checked)} />
                      <span>Kunci</span>
                    </div>
                  </div>
                  <Input
                    id="quick-guidance-workbook-code"
                    value={formData.workbook_code}
                    onChange={(event) => setFormData((current) => ({ ...current, workbook_code: event.target.value }))}
                    placeholder="Kode workbook (opsional)"
                    className="h-11 rounded-2xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Kalau kodenya bentrok dengan bahan lain, kolom lain tetap disimpan dan kode workbook dikembalikan ke nilai sebelumnya.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="quick-guidance-cas">Nomor CAS</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={fieldLocks.cas_number} onCheckedChange={(checked) => toggleFieldLock('cas_number', checked)} />
                      <span>Kunci</span>
                    </div>
                  </div>
                  <Input
                    id="quick-guidance-cas"
                    value={formData.cas_number}
                    onChange={(event) => setFormData((current) => ({ ...current, cas_number: event.target.value }))}
                    placeholder="mis. 79-09-4"
                    className="h-11 rounded-2xl"
                  />
                </div>
              </div>

              {workbookCodeNotice ? (
                <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-950 [&>svg]:text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Kode workbook tidak disimpan</AlertTitle>
                  <AlertDescription>{workbookCodeNotice}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="quick-guidance-family">Keluarga aroma / kelas workbook</Label>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={fieldLocks.reference_abc_primary_family} onCheckedChange={(checked) => toggleFieldLock('reference_abc_primary_family', checked)} />
                    <span>Kunci</span>
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
                    <SelectValue placeholder="Pilih keluarga aroma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tanpa keluarga aroma</SelectItem>
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
                    <Label htmlFor="quick-guidance-impact">Kekuatan</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={fieldLocks.reference_impact} onCheckedChange={(checked) => toggleFieldLock('reference_impact', checked)} />
                      <span>Kunci</span>
                    </div>
                  </div>
                  <Input
                    id="quick-guidance-impact"
                    type="number"
                    min="0"
                    step="any"
                    value={formData.reference_impact}
                    onChange={(event) => setFormData((current) => ({ ...current, reference_impact: event.target.value }))}
                    placeholder="0.0"
                    className="h-11 rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="quick-guidance-life">Ketahanan di strip (jam)</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={fieldLocks.reference_life_hours} onCheckedChange={(checked) => toggleFieldLock('reference_life_hours', checked)} />
                      <span>Kunci</span>
                    </div>
                  </div>
                  <Input
                    id="quick-guidance-life"
                    type="number"
                    min="0"
                    step="any"
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
                    <Label htmlFor="quick-guidance-typical-use">Takaran umum (%)</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={fieldLocks.reference_use_level_typical_percent} onCheckedChange={(checked) => toggleFieldLock('reference_use_level_typical_percent', checked)} />
                      <span>Kunci</span>
                    </div>
                  </div>
                  <Input
                    id="quick-guidance-typical-use"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={formData.reference_use_level_typical_percent}
                    onChange={(event) => setFormData((current) => ({ ...current, reference_use_level_typical_percent: event.target.value }))}
                    placeholder="0.0"
                    className="h-11 rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="quick-guidance-max-use">Takaran maks (%)</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={fieldLocks.reference_use_level_max_percent} onCheckedChange={(checked) => toggleFieldLock('reference_use_level_max_percent', checked)} />
                      <span>Kunci</span>
                    </div>
                  </div>
                  <Input
                    id="quick-guidance-max-use"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={formData.reference_use_level_max_percent}
                    onChange={(event) => setFormData((current) => ({ ...current, reference_use_level_max_percent: event.target.value }))}
                    placeholder="0.0"
                    className="h-11 rounded-2xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="quick-guidance-ifra">Batas IFRA (%)</Label>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={fieldLocks.ifra_limit} onCheckedChange={(checked) => toggleFieldLock('ifra_limit', checked)} />
                    <span>Kunci</span>
                  </div>
                </div>
                <Input
                  id="quick-guidance-ifra"
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={formData.ifra_limit}
                  onChange={(event) => setFormData((current) => ({ ...current, ifra_limit: event.target.value }))}
                  placeholder="Batas IFRA (opsional)"
                  className="h-11 rounded-2xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-2xl">
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="rounded-2xl">
              {loading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RawMaterialGuidanceQuickEditDialog;
