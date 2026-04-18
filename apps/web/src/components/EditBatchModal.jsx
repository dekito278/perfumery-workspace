
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useBatches } from '@/hooks/useBatches.js';
import BatchProductionForm from '@/components/BatchProductionForm.jsx';
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import { getBatchById } from '@/services/batchesSupabaseService.js';

const EditBatchModal = ({ open, onOpenChange, batch, onSuccess }) => {
  const { updateBatch, completeBatch, loading } = useBatches();
  const [batchData, setBatchData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (open && batch) {
      loadBatchData();
    }
  }, [open, batch]);

  const loadBatchData = async () => {
    setLoadingData(true);
    try {
      const fullBatch = await getBatchById(batch.id);
      setBatchData(fullBatch);
    } catch (error) {
      toast.error('Failed to load batch data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (formData) => {
    // Check if status is being changed to 'completed'
    if (formData.status === 'completed' && batchData.status !== 'completed') {
      // Show confirmation dialog
      setPendingFormData(formData);
      setCompleteDialogOpen(true);
      return;
    }

    // For other status changes or updates, proceed normally
    try {
      await updateBatch(batch.id, formData);
      toast.success('Batch updated successfully');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.message || 'Failed to update batch');
    }
  };

  const handleCompleteConfirm = async () => {
    setCompleting(true);
    try {
      const result = await completeBatch(batch.id);
      
      toast.success(result.message || 'Batch completed successfully. Raw material stock has been updated.');
      setCompleteDialogOpen(false);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.message || 'Failed to complete batch');
    } finally {
      setCompleting(false);
    }
  };

  const formulaName = batchData?.expand?.formula_id?.name || 'Unknown formula';
  const solventName = batchData?.expand?.solvent_id?.name || 'Unknown solvent';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit batch</DialogTitle>
            <DialogDescription>Update batch details including solvent and dilution settings (draft batches only).</DialogDescription>
          </DialogHeader>
          {loadingData ? (
            <div className="space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : batchData ? (
            <BatchProductionForm
              initialData={batchData}
              onSubmit={handleSubmit}
              onCancel={() => onOpenChange(false)}
              loading={loading}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        onConfirm={handleCompleteConfirm}
        title="Mark batch as completed"
        description={`Mark this batch as completed? Raw material stock will be deducted for ${formulaName} and ${solventName}.`}
        confirmText={completing ? 'Completing...' : 'Complete batch'}
      />
    </>
  );
};

export default EditBatchModal;
