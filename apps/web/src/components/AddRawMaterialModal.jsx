import React from 'react';
import { toast } from 'sonner';
import RawMaterialFormDialog from '@/components/RawMaterialFormDialog.jsx';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useRawMaterialForm } from '@/hooks/useRawMaterialForm.js';
import { formatName } from '@/utils/formatting.js';

const AddRawMaterialModal = ({ open, onOpenChange, onSuccess }) => {
  const { addMaterial, loading } = useRawMaterials();
  const form = useRawMaterialForm({ open });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.validateForm()) {
      toast.error('Please fix all errors before submitting');
      return;
    }

    try {
      const result = await addMaterial({
        ...form.buildSubmitPayload(),
        name: formatName(form.formData.name),
      });

      // Nothing was created in the matched case — keep the dialog open and say so plainly, instead of
      // closing on a toast.info that reads like success (audit round 8).
      if (result?._creationResolution?.action === 'matched_existing') {
        toast.warning(`${result._creationResolution.message} Material baru TIDAK dibuat — ubah nama atau workbook code kalau ini memang material berbeda.`);
        onSuccess?.();
        return;
      }

      toast.success('Material added successfully');
      form.resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error.message || 'Failed to add material');
    }
  };

  return (
    <RawMaterialFormDialog
      mode="create"
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      form={form}
      onSubmit={handleSubmit}
    />
  );
};

export default AddRawMaterialModal;
