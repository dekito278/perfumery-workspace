
import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatGramAmount, formatPercentage, formatStatus, formatQuantity } from '@/utils/formatting.js';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { calculateDilutionComposition } from '@/utils/calculateDilutionCost.js';
import { buildFormulaItemReferenceMaps, resolveFormulaItemReference } from '@/utils/legacyFormulaItemSources.js';
import { getFormulaItems } from '@/services/formulasSupabaseService.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';

const normalizeFormulaItemType = (item, itemDetails) => {
  if (item?.item_type === 'accord') {
    return 'accord';
  }

  if (itemDetails?.type === 'solvent' || itemDetails?.item_type === 'solvent' || item?.item_type === 'solvent') {
    return 'solvent';
  }

  return 'raw_material';
};

const FormulaPreview = ({ formula }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFormulaItems = useCallback(async () => {
    if (!formula?.id) {
      return;
    }

    setLoading(true);
    try {
      const itemsData = await getFormulaItems(formula.id);
      const rawMaterials = await getRawMaterialOptions();
      const referenceMaps = await buildFormulaItemReferenceMaps(itemsData, rawMaterials);

      const enrichedItems = itemsData.map((item) => {
        const itemDetails = resolveFormulaItemReference(item, referenceMaps);
        const normalizedItemType = normalizeFormulaItemType(item, itemDetails);

        return {
          ...item,
          name: itemDetails?.name || 'Unknown',
          item_type: normalizedItemType,
          is_diluted: Boolean(item.dilution_percent && item.dilution_solvent_id) || itemDetails?.is_diluted || false,
          dilution_percentage: item.dilution_percent || itemDetails?.dilution_percentage || null,
          dilution_solvent_name: item.dilution_solvent_id ? referenceMaps.rawMaterialsMap.get(item.dilution_solvent_id)?.name || null : null,
        };
      });

      setItems(enrichedItems);
    } catch (error) {
      console.error('Failed to load formula items:', error);
    } finally {
      setLoading(false);
    }
  }, [formula?.id]);

  useEffect(() => {
    loadFormulaItems();
  }, [loadFormulaItems]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,246,239,0.98)_100%)] p-4">
        <p className="text-sm text-muted-foreground">Loading formula preview...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[24px] border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,246,239,0.98)_100%)] p-4">
        <p className="text-sm text-muted-foreground">No ingredients in this formula</p>
      </div>
    );
  }

  const totalGrams = calculateTotalAmount(items);
  const totalPercentage = items.reduce((sum, item) => sum + (item.percentage || 0), 0);

  return (
    <div className="space-y-4 rounded-[24px] border border-[#ddd3bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,246,239,0.98)_100%)] p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <div className="rounded-full border border-[#e5dcc7] bg-[#fcf8ef] px-3 py-1.5 text-xs font-semibold text-[#443822]">
          Rows {items.length}
        </div>
        <div className="rounded-full border border-[#d9def0] bg-[#f3f5fb] px-3 py-1.5 text-xs font-semibold text-[#26314e]">
          Total {formatGramAmount(totalGrams)}
        </div>
        <div className="rounded-full border border-[#dce6d1] bg-[#f3f8ee] px-3 py-1.5 text-xs font-semibold text-[#31451f]">
          Coverage {formatPercentage(totalPercentage)}
        </div>
      </div>

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Ingredient</TableHead>
              <TableHead className="min-w-[100px]">Type</TableHead>
              <TableHead className="text-right min-w-[110px]">Amount</TableHead>
              <TableHead className="text-right min-w-[110px]">Percentage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const isDiluted = item.is_diluted && item.dilution_percentage;
              const composition = isDiluted
                ? calculateDilutionComposition(item.grams || 0, item.dilution_percentage)
                : null;

              return (
                <React.Fragment key={index}>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="min-w-0">
                        <div>{item.name}</div>
                        {isDiluted ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.dilution_percentage}%{item.dilution_solvent_name ? ` in ${item.dilution_solvent_name}` : ''}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {formatStatus(item.item_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatGramAmount(item.grams)}</TableCell>
                    <TableCell className="text-right font-mono">{formatPercentage(item.percentage)}</TableCell>
                  </TableRow>
                  {isDiluted && composition ? (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={4} className="py-2 px-4">
                        <div className="text-xs text-muted-foreground">
                          Composition: {formatQuantity(composition.activeAmount)} g active + {formatQuantity(composition.solventAmount)} g solvent
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell colSpan={2}>Total</TableCell>
              <TableCell className="text-right font-mono">{formatGramAmount(totalGrams)}</TableCell>
              <TableCell className="text-right font-mono">{formatPercentage(totalPercentage)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default FormulaPreview;
