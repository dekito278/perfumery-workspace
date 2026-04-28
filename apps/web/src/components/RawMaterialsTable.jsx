import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Eye } from 'lucide-react';
import { formatPricePerUnit } from '@/utils/pricingUtils.js';
import { deriveScentFamilyFromCategory } from '@/utils/rawMaterialCategoryMeta.js';

const hasGuidance = (material) => Boolean(
  material.workbook_code
  || material.reference_abc_primary_family
  || material.reference_impact
  || material.reference_life_hours
);

const RawMaterialsTable = ({ materials, onEdit, onDelete, onView }) => (
  <div className="table-container">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[180px]">Name</TableHead>
          <TableHead className="min-w-[120px]">Category</TableHead>
          <TableHead className="min-w-[100px]">Vendor</TableHead>
          <TableHead className="min-w-[120px]">Family</TableHead>
          <TableHead className="min-w-[100px]">Unit</TableHead>
          <TableHead className="text-right min-w-[140px]">Unit price</TableHead>
          <TableHead className="min-w-[120px]">Guidance</TableHead>
          <TableHead className="table-action-head">Actions</TableHead>
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
            <TableRow key={material.id}>
              <TableCell className="font-medium text-sm">{material.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize text-xs">
                  {material.category}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{material.vendor || '-'}</TableCell>
              <TableCell className="text-sm">
                {material.scent_family || deriveScentFamilyFromCategory(material.category, '') || '-'}
              </TableCell>
              <TableCell className="text-sm">{material.unit}</TableCell>
              <TableCell className="text-right font-mono text-sm">{formatPricePerUnit(material.cost_per_unit, material.unit)}</TableCell>
              <TableCell>
                {hasGuidance(material) ? (
                  <Badge variant="secondary" className="text-xs">Guided</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">Needs guidance</Badge>
                )}
              </TableCell>
              <TableCell className="table-action-cell">
                <div className="table-action-group">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(material)}
                    className="table-action-button"
                    title="View details"
                    aria-label={`View details for ${material.name}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(material)}
                    className="table-action-button"
                    title="Edit"
                    aria-label={`Edit ${material.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(material)}
                    className="table-action-button text-destructive hover:text-destructive"
                    title="Delete"
                    aria-label={`Delete ${material.name}`}
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

export default RawMaterialsTable;
