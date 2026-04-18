
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useBatches } from '@/hooks/useBatches.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import { calculateBatchComposition, calculateBatchCost, completeBatch } from '@/services/batchesService.js';
import { formatCurrency, formatQuantity } from '@/utils/formatting.js';
import pb from '@/lib/pocketbaseClient';

const MaterialRequirementsModal = ({ open, onOpenChange, batch, onSuccess }) => {
  const { getFormulaItems } = useFormulaItems();
  const [expandedComposition, setExpandedComposition] = useState([]);
  const [costBreakdown, setCostBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);
  const [producing, setProducing] = useState(false);
  const [formula, setFormula] = useState(null);
  const [solvent, setSolvent] = useState(null);

  useEffect(() => {
    if (open && batch) {
      loadRequirements();
    }
  }, [open, batch]);

  const loadRequirements = async () => {
    setLoading(true);
    try {
      const formulaData = await pb.collection('formulas').getOne(batch.formula_id, { $autoCancel: false });
      setFormula(formulaData);

      let solventData = null;
      if (batch.solvent_id) {
        solventData = await pb.collection('raw_materials').getOne(batch.solvent_id, { $autoCancel: false });
        setSolvent(solventData);
      }

      const items = await getFormulaItems(batch.formula_id);

      // Calculate expanded composition (includes dilution expansion)
      const composition = await calculateBatchComposition(batch, items, solventData);
      setExpandedComposition(composition);

      // Calculate cost breakdown
      const costs = calculateBatchCost(composition, batch.target_quantity);
      setCostBreakdown(costs);

    } catch (error) {
      console.error('Failed to load material requirements:', error);
      toast.error('Failed to load material requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleProduce = async () => {
    setProducing(true);
    try {
      await completeBatch(batch.id, expandedComposition);
      toast.success('Batch produced successfully. Stock has been deducted.');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.message || 'Failed to produce batch');
    } finally {
      setProducing(false);
    }
  };

  // Group composition by type
  const formulaIngredients = expandedComposition.filter(item => item.type === 'formula_ingredient');
  const dilutionSolvents = expandedComposition.filter(item => item.type === 'dilution_solvent');
  const mainBatchSolvents = expandedComposition.filter(item => item.type === 'main_batch_solvent');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Material requirements</DialogTitle>
          <DialogDescription>
            Review expanded material requirements for batch {batch?.batch_code}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Formula</div>
                  <div className="font-semibold">{formula?.name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Target quantity</div>
                  <div className="font-semibold">{batch?.target_quantity} {batch?.unit}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Required qty</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Cost per unit</TableHead>
                    <TableHead className="text-right">Total cost</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Formula Ingredients Group */}
                  {formulaIngredients.length > 0 && (
                    <>
                      <TableRow className="bg-primary/5">
                        <TableCell colSpan={7} className="font-semibold text-sm">
                          Formula Ingredients
                        </TableCell>
                      </TableRow>
                      {formulaIngredients.map((item, index) => (
                        <TableRow key={`ingredient-${index}`}>
                          <TableCell className="font-medium text-sm">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              Active Material
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatQuantity(item.required_quantity)}
                          </TableCell>
                          <TableCell className="text-right text-sm">{item.unit}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatCurrency(item.cost_per_unit)}/10ml
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(item.total_cost)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.source}</TableCell>
                        </TableRow>
                      ))}
                      {costBreakdown && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={5} className="text-sm font-medium">Subtotal</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">
                            {formatCurrency(costBreakdown.formula_ingredient_cost)}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )}
                    </>
                  )}

                  {/* Dilution Solvents Group */}
                  {dilutionSolvents.length > 0 && (
                    <>
                      <TableRow className="bg-accent/5">
                        <TableCell colSpan={7} className="font-semibold text-sm">
                          Dilution Solvents (inside ingredients)
                        </TableCell>
                      </TableRow>
                      {dilutionSolvents.map((item, index) => (
                        <TableRow key={`dilution-${index}`}>
                          <TableCell className="font-medium text-sm">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              Dilution Solvent
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatQuantity(item.required_quantity)}
                          </TableCell>
                          <TableCell className="text-right text-sm">{item.unit}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatCurrency(item.cost_per_unit)}/10ml
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(item.total_cost)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.source}</TableCell>
                        </TableRow>
                      ))}
                      {costBreakdown && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={5} className="text-sm font-medium">Subtotal</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">
                            {formatCurrency(costBreakdown.dilution_solvent_cost)}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )}
                    </>
                  )}

                  {/* Main Batch Solvent Group */}
                  {mainBatchSolvents.length > 0 && (
                    <>
                      <TableRow className="bg-secondary/5">
                        <TableCell colSpan={7} className="font-semibold text-sm">
                          Main Batch Solvent
                        </TableCell>
                      </TableRow>
                      {mainBatchSolvents.map((item, index) => (
                        <TableRow key={`solvent-${index}`}>
                          <TableCell className="font-medium text-sm">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              Batch Solvent
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatQuantity(item.required_quantity)}
                          </TableCell>
                          <TableCell className="text-right text-sm">{item.unit}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatCurrency(item.cost_per_unit)}/{item.unit}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(item.total_cost)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.source}</TableCell>
                        </TableRow>
                      ))}
                      {costBreakdown && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={5} className="text-sm font-medium">Subtotal</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">
                            {formatCurrency(costBreakdown.main_batch_solvent_cost)}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )}
                    </>
                  )}

                  {/* Grand Total */}
                  {costBreakdown && (
                    <TableRow className="font-semibold bg-primary/10">
                      <TableCell colSpan={5} className="text-sm">Grand Total</TableCell>
                      <TableCell className="text-right font-mono text-sm text-primary">
                        {formatCurrency(costBreakdown.total_cost)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">
              Diluted materials are expanded into active material + dilution solvent components. All costs are calculated based on actual material usage.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleProduce}
            disabled={loading || producing}
          >
            {producing ? 'Producing...' : 'Produce batch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialRequirementsModal;
