import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Link2, AlertTriangle, ScanSearch } from 'lucide-react';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { createReferenceMetadataPatch } from '@/utils/canonicalReferenceProfile.js';
import { buildPerfumersWorldUrlFromWorkbookCode, importPerfumersWorldByUrl } from '@/services/scentreeImportService.js';

const normalizeWorkbookCode = (value) => String(value || '').trim().toUpperCase();

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

const BulkWorkbookGuidanceImportDialog = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { fetchMaterials, updateMaterial, loading } = useRawMaterials();
  const [inventorySummary, setInventorySummary] = useState({
    totalMaterials: 0,
    eligibleMaterials: 0,
    uniqueWorkbookCodes: 0,
    sharedWorkbookCodes: 0,
  });
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastReport, setLastReport] = useState(null);

  const summaryBadges = useMemo(() => ([
    { label: 'total material', value: inventorySummary.totalMaterials },
    { label: 'punya workbook code', value: inventorySummary.eligibleMaterials },
    { label: 'unique workbook code', value: inventorySummary.uniqueWorkbookCodes },
    { label: 'dipakai >1 material', value: inventorySummary.sharedWorkbookCodes },
  ]), [inventorySummary]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let isActive = true;

    const loadInventorySummary = async () => {
      setInventoryLoading(true);
      try {
        const materials = await fetchMaterials();
        if (!isActive) {
          return;
        }

        const materialsWithWorkbookCode = (materials || []).filter((material) => normalizeWorkbookCode(material.workbook_code));
        const workbookCodeCounts = new Map();
        materialsWithWorkbookCode.forEach((material) => {
          const workbookCode = normalizeWorkbookCode(material.workbook_code);
          workbookCodeCounts.set(workbookCode, (workbookCodeCounts.get(workbookCode) || 0) + 1);
        });

        setInventorySummary({
          totalMaterials: (materials || []).length,
          eligibleMaterials: materialsWithWorkbookCode.length,
          uniqueWorkbookCodes: workbookCodeCounts.size,
          sharedWorkbookCodes: [...workbookCodeCounts.values()].filter((count) => count > 1).length,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setInventorySummary({
          totalMaterials: 0,
          eligibleMaterials: 0,
          uniqueWorkbookCodes: 0,
          sharedWorkbookCodes: 0,
        });
        toast.error(error.message || 'Gagal membaca inventory raw material');
      } finally {
        if (isActive) {
          setInventoryLoading(false);
        }
      }
    };

    loadInventorySummary();

    return () => {
      isActive = false;
    };
  }, [open, fetchMaterials]);

  const handleRunImport = async () => {
    setProcessing(true);
    try {
      const materials = await fetchMaterials();
      const materialsByWorkbookCode = new Map();
      (materials || []).forEach((material) => {
        const workbookCode = normalizeWorkbookCode(material.workbook_code);
        if (!workbookCode) {
          return;
        }

        if (!materialsByWorkbookCode.has(workbookCode)) {
          materialsByWorkbookCode.set(workbookCode, []);
        }
        materialsByWorkbookCode.get(workbookCode).push(material);
      });

      const workbookCodes = [...materialsByWorkbookCode.keys()];
      if (!workbookCodes.length) {
        toast.error('Belum ada raw material dengan workbook code');
        return;
      }

      const report = {
        scannedMaterials: (materials || []).length,
        eligibleMaterials: [...materialsByWorkbookCode.values()].reduce((total, entries) => total + entries.length, 0),
        processedWorkbookCodes: workbookCodes.length,
        workbookMatches: [],
        failedCodes: [],
        updatedMaterials: 0,
      };

      for (const workbookCode of workbookCodes) {
        const url = buildPerfumersWorldUrlFromWorkbookCode(workbookCode);
        try {
          const imported = await importPerfumersWorldByUrl(url);
          const importedWorkbookCode = normalizeWorkbookCode(imported.workbook_code);
          const matchingMaterials = materialsByWorkbookCode.get(workbookCode) || [];

          await Promise.all(matchingMaterials.map(async (material) => {
            await updateMaterial(material.id, buildBulkWorkbookPayload(material, imported));
            report.updatedMaterials += 1;
          }));

          report.workbookMatches.push({
            workbookCode,
            matchedCount: matchingMaterials.length,
            url,
            importedWorkbookCode: importedWorkbookCode || null,
            codeMismatch: Boolean(importedWorkbookCode) && importedWorkbookCode !== workbookCode,
          });
        } catch (error) {
          report.failedCodes.push({
            workbookCode,
            url,
            reason: error.message || 'Import gagal untuk URL ini.',
          });
        }
      }

      setLastReport(report);
      toast.success(
        report.updatedMaterials > 0
          ? `${report.updatedMaterials} raw material berhasil disinkronkan dari ${report.workbookMatches.length} workbook code.`
          : 'Bulk import selesai, tetapi belum ada raw material yang tersinkron.'
      );
      await onSuccess?.();
    } catch (error) {
      toast.error(error.message || 'Bulk workbook import gagal');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-[24px] border-[#e6deca] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(249,246,239,1)_100%)] p-6">
        <DialogHeader>
          <DialogTitle className="text-xl tracking-[-0.02em]">Auto sync workbook guidance</DialogTitle>
          <DialogDescription>
            Sistem akan scan semua raw material yang punya `workbook_code`, generate URL PerfumersWorld otomatis dari code itu, lalu sync guidance secara massal tanpa perlu tempel link satu-satu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#e6deca] bg-white/80 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Scan workbook code dari inventory</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Setiap workbook code akan diubah menjadi URL seperti `view.php?pro_id=CODE`, lalu hasil PerfumersWorld akan disebarkan ke semua material yang memakai code yang sama.
                </p>
              </div>
              <ScanSearch className="mt-1 h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {summaryBadges.map((entry) => (
                <Badge key={entry.label} variant="outline" className="rounded-full">
                  {inventoryLoading ? '...' : entry.value} {entry.label}
                </Badge>
              ))}
            </div>
          </div>

          <Alert className="border-amber-200 bg-amber-50 text-amber-950 [&>svg]:text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Yang akan disinkronkan</AlertTitle>
            <AlertDescription>
              Workbook code, CAS, family, impact, life, typical use level, max use level, dan summary description dari PerfumersWorld akan disebarkan ke semua raw material yang workbook code-nya cocok.
            </AlertDescription>
          </Alert>

          {lastReport ? (
            <div className="rounded-2xl border border-[#e6deca] bg-white/80 p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full">
                  {lastReport.updatedMaterials} material updated
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {lastReport.workbookMatches.length} workbook synced
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {lastReport.failedCodes.length} failed
                </Badge>
              </div>

              {lastReport.workbookMatches.length ? (
                <div className="mt-4 space-y-2">
                  {lastReport.workbookMatches.map((entry) => (
                    <div key={`${entry.workbookCode}-${entry.url}`} className="rounded-xl border bg-background/70 px-3 py-3 text-sm">
                      <div className="font-medium">Workbook {entry.workbookCode}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {entry.matchedCount} matching raw material(s) updated
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{entry.url}</div>
                      {entry.codeMismatch ? (
                        <div className="mt-1 text-xs text-amber-700">
                          Workbook di halaman terbaca sebagai {entry.importedWorkbookCode || '-'}.
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {lastReport.failedCodes.length ? (
                <div className="mt-4 space-y-2">
                  {lastReport.failedCodes.map((entry) => (
                    <div key={`failed-${entry.url}`} className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm">
                      <div className="font-medium">Workbook {entry.workbookCode}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{entry.reason}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{entry.url}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-2xl">
            Close
          </Button>
          <Button type="button" onClick={handleRunImport} disabled={processing || loading || inventoryLoading} className="rounded-2xl">
            <Link2 className="mr-2 h-4 w-4" />
            {processing ? 'Syncing...' : 'Run auto sync'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkWorkbookGuidanceImportDialog;
