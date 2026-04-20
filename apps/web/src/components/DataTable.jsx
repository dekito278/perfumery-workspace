
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile.jsx';

const DataTable = ({ columns, data, onEdit, onDelete, actions, emptyMessage = 'No items found', mobileCard }) => {
  const isMobile = useIsMobile();
  const hasActions = Boolean(onEdit || onDelete || actions);

  if (isMobile && mobileCard) {
    return (
      <div className="space-y-3">
        {data.length === 0 ? (
          <div className="table-container px-4 py-12 text-center text-muted-foreground">
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
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={column.align === 'right' ? 'text-right' : ''}
              >
                {column.label}
              </TableHead>
            ))}
            {hasActions && (
              <TableHead className="table-action-head">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (hasActions ? 1 : 0)} className="text-center py-12 text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, rowIndex) => (
              <TableRow key={row.id || rowIndex}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={`${column.align === 'right' ? 'text-right' : ''} ${column.className || ''}`}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </TableCell>
                ))}
                {hasActions && (
                  <TableCell className="table-action-cell">
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
