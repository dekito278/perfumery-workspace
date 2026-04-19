
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { formatQuantity, formatDate, formatPercentage } from '@/utils/formatting.js';
import { formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';
import UsageHistoryTable from '@/components/UsageHistoryTable.jsx';
import { getRawMaterialUsageHistory } from '@/services/rawMaterialsService.js';
import { deriveScentFamilyFromCategory } from '@/utils/rawMaterialCategoryMeta.js';

const RawMaterialDetailModal = ({ open, onOpenChange, material, onEdit, onDelete }) => {
  const [usageRecords, setUsageRecords] = useState([]);
  const [usageLoading, setUsageLoading] = useState(false);

  useEffect(() => {
    if (!open || !material?.id) {
      return;
    }

    const loadUsageHistory = async () => {
      setUsageLoading(true);
      try {
        const records = await getRawMaterialUsageHistory(material.id);
        setUsageRecords(records);
      } catch (error) {
        console.error('Failed to load usage history:', error);
        setUsageRecords([]);
      } finally {
        setUsageLoading(false);
      }
    };

    loadUsageHistory();
  }, [open, material?.id]);

  const usageSummary = {
    count: usageRecords.length,
    totalQuantityUsed: usageRecords.reduce((sum, record) => sum + Number(record.quantity_deducted || 0), 0),
    totalUsageCost: usageRecords.reduce((sum, record) => sum + Number(record.cost || 0), 0),
  };

  if (!material) return null;

  const isLowStock = material.low_stock_threshold 
    ? material.stock_quantity < material.low_stock_threshold
    : material.stock_quantity < material.minimum_stock;
  const scentFamily = material.scent_family || deriveScentFamilyFromCategory(material.category, '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-5">
        <DialogHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-lg font-semibold pr-8">{material.name}</DialogTitle>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onEdit(material);
                  onOpenChange(false);
                }}
                className="h-8 w-8 p-0"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onDelete(material);
                  onOpenChange(false);
                }}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          {isLowStock && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Low stock alert</p>
                  <p className="text-xs text-muted-foreground">Current stock is already below the alert threshold.</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Category</p>
                  <Badge variant="outline" className="capitalize text-xs">
                    {material.category}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Type</p>
                  <p className="capitalize text-sm">{material.type}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Vendor</p>
                  <p className="text-sm">{material.vendor || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">CAS number</p>
                  <p className="text-sm">{material.cas_number || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Workbook code</p>
                  <p className="text-sm font-mono">{material.workbook_code || '-'}</p>
                </div>
                <div />
              </div>

              {scentFamily && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Family</p>
                  <p className="text-sm">{scentFamily}</p>
                </div>
              )}

              {material.ifra_limit !== null && material.ifra_limit !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">IFRA limit</p>
                  <p className="text-sm">{formatPercentage(material.ifra_limit)}</p>
                </div>
              )}

              {material.notes && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{material.notes}</p>
                </div>
              )}

              <div className="border-t pt-3 flex gap-4 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium">Created:</span> {formatDate(material.created)}
                </div>
                <div>
                  <span className="font-medium">Updated:</span> {formatDate(material.updated)}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Stock quantity</p>
                <p className={`font-mono text-xl font-semibold ${isLowStock ? 'text-destructive' : ''}`}>
                  {formatQuantity(material.stock_quantity)} {material.unit}
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Unit price</p>
                <p className="font-mono text-lg font-semibold">{formatPricePerUnit(material.cost_per_unit, material.unit)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Minimum stock</p>
                  <p className="font-mono text-sm">{formatQuantity(material.minimum_stock)} {material.unit}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Alert threshold</p>
                  <p className="font-mono text-sm">
                    {material.low_stock_threshold
                      ? `${formatQuantity(material.low_stock_threshold)} ${material.unit}`
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Usage records</p>
                  <p className="text-lg font-semibold">{usageSummary.count}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total used</p>
                  <p className="font-mono text-lg font-semibold">
                    {formatQuantity(usageSummary.totalQuantityUsed)} {material.unit}
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Usage cost</p>
                  <p className="font-mono text-lg font-semibold">{formatPrice(usageSummary.totalUsageCost)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="mb-3">
              <p className="text-sm font-semibold">Usage history</p>
              <p className="text-xs text-muted-foreground">
                Track how this material has been reduced across completed batches.
              </p>
            </div>
            <UsageHistoryTable usageRecords={usageRecords} isLoading={usageLoading} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RawMaterialDetailModal;
