
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFormulas } from '@/hooks/useFormulas.js';
import { checkFormulaRelations } from '@/utils/checkFormulaRelations.js';

const DeleteFormulaModal = ({ isOpen, onClose, formulaId, formulaName, onDeleteSuccess }) => {
  const { deleteFormula } = useFormulas();
  const [loading, setLoading] = useState(false);
  const [checkingRelations, setCheckingRelations] = useState(true);
  const [relationInfo, setRelationInfo] = useState({ hasRelations: false, relationType: null, relationCount: 0 });

  useEffect(() => {
    if (isOpen && formulaId) {
      checkRelations();
    }
  }, [isOpen, formulaId]);

  const checkRelations = async () => {
    setCheckingRelations(true);
    try {
      const result = await checkFormulaRelations(formulaId);
      setRelationInfo(result);
    } catch (error) {
      console.error('Error checking formula relations:', error);
      setRelationInfo({ hasRelations: false, relationType: null, relationCount: 0 });
    } finally {
      setCheckingRelations(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteFormula(formulaId);
      toast.success('Formula deleted successfully');
      onDeleteSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to delete formula. Please try again.');
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
          {formulaName && (
            <DialogDescription className="text-sm">
              Formula: {formulaName}
            </DialogDescription>
          )}
        </DialogHeader>

        {checkingRelations ? (
          <div className="py-8 flex items-center justify-center">
            <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : relationInfo.hasRelations ? (
          <>
            <Alert variant="destructive" className="my-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                This formula is used by {relationInfo.relationCount} {relationInfo.relationType}. 
                You must delete or reassign those {relationInfo.relationType} before you can delete this formula.
              </AlertDescription>
            </Alert>
            <DialogFooter className="gap-2">
              <Button onClick={onClose} variant="outline" size="sm">
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="py-4">
              <p className="text-muted-foreground text-sm">
                Are you sure you want to delete this formula? This action cannot be undone.
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DeleteFormulaModal;
