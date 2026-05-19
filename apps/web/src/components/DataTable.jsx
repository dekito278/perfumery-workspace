
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Pencil, Trash2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile.jsx';

const DataTable = ({
  columns,
  data,
  onEdit,
  onDelete,
  actions,
  emptyMessage = 'No items found',
  mobileCard,
  selectable = false,
  selectedRowIds = [],
  onToggleRow,
  onToggleAll,
  getRowId = (row) => row.id,
}) => {
  const isMobile = useIsMobile();
  const hasActions = Boolean(onEdit || onDelete || actions);
  const selectedIdSet = new Set(selectedRowIds);
  const selectableRows = data
    .map((row) => getRowId(row))
    .filter(Boolean);
  const selectedOnPageCount = selectableRows.filter((id) => selectedIdSet.has(id)).length;
  const allSelected = selectableRows.length > 0 && selectedOnPageCount === selectableRows.length;
  const partiallySelected = selectedOnPageCount > 0 && selectedOnPageCount < selectableRows.length;

  if (isMobile && mobileCard) {
    return (
      <div className="space-y-3">
        {data.length === 0 ? (
          <div className="mobile-card px-4 py-12 text-center text-sm font-medium text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          data.map((row, rowIndex) => (
            <div key={row.id || rowIndex}>
              {mobileCard(row)}
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="table-container">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected ? true : (partiallySelected ? 'indeterminate' : false)}
                  onCheckedChange={() => onToggleAll?.(data)}
                  aria-label="Select all rows"
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={`${column.align === 'right' ? 'text-right' : ''} py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground`}
              >
                {column.label}
              </TableHead>
            ))}
            {hasActions && (
              <TableHead className="table-action-head py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (hasActions ? 1 : 0)} className="py-12 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, rowIndex) => (
              <TableRow key={row.id || rowIndex}>
                {selectable && (
                  <TableCell className="w-12">
                    <Checkbox
                      checked={selectedIdSet.has(getRowId(row))}
                      onCheckedChange={() => onToggleRow?.(row)}
                      aria-label={`Select ${row.name || row.code || 'item'}`}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={`${column.align === 'right' ? 'text-right' : ''} align-top py-3 ${column.className || ''}`}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </TableCell>
                ))}
                {hasActions && (
                  <TableCell className="table-action-cell align-top py-3">
                    <div className="table-action-group">
                      {actions && actions(row)}
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(row)}
                          className="table-action-button"
                          title="Edit"
                          aria-label={`Edit ${row.name || row.code || 'item'}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(row)}
                          className="table-action-button text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete"
                          aria-label={`Delete ${row.name || row.code || 'item'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default DataTable;
