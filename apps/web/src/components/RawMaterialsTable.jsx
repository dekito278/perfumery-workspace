
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, AlertTriangle, Eye, TrendingUp, Minus, TrendingDown } from 'lucide-react';
import { formatPricePerUnit } from '@/utils/pricingUtils.js';

const RawMaterialsTable = ({ materials, onEdit, onDelete, onView }) => {
  const isLowStock = (material) => material.stock_quantity < material.minimum_stock;

  const getPyramidIcon = (placement) => {
    switch (placement) {
      case 'top':
        return <TrendingUp className="w-3.5 h-3.5 text-amber-600" title="Top note" />;
      case 'middle':
        return <Minus className="w-3.5 h-3.5 text-rose-600" title="Middle note" />;
      case 'base':
        return <TrendingDown className="w-3.5 h-3.5 text-amber-800" title="Base note" />;
      default:
        return <span className="text-xs text-muted-foreground">—</span>;
    }
  };

  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[180px]">Name</TableHead>
            <TableHead className="min-w-[120px]">Category</TableHead>
            <TableHead className="min-w-[100px]">Vendor</TableHead>
            <TableHead className="min-w-[80px]">Pyramid</TableHead>
            <TableHead className="min-w-[100px]">Unit</TableHead>
            <TableHead className="text-right min-w-[140px]">Unit price</TableHead>
            <TableHead className="min-w-[100px]">Status</TableHead>
            <TableHead className="text-right min-w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                No materials found. Add your first material to get started.
              </TableCell>
            </TableRow>
          ) : (
            materials.map((material) => (
              <TableRow key={material.id} className={isLowStock(material) ? 'low-stock' : ''}>
                <TableCell className="font-medium text-sm">{material.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize text-xs">
                    {material.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {material.vendor || '—'}
                </TableCell>
                <TableCell className="text-center">
                  {getPyramidIcon(material.pyramid_placement)}
                </TableCell>
                <TableCell className="text-sm">{material.unit}</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatPricePerUnit(material.cost_per_unit)}</TableCell>
                <TableCell>
                  {isLowStock(material) ? (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <AlertTriangle className="w-3 h-3" />
                      Low stock
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">In stock</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(material)}
                      className="h-8 w-8 p-0"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(material)}
                      className="h-8 w-8 p-0"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(material)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default RawMaterialsTable;
