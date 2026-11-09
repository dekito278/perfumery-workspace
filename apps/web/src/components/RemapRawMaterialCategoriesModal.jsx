import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, RefreshCw, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateRawMaterial } from '@/services/rawMaterialsService.js';
import { isOfficialScentTaxonomyCategory, suggestScentTaxonomyCategory } from '@/utils/scentTaxonomySuggestions.js';

const CONFIDENCE_STYLES = {
  exact: 'default',
  high: 'default',
  medium: 'secondary',
  low: 'outline',
  none: 'outline',
};

// Display only: the confidence keys themselves are compared above and below.
const CONFIDENCE_LABELS = {
  exact: 'pasti',
  high: 'tinggi',
  medium: 'sedang',
  low: 'rendah',
  none: '-',
};

const RemapRawMaterialCategoriesModal = ({ open, onOpenChange, materials, onSuccess }) => {
  const [savingIds, setSavingIds] = useState({});
  const [applyingAll, setApplyingAll] = useState(false);

  const candidates = useMemo(
    () =>
      (materials || [])
        .map((material) => {
          const suggestion = suggestScentTaxonomyCategory({
            workbookCode: material.workbook_code,
            name: material.name,
            legacyCategory: material.category,
          });

          const alreadyStandard = isOfficialScentTaxonomyCategory(material.category);

          return {
            material,
            suggestion,
            alreadyStandard,
          };
        })
        .filter(({ suggestion, alreadyStandard }) => !alreadyStandard && suggestion.category),
    [materials]
  );

  const applyRemap = async (candidate) => {
    const materialId = candidate.material.id;
    setSavingIds((current) => ({ ...current, [materialId]: true }));

    try {
      await updateRawMaterial(materialId, {
        ...candidate.material,
        category: candidate.suggestion.category.label.toLowerCase(),
      });
      toast.success(`${candidate.material.name} diperbarui`);
      if (onSuccess) {
        await onSuccess();
      }
    } catch (error) {
      toast.error(error.message || `Gagal memperbarui ${candidate.material.name}`);
    } finally {
      setSavingIds((current) => {
        const next = { ...current };
        delete next[materialId];
        return next;
      });
    }
  };

  const applyAllSafeSuggestions = async () => {
    const safeCandidates = candidates.filter((candidate) =>
      ['exact', 'high', 'medium'].includes(candidate.suggestion.confidence)
    );

    if (!safeCandidates.length) {
      toast.info('Tidak ada saran kategori aman yang bisa diterapkan');
      return;
    }

    setApplyingAll(true);
    try {
      for (const candidate of safeCandidates) {
        await updateRawMaterial(candidate.material.id, {
          ...candidate.material,
          category: candidate.suggestion.category.label.toLowerCase(),
        });
      }
      toast.success(`${safeCandidates.length} kategori dipetakan ulang`);
      if (onSuccess) {
        await onSuccess();
      }
    } catch (error) {
      toast.error(error.message || 'Gagal menerapkan semua pemetaan ulang');
    } finally {
      setApplyingAll(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>Petakan ulang kategori bahan baku</DialogTitle>
          <DialogDescription>
            Tinjau bahan lama dan masukkan ke 11 grandfamily aroma satu per satu, dengan saran pemetaan.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <div className="rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground">
            Semua bahan baku yang dimuat sudah memakai taksonomi aroma, atau tidak ada saran yang cukup aman.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{candidates.length} bahan perlu dipetakan ulang</Badge>
              <Badge variant="outline">
                {candidates.filter((candidate) => ['exact', 'high', 'medium'].includes(candidate.suggestion.confidence)).length} saran aman
              </Badge>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bahan</TableHead>
                    <TableHead>Kategori sekarang</TableHead>
                    <TableHead>Saran grandfamily</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => {
                    const { material, suggestion } = candidate;
                    const isSaving = Boolean(savingIds[material.id]);

                    return (
                      <TableRow key={material.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{material.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {material.workbook_code || 'Belum ada kode workbook'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{material.category || 'Tanpa kategori'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={CONFIDENCE_STYLES[suggestion.confidence] || 'outline'}>
                              {suggestion.category?.label || 'Tidak ada saran'}
                            </Badge>
                            <span className="text-xs text-muted-foreground uppercase">{CONFIDENCE_LABELS[suggestion.confidence] || suggestion.confidence}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{suggestion.reason}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={isSaving}
                            onClick={() => applyRemap(candidate)}
                          >
                            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Terapkan
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button type="button" onClick={applyAllSafeSuggestions} disabled={applyingAll || !candidates.length} className="gap-2">
            {applyingAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Terapkan saran aman
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemapRawMaterialCategoriesModal;
