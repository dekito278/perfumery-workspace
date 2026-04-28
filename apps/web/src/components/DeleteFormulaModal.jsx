import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFormulas } from '@/hooks/useFormulas.js';

const DeleteFormulaModal = ({ isOpen, onClose, formulaId, formulaName, onDeleteSuccess }) => {
  const { deleteFormula } = useFormulas();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteFormula(formulaId);
      toast.success('Formula deleted successfully');
      onDeleteSuccess();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to delete formula. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Trash2 className="w-5 h-5 text-destructive" />
            Delete formula
          </DialogTitle>
          <DialogDescription className="text-sm">
            {formulaName
              ? `Formula: ${formulaName}`
              : 'This will permanently remove the selected formula.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <p className="text-muted-foreground text-sm">
            This action cannot be undone. Remove the formula only if you no longer need its composition, workbook guidance, and performance notes.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button onClick={onClose} variant="outline" disabled={loading} size="sm">
            Cancel
          </Button>
          <Button onClick={handleDelete} variant="destructive" disabled={loading} size="sm">
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteFormulaModal;
