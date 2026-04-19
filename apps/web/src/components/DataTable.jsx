
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile.jsx';

const DataTable = ({ columns, data, onEdit, onDelete, actions, emptyMessage = 'No items found', mobileCard }) => {
  const isMobile = useIsMobile();

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
            {(onEdit || onDelete || actions) && (
              <TableHead className="text-right w-32">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center py-12 text-muted-foreground">
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
                {(onEdit || onDelete || actions) && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {actions && actions(row)}
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(row)}
                          className="h-8 w-8 p-0"
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
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
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
