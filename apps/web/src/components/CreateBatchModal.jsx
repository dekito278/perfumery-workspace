
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useBatches } from '@/hooks/useBatches.js';
import BatchProductionForm from '@/components/BatchProductionForm.jsx';

const CreateBatchModal = ({ open, onOpenChange, onSuccess, preSelectedFormulaId = null }) => {
  const { createBatch, loading } = useBatches();

  const handleSubmit = async (formData) => {
    try {
      await createBatch(formData);
      toast.success('Batch created successfully');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.message || 'Failed to create batch');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create new batch</DialogTitle>
          <DialogDescription>Set up a new production batch with solvent dilution for a formula.</DialogDescription>
        </DialogHeader>
        <BatchProductionForm
          preSelectedFormulaId={preSelectedFormulaId}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          loading={loading}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CreateBatchModal;
