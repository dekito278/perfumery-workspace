import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, RefreshCw, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateRawMaterial } from '@/services/rawMaterialsService.js';
import { PERFUMERS_WORLD_CATEGORY_VALUES } from '@/utils/perfumersWorldCategories.js';
import { suggestPerfumersWorldCategory } from '@/utils/perfumersWorldCategorySuggestions.js';

const CONFIDENCE_STYLES = {
  exact: 'default',
  high: 'default',
  medium: 'secondary',
  low: 'outline',
  none: 'outline',
};

const RemapRawMaterialCategoriesModal = ({ open, onOpenChange, materials, onSuccess }) => {
  const [savingIds, setSavingIds] = useState({});
  const [applyingAll, setApplyingAll] = useState(false);

  const candidates = useMemo(
    () =>
      (materials || [])
        .map((material) => {
          const suggestion = suggestPerfumersWorldCategory({
            workbookCode: material.workbook_code,
            name: material.name,
            legacyCategory: material.category,
          });

          const alreadyStandard = PERFUMERS_WORLD_CATEGORY_VALUES.has(String(material.category || '').toLowerCase());

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
      toast.success(`Updated ${candidate.material.name}`);
      if (onSuccess) {
        await onSuccess();
      }
    } catch (error) {
      toast.error(error.message || `Failed to update ${candidate.material.name}`);
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
      toast.info('No safe category suggestions available to apply');
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
      toast.success(`Applied ${safeCandidates.length} category remaps`);
      if (onSuccess) {
        await onSuccess();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to apply all remaps');
    } finally {
      setApplyingAll(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>Remap raw material categories</DialogTitle>
          <DialogDescription>
            Review legacy materials and update them into the Perfumer&apos;s Workbook A-Z system one by one with suggested mappings.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <div className="rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground">
            All loaded raw materials already use the A-Z classification, or no safe suggestions were found.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{candidates.length} materials need remap</Badge>
              <Badge variant="outline">
                {candidates.filter((candidate) => ['exact', 'high', 'medium'].includes(candidate.suggestion.confidence)).length} safe suggestions
              </Badge>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Current category</TableHead>
                    <TableHead>Suggested A-Z category</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Action</TableHead>
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
                            {material.workbook_code || 'No workbook code'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{material.category || 'Uncategorized'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={CONFIDENCE_STYLES[suggestion.confidence] || 'outline'}>
                              {suggestion.category?.label || 'No suggestion'}
                            </Badge>
                            <span className="text-xs text-muted-foreground uppercase">{suggestion.confidence}</span>
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
                            Apply
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
            Close
          </Button>
          <Button type="button" onClick={applyAllSafeSuggestions} disabled={applyingAll || !candidates.length} className="gap-2">
            {applyingAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Apply safe suggestions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemapRawMaterialCategoriesModal;
