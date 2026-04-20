
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatQuantity, formatDate } from '@/utils/formatting.js';
import { formatPrice } from '@/utils/pricingUtils.js';

const UsageHistoryTable = ({ usageRecords = [], isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!usageRecords || usageRecords.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No usage history found
      </div>
    );
  }

  const getTypeBadgeVariant = (type) => {
    switch (type) {
      case 'formula_ingredient':
        return 'default';
      case 'dilution_solvent':
        return 'secondary';
      case 'main_batch_solvent':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'formula_ingredient':
        return 'Formula Ingredient';
      case 'dilution_solvent':
        return 'Dilution Solvent';
      case 'main_batch_solvent':
        return 'Main Batch Solvent';
      default:
        return type;
    }
  };

  return (
    <div className="table-container">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[120px]">Batch code</TableHead>
            <TableHead className="text-right min-w-[120px]">Quantity deducted</TableHead>
            <TableHead className="min-w-[140px]">Type</TableHead>
            <TableHead className="min-w-[220px]">Used for</TableHead>
            <TableHead className="min-w-[100px]">Date</TableHead>
            <TableHead className="text-right min-w-[100px]">Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usageRecords.map((record) => (
            <TableRow key={record.id}>
              <TableCell className="font-mono text-sm">
                {record.expand?.batch_id?.batch_code || 'N/A'}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatQuantity(record.quantity_deducted)} {record.expand?.raw_material_id?.unit || 'ml'}
              </TableCell>
              <TableCell>
                <Badge variant={getTypeBadgeVariant(record.type)} className="text-xs">
                  {getTypeLabel(record.type)}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {record.source || 'Batch production'}
              </TableCell>
              <TableCell className="text-sm">
                {formatDate(record.created_at)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatPrice(record.cost)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default UsageHistoryTable;
