
import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatGramAmount, formatPercentage, formatStatus, formatQuantity } from '@/utils/formatting.js';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { calculateDilutionComposition } from '@/utils/calculateDilutionCost.js';
import pb from '@/lib/pocketbaseClient';

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
      const itemsData = await pb.collection('formula_items').getFullList({
        filter: `formula_id = "${formula.id}"`,
        sort: 'created',
        $autoCancel: false
      });

      const enrichedItems = await Promise.all(itemsData.map(async (item) => {
        let itemDetails = null;
        if (item.item_type === 'raw_material' || item.item_type === 'solvent') {
          itemDetails = await pb.collection('raw_materials').getOne(item.item_id, { $autoCancel: false });
        } else if (item.item_type === 'accord') {
          itemDetails = await pb.collection('accords').getOne(item.item_id, { $autoCancel: false });
        }

        return {
          ...item,
          name: itemDetails?.name || 'Unknown',
          type: itemDetails?.type || item.item_type,
          is_diluted: itemDetails?.is_diluted || false,
          dilution_percentage: itemDetails?.dilution_percentage || null
        };
      }));

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
                        ({item.dilution_percentage}%)
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
                        Composition: {formatQuantity(composition.activeAmount)} ml active + {formatQuantity(composition.solventAmount)} ml solvent
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
