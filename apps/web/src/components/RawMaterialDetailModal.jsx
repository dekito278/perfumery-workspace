
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, TrendingUp, Minus, TrendingDown } from 'lucide-react';
import { formatQuantity, formatCurrency, formatDate, formatPercentage } from '@/utils/formatting.js';

const RawMaterialDetailModal = ({ open, onOpenChange, material, onEdit, onDelete }) => {
  if (!material) return null;

  const isLowStock = material.low_stock_threshold 
    ? material.stock_quantity < material.low_stock_threshold
    : material.stock_quantity < material.minimum_stock;

  const getPyramidIcon = (placement) => {
    switch (placement) {
      case 'top':
        return <TrendingUp className="w-3.5 h-3.5 text-amber-600" />;
      case 'middle':
        return <Minus className="w-3.5 h-3.5 text-rose-600" />;
      case 'base':
        return <TrendingDown className="w-3.5 h-3.5 text-amber-800" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] max-h-[90vh] overflow-y-auto p-5">
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

        <div className="space-y-4 text-sm">
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

          {(material.scent_family || material.note_type) && (
            <div className="grid grid-cols-2 gap-3">
              {material.scent_family && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Scent family</p>
                  <p className="capitalize text-sm">{material.scent_family}</p>
                </div>
              )}
              {material.note_type && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Note type</p>
                  <p className="capitalize text-sm">{material.note_type}</p>
                </div>
              )}
            </div>
          )}

          {material.pyramid_placement && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pyramid placement</p>
              <div className="flex items-center gap-2">
                {getPyramidIcon(material.pyramid_placement)}
                <span className="capitalize text-sm font-medium">{material.pyramid_placement}</span>
              </div>
            </div>
          )}

          <div className="border-t pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Stock quantity</p>
                <p className={`font-mono font-medium text-sm ${isLowStock ? 'text-destructive' : ''}`}>
                  {formatQuantity(material.stock_quantity)} {material.unit}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Unit price</p>
                <p className="font-mono text-sm">{formatCurrency(material.cost_per_unit)} / 10 ml</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Minimum stock</p>
              <p className="font-mono text-sm">{formatQuantity(material.minimum_stock)} {material.unit}</p>
            </div>
            {material.low_stock_threshold && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Low stock threshold</p>
                <p className="font-mono text-sm">{formatQuantity(material.low_stock_threshold)} {material.unit}</p>
              </div>
            )}
          </div>

          {material.vendor && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Vendor</p>
              <p className="text-sm">{material.vendor}</p>
            </div>
          )}

          {material.ifra_limit !== null && material.ifra_limit !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">IFRA limit</p>
              <p className="text-sm">{formatPercentage(material.ifra_limit)}</p>
            </div>
          )}

          {material.default_dilution_percent && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Default dilution</p>
              <p className="text-sm">{formatPercentage(material.default_dilution_percent)}</p>
            </div>
          )}

          {material.dilution_info && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Dilution info</p>
              <p className="text-sm leading-relaxed">{material.dilution_info}</p>
            </div>
          )}

          {material.description && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Description</p>
              <p className="text-sm leading-relaxed">{material.description}</p>
            </div>
          )}

          {material.notes && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm leading-relaxed">{material.notes}</p>
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
      </DialogContent>
    </Dialog>
  );
};

export default RawMaterialDetailModal;
