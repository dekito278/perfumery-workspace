
import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatGramAmount, formatPercentage, formatStatus, formatQuantity } from '@/utils/formatting.js';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { calculateDilutionComposition } from '@/utils/calculateDilutionCost.js';
import { buildFormulaItemReferenceMaps, resolveFormulaItemReference } from '@/utils/legacyFormulaItemSources.js';
import { getFormulaItems } from '@/services/formulasSupabaseService.js';
import { getRawMaterials } from '@/services/rawMaterialsService.js';

const FormulaPreview = ({ formula }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (formula?.id) {
      loadFormulaItems();
    }
  }, [formula]);

  const loadFormulaItems = async () => {
    setLoading(true);
    try {
      const itemsData = await getFormulaItems(formula.id);
      const rawMaterials = await getRawMaterials();
      const referenceMaps = await buildFormulaItemReferenceMaps(itemsData, rawMaterials);

      const enrichedItems = itemsData.map((item) => {
        const itemDetails = resolveFormulaItemReference(item, referenceMaps);

        return {
          ...item,
          name: itemDetails?.name || 'Unknown',
          type: itemDetails?.type || itemDetails?.item_type || 'raw_material',
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
  };

  if (loading) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg border">
        <p className="text-sm text-muted-foreground">Loading formula preview...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg border">
        <p className="text-sm text-muted-foreground">No ingredients in this formula</p>
      </div>
    );
  }

  const totalGrams = calculateTotalAmount(items);
  const totalPercentage = items.reduce((sum, item) => sum + (item.percentage || 0), 0);

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ingredient</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Percentage</TableHead>
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
                    {item.name}
                    {isDiluted && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({item.dilution_percentage}%{item.dilution_solvent_name ? ` in ${item.dilution_solvent_name}` : ''})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {formatStatus(item.item_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatGramAmount(item.grams)}</TableCell>
                  <TableCell className="text-right font-mono">{formatPercentage(item.percentage)}</TableCell>
                </TableRow>
                {isDiluted && composition && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={4} className="py-2 px-4">
                      <div className="text-xs text-muted-foreground">
                        Composition: {formatQuantity(composition.activeAmount)} g active + {formatQuantity(composition.solventAmount)} g solvent
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
          <TableRow className="font-semibold bg-muted/50">
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right font-mono">{formatGramAmount(totalGrams)}</TableCell>
            <TableCell className="text-right font-mono">{formatPercentage(totalPercentage)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default FormulaPreview;
