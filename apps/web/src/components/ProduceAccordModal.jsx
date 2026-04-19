
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Package } from 'lucide-react';
import { useAccords } from '@/hooks/useAccords.js';
import { getAccordItems } from '@/services/accordsSupabaseService.js';
import { blurNumberInputOnWheel } from '@/utils/numberInputs.js';
import { calculateDilutionComposition } from '@/utils/calculateDilutionCost.js';

const ProduceAccordModal = ({ open, onOpenChange, accord, onSuccess }) => {
  const { produceAccord, loading } = useAccords();
  const [quantity, setQuantity] = useState('');
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [requirements, setRequirements] = useState([]);
  const [loadingRequirements, setLoadingRequirements] = useState(false);

  useEffect(() => {
    if (open && accord) {
      loadRequirements();
      setQuantity('');
      setProductionDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [open, accord]);

  const loadRequirements = async () => {
    setLoadingRequirements(true);
    try {
      const items = await getAccordItems(accord.id);
      const reqs = items.flatMap((item) => {
        const material = item.expand?.raw_material_id;
        const baseRequirement = {
          material,
          percentage: item.percentage,
          currentStock: material?.stock_quantity || 0,
        };

        if (item.dilution_percent && item.dilution_solvent_id && item.expand?.dilution_solvent_id) {
          const composition = calculateDilutionComposition(item.percentage, item.dilution_percent);
          return [
            {
              ...baseRequirement,
              percentage: composition.activeAmount,
              displayPercentage: item.percentage,
              sourceLabel: `${item.dilution_percent}% active`,
            },
            {
              material: item.expand.dilution_solvent_id,
              percentage: composition.solventAmount,
              displayPercentage: item.percentage,
              currentStock: item.expand.dilution_solvent_id?.stock_quantity || 0,
              sourceLabel: `${item.dilution_percent}% solvent`,
            },
          ];
        }

        return [baseRequirement];
      });

      setRequirements(reqs);
    } catch (error) {
      toast.error('Failed to load material requirements');
    } finally {
      setLoadingRequirements(false);
    }
  };

  const calculatedRequirements = requirements.map(req => {
    const requiredQty = (req.percentage / 100) * (parseFloat(quantity) || 0);
    const hasSufficientStock = req.currentStock >= requiredQty;
    return {
      ...req,
      requiredQty,
      hasSufficientStock
    };
  });

  const hasInsufficientStock = calculatedRequirements.some(req => !req.hasSufficientStock);
  const canProduce = quantity && parseFloat(quantity) > 0 && !hasInsufficientStock;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!quantity || parseFloat(quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (hasInsufficientStock) {
      toast.error('Insufficient stock for one or more materials');
      return;
    }

    try {
      await produceAccord(accord.id, parseFloat(quantity), productionDate, notes);
      toast.success(`Successfully produced ${quantity} units of ${accord.name}`);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.message || 'Failed to produce accord');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Produce accord: {accord?.name}
          </DialogTitle>
          <DialogDescription>
            Review material requirements and confirm production quantity.
          </DialogDescription>
        </DialogHeader>

        {loadingRequirements ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="produce-quantity">Quantity to produce *</Label>
                  <Input
                    id="produce-quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onWheel={blurNumberInputOnWheel}
                    placeholder="0.00"
                    required
                    className="text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="produce-date">Production date *</Label>
                  <Input
                    id="produce-date"
                    type="date"
                    value={productionDate}
                    onChange={(e) => setProductionDate(e.target.value)}
                    required
                    className="text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="produce-notes">Notes</Label>
                <Textarea
                  id="produce-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Production notes..."
                  rows={2}
                  className="text-foreground"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Material requirements</Label>
              {calculatedRequirements.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No materials in recipe
                </div>
              ) : (
                <div className="space-y-2">
                  {calculatedRequirements.map((req, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        req.hasSufficientStock ? 'bg-card' : 'bg-destructive/10 border-destructive'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="font-medium">{req.material.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {req.sourceLabel ? `${req.sourceLabel} from ${req.displayPercentage}% of recipe` : `${req.percentage}% of recipe`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm">
                            Required: {req.requiredQty.toFixed(2)} {req.material.unit}
                          </div>
                          <div className="font-mono text-sm text-muted-foreground">
                            Available: {req.currentStock.toFixed(2)} {req.material.unit}
                          </div>
                        </div>
                        <div>
                          {req.hasSufficientStock ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasInsufficientStock && quantity && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-destructive font-medium">
                    Insufficient stock for one or more materials. Please reduce quantity or restock materials.
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !canProduce}>
                {loading ? 'Producing...' : 'Produce accord'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProduceAccordModal;
